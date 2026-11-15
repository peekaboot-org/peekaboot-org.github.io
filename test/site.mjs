// The checks read the built site through this module, as files, over HTTP and in a browser.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const SITE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const BUILT = join(SITE_ROOT, '_site');

const THEME_STORAGE_KEY = 'peekaboot-theme';
const REDIRECT_STUB = '<meta http-equiv="refresh"';

const CONTENT_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml',
};

const NAMED_ENTITIES = {
    amp: '&',
    apos: "'",
    gt: '>',
    hellip: '\u2026',
    lt: '<',
    middot: '\u00b7',
    nbsp: '\u00a0',
    quot: '"',
};

function builtFile(urlPath) {
    const index = urlPath.endsWith('/') ? 'index.html' : '';
    const file = join(BUILT, decodeURIComponent(urlPath), index);
    const inside = file.startsWith(BUILT + sep);
    return inside && statSync(file, {throwIfNoEntry: false})?.isFile() ? file : null;
}

function decodeEntity(entity, name) {
    if (name.startsWith('#')) {
        const hex = name[1].toLowerCase() === 'x';
        return String.fromCodePoint(parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    assert.ok(name in NAMED_ENTITIES, `${entity} is missing from NAMED_ENTITIES in test/site.mjs`);
    return NAMED_ENTITIES[name];
}

export function builtPages() {
    return readdirSync(BUILT, {recursive: true})
        .filter((file) => file.endsWith('.html'))
        .map((file) => '/' + file.split(sep).join('/').replace(/(^|\/)index\.html$/, '$1'))
        .filter((urlPath) => !html(urlPath).includes(REDIRECT_STUB))
        .sort();
}

export function html(urlPath) {
    const file = builtFile(urlPath);
    assert.ok(file, `${urlPath} is not in ${BUILT}`);
    return readFileSync(file, 'utf8');
}

export function text(urlPath) {
    return html(urlPath)
        .replace(/<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1>|<[^>]+>/g, '')
        .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, decodeEntity)
        .replace(/\s+/g, ' ')
        .trim();
}

export function serveSite() {
    const server = createServer((request, response) => {
        const file = builtFile(new URL(request.url, 'http://site').pathname);
        const answer = file ?? builtFile('/404.html');
        if (answer) {
            response.setHeader('Content-Type',
                CONTENT_TYPES[extname(answer)] ?? 'application/octet-stream');
        }
        response.writeHead(file ? 200 : 404).end(answer ? readFileSync(answer) : undefined);
    });
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve({
            origin: `http://127.0.0.1:${server.address().port}`,
            close: () => new Promise((closed) => {
                server.close(closed);
                server.closeAllConnections();
            }),
        }));
    });
}

export function launch() {
    return chromium.launch();
}

export async function openPage(browser, origin, urlPath,
                               {scheme = 'light', js = true, width = 1280, storedTheme} = {}) {
    const context = await browser.newContext({
        colorScheme: scheme,
        javaScriptEnabled: js,
        viewport: {width, height: 900},
    });
    if (storedTheme) {
        await context.addInitScript(
            ([key, theme]) => localStorage.setItem(key, theme), [THEME_STORAGE_KEY, storedTheme]);
    }
    const page = await context.newPage();
    await page.goto(origin + urlPath);
    return page;
}

export async function readPage(browser, origin, urlPath, options, read) {
    const page = await openPage(browser, origin, urlPath, options);
    try {
        return await read(page);
    } finally {
        await page.context().close();
    }
}
