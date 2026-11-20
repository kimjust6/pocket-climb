/**
 * Wiki Bloc Site Initialization
 * Handles synchronous theme restoration (to prevent FOUC), theme toggling,
 * Service Worker registration, and GA4 privacy-compliant setup.
 */
(function () {
    // 1. Apply saved theme immediately before first paint
    try {
        var match = document.cookie.match(/(^|;)\s*theme=([^;]+)/);
        var saved = match ? match[2] : null;
        if (!saved) saved = localStorage.getItem('theme');
        if (saved === 'nord' || saved === 'dark') {
            document.documentElement.setAttribute('data-theme', saved);
            document.documentElement.classList.toggle('dark', saved === 'dark');
        }
    } catch (_) {}

    // 2. Theme toggle & icon sync
    function syncThemeIcons(theme) {
        var currentTheme = theme || document.documentElement.getAttribute('data-theme') || 'dark';
        var sun = document.getElementById('theme-icon-sun');
        var moon = document.getElementById('theme-icon-moon');
        if (sun) sun.style.display = currentTheme === 'dark' ? 'inline-block' : 'none';
        if (moon) moon.style.display = currentTheme === 'nord' ? 'inline-block' : 'none';
    }

    window.toggleTheme = function () {
        var html = document.documentElement;
        var currentTheme = html.getAttribute('data-theme') === 'nord' ? 'nord' : 'dark';
        var newTheme = currentTheme === 'dark' ? 'nord' : 'dark';

        html.setAttribute('data-theme', newTheme);
        try {
            localStorage.setItem('theme', newTheme);
        } catch (_) {}
        document.cookie = 'theme=' + newTheme + '; path=/; max-age=31536000; SameSite=Lax';
        html.classList.toggle('dark', newTheme === 'dark');
        syncThemeIcons(newTheme);
    };

    document.addEventListener('DOMContentLoaded', function () {
        syncThemeIcons();
    });
    window.addEventListener('pageshow', function () {
        syncThemeIcons();
    });

    // 3. Register Service Worker for local caching and offline support
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/sw.js').catch(function (err) {
                console.debug('SW registration skipped:', err);
            });
        });
    }

    // 4. Google Analytics 4 (privacy-compliant)
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
        window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', 'G-6P8M4DJNQL', {
        anonymize_ip: true,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        cookie_flags: 'SameSite=Lax;Secure',
    });
})();

