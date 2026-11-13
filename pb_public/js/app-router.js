/**
 * Wiki Bloc Unified App Router
 * Powers seamless navigation between server-rendered PocketPages
 */
(function () {
    if (typeof VueRouter === 'undefined' || typeof Vue === 'undefined') {
        console.warn('Vue or VueRouter not found, skipping app router initialization.');
        return;
    }

    const { createRouter, createWebHistory } = VueRouter;

    const routes = [
        { path: '/', name: 'home', component: { render: () => null } },
        { path: '/area/:pathMatch(.*)*', name: 'area', component: { render: () => null } },
        { path: '/climb/:pathMatch(.*)*', name: 'climb', component: { render: () => null } },
        { path: '/login', name: 'login', component: { render: () => null } },
        { path: '/logout', name: 'logout', component: { render: () => null } },
        { path: '/privacy', name: 'privacy', component: { render: () => null } },
        { path: '/terms', name: 'terms', component: { render: () => null } },
        { path: '/faq', name: 'faq', component: { render: () => null } },
        { path: '/zen', name: 'zen', component: { render: () => null } },
        { path: '/:pathMatch(.*)*', name: 'catch-all', component: { render: () => null } }
    ];

    const router = createRouter({
        history: createWebHistory(),
        routes,
        scrollBehavior(to, from, savedPosition) {
            if (to.hash) {
                return { el: to.hash, behavior: 'smooth' };
            }
            if (savedPosition) {
                return savedPosition;
            }
            return { top: 0 };
        }
    });

    window.appRouter = router;

    let isNavigating = false;
    let currentAbortController = null;
    let lastRenderedPath = window.location.pathname;

    /**
     * Update active navigation link styles in navbar and sidebar
     */
    function updateActiveNavLinks(newPath) {
        const navLinks = document.querySelectorAll(
            'nav[aria-label="Main Navigation"] a, nav[aria-label="Mobile Navigation"] a'
        );
        navLinks.forEach((link) => {
            const href = link.getAttribute('href');
            if (!href) return;
            try {
                const url = new URL(href, window.location.origin);
                const isExact = url.pathname === newPath;
                const isHome = url.pathname === '/' && newPath === '/';
                const isChild = !isHome && url.pathname !== '/' && newPath.startsWith(url.pathname);

                if (isExact || isChild) {
                    link.setAttribute('aria-current', 'page');
                    link.classList.add('text-accent');
                    link.classList.remove('text-base-content');
                } else {
                    link.removeAttribute('aria-current');
                    link.classList.remove('text-accent');
                    link.classList.add('text-base-content');
                }
            } catch (_) {}
        });
    }

    /**
     * Unmount any active Vue island apps inside a container
     */
    function unmountIslands(container) {
        if (!container) return;
        const roots = container.querySelectorAll('*');
        roots.forEach((el) => {
            if (el.__vue_app__ && typeof el.__vue_app__.unmount === 'function') {
                try {
                    el.__vue_app__.unmount();
                } catch (_) {}
                el.__vue_app__ = null;
            }
        });
    }

    /**
     * Re-execute inline and external scripts inside container
     */
    function executeScripts(container) {
        if (!container) return;
        const scripts = container.querySelectorAll('script');
        scripts.forEach((oldScript) => {
            const type = oldScript.getAttribute('type') || '';
            // Skip data islands (JSON)
            if (type === 'application/json' || type === 'application/ld+json') {
                return;
            }
            try {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach((attr) => {
                    newScript.setAttribute(attr.name, attr.value);
                });
                newScript.textContent = oldScript.textContent;
                oldScript.parentNode.replaceChild(newScript, oldScript);
            } catch (err) {
                console.warn('Script execution caught warning:', err);
            }
        });
    }

    /**
     * Fetch new server-rendered HTML page and swap <main id="main-content">
     */
    async function navigateToUrl(targetUrl, pushState = true) {
        if (isNavigating && currentAbortController) {
            currentAbortController.abort();
        }

        isNavigating = true;
        currentAbortController = new AbortController();

        try {
            const res = await fetch(targetUrl, {
                signal: currentAbortController.signal,
                headers: {
                    'X-Requested-With': 'VueRouter'
                }
            });

            if (!res.ok) {
                window.location.href = targetUrl;
                return;
            }

            const finalUrl = res.url || targetUrl;
            const parsedTarget = new URL(finalUrl, window.location.origin);

            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const newMain = doc.querySelector('#main-content');
            const currentMain = document.querySelector('#main-content');

            if (!newMain || !currentMain) {
                window.location.href = targetUrl;
                return;
            }

            // Update title
            if (doc.title) {
                document.title = doc.title;
            }

            // Update meta tags
            ['description', 'og:title', 'og:description', 'og:url', 'twitter:title', 'twitter:description'].forEach((metaName) => {
                const newMeta = doc.querySelector(`meta[name="${metaName}"], meta[property="${metaName}"]`);
                let curMeta = document.querySelector(`meta[name="${metaName}"], meta[property="${metaName}"]`);
                if (newMeta) {
                    if (!curMeta) {
                        curMeta = document.createElement('meta');
                        curMeta.setAttribute(newMeta.hasAttribute('property') ? 'property' : 'name', metaName);
                        document.head.appendChild(curMeta);
                    }
                    curMeta.setAttribute('content', newMeta.getAttribute('content') || '');
                }
            });

            // Update canonical link
            const newCanonical = doc.querySelector('link[rel="canonical"]');
            let curCanonical = document.querySelector('link[rel="canonical"]');
            if (newCanonical) {
                if (!curCanonical) {
                    curCanonical = document.createElement('link');
                    curCanonical.setAttribute('rel', 'canonical');
                    document.head.appendChild(curCanonical);
                }
                curCanonical.setAttribute('href', newCanonical.getAttribute('href') || '');
            }

            // Update JSON-LD structured data
            const newJsonLd = doc.querySelector('script[type="application/ld+json"]');
            const curJsonLd = document.querySelector('script[type="application/ld+json"]');
            if (newJsonLd && curJsonLd) {
                curJsonLd.textContent = newJsonLd.textContent;
            }

            // Update browser URL before DOM swap so components read current location
            if (pushState && window.location.href !== parsedTarget.href) {
                window.history.pushState({}, '', parsedTarget.href);
            }
            lastRenderedPath = parsedTarget.pathname;

            // Sync VueRouter's internal state
            try {
                router.replace(parsedTarget.pathname + parsedTarget.search + parsedTarget.hash);
            } catch (_) {}

            // Perform DOM replacement
            const doSwap = () => {
                unmountIslands(currentMain);
                currentMain.innerHTML = newMain.innerHTML;
                executeScripts(currentMain);
                updateActiveNavLinks(parsedTarget.pathname);

                if (parsedTarget.hash) {
                    const targetEl = document.querySelector(parsedTarget.hash);
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth' });
                    }
                } else {
                    window.scrollTo({ top: 0, behavior: 'instant' });
                }

                // Close mobile sidebar drawer if open
                const drawer = document.getElementById('my-drawer-3');
                if (drawer && drawer.checked) drawer.checked = false;
            };

            if (document.startViewTransition) {
                try {
                    await document.startViewTransition(doSwap).finished;
                } catch (_) {
                    doSwap();
                }
            } else {
                doSwap();
            }

        } catch (err) {
            if (err.name === 'AbortError') return;
            console.warn('SPA navigation fallback to standard load:', err);
            window.location.href = targetUrl;
        } finally {
            isNavigating = false;
        }
    }

    // Handle browser back and forward button navigation
    window.addEventListener('popstate', () => {
        if (window.location.hash && window.location.hash.startsWith('#photo-')) {
            return;
        }
        const currentPath = window.location.pathname;
        if (currentPath === lastRenderedPath) {
            if (window.location.hash) {
                const el = document.querySelector(window.location.hash);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
            }
            return;
        }
        lastRenderedPath = currentPath;
        navigateToUrl(window.location.href, false);
    });

    // Global Link Interceptor for all internal links
    document.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented) return;

        const anchor = e.target && e.target.closest ? e.target.closest('a') : null;
        if (!anchor) return;

        const href = anchor.getAttribute('href');
        if (!href) return;

        // Skip in-page hash anchors
        if (href.startsWith('#')) return;

        // Skip downloads and external targets
        if (anchor.hasAttribute('download') || anchor.getAttribute('target') === '_blank') return;
        if (anchor.getAttribute('rel') === 'external' || anchor.getAttribute('data-no-router') !== null) return;

        try {
            const url = new URL(href, window.location.origin);
            if (url.origin !== window.location.origin) return;

            // Skip API endpoints or special auth endpoints
            if (url.pathname.startsWith('/api/') || url.pathname === '/logout') {
                return;
            }

            // Same pathname: let island handle query or hash changes without re-fetching
            if (url.pathname === window.location.pathname) {
                return;
            }

            e.preventDefault();
            navigateToUrl(url.pathname + url.search + url.hash, true);
        } catch (_) {}
    });

    // Sync active nav links on initial DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            updateActiveNavLinks(window.location.pathname);
        });
    } else {
        updateActiveNavLinks(window.location.pathname);
    }
})();
