// WCAG 2 contrast of the text a page renders, measured in the browser.

// Runs in the page, so it can use nothing else from this module. One row per element: the
// first match of `selector`, or with `withDescendants` every match and descendant that renders
// text of its own.
function measureText({selector, withDescendants}) {
    // WCAG 1.4.3: large text, 18 pt or 14 pt bold, needs the lower ratio.
    const LARGE_PX = 24;
    const LARGE_BOLD_PX = 18.66;
    const BOLD_WEIGHT = 700;
    const REQUIRED = 4.5;
    const REQUIRED_LARGE = 3;
    const TEXT_SHOWN = 60;

    const channels = (colour) => {
        const match = /^rgba?\(([^)]+)\)$/.exec(colour);
        if (!match) {
            throw new Error(`cannot read the colour ${colour}`);
        }
        const [red, green, blue, alpha = 1] = match[1].split(/[\s,/]+/).map(Number);
        return [red, green, blue, alpha];
    };
    const over = ([red, green, blue, alpha], ground) =>
        [red, green, blue].map((channel, i) => channel * alpha + ground[i] * (1 - alpha));
    const linear = (channel) => {
        const share = channel / 255;
        return share <= 0.04045 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ([red, green, blue]) =>
        0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);

    const groundBehind = (element) => {
        const translucent = [];
        for (let layer = element; layer; layer = layer.parentElement) {
            const background = channels(getComputedStyle(layer).backgroundColor);
            if (background[3] === 1) {
                return translucent.reduceRight((ground, top) => over(top, ground), background);
            }
            translucent.push(background);
        }
        throw new Error(`no opaque background behind ${describe(element)}`);
    };
    const contrast = (element) => {
        const ground = groundBehind(element);
        const text = over(channels(getComputedStyle(element).color), ground);
        const [darker, lighter] = [luminance(text), luminance(ground)].sort((a, b) => a - b);
        return (lighter + 0.05) / (darker + 0.05);
    };
    const required = (element) => {
        const style = getComputedStyle(element);
        const size = parseFloat(style.fontSize);
        const large = size >= LARGE_PX
            || (size >= LARGE_BOLD_PX && Number(style.fontWeight) >= BOLD_WEIGHT);
        return large ? REQUIRED_LARGE : REQUIRED;
    };

    const ownText = (element) => Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    const rendered = (element) => {
        if (element.getClientRects().length === 0
            || getComputedStyle(element).visibility !== 'visible') {
            return false;
        }
        for (let layer = element; layer; layer = layer.parentElement) {
            if (Number(getComputedStyle(layer).opacity) === 0) {
                return false;
            }
        }
        return true;
    };
    const describe = (element) => {
        const path = [];
        for (let node = element; node && path.length < 3; node = node.parentElement) {
            path.unshift([node.localName, ...node.classList].join('.'));
        }
        return path.join(' > ');
    };

    const matches = Array.from(document.querySelectorAll(selector));
    if (matches.length === 0) {
        throw new Error(`nothing on ${location.pathname} matches ${selector}`);
    }
    const elements = withDescendants
        ? [...new Set(matches.flatMap((match) => [match, ...match.querySelectorAll('*')]))]
            .filter((element) => rendered(element) && ownText(element) !== '')
        : matches.slice(0, 1);
    return elements.map((element) => ({
        selector: describe(element),
        text: ownText(element).slice(0, TEXT_SHOWN),
        ratio: contrast(element),
        required: required(element),
    }));
}

// The ratio of the first match's text colour against its ground: the nearest background with
// alpha 1 on the element or an ancestor, with the translucent backgrounds above it blended in.
export async function contrastOf(page, selector) {
    const [first] = await page.evaluate(measureText, {selector, withDescendants: false});
    return first.ratio;
}

// Every element under `within` that renders text of its own below the ratio WCAG AA requires
// of it. Text nobody sees is left out: no box, visibility hidden, or an opacity of 0 on the
// element or an ancestor.
export async function contrastFailures(page, within = 'body') {
    const texts = await page.evaluate(measureText, {selector: within, withDescendants: true});
    return texts.filter(({ratio, required}) => ratio < required);
}
