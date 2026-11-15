import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { BUILT, SITE_ROOT, builtPages, html, text } from './site.mjs';

const SITE_URL = 'https://www.peekaboot.org';

function builtText(name) {
    return readFileSync(join(BUILT, name), 'utf8');
}

// A page's own content, without the navbar and the footer every page carries.
function mainContent(urlPath) {
    return /<main\b[^>]*>([\s\S]*)<\/main>/.exec(html(urlPath))?.[1] ?? '';
}

// A feature block of the landing page, from below its heading to the next heading.
function landingBlock(heading) {
    const block = new RegExp(`<h2[^>]*>${heading}</h2>([\\s\\S]*?)(?=<h2|</section>)`);
    const markup = block.exec(html('/'))?.[1] ?? '';
    return {markup, text: markup.replace(/<[^>]+>/g, '')};
}

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

test('the landing page presents the HTTP API', () => {
    const api = landingBlock('HTTP API for agents and scripts');
    const dashboard = landingBlock('Dashboard');
    const missing = [
        ...['/peekaboot/api', 'OpenAPI']
            .filter((phrase) => !api.text.includes(phrase))
            .map((phrase) => `"${phrase}" in the API block`),
        ...['/docs/api/', '/docs/agents/', '/llms.txt']
            .filter((href) => !api.markup.includes(`href="${href}"`))
            .map((href) => `a link to ${href} in the API block`),
        ...['Lifecycle', 'Meters']
            .filter((tab) => !dashboard.text.includes(tab))
            .map((tab) => `"${tab}" in the Dashboard block`),
    ];

    assert.deepEqual(missing, []);
});

test('the API page and llms.txt say what only the API serves', () => {
    const unread = /do not read[^.]*\./.exec(text('/docs/api/'))?.[0] ?? '';
    const description = /<meta name="description" content="([^"]*)">/.exec(html('/docs/api/'))[1];
    const llms = builtText('llms.txt');
    const wrong = [
        ...['index', 'OpenAPI document', 'log search', 'routes', 'error digest']
            .filter((endpoint) => !unread.includes(endpoint))
            .map((endpoint) => `/docs/api/ does not say the dashboard skips the ${endpoint}`),
        ...(description.includes('that the dashboard and the dev toolbar read')
            ? ['the description of /docs/api/ says the dashboard reads every endpoint'] : []),
        ...(llms.includes('the same data') ? ['llms.txt says "the same data"'] : []),
    ];

    assert.deepEqual(wrong, []);
});

test('the site publishes a sitemap, robots.txt and a 404 page', () => {
    const listed = [...builtText('sitemap.xml').matchAll(/<loc>([^<]*)<\/loc>/g)]
        .map(([, location]) => location)
        .sort();
    const pages = builtPages()
        .filter((urlPath) => urlPath !== '/404.html')
        .map((urlPath) => SITE_URL + urlPath);
    assert.deepEqual(listed, pages);

    const sitemapLine = `Sitemap: ${SITE_URL}/sitemap.xml`;
    assert.ok(builtText('robots.txt').includes(sitemapLine), `robots.txt lacks "${sitemapLine}"`);

    const notFoundPage = mainContent('/404.html');
    const missingFromNotFoundPage = ['Page not found', 'href="/"', 'href="/docs/quick-start/"']
        .filter((markup) => !notFoundPage.includes(markup));
    assert.deepEqual(missingFromNotFoundPage, []);
});
