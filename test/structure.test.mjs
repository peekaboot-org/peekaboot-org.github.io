import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { builtPages, launch, readPage, serveSite } from './site.mjs';

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

function onPage(urlPath, options, read) {
    return readPage(browser, site.origin, urlPath, options, read);
}

const PHONE_WIDTH = 375;
const DESKTOP_WIDTH = 1280;
const SIDEBAR_PAGE = '/docs/configuration/';

// Fragments that pages, bookmarks and the product repo linked before a section was renamed or moved.
const LEGACY_ANCHORS = [
    ['/docs/in-production/', 'what-happens-when-you-deploy'],
    ['/docs/in-production/', 'what-it-costs-while-it-is-on'],
    ['/docs/in-production/', 'memory'],
    ['/docs/in-production/', 'what-it-cannot-do'],
    ['/docs/in-production/', 'class-path'],
    ['/docs/in-production/', 'if-you-run-it-somewhere-shared'],
    ['/docs/in-production/', 'keeping-it-out-of-the-artifact-entirely'],
    ['/docs/security/', 'running-it-in-a-deployed-environment'],
    ['/docs/security/', 'production-checklist'],
    ['/docs/security/', 'keeping-it-out-of-production-entirely'],
    ['/docs/security/', 'if-nothing-else-secures-it'],
];

function idsAndLinks(urlPath) {
    return onPage(urlPath, {}, (page) => page.evaluate(() => ({
        ids: Array.from(document.querySelectorAll('[id]'), (element) => element.id),
        links: Array.from(document.querySelectorAll('a[href]'),
            (link) => ({href: link.getAttribute('href'), target: link.href})),
    })));
}

// A section is what follows an h2 up to the next one.
function sectionUnder(urlPath, headingId) {
    return onPage(urlPath, {}, (page) => page.evaluate((id) => {
        const blocks = [];
        for (let block = document.getElementById(id)?.nextElementSibling;
            block && block.tagName !== 'H2'; block = block.nextElementSibling) {
            blocks.push(block);
        }
        const within = (selector) => blocks.flatMap((block) =>
            [...(block.matches(selector) ? [block] : []), ...block.querySelectorAll(selector)]);
        return {
            links: within('a[href]').map((link) => link.getAttribute('href')),
            lists: within('ul, ol').length,
            orderedListSizes: within('ol').map((list) => list.querySelectorAll(':scope > li').length),
        };
    }, headingId));
}

function sidebarState(page) {
    return page.evaluate(() => {
        const shown = (element) => Boolean(element) && element.getClientRects().length > 0;
        const toggle = document.querySelector('.pk-sidebar__toggle');
        const controlled = document.getElementById(toggle?.getAttribute('aria-controls'));
        const width = (element) => element?.getBoundingClientRect().width;
        return {
            firstLinkShown: shown(document.querySelector('.pk-sidebar__link')),
            toggleShown: shown(toggle),
            toggleAsWideAsMain: width(toggle) === width(document.querySelector('main')),
            expanded: toggle?.getAttribute('aria-expanded') ?? null,
            toggleControlsTheLinks: Boolean(controlled?.querySelector('.pk-sidebar__link')),
        };
    });
}

function navbarMenuState(page) {
    return page.evaluate(() => {
        const burger = document.querySelector('.navbar-burger');
        return {
            menuShown: document.getElementById('navbar-menu').getClientRects().length > 0,
            burgerActive: burger.classList.contains('is-active'),
            expanded: burger.getAttribute('aria-expanded'),
        };
    });
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
    const widths = {};
    for (const js of [true, false]) {
        widths[js ? 'with JavaScript' : 'without JavaScript'] =
            await onPage('/', {width: PHONE_WIDTH, js},
                (page) => page.evaluate(() => document.documentElement.scrollWidth));
    }

    assert.deepEqual(widths, {'with JavaScript': PHONE_WIDTH, 'without JavaScript': PHONE_WIDTH});
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

test('anchors from before the restructure still resolve', async () => {
    const idsByPage = new Map();
    const missing = [];
    for (const [urlPath, id] of LEGACY_ANCHORS) {
        if (!idsByPage.has(urlPath)) {
            idsByPage.set(urlPath, (await idsAndLinks(urlPath)).ids);
        }
        if (!idsByPage.get(urlPath).includes(id)) {
            missing.push(`${urlPath}#${id}`);
        }
    }

    assert.deepEqual(missing, []);
});

test('in-production says what happens on a deployment and what to set', async () => {
    const checklistItems = 10;
    const firstSections = await onPage('/docs/in-production/', {}, (page) => page
        .locator('main h2')
        .evaluateAll((headings) => headings.slice(0, 2).map((heading) => heading.id)));
    const {orderedListSizes} = await sectionUnder('/docs/in-production/', 'before-you-turn-it-on');

    assert.deepEqual(firstSections, ['what-happens-on-a-deployment', 'before-you-turn-it-on']);
    assert.ok(orderedListSizes.some((size) => size >= checklistItems),
        `ordered lists under #before-you-turn-it-on have ${JSON.stringify(orderedListSizes)} items, `
        + `want one with ${checklistItems} or more`);
});

test('security sends the reader to the in-production checklist', async () => {
    const {links, lists} = await sectionUnder('/docs/security/', 'running-it-in-a-deployed-environment');

    assert.deepEqual(
        {linksTheChecklist: links.includes('/docs/in-production/#before-you-turn-it-on'), lists},
        {linksTheChecklist: true, lists: 0});
});

test('no page renders a checkbox', async () => {
    const checkboxesByPage = {};
    for (const urlPath of builtPages()) {
        const checkboxes = await onPage(urlPath, {},
            (page) => page.locator('input[type=checkbox]').count());
        if (checkboxes > 0) {
            checkboxesByPage[urlPath] = checkboxes;
        }
    }

    assert.deepEqual(checkboxesByPage, {});
});

test('the burger opens and closes the navbar menu on a phone', async () => {
    const closed = {menuShown: false, burgerActive: false, expanded: 'false'};
    const open = {menuShown: true, burgerActive: true, expanded: 'true'};

    await onPage('/', {width: PHONE_WIDTH}, async (page) => {
        const burger = page.locator('.navbar-burger');
        assert.deepEqual(await navbarMenuState(page), closed);
        await burger.click();
        assert.deepEqual(await navbarMenuState(page), open);
        await burger.click();
        assert.deepEqual(await navbarMenuState(page), closed);
    });
});

test('the sidebar collapses behind a toggle on a phone', async () => {
    const headingTopLimit = 250;
    const toggleInPlace = {toggleShown: true, toggleAsWideAsMain: true, toggleControlsTheLinks: true};
    const collapsed = {...toggleInPlace, firstLinkShown: false, expanded: 'false'};
    const open = {...toggleInPlace, firstLinkShown: true, expanded: 'true'};

    await onPage(SIDEBAR_PAGE, {width: PHONE_WIDTH}, async (page) => {
        const toggle = page.locator('.pk-sidebar__toggle');
        assert.deepEqual(await sidebarState(page), collapsed);
        const headingTop = (await page.locator('main h1').boundingBox()).y;
        assert.ok(headingTop < headingTopLimit,
            `the h1 starts ${headingTop} px down the page, want under ${headingTopLimit}`);
        await toggle.click();
        assert.deepEqual(await sidebarState(page), open);
        await toggle.click();
        assert.deepEqual(await sidebarState(page), collapsed);
    });
});

test('the sidebar stays open on a phone without JavaScript', async () => {
    const {firstLinkShown, toggleShown} =
        await onPage(SIDEBAR_PAGE, {width: PHONE_WIDTH, js: false}, sidebarState);

    assert.deepEqual({firstLinkShown, toggleShown}, {firstLinkShown: true, toggleShown: false});
});

test('the sidebar shows no toggle on a desktop', async () => {
    const {firstLinkShown, toggleShown} =
        await onPage(SIDEBAR_PAGE, {width: DESKTOP_WIDTH}, sidebarState);

    assert.deepEqual({firstLinkShown, toggleShown}, {firstLinkShown: true, toggleShown: false});
});
