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

async function onPage(urlPath, options, read) {
    const page = await openPage(browser, site.origin, urlPath, options);
    try {
        return await read(page);
    } finally {
        await page.context().close();
    }
}

function idsAndLinks(urlPath) {
    return onPage(urlPath, {}, (page) => page.evaluate(() => ({
        ids: Array.from(document.querySelectorAll('[id]'), (element) => element.id),
        links: Array.from(document.querySelectorAll('a[href]'),
            (link) => ({href: link.getAttribute('href'), target: link.href})),
    })));
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

test('the landing page does not scroll sideways on a phone', async () => {
    const phoneWidth = 375;
    const widths = {};
    for (const js of [true, false]) {
        widths[js ? 'with JavaScript' : 'without JavaScript'] =
            await onPage('/', {width: phoneWidth, js},
                (page) => page.evaluate(() => document.documentElement.scrollWidth));
    }

    assert.deepEqual(widths, {'with JavaScript': phoneWidth, 'without JavaScript': phoneWidth});
});

test('the navbar links the API', async () => {
    const apiLinks = await onPage('/', {}, (page) => page
        .getByRole('navigation', {name: 'main navigation'})
        .getByRole('link', {name: 'API', exact: true})
        .evaluateAll((links) => links.map((link) => link.getAttribute('href'))));
    const currentOnApiPage = await onPage('/docs/api/', {},
        (page) => page.locator('.navbar-item.is-current').allTextContents());

    assert.deepEqual({apiLinks, currentOnApiPage},
        {apiLinks: ['/docs/api/'], currentOnApiPage: ['API']});
});
