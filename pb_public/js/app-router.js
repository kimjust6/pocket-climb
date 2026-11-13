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

    // In-memory HTML Page Cache for Instant Navigation
    const pageCache = new Map();
    const inFlightPrefetches = new Map();
    const PAGE_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

    function getCachedPage(url) {
        const entry = pageCache.get(url);
        if (!entry) return null;
        if (Date.now() - entry.time > PAGE_CACHE_TTL_MS) {
            pageCache.delete(url);
            return null;
        }
        return entry;
    }

    function setCachedPage(url, data) {
        if (pageCache.size > 80) {
            const oldestKey = pageCache.keys().next().value;
            pageCache.delete(oldestKey);
        }
        pageCache.set(url, { ...data, time: Date.now() });
    }

    // Top subtle progress bar
    let progressBar = null;
    let progressTimer = null;

    function getProgressBar() {
        if (!progressBar) {
            progressBar = document.createElement('div');
            progressBar.id = 'app-router-progress';
            progressBar.className = 'fixed top-0 left-0 right-0 h-[2.5px] bg-accent z-[99999] pointer-events-none transition-all duration-300 opacity-0';
            progressBar.style.width = '0%';
            document.body.appendChild(progressBar);
        }
        return progressBar;
    }

    function startProgress() {
        clearTimeout(progressTimer);
        const bar = getProgressBar();
        bar.style.transition = 'none';
        bar.style.width = '20%';
        bar.style.opacity = '1';
        progressTimer = setTimeout(() => {
            bar.style.transition = 'width 600ms cubic-bezier(0.1, 0.9, 0.2, 1)';
            bar.style.width = '75%';
        }, 50);
    }

    function finishProgress() {
        clearTimeout(progressTimer);
        if (!progressBar) return;
        progressBar.style.transition = 'width 150ms ease-out, opacity 200ms ease-out 150ms';
        progressBar.style.width = '100%';
        progressBar.style.opacity = '0';
        setTimeout(() => {
            if (progressBar) progressBar.style.width = '0%';
        }, 400);
    }

    /**
     * Fetch page HTML with deduplication and in-memory caching
     */
    async function fetchPage(targetUrl, signal = null) {
        const cached = getCachedPage(targetUrl);
        if (cached) return cached;

        if (inFlightPrefetches.has(targetUrl)) {
            try {
                return await inFlightPrefetches.get(targetUrl);
            } catch (_) {
                inFlightPrefetches.delete(targetUrl);
            }
        }

        const promise = (async () => {
            try {
                const res = await fetch(targetUrl, {
                    signal,
                    headers: { 'X-Requested-With': 'VueRouter' }
                });
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const finalUrl = res.url || targetUrl;
                const html = await res.text();
                const data = { finalUrl, html };

                setCachedPage(targetUrl, data);
                if (finalUrl !== targetUrl) {
                    setCachedPage(finalUrl, data);
                }
                return data;
            } finally {
                inFlightPrefetches.delete(targetUrl);
            }
        })();

        inFlightPrefetches.set(targetUrl, promise);
        return promise;
    }

    /**
     * Prefetch a URL on hover or touch before click
     */
    function prefetchUrl(targetHref) {
        if (!targetHref || targetHref.startsWith('#')) return;
        try {
            const url = new URL(targetHref, window.location.origin);
            if (url.origin !== window.location.origin) return;
            if (url.pathname === window.location.pathname && url.search === window.location.search) return;
            if (url.pathname.startsWith('/api/') || url.pathname === '/logout') return;

            const normalized = url.pathname + url.search;
            if (getCachedPage(normalized) || inFlightPrefetches.has(normalized)) return;

            const schedulePrefetch = window.requestIdleCallback || ((cb) => setTimeout(cb, 10));
            schedulePrefetch(() => {
                fetchPage(normalized).catch(() => {});
            });
        } catch (_) {}
    }

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
        const scripts = Array.from(container.querySelectorAll('script'));
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
                if (oldScript.parentNode) {
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                }
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

        const isCached = Boolean(getCachedPage(targetUrl));
        if (!isCached) {
            startProgress();
        }

        try {
            const pageData = await fetchPage(targetUrl, currentAbortController.signal);
            if (!isCached) {
                finishProgress();
            }

            const finalUrl = pageData.finalUrl || targetUrl;
            const parsedTarget = new URL(finalUrl, window.location.origin);

            const parser = new DOMParser();
            const doc = parser.parseFromString(pageData.html, 'text/html');

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

            // Perform DOM replacement first, then update browser history upon success
            const performSwap = () => {
                unmountIslands(currentMain);
                currentMain.innerHTML = newMain.innerHTML;
                executeScripts(currentMain);
                updateActiveNavLinks(parsedTarget.pathname);

                if (pushState && window.location.href !== parsedTarget.href) {
                    window.history.pushState({}, '', parsedTarget.href);
                }
                lastRenderedPath = parsedTarget.pathname;

                try {
                    if (router && typeof router.replace === 'function') {
                        router.replace(parsedTarget.pathname + parsedTarget.search + parsedTarget.hash).catch(() => {});
                    }
                } catch (_) {}

                if (parsedTarget.hash) {
                    const targetEl = document.querySelector(parsedTarget.hash);
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth' });
                    }
                } else {
                    window.scrollTo(0, 0);
                }

                // Close mobile sidebar drawer if open
                const drawer = document.getElementById('my-drawer-3');
                if (drawer && drawer.checked) drawer.checked = false;
            };

            if (typeof document.startViewTransition === 'function') {
                try {
                    document.startViewTransition(() => {
                        performSwap();
                    });
                } catch (_) {
                    performSwap();
                }
            } else {
                performSwap();
            }

        } catch (err) {
            finishProgress();
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

    // Hover and Touch Prefetching for internal links
    const handleLinkPrefetch = (e) => {
        const anchor = e.target && e.target.closest ? e.target.closest('a') : null;
        if (!anchor) return;
        const href = anchor.getAttribute('href');
        if (!href || href.startsWith('#') || anchor.hasAttribute('download') || anchor.getAttribute('target') === '_blank') return;
        if (anchor.getAttribute('rel') === 'external' || anchor.getAttribute('data-no-router') !== null) return;
        prefetchUrl(href);
    };

    document.addEventListener('pointerenter', handleLinkPrefetch, { passive: true, capture: true });
    document.addEventListener('touchstart', handleLinkPrefetch, { passive: true, capture: true });

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

            // Same pathname & search: let island handle query or hash changes without re-fetching
            if (url.pathname === window.location.pathname && url.search === window.location.search) {
                return;
            }

            e.preventDefault();
            navigateToUrl(url.pathname + url.search + url.hash, true);
        } catch (_) {}
    });

    // Seed current page into cache and sync active nav links on DOM ready
    const initPage = () => {
        updateActiveNavLinks(window.location.pathname);
        setCachedPage(window.location.pathname + window.location.search, {
            finalUrl: window.location.href,
            html: document.documentElement.outerHTML
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPage);
    } else {
        initPage();
    }
})();
