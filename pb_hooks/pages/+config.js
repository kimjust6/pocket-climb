module.exports = function (api) {
    return {
        plugins: [
            {
                name: 'pocketpages-plugin-js-sdk',
                options: {
                    // Use the regular SDK instead of JSVM
                    sdk: 'pocketbase',
                },
            },
            'pocketpages-plugin-ejs',
            {
                name: 'status-responder',
                fn: () => ({
                    name: 'status-responder',
                    onResponse: ({ content, api }) => {
                        if (api.response && typeof api.response.header === 'function' && api.response.header('Location')) {
                            return true;
                        }
                        const status = api.status || api.data?.status || 200;
                        api.response.html(status, content);
                        return true;
                    },
                }),
            },
        ],
        debug: true,
    }
}
