/** @type {import('pocketpages').MiddlewareLoaderFunc} */
module.exports = function (api) {
    const { getAuthenticatedUser } = require(`${__hooks}/pages/utils/common.js`);
    let cookieValue = 'dark';
    try {
        // api.request.cookies is a function in the JS bridge
        const cookiesMap = api.request.cookies();

        // Check if theme cookie exists
        // cookiesMap might be an object where keys are cookie names
        if (cookiesMap && cookiesMap.theme) {
            // value might be the string directly or an object with .value
            cookieValue = cookiesMap.theme.value || cookiesMap.theme;
        }
    } catch (e) {
        console.log("Error reading cookies:", e);
    }

    let pathname = '/';
    try {
        if (api.request?.url?.pathname) {
            pathname = api.request.url.pathname;
        }
    } catch (_) { }

    try {
        if (api.response?.header) {
            api.response.header('Cache-Control', 'no-cache, private, must-revalidate');
            api.response.header('Vary', 'Cookie');
        }
    } catch (_) { }

    const baseUrl = 'https://wiki-bloc.jkim.win';
    const pageUrl = pathname === '/' ? `${baseUrl}/` : `${baseUrl}${pathname}`;
    const user = getAuthenticatedUser(api.request);

    return {
        currentPath: pathname,
        user,
        metadata: [
            // Basic metadata
            {
                name: 'title',
                content:
                    "Wiki Bloc",
            },
            {
                name: 'description',
                content:
                    'An open source community drive wiki that provides information on climbs',
            },
            { name: 'url', content: pageUrl },
            { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' },

            // Open Graph metadata
            {
                name: 'og:title',
                content:
                    "Wiki Bloc",
            },
            { name: 'og:type', content: 'website' },
            { name: 'og:url', content: pageUrl },
            {
                name: 'og:image',
                content: 'https://wiki-bloc.jkim.win/og-image.png',
            },
            {
                name: 'og:image:secure_url',
                content: 'https://wiki-bloc.jkim.win/og-image.png',
            },
            { name: 'og:image:type', content: 'image/png' },
            { name: 'og:image:alt', content: 'Wiki Bloc Cover' },
            { name: 'og:image:width', content: '1200' },
            { name: 'og:image:height', content: '630' },
            {
                name: 'og:description',
                content:
                    'An open source community drive wiki that provides information on climbs',
            },
            { name: 'og:site_name', content: "Wiki Bloc" },
            { name: 'og:locale', content: 'en_CA' },

            // Encourage connection—author details
            { name: 'author', content: 'Justin Kim' },
            {
                name: 'article:author',
                content: 'https://www.justink.dev',
            },
            { name: 'article:author:name', content: 'Justin Kim' },
            { name: 'article:publisher', content: 'https://www.justink.dev/' },

            // Twitter Card metadata (optional, but helpful)
            { name: 'twitter:card', content: 'summary_large_image' },
            { name: 'twitter:site', content: '@MatchaLatteTea' },
            { name: 'twitter:creator', content: '@MatchaLatteTea' },
            {
                name: 'twitter:title',
                content:
                    "Wiki Bloc",
            },
            {
                name: 'twitter:description',
                content:
                    'An open source community drive wiki that provides information on climbs',
            },
            {
                name: 'twitter:image',
                content: 'https://wiki-bloc.jkim.win/og-image.png',
            },
            {
                name: 'twitter:url',
                content: pageUrl,
            },
        ],
        theme: cookieValue,
        navigation: []
    }
}
