import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { builtPages, launch, openPage, serveSite } from './site.mjs';

let site;
let browser;

before(async () => {
    site = await serveSite();
    browser = await launch();
});

after(async () => {
    await browser?.close();
    await site?.close();
});

async function idsAndLinks(urlPath) {
    const page = await openPage(browser, site.origin, urlPath);
    try {
        return await page.evaluate(() => ({
            ids: Array.from(document.querySelectorAll('[id]'), (element) => element.id),
            links: Array.from(document.querySelectorAll('a[href]'),
                (link) => ({href: link.getAttribute('href'), target: link.href})),
        }));
    } finally {
        await page.context().close();
    }
}

test('every internal link and fragment resolves', async () => {
    const idsByPage = new Map();
    const internalLinks = [];
    for (const urlPath of builtPages()) {
        const {ids, links} = await idsAndLinks(urlPath);
        idsByPage.set(urlPath, ids);
        for (const {href, target} of links) {
            const url = new URL(target);
            if (url.origin === site.origin) {
                internalLinks.push({from: urlPath, href, target: url});
            }
        }
    }

    const answered = new Map();
    const unresolved = [];
    for (const {from, href, target} of internalLinks) {
        if (!answered.has(target.pathname)) {
            answered.set(target.pathname, (await fetch(target.origin + target.pathname)).ok);
        }
        const fragment = decodeURIComponent(target.hash.slice(1));
        const fragmentFound = !fragment || idsByPage.get(target.pathname)?.includes(fragment);
        if (!answered.get(target.pathname) || !fragmentFound) {
            unresolved.push(`${from} -> ${href}`);
        }
    }

    assert.equal(unresolved.length, 0, `unresolved links:\n${unresolved.join('\n')}`);
});
