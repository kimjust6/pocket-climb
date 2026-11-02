/** @type {import('pocketpages').MiddlewareLoaderFunc} */
module.exports = function (api) {
    const { getAuthenticatedUser, prepareSiteAndHeroViewData } = require(`${__hooks}/pages/utils/common.js`);
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

    const siteConfig = prepareSiteAndHeroViewData();
    const baseUrl = siteConfig.baseUrl;
    const siteTitle = siteConfig.siteTitle;
    const siteDesc = siteConfig.siteDescription;
    const pageUrl = pathname === '/' ? `${baseUrl}/` : `${baseUrl}${pathname}`;
    const user = getAuthenticatedUser(api.request);

    return {
        currentPath: pathname,
        user,
        siteConfig,
        metadata: [
            // Basic metadata
            {
                name: 'title',
                content: siteTitle,
            },
            {
                name: 'description',
                content: siteDesc,
            },
            { name: 'url', content: pageUrl },
            { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' },

            // Open Graph metadata
            {
                name: 'og:title',
                content: siteTitle,
            },
            { name: 'og:type', content: 'website' },
            { name: 'og:url', content: pageUrl },
            {
                name: 'og:image',
                content: `${baseUrl}/og-image.png`,
            },
            {
                name: 'og:image:secure_url',
                content: `${baseUrl}/og-image.png`,
            },
            { name: 'og:image:type', content: 'image/png' },
            { name: 'og:image:alt', content: `${siteTitle} Cover` },
            { name: 'og:image:width', content: '1200' },
            { name: 'og:image:height', content: '630' },
            {
                name: 'og:description',
                content: siteDesc,
            },
            { name: 'og:site_name', content: siteTitle },
            { name: 'og:locale', content: 'en_CA' },

            // Encourage connection—author details
            { name: 'author', content: siteConfig.authorName },
            {
                name: 'article:author',
                content: siteConfig.authorUrl,
            },
            { name: 'article:author:name', content: siteConfig.authorName },
            { name: 'article:publisher', content: `${siteConfig.authorUrl}/` },

            // Twitter Card metadata (optional, but helpful)
            { name: 'twitter:card', content: 'summary_large_image' },
            { name: 'twitter:site', content: siteConfig.twitterHandle },
            { name: 'twitter:creator', content: siteConfig.twitterHandle },
            {
                name: 'twitter:title',
                content: siteTitle,
            },
            {
                name: 'twitter:description',
                content: siteDesc,
            },
            {
                name: 'twitter:image',
                content: `${baseUrl}/og-image.png`,
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
