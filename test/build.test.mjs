import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { BUILT, SITE_ROOT, builtPages, html, text } from './site.mjs';

const SITE_URL = 'https://www.peekaboot.org';

// What more than one page explains, written once under _includes/facts and included by each.
const FACTS = [
    {
        file: 'guard-credentials.md',
        phrase: 'else `peekaboot-admin`',
        pages: ['/docs/security/', '/docs/agents/'],
    },
    {
        file: 'guard-refusal.md',
        phrase: 'An include cannot set the status',
        pages: ['/docs/security/', '/docs/api/'],
    },
    {
        file: 'storage-files.md',
        phrase: '| `traces.snapshot.jsonl` |',
        pages: ['/docs/configuration/', '/docs/security/'],
    },
    {
        file: 'local-run-disk.md',
        phrase: 'so traces survive a restart',
        pages: ['/docs/quick-start/', '/docs/traces/'],
    },
    {
        file: 'insights-stream-cap.md',
        phrase: 'At most 32',
        pages: ['/docs/api/', '/docs/insights/'],
    },
    {
        file: 'propagate-context.md',
        phrase: 'propagate-context: true',
        pages: ['/docs/traces/', '/docs/troubleshooting/'],
    },
    {
        file: 'error-page-accept.md',
        phrase: 'A bare `*/*`',
        pages: ['/docs/error-page/', '/docs/troubleshooting/'],
    },
    {
        file: 'trace-memory.md',
        phrase: '1.2 million entries',
        pages: ['/docs/traces/', '/docs/in-production/'],
    },
    {
        file: 'insights-memory.md',
        phrase: '138,960',
        pages: ['/docs/insights/', '/docs/in-production/'],
    },
];

function builtText(name) {
    return readFileSync(join(BUILT, name), 'utf8');
}

// A source file with its whitespace collapsed, since the pages wrap in the middle of a phrase.
function source(...segments) {
    const file = join(SITE_ROOT, ...segments);
    return existsSync(file) ? readFileSync(file, 'utf8').replace(/\s+/g, ' ') : '';
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

// The size a PNG states in its IHDR chunk, the first chunk after the 8-byte signature.
function pngSize(file) {
    const header = readFileSync(file).subarray(0, 24);
    assert.equal(header.toString('latin1', 12, 16), 'IHDR', `${file} is not a PNG`);
    return `${header.readUInt32BE(16)}x${header.readUInt32BE(20)}`;
}

function images(urlPath) {
    return [...html(urlPath).matchAll(/<img\b[^>]*>/g)].map(([tag]) => {
        const attribute = (name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
        const declared = `${attribute('width') ?? '?'}x${attribute('height') ?? '?'}`;
        return {src: attribute('src'), declared};
    });
}

// The caption under a screenshot, as markup.
function screenshotCaption(urlPath, name) {
    const figure = html(urlPath).split('<figure')
        .find((markup) => markup.includes(`/${name}-light.png"`));
    return /<figcaption>([\s\S]*?)<\/figcaption>/.exec(figure ?? '')?.[1] ?? '';
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

// Read from the files, since a lazy image the theme hides never loads in a browser.
test('every image declares its intrinsic size', () => {
    const wrong = builtPages().flatMap((urlPath) => images(urlPath)
        .map(({src, declared}) => ({src, declared, actual: pngSize(join(BUILT, src))}))
        .filter(({declared, actual}) => declared !== actual)
        .map(({src, declared, actual}) =>
            `${urlPath}: ${src} declares ${declared}, the file is ${actual}`));

    assert.deepEqual(wrong, []);
});

test('the revealed screenshot links the two opt-ins', () => {
    const caption = screenshotCaption('/docs/dashboard/', 'dashboard-environment-revealed');
    const wrong = [
        ...(caption.includes('href="/docs/security/#masking-opt-ins"')
            ? [] : [`the caption does not link the two opt-ins: ${caption}`]),
        ...(text('/docs/dashboard/').includes('safe to publish')
            ? ['/docs/dashboard/ says "safe to publish"'] : []),
    ];

    assert.deepEqual(wrong, []);
});

// A branch name in a link breaks when the branch is renamed. HEAD follows the default branch.
test('links into GitHub repositories use blob/HEAD', () => {
    const branchLink = /github\.com\/peekaboot-org\/[^"\s]*\/blob\/(?!HEAD\/)[^"\s)]*/g;
    const published = [
        ...builtPages().map((urlPath) => [urlPath, html(urlPath)]),
        ['/llms.txt', builtText('llms.txt')],
    ];
    const onABranch = published.flatMap(([urlPath, content]) =>
        [...content.matchAll(branchLink)].map(([link]) => `${urlPath}: ${link}`));

    assert.deepEqual(onABranch, []);
});

// The release job groups breaking entries under "Breaking changes", so a tag would say it twice.
test('the releases page tags no entry', () => {
    const releases = html('/releases/');

    assert.ok(/<h3[^>]*>Breaking changes<\/h3>/.test(releases),
        '/releases/ has no "Breaking changes" heading');
    assert.ok(!releases.includes('class="tag'), '/releases/ renders a tag');
});

test('a single-sourced fact is written in one file', () => {
    const pages = readdirSync(join(SITE_ROOT, 'docs')).filter((name) => name.endsWith('.md'));
    const wrong = FACTS.flatMap(({file, phrase}) => [
        ...(source('_includes', 'facts', file).includes(phrase)
            ? [] : [`_includes/facts/${file} lacks "${phrase}"`]),
        ...pages
            .filter((name) => source('docs', name).includes(phrase))
            .map((name) => `docs/${name} repeats "${phrase}" of _includes/facts/${file}`),
    ]);

    assert.deepEqual(wrong, []);
});

test('each page that needs a fact renders it', () => {
    const missing = FACTS.flatMap(({file, phrase, pages}) => {
        const rendered = phrase.replace(/[`|]/g, '').trim();
        return pages
            .filter((urlPath) => !text(urlPath).includes(rendered))
            .map((urlPath) => `${urlPath} does not render "${rendered}" of ${file}`);
    });

    assert.deepEqual(missing, []);
});

// Markdown inside an HTML block that lacks markdown="1" reaches the page as typed.
test('included facts render as Markdown', () => {
    const codeAndTags = /<!--[\s\S]*?-->|<(script|style|pre|code)\b[\s\S]*?<\/\1>|<[^>]+>/g;
    const pages = [...new Set(FACTS.flatMap((fact) => fact.pages))];
    const wrong = pages.flatMap((urlPath) => {
        const prose = html(urlPath).replace(codeAndTags, '');
        return ['`', '**', '{%']
            .filter((markup) => prose.includes(markup))
            .map((markup) => {
                const at = prose.indexOf(markup);
                const around = prose.slice(Math.max(0, at - 40), at + 40).replace(/\s+/g, ' ');
                return `${urlPath} shows a literal ${markup} in "${around}"`;
            });
    });

    assert.deepEqual(wrong, []);
});

test("the guard's username rule is on both pages", () => {
    const missing = ['/docs/security/', '/docs/agents/'].flatMap((urlPath) =>
        ['lowercased', 'orders-service--admin']
            .filter((phrase) => !text(urlPath).includes(phrase))
            .map((phrase) => `${urlPath} lacks "${phrase}"`));

    assert.deepEqual(missing, []);
});
