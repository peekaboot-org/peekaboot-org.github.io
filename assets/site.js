// The entire client-side surface of this site: theme resolution and the navbar burger.
// The storage key and the [data-theme] attribute are shared with Peekaboot's own UI
// (peekaboot-frontend/.../shared/theme.js), so a visitor who set a theme in a running
// dashboard sees this site match it.
(function () {
    'use strict';

    var STORAGE_KEY = 'peekaboot-theme';

    function storedTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            return null;
        }
    }

    function storeTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
            // private browsing or a blocked storage partition - the toggle still works
            // for this page view, it just will not persist
        }
    }

    function resolveTheme() {
        var stored = storedTheme();
        if (stored === 'light' || stored === 'dark') {
            return stored;
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        var button = document.getElementById('theme-toggle');
        if (button) {
            button.setAttribute('aria-label',
                theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
        }
    }

    applyTheme(resolveTheme());

    // Every doc heading already carries a stable, explicit id (see docs/*.md); this just
    // gives a reader something to click. Scoped to .pk-content, which only the doc layout
    // renders, so it never touches the page title (an <h1> with no id) or a non-docs page.
    function addHeadingAnchors() {
        var headings = document.querySelectorAll('.pk-content h2[id], .pk-content h3[id], .pk-content h4[id]');
        for (var i = 0; i < headings.length; i++) {
            var heading = headings[i];
            var link = document.createElement('a');
            link.className = 'pk-heading-anchor';
            link.href = '#' + heading.id;
            link.setAttribute('aria-label', 'Link to this section: ' + heading.textContent.trim());
            link.textContent = '#';
            heading.appendChild(link);
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        applyTheme(resolveTheme());
        addHeadingAnchors();

        var toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.addEventListener('click', function () {
                var next = document.documentElement.getAttribute('data-theme') === 'dark'
                    ? 'light' : 'dark';
                storeTheme(next);
                applyTheme(next);
            });
        }

        var burger = document.querySelector('.navbar-burger');
        var menu = burger && document.getElementById(burger.dataset.target);
        if (burger && menu) {
            burger.addEventListener('click', function () {
                burger.classList.toggle('is-active');
                menu.classList.toggle('is-active');
                burger.setAttribute('aria-expanded', menu.classList.contains('is-active'));
            });
        }
    });
})();
