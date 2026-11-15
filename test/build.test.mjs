import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { BUILT, SITE_ROOT, builtPages, html } from './site.mjs';

test('built pages carry no unrendered Liquid or kramdown attribute', () => {
    const unrendered = /\{\{|\{%|\{:\s*#|\{#[a-z-]+\}/;
    const leaking = builtPages().filter((urlPath) => unrendered.test(html(urlPath)));

    assert.deepEqual(leaking, []);
});

// The product's release.yml rewrites the line starting "peekaboot_version: " with sed.
test('_config.yml keeps the version line the release job rewrites', () => {
    const versionLines = readFileSync(join(SITE_ROOT, '_config.yml'), 'utf8')
        .split('\n')
        .filter((line) => /^peekaboot_version: \d+\.\d+\.\d+$/.test(line));

    assert.equal(versionLines.length, 1);
});

test('only the site is published', () => {
    const published = ['test', 'README.md', 'serve.sh', 'Gemfile']
        .filter((name) => existsSync(join(BUILT, name)));

    assert.deepEqual(published, []);
});
