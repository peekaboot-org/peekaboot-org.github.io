#!/usr/bin/env bash
#
# Build the site and serve it on localhost, using the same toolchain GitHub Pages
# uses (the `github-pages` gem) so what you see is what Pages will publish.
#
#   ./serve.sh            build and serve at http://localhost:4000, rebuilding on edit
#   ./serve.sh --build    build into _site and exit, no server
#   PORT=8080 ./serve.sh  serve on a different port
#
# Everything runs inside Docker, so no Ruby, Bundler or Node is needed on this
# machine. The container runs as the invoking user, so nothing it writes into
# vendor/ or _site/ ends up owned by root.

set -euo pipefail

readonly IMAGE="ruby:3.3"          # verified to resolve and build the github-pages gem
readonly PORT="${PORT:-4000}"
readonly LIVERELOAD_PORT=35729
readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly -a SITE_MOUNT=(-v "$ROOT":/srv/jekyll -w /srv/jekyll)
readonly -a JEKYLL_RUN=(docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp "${SITE_MOUNT[@]}")

build_only=false
case "${1:-}" in
    --build) build_only=true ;;
    -h|--help) sed -n '3,12p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'; exit 0 ;;
    "") ;;
    *) echo "unknown argument: $1 (try --help)" >&2; exit 2 ;;
esac

if ! docker info >/dev/null 2>&1; then
    echo "Docker isn't running or isn't reachable. This script needs it." >&2
    exit 1
fi

# A container run as root leaves files in the generated directories that a non-root run
# can't write and you can't delete without sudo. Only a container has root to repair them.
reclaim_generated_dirs() {
    local stray
    stray=$(find _site vendor .jekyll-cache -not -user "$(id -un)" -print -quit 2>/dev/null || true)
    [ -n "$stray" ] || return 0

    echo "Found root-owned files in the generated directories, left by an earlier"
    echo "container run. Taking ownership of them so this run can write..."
    docker run --rm "${SITE_MOUNT[@]}" "$IMAGE" \
        sh -c "chown -R $(id -u):$(id -g) _site vendor .jekyll-cache 2>/dev/null; true"
    echo
}

# Bundler trusts a gem.build_complete marker alone, so an interrupted install or a partial
# copy between machines leaves a marker with no .so, and Jekyll dies loading it. Dropping the
# directory makes bundler rebuild it. The build runs in a Linux container, so *.so is right
# on every host.
rebuild_half_built_extensions() {
    local marker dir repaired=false

    while IFS= read -r marker; do
        dir=$(dirname "$marker")
        [ -z "$(find "$dir" -name "*.so" -print -quit)" ] || continue

        if [ "$repaired" = false ]; then
            echo "Found half-built native extensions, a build marker with nothing built"
            echo "beside it. Removing them so bundler rebuilds:"
            repaired=true
        fi
        echo "  $(basename "$dir")"
        rm -rf "$dir"
    done < <(find vendor/bundle -name gem.build_complete 2>/dev/null || true)

    [ "$repaired" = false ] || echo
}

# A copy from another machine can bring a .so built for the other architecture, which Ruby
# reports as "cannot open shared object file" although the file is there. The host can't tell
# which tree the container needs, so with more than one, drop them all and every .so copied
# out of them, and let bundler rebuild.
rebuild_foreign_architecture_extensions() {
    local trees
    trees=$(find vendor/bundle -type d -path "*/extensions/*" -mindepth 4 -maxdepth 4 2>/dev/null || true)
    [ "$(echo "$trees" | grep -c .)" -gt 1 ] || return 0

    echo "Found native extensions built for more than one architecture. This checkout"
    echo "has been copied between machines. Removing them so bundler rebuilds for this one:"
    echo "$trees" | sed 's/^/  /'
    echo "$trees" | while IFS= read -r tree; do rm -rf "$tree"; done
    find vendor/bundle -name "*.so" -delete 2>/dev/null || true
    echo
}

cd "$ROOT"
reclaim_generated_dirs
rebuild_half_built_extensions
rebuild_foreign_architecture_extensions

# Gems install into vendor/bundle inside the repo (gitignored), so the first run
# takes a minute and later ones start in seconds.
readonly SETUP='bundle config set --local path vendor/bundle \
    && bundle install --quiet'

if [ "$build_only" = true ]; then
    echo "Building into _site/ ..."
    "${JEKYLL_RUN[@]}" "$IMAGE" sh -c "$SETUP && bundle exec jekyll build --trace"
    echo
    echo "Built. Open _site/index.html, or run ./serve.sh to browse it."
    exit 0
fi

echo "Starting Jekyll on http://localhost:${PORT}. Press Ctrl-C to stop."
echo "Edits to any page rebuild automatically; the browser reloads itself."
echo

# Allocate a TTY only when there is one, so Ctrl-C works from a terminal without
# breaking non-interactive use (CI, or piping the output to a file).
tty_flags=()
if [ -t 0 ] && [ -t 1 ]; then
    tty_flags=(-it)
fi

# --force_polling: inotify doesn't propagate from a bind mount into the container
# on every platform, so Jekyll would miss edits without it.
exec "${JEKYLL_RUN[@]}" "${tty_flags[@]}" --init \
    -p "${PORT}:${PORT}" -p "${LIVERELOAD_PORT}:${LIVERELOAD_PORT}" \
    "$IMAGE" sh -c "$SETUP && bundle exec jekyll serve \
        --host 0.0.0.0 --port ${PORT} --livereload --force_polling --trace"
