// The entire client-side surface of this site: theme resolution, the navbar burger, the docs
// sidebar toggle and the heading anchors.
// The storage key and the [data-theme] attribute are shared with Peekaboot's own UI
// (peekaboot-frontend/.../shared/theme.js), so a visitor who set a theme in a running
// dashboard sees this site match it.
(function () {
    'use strict';

    var STORAGE_KEY = 'peekaboot-theme';
    var darkOsTheme = window.matchMedia('(prefers-color-scheme: dark)');

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
        return darkOsTheme.matches ? 'dark' : 'light';
    }

    function labelToggle(theme) {
        var button = document.getElementById('theme-toggle');
        if (button) {
            button.setAttribute('aria-label',
                theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
        }
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        labelToggle(theme);
    }

    applyTheme(resolveTheme());
    // Resolved again, so a theme chosen with the toggle outlasts an OS theme change.
    darkOsTheme.addEventListener('change', function () {
        applyTheme(resolveTheme());
    });
    // CSS that needs this script keys on the class, so without it the sidebar stays open.
    document.documentElement.classList.add('pk-js');

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

    function discloseOnClick(button, openClass, elements) {
        button.addEventListener('click', function () {
            var open = button.getAttribute('aria-expanded') !== 'true';
            for (var i = 0; i < elements.length; i++) {
                elements[i].classList.toggle(openClass, open);
            }
            button.setAttribute('aria-expanded', open);
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        labelToggle(document.documentElement.getAttribute('data-theme'));
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
            discloseOnClick(burger, 'is-active', [burger, menu]);
        }

        var sidebar = document.querySelector('.pk-sidebar');
        var sidebarToggle = sidebar && sidebar.querySelector('.pk-sidebar__toggle');
        if (sidebarToggle) {
            discloseOnClick(sidebarToggle, 'is-open', [sidebar]);
        }
    });
})();
