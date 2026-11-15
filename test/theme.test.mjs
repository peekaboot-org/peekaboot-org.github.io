import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { contrastFailures } from './contrast.mjs';
import { launch, readPage, serveSite } from './site.mjs';

const MODES = {
    'light': {scheme: 'light'},
    'dark': {scheme: 'dark'},
    'light without JavaScript': {scheme: 'light', js: false},
    'dark without JavaScript': {scheme: 'dark', js: false},
};

// WCAG 1.4.11, the floor for the parts of a graphic.
const GRAPHIC_CONTRAST = 3;
// A lower alpha is an anti-aliased edge, which takes its colour from the ground.
const OPAQUE_ALPHA = 250;

// One Rouge class per --pk-code-* token, each on a page whose code blocks have it.
const HIGHLIGHTED_TOKENS = {
    '/docs/quick-start/': ['.highlight .nt'],
    '/docs/security/': ['.highlight .s', '.highlight .c1'],
    '/docs/configuration/': ['.highlight .na'],
};

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

// Every hero image the page displays, with the lowest contrast any of its opaque pixels has
// against the ground behind it.
function displayedHeroLogos(page) {
    return page.evaluate(async (opaqueAlpha) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', {willReadFrequently: true});
        const pixelsOf = (width, height, paint) => {
            canvas.width = width;
            canvas.height = height;
            paint();
            return context.getImageData(0, 0, width, height).data;
        };
        const linear = (channel) => {
            const share = channel / 255;
            return share <= 0.04045 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
        };
        const luminance = (red, green, blue) =>
            0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
        const contrast = (one, other) =>
            (Math.max(one, other) + 0.05) / (Math.min(one, other) + 0.05);
        const groundBehind = (element) => {
            for (let layer = element; layer; layer = layer.parentElement) {
                const [red, green, blue, alpha] = pixelsOf(1, 1, () => {
                    context.fillStyle = getComputedStyle(layer).backgroundColor;
                    context.fillRect(0, 0, 1, 1);
                });
                if (alpha === 255) {
                    return [red, green, blue];
                }
            }
            throw new Error('no opaque background behind the hero image');
        };

        const logos = [];
        for (const image of document.querySelectorAll('.hero img')) {
            if (image.getClientRects().length === 0) {
                continue;
            }
            await image.decode();
            const ground = groundBehind(image);
            const groundLuminance = luminance(...ground);
            const pixels = pixelsOf(image.naturalWidth, image.naturalHeight,
                () => context.drawImage(image, 0, 0));
            let lowestContrast = Infinity;
            for (let i = 0; i < pixels.length; i += 4) {
                if (pixels[i + 3] >= opaqueAlpha) {
                    lowestContrast = Math.min(lowestContrast, contrast(groundLuminance,
                        luminance(pixels[i], pixels[i + 1], pixels[i + 2])));
                }
            }
            logos.push({
                file: image.currentSrc.split('/').pop(),
                ground: `rgb(${ground.join(', ')})`,
                lowestContrast,
            });
        }
        return logos;
    }, OPAQUE_ALPHA);
}

// Per screenshot figure, the themes of the images it displays, such as "light" or "light+dark".
function displayedScreenshotThemes(page) {
    return page.locator('figure:has(.pk-screenshot)').evaluateAll((figures) => figures.map(
        (figure) => Array.from(figure.querySelectorAll('.pk-screenshot'))
            .filter((image) => image.getClientRects().length > 0)
            .map((image) => /-(light|dark)\.png$/.exec(image.getAttribute('src'))[1])
            .join('+')));
}

// A problem per token that is missing or has the colour of the code around it.
function uncolouredTokens(page, tokens) {
    return page.evaluate((selectors) => selectors.flatMap((selector) => {
        const token = document.querySelector(selector);
        if (!token) {
            return [`${selector} is not on the page`];
        }
        const colour = getComputedStyle(token).color;
        return colour === getComputedStyle(token.closest('pre')).color
            ? [`${selector} has the colour of its pre, ${colour}`]
            : [];
    }), tokens);
}

test('the hero logo is legible on the dark ground', async () => {
    const problems = [];
    for (const [mode, options] of Object.entries(MODES)) {
        const dark = options.scheme === 'dark';
        const wanted = dark ? 'logo-mark-dark-480.png' : 'logo-full.png';
        const logos = await onPage('/', options, displayedHeroLogos);
        const shown = logos.map((logo) => logo.file);
        if (shown.length !== 1 || shown[0] !== wanted) {
            problems.push(`${mode}: shows ${shown.join(' and ') || 'no logo'}, want ${wanted}`);
        }
        // The light artwork has a white lens, so the pixel rule holds on the dark ground only.
        const faint = dark ? logos.filter((logo) => logo.lowestContrast < GRAPHIC_CONTRAST) : [];
        for (const logo of faint) {
            problems.push(`${mode}: ${logo.file} has pixels at `
                + `${logo.lowestContrast.toFixed(2)}:1 on ${logo.ground}, `
                + `want ${GRAPHIC_CONTRAST}:1 or more`);
        }
    }

    assert.deepEqual(problems, []);
});

test('each screenshot shows in the theme of the page', async () => {
    const shown = {};
    const wanted = {};
    for (const [mode, options] of Object.entries(MODES)) {
        const perFigure = await onPage('/docs/dashboard/', options, displayedScreenshotThemes);
        shown[mode] = [...new Set(perFigure)];
        wanted[mode] = [options.scheme];
    }

    assert.deepEqual(shown, wanted);
});

test('highlighted code is coloured and readable', async () => {
    const problems = [];
    for (const mode of ['light', 'dark']) {
        for (const [urlPath, tokens] of Object.entries(HIGHLIGHTED_TOKENS)) {
            const {uncoloured, faint} = await onPage(urlPath, MODES[mode], async (page) => ({
                uncoloured: await uncolouredTokens(page, tokens),
                faint: await contrastFailures(page, '.highlight'),
            }));
            problems.push(
                ...uncoloured.map((problem) => `${mode} ${urlPath}: ${problem}`),
                ...faint.map(({selector, text, ratio, required}) => `${mode} ${urlPath}: `
                    + `${selector} "${text}" has ${ratio.toFixed(2)}:1, want ${required}:1`));
        }
    }

    assert.deepEqual(problems, []);
});
