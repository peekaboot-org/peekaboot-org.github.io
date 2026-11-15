// Prints the table under "Measured contrast" in README.md. Reads the built site.
import { contrastOf } from './contrast.mjs';
import { launch, readPage, serveSite } from './site.mjs';

const PAGE = '/docs/quick-start/';
const SCHEMES = ['light', 'dark'];
const MEASURED = [
    {text: 'Body text', selector: '.pk-content p'},
    {text: 'Link on the page ground', selector: '.pk-content > p a'},
    {text: 'Link on the tinted ground of a callout', selector: '.pk-callout a'},
    {
        text: 'Current sidebar entry, on the tinted ground',
        selector: '.pk-sidebar__link.is-current',
    },
];

const site = await serveSite();
const browser = await launch();
try {
    const ratios = {};
    for (const scheme of SCHEMES) {
        ratios[scheme] = await readPage(browser, site.origin, PAGE, {scheme}, async (page) => {
            const measured = [];
            for (const {selector} of MEASURED) {
                measured.push(await contrastOf(page, selector));
            }
            return measured;
        });
    }
    const rows = MEASURED.map(({text, selector}, i) => [
        `${text} (\`${selector}\`)`,
        ...SCHEMES.map((scheme) => `${ratios[scheme][i].toFixed(2)}:1`),
    ]);
    const table = [['Text', 'Light', 'Dark'], ['---', '---', '---'], ...rows];
    console.log(table.map((cells) => `| ${cells.join(' | ')} |`).join('\n'));
} finally {
    await browser.close();
    await site.close();
}
