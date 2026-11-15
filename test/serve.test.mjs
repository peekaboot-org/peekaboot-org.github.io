import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { after, before, test } from 'node:test';
import { SITE_ROOT } from './site.mjs';

// Answers `docker info` and prints every other call, so a run starts no container.
const DOCKER_STUB = `#!/bin/sh
[ "$1" = info ] && exit 0
echo "docker $*"
`;

let stubDirectory;

before(() => {
    stubDirectory = mkdtempSync(join(tmpdir(), 'serve-test-'));
    writeFileSync(join(stubDirectory, 'docker'), DOCKER_STUB, {mode: 0o755});
});

after(() => {
    rmSync(stubDirectory, {recursive: true});
});

function serve(args, overrides = {}) {
    const {PORT, BIND, ...inherited} = process.env;
    const env = {...inherited, ...overrides, PATH: stubDirectory + delimiter + process.env.PATH};
    const run = spawnSync('bash', ['serve.sh', ...args], {cwd: SITE_ROOT, env, encoding: 'utf8'});
    assert.equal(run.stderr, '');
    assert.equal(run.status, 0);
    return run.stdout;
}

test('serve.sh publishes its ports on loopback', () => {
    const stdout = serve([]);

    assert.ok(stdout.includes('-p 127.0.0.1:4000:4000'), stdout);
    assert.ok(stdout.includes('-p 127.0.0.1:35729:35729'), stdout);
});

test('BIND opens the preview to other machines', () => {
    const stdout = serve([], {BIND: '0.0.0.0'});

    assert.ok(stdout.includes('-p 0.0.0.0:4000:4000'), stdout);
    assert.ok(stdout.includes('-p 0.0.0.0:35729:35729'), stdout);
});

test('serve.sh --help lists BIND and every line of the header', () => {
    const stdout = serve(['--help']);

    assert.ok(stdout.includes('BIND=0.0.0.0 ./serve.sh  let other machines reach the preview'), stdout);
    assert.ok(stdout.endsWith('ends up owned by root.\n'), stdout);
});
