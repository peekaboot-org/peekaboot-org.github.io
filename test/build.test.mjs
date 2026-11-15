import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { BUILT, SITE_ROOT, builtPages, html, text } from './site.mjs';

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

test('the landing page, quick start and traces say a local run writes traces to disk', () => {
    const stated = ['/.peekaboot', 'unmasked', 'peekaboot.storage.traces.enabled'];
    const wrong = ['/', '/docs/quick-start/', '/docs/traces/'].flatMap((urlPath) => {
        const pageText = text(urlPath);
        const missing = stated.filter((phrase) => !pageText.includes(phrase));
        const memoryOnly = pageText.includes('held in memory') ? ['says "held in memory"'] : [];
        return [...missing.map((phrase) => `lacks "${phrase}"`), ...memoryOnly]
            .map((defect) => `${urlPath} ${defect}`);
    });

    assert.deepEqual(wrong, []);
});
