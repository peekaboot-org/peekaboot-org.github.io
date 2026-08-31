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

build_only=false
case "${1:-}" in
    --build) build_only=true ;;
    -h|--help) sed -n '3,12p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'; exit 0 ;;
    "") ;;
    *) echo "unknown argument: $1 (try --help)" >&2; exit 2 ;;
esac

if ! docker info >/dev/null 2>&1; then
    echo "Docker isn't running (or isn't reachable) — this script needs it." >&2
    exit 1
fi

# Running the container as root (as the raw docker commands in the README once did)
# leaves root-owned files in the generated directories, which a later non-root run
# then can't write to — and which you can't delete without sudo either. Repair it
# from inside a container, since that's the only place we have root.
reclaim_generated_dirs() {
    local stray
    stray=$(find _site vendor .jekyll-cache -not -user "$(id -un)" -print -quit 2>/dev/null || true)
    [ -n "$stray" ] || return 0

    echo "Found root-owned files in the generated directories, left by an earlier"
    echo "container run. Taking ownership of them so this run can write..."
    docker run --rm -v "$ROOT":/srv/jekyll -w /srv/jekyll "$IMAGE" \
        sh -c "chown -R $(id -u):$(id -g) _site vendor .jekyll-cache 2>/dev/null; true"
    echo
}

# RubyGems marks a compiled extension done by dropping an empty gem.build_complete
# beside the object it built. It trusts that marker alone: a directory holding the marker
# but no compiled object counts as built, so `bundle install` skips the gem and Jekyll
# then dies loading a .so that was never produced — with an error naming the gem rather
# than the half-built tree, which is what makes it hard to place. Bundler recovers on its
# own when an extension directory is missing outright (it falls back to the default gem
# and rebuilds), but not from this state. Interrupted installs and partial copies between
# machines both produce it; this checkout has extension trees for two architectures, so it
# is copied between machines.
#
# Dropping the directory is enough — bundler rebuilds what it can no longer find. Looking
# for *.so is correct on every host: the build always happens inside the Linux container,
# whatever this machine is.
rebuild_half_built_extensions() {
    local marker dir repaired=false

    while IFS= read -r marker; do
        dir=$(dirname "$marker")
        [ -z "$(find "$dir" -name "*.so" -print -quit)" ] || continue

        if [ "$repaired" = false ]; then
            echo "Found half-built native extensions — a build marker with nothing built"
            echo "beside it. Removing them so bundler rebuilds:"
            repaired=true
        fi
        echo "  $(basename "$dir")"
        rm -rf "$dir"
    done < <(find vendor/bundle -name gem.build_complete 2>/dev/null || true)

    [ "$repaired" = false ] || echo
}

cd "$ROOT"
reclaim_generated_dirs
rebuild_half_built_extensions

# Gems install into vendor/bundle inside the repo (gitignored), so the first run
# takes a minute and later ones start in seconds.
readonly SETUP='bundle config set --local path vendor/bundle \
    && bundle install --quiet'

if [ "$build_only" = true ]; then
    echo "Building into _site/ ..."
    docker run --rm \
        --user "$(id -u):$(id -g)" \
        -e HOME=/tmp \
        -v "$ROOT":/srv/jekyll -w /srv/jekyll \
        "$IMAGE" sh -c "$SETUP && bundle exec jekyll build --trace"
    echo
    echo "Built. Open _site/index.html, or run ./serve.sh to browse it."
    exit 0
fi

echo "Starting Jekyll on http://localhost:${PORT} — Ctrl-C to stop."
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
exec docker run --rm "${tty_flags[@]}" --init \
    --user "$(id -u):$(id -g)" \
    -e HOME=/tmp \
    -v "$ROOT":/srv/jekyll -w /srv/jekyll \
    -p "${PORT}:${PORT}" -p "${LIVERELOAD_PORT}:${LIVERELOAD_PORT}" \
    "$IMAGE" sh -c "$SETUP && bundle exec jekyll serve \
        --host 0.0.0.0 --port ${PORT} --livereload --force_polling --trace"
