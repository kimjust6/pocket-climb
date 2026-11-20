const {
    POCKET_COLLECTION_ADMIN_SETTINGS,
    POCKET_ADMIN_IMGUR_CLIENT_ID,
    OPENBETA_MEDIA_BASE_URL,
    IMGUR_UPLOAD_ENDPOINT,
    AUTH_COOKIE_NAME,
    AUTH_COOKIE_MAX_AGE
} = require(`${__hooks}/pages/utils/constants.js`);
const {
    sanitizeSearchTerm,
    trackGAEvent: _trackGAEventBase
} = require(`${__hooks}/pages/utils/analytics.js`);

const {
    getImgurClientId,
    normalizeImgurUrl,
    isValidImgurDirectUrl,
    resolveClimbMediaUrl,
    parseClimbMediaTimestamp,
    formatClimbMediaDate,
    formatClimbMediaItem,
    uploadImageUrlToImgur,
    uploadBase64ToImgur,
} = require(`${__hooks}/pages/utils/media.js`);
const {
    toNoCookie,
    extractPreviewText,
    escapeHtml,
    resolveMarkdownHref,
    formatInlineMarkdownText,
    renderInlineMarkdown,
    renderMarkdown,
} = require(`${__hooks}/pages/utils/markdown.js`);
function trackGAEvent(eventName, eventParams = {}, req = null) {
    return _trackGAEventBase(eventName, eventParams, req, extractCookiesMap);
}

function formatDateTime(date) {
    const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
    ]

    const month = months[date.getMonth()]
    const day = date.getDate().toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${month} ${day}, ${year}`
}

function getBaseUrl() {
    try {
        if (typeof $app !== 'undefined' && $app?.settings) {
            const meta = $app.settings()?.meta;
            const appUrl = meta?.appURL || meta?.appUrl;
            if (appUrl && !/localhost|127\.0\.0\.1/i.test(appUrl)) {
                return appUrl.replace(/\/+$/, '');
            }
        }
    } catch (err) {
        if (typeof $app !== 'undefined' && $app?.logger) {
            $app.logger().error('Error getting appURL from settings', 'error', err);
        }
    }
    return 'https://wiki-bloc.jkim.win';
}

/**
 * 
 * @param {string} title 
 * @returns {string}
 */
function slugifyTitle(title) {
    if (!title) return '';
    return title
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
}

/**
 *
 * @param {string} key
 * @returns {string|null}
 */

function getAdminSetting(key) {
    if (!key) {
        return null;
    }
    let record = new Record();
    try {

        $app.recordQuery(POCKET_COLLECTION_ADMIN_SETTINGS)
            .andWhere($dbx.hashExp({ "key": key }))
            .limit(1)
            .one(record)
    }
    catch (err) {
        $app.logger().error("Error querying admin settings:", "error", err);
        return null;
    }

    return record.get("value") ?? null;
}

/**
 * Helper to update an existing metadata entry or append a new one
 */
function setOrUpdateMeta(metadata, name, content) {
    if (!metadata || !Array.isArray(metadata) || content === undefined || content === null) return;
    const existing = metadata.find((m) => m.name === name);
    if (existing) {
        existing.content = String(content);
    } else {
        metadata.push({ name, content: String(content) });
    }
}

/**
 * Apply standard SEO, OpenGraph, and Twitter Card metadata for a page.
 * @param {Array} metadata
 * @param {{ title?: string, description?: string, url?: string, image?: string, robots?: string }} opts
 */
function applyPageMetadata(metadata, opts = {}) {
    if (!metadata || !Array.isArray(metadata)) return;
    const { title, description, url, image, robots } = opts;

    if (title) {
        setOrUpdateMeta(metadata, 'title', title);
        setOrUpdateMeta(metadata, 'og:title', title);
        setOrUpdateMeta(metadata, 'twitter:title', title);
    }
    if (description) {
        setOrUpdateMeta(metadata, 'description', description);
        setOrUpdateMeta(metadata, 'og:description', description);
        setOrUpdateMeta(metadata, 'twitter:description', description);
    }
    if (url) {
        setOrUpdateMeta(metadata, 'url', url);
        setOrUpdateMeta(metadata, 'og:url', url);
        setOrUpdateMeta(metadata, 'twitter:url', url);
    }
    if (image) {
        setOrUpdateMeta(metadata, 'og:image', image);
        setOrUpdateMeta(metadata, 'og:image:secure_url', image);
        setOrUpdateMeta(metadata, 'twitter:image', image);
        if (title) {
            setOrUpdateMeta(metadata, 'og:image:alt', title);
        }
    }
    if (robots) {
        setOrUpdateMeta(metadata, 'robots', robots);
    }
}

/**
 * Sanitize a redirect target so it is always a safe internal relative path
 * @param {string} redirectParam
 * @returns {string}
 */
function sanitizeRedirectPath(redirectParam) {
    if (!redirectParam || typeof redirectParam !== 'string') return '/';
    const trimmed = redirectParam.trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
        return '/';
    }
    if (trimmed.startsWith('/login') || trimmed.startsWith('/logout')) {
        return '/';
    }
    return trimmed;
}

/**
 * Parse a Cookie header string into a key/value map
 * @param {string} cookieHeader
 * @returns {Object<string, string>}
 */
function parseCookieHeader(cookieHeader) {
    const out = {};
    if (!cookieHeader || typeof cookieHeader !== 'string') return out;
    const parts = cookieHeader.split(';');
    for (let i = 0; i < parts.length; i++) {
        const idx = parts[i].indexOf('=');
        if (idx <= 0) continue;
        const key = parts[i].slice(0, idx).trim();
        let val = parts[i].slice(idx + 1).trim();
        if (!key) continue;
        if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
            val = val.slice(1, -1);
        }
        try {
            val = decodeURIComponent(val);
        } catch (_) {}
        out[key] = val;
    }
    return out;
}

/**
 * Extract a cookies map from either PocketPages request or PocketBase RequestEvent
 * @param {Object|null} reqOrEvent
 * @returns {Object<string, any>}
 */
function extractCookiesMap(reqOrEvent) {
    if (!reqOrEvent) return {};
    try {
        if (typeof reqOrEvent.cookies === 'function') {
            return reqOrEvent.cookies() || {};
        }
        if (reqOrEvent.cookies && typeof reqOrEvent.cookies === 'object') {
            return reqOrEvent.cookies;
        }
        const headerAccessor = reqOrEvent.request?.header || reqOrEvent.header;
        let cookieHeader = '';
        if (headerAccessor && typeof headerAccessor.get === 'function') {
            cookieHeader = headerAccessor.get('Cookie') || '';
        } else if (typeof headerAccessor === 'function') {
            cookieHeader = headerAccessor('Cookie') || '';
        }
        return parseCookieHeader(cookieHeader);
    } catch (_) {
        return {};
    }
}

/**
 * Extract the authenticated user from request cookies, bearer token, or request auth context
 * @param {Object|null} reqOrEvent
 * @returns {{ id: string, email: string, name: string, username: string, displayName: string, verified: boolean } | null}
 */
function getAuthenticatedUser(reqOrEvent) {
    if (!reqOrEvent) return null;

    try {
        const { getAuthRecordFromToken } = require(`${__hooks}/pages/utils/pocket.js`);
        let record = reqOrEvent.auth || reqOrEvent.event?.auth || reqOrEvent.request?.auth || null;

        if (!record) {
            const cookiesMap = extractCookiesMap(reqOrEvent);
            const rawCookie = cookiesMap ? cookiesMap[AUTH_COOKIE_NAME] : null;
            const cookieToken = typeof rawCookie === 'string' ? rawCookie : (rawCookie?.token || rawCookie?.value || null);

            const headerAccessor = reqOrEvent.request?.header || reqOrEvent.header;
            const authHeader = typeof headerAccessor?.get === 'function'
                ? (headerAccessor.get('Authorization') || '')
                : (typeof headerAccessor === 'function' ? (headerAccessor('Authorization') || '') : '');
            const bearerToken = String(authHeader).match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;

            const token = cookieToken || bearerToken;
            if (token) {
                record = getAuthRecordFromToken(token);
            }
        }

        if (!record || !record.id) return null;

        const getStr = (field) => (typeof record.getString === 'function' ? record.getString(field) : (record[field] || ''));
        const getBool = (field) => (typeof record.getBool === 'function' ? record.getBool(field) : Boolean(record[field]));

        const email = getStr('email');
        const name = getStr('name');
        const username = getStr('username');
        const displayName = name || username || (email ? email.split('@')[0] : 'User');

        return {
            id: record.id,
            email,
            name,
            username,
            displayName,
            verified: getBool('verified')
        };
    } catch (_) {
        return null;
    }
}

/**
 * Set the server-side authentication cookie on the response
 * @param {Object} response
 * @param {string} token
 * @param {boolean} rememberMe
 */
function setAuthCookie(response, token, rememberMe = true) {
    if (!response || typeof response.cookie !== 'function' || !token) return;
    const isSecure = getBaseUrl().startsWith('https://');
    const cookieOpts = {
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        secure: isSecure
    };
    if (rememberMe) {
        cookieOpts.maxAge = AUTH_COOKIE_MAX_AGE;
    }
    response.cookie(AUTH_COOKIE_NAME, token, cookieOpts);
}

/**
 * Clear the server-side authentication cookie on the response
 * @param {Object} response
 */
function clearAuthCookie(response) {
    if (!response || typeof response.cookie !== 'function') return;
    response.cookie(AUTH_COOKIE_NAME, '', {
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        maxAge: 0
    });
}

/**
 * Prepare metadata, form handling, and view model for the /login page
 * @param {Object} api - PocketPages request context
 * @param {Object} data - Middleware data object
 * @returns {Object} Login page view model
 */
function prepareLoginPageViewData(api, data = {}) {
    const {
        authenticateUserWithPassword,
        getAuthRecordFromToken,
        getOAuthProviders,
        requestPasswordResetByEmail,
        registerNewUser
    } = require(`${__hooks}/pages/utils/pocket.js`);

    const req = api?.request || null;
    const res = api?.response || null;
    const params = api?.params || {};
    const method = String(req?.method || 'GET').toUpperCase();

    const rawBody = (() => {
        try {
            if (typeof api?.formData === 'function') return api.formData() || {};
            if (api?.formData && typeof api.formData === 'object') return api.formData;
            if (typeof req?.formData === 'function') return req.formData() || {};
        } catch (_) { }
        return {};
    })();

    const redirectTo = sanitizeRedirectPath(rawBody.redirect || params.redirect || '/');
    const requestedMode = String(rawBody.action || params.mode || 'login').toLowerCase();
    let mode = ['login', 'register', 'forgot'].includes(requestedMode) ? requestedMode : 'login';

    let errorMessage = '';
    let successMessage = '';
    let formValues = {
        identity: String(rawBody.identity || rawBody.email || '').trim(),
        email: String(rawBody.email || rawBody.identity || '').trim(),
        name: String(rawBody.name || '').trim(),
        remember: rawBody.remember !== 'false' && rawBody.remember !== '0'
    };

    // If user is already logged in on GET, redirect them straight to their destination
    const existingUser = data?.user || getAuthenticatedUser(req);
    if (method === 'GET' && existingUser && !params.mode) {
        if (res && typeof res.redirect === 'function') {
            res.redirect(redirectTo, 302);
        }
        return {
            redirected: true,
            mode,
            redirectTo,
            errorMessage,
            successMessage,
            formValues,
            oauthProviders: []
        };
    }

    if (method === 'POST') {
        const action = String(rawBody.action || 'login').toLowerCase();

        if (action === 'oauth_token') {
            const oauthToken = String(rawBody.token || '').trim();
            const remember = rawBody.remember !== 'false' && rawBody.remember !== '0';
            const record = getAuthRecordFromToken(oauthToken);
            if (record) {
                setAuthCookie(res, oauthToken, remember);
                trackGAEvent('login', {
                    method: 'oauth2',
                    event_category: 'authentication'
                }, req);
                if (res && typeof res.redirect === 'function') {
                    res.redirect(redirectTo, 302);
                }
                return {
                    redirected: true,
                    mode: 'login',
                    redirectTo,
                    errorMessage: '',
                    successMessage: '',
                    formValues,
                    oauthProviders: []
                };
            } else {
                mode = 'login';
                errorMessage = 'OAuth sign-in failed or token expired. Please try again.';
            }
        } else if (action === 'register') {
            mode = 'register';
            const email = String(rawBody.email || '').trim();
            const name = String(rawBody.name || '').trim();
            const password = String(rawBody.password || '');
            const passwordConfirm = String(rawBody.passwordConfirm || '');
            const remember = Boolean(rawBody.remember);

            if (!email || !password) {
                errorMessage = 'Please provide both your email address and a password.';
            } else if (password.length < 8) {
                errorMessage = 'Password must be at least 8 characters long.';
            } else if (password !== passwordConfirm) {
                errorMessage = 'Passwords do not match.';
            } else {
                const regResult = registerNewUser({ email, password, name });
                if (regResult.ok && regResult.token) {
                    setAuthCookie(res, regResult.token, remember);
                    trackGAEvent('sign_up', {
                        method: 'password',
                        event_category: 'authentication'
                    }, req);
                    if (res && typeof res.redirect === 'function') {
                        res.redirect(redirectTo, 302);
                    }
                    return {
                        redirected: true,
                        mode,
                        redirectTo,
                        errorMessage: '',
                        successMessage: '',
                        formValues,
                        oauthProviders: []
                    };
                } else {
                    errorMessage = regResult.error || 'Could not create your account. Please try again.';
                }
            }
        } else if (action === 'forgot') {
            mode = 'forgot';
            const email = String(rawBody.email || rawBody.identity || '').trim();
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                errorMessage = 'Please enter a valid email address to reset your password.';
            } else {
                requestPasswordResetByEmail(email);
                successMessage = 'If an account matches that email address, a password reset link has been sent.';
            }
        } else {
            mode = 'login';
            const identity = String(rawBody.identity || rawBody.email || '').trim();
            const password = String(rawBody.password || '');
            const remember = Boolean(rawBody.remember);

            if (!identity || !password) {
                errorMessage = 'Please enter your email or username and password.';
            } else {
                const authResult = authenticateUserWithPassword(identity, password);
                if (authResult && authResult.token) {
                    setAuthCookie(res, authResult.token, remember);
                    trackGAEvent('login', {
                        method: 'password',
                        event_category: 'authentication'
                    }, req);
                    if (res && typeof res.redirect === 'function') {
                        res.redirect(redirectTo, 302);
                    }
                    return {
                        redirected: true,
                        mode,
                        redirectTo,
                        errorMessage: '',
                        successMessage: '',
                        formValues,
                        oauthProviders: []
                    };
                } else {
                    errorMessage = 'Invalid email/username or password.';
                }
            }
        }
    }

    if (data?.metadata) {
        const pageTitle = mode === 'register'
            ? 'Create Account | Wiki Bloc'
            : mode === 'forgot'
                ? 'Reset Password | Wiki Bloc'
                : 'Sign In | Wiki Bloc';
        const pageDesc = 'Sign in to your account on Wiki Bloc.';
        const canonicalUrl = `${getBaseUrl()}/login`;

        setOrUpdateMeta(data.metadata, 'title', pageTitle);
        setOrUpdateMeta(data.metadata, 'og:title', pageTitle);
        setOrUpdateMeta(data.metadata, 'twitter:title', pageTitle);
        setOrUpdateMeta(data.metadata, 'description', pageDesc);
        setOrUpdateMeta(data.metadata, 'og:description', pageDesc);
        setOrUpdateMeta(data.metadata, 'twitter:description', pageDesc);
        setOrUpdateMeta(data.metadata, 'url', canonicalUrl);
        setOrUpdateMeta(data.metadata, 'og:url', canonicalUrl);
        setOrUpdateMeta(data.metadata, 'twitter:url', canonicalUrl);
        setOrUpdateMeta(data.metadata, 'robots', 'noindex, nofollow');
    }

    const oauthProviders = getOAuthProviders();

    return {
        redirected: false,
        mode,
        redirectTo,
        errorMessage,
        successMessage,
        formValues,
        oauthProviders
    };
}

/**
 * Format an integer with comma separators (e.g. 206261 -> "206,261")
 * @param {number} num
 * @returns {string}
 */
function formatNumberWithCommas(num) {
    const n = Number(num) || 0;
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Build canonical Area URL (/area/:slug/:id)
 * @param {string} id
 * @param {string} name
 * @returns {string}
 */
function buildAreaUrl(id, name) {
    const slug = slugifyTitle(String(name || "area")) || "area";
    return `/area/${encodeURIComponent(slug)}/${encodeURIComponent(String(id || ""))}`;
}

/**
 * Build canonical Climb URL (/climb/:slug/:id)
 * @param {string} id
 * @param {string} name
 * @returns {string}
 */
function buildClimbUrl(id, name) {
    const slug = slugifyTitle(String(name || "climb")) || "climb";
    return `/climb/${encodeURIComponent(slug)}/${encodeURIComponent(String(id || ""))}`;
}

/**
 * Load site metadata, hero cards, social links, and footer info from `admin_settings` in PocketBase
 * @returns {object}
 */
function prepareSiteAndHeroViewData() {
    const { getHomepageSettingsMap } = require(`${__hooks}/pages/utils/pocket.js`);
    const settings = getHomepageSettingsMap();

    let socials = [];
    try {
        if (settings.HERO_SOCIAL_LINKS) {
            socials = JSON.parse(settings.HERO_SOCIAL_LINKS);
        }
    } catch (_) {}

    let heroCards = [];
    try {
        if (settings.HERO_CARDS) {
            heroCards = JSON.parse(settings.HERO_CARDS);
        }
    } catch (_) {}

    let featuredCountries = [];
    try {
        if (settings.FEATURED_COUNTRY_CODES) {
            featuredCountries = JSON.parse(settings.FEATURED_COUNTRY_CODES);
        }
    } catch (_) {}

    return {
        siteTitle: settings.SITE_TITLE || "",
        siteDescription: settings.SITE_DESCRIPTION || "",
        baseUrl: settings.SITE_BASE_URL || getBaseUrl(),
        authorName: settings.SITE_AUTHOR || "",
        authorUrl: settings.SITE_AUTHOR_URL || "",
        twitterHandle: settings.SITE_TWITTER_HANDLE || "",
        copyrightText: settings.SITE_COPYRIGHT || "",
        socials: Array.isArray(socials) ? socials : [],
        heroCards: Array.isArray(heroCards) ? heroCards : [],
        featuredCountries: Array.isArray(featuredCountries) ? featuredCountries : []
    };
}

/**
 * Search climbs, crags / sub-areas, and location records for directory search
 * @param {string} rawQuery
 * @param {string} countryFilter
 * @returns {object} { crags, climbs, totalCrags, totalClimbs }
 */
function searchDirectoryItems(rawQuery, countryFilter = "ALL") {
    const cleanQuery = sanitizeSearchTerm(rawQuery || "");
    if (!cleanQuery) {
        return {
            crags: [],
            climbs: [],
            totalCrags: 0,
            totalClimbs: 0
        };
    }

    const {
        getHomepageDirectoryAreas,
        getAreas,
        getClimbs
    } = require(`${__hooks}/pages/utils/pocket.js`);

    const normalizedCountry = (countryFilter || "ALL").toUpperCase();
    let targetCountryName = "";
    if (normalizedCountry !== "ALL") {
        const countryMap = {
            CAN: "Canada",
            USA: "USA",
            ZAF: "South Africa",
            DEU: "Germany",
            FRA: "France",
            ESP: "Spain",
            AUS: "Australia",
            ITA: "Italy",
            CHE: "Switzerland",
            MEX: "Mexico",
            NZL: "New Zealand",
            THA: "Thailand",
            GRC: "Greece"
        };
        targetCountryName = countryMap[normalizedCountry] || normalizedCountry;
    }

    // Exclude top-level directory root nodes (countries and US states) so they only show in Locations
    let shownUuids = new Set();
    try {
        const directoryRecords = getHomepageDirectoryAreas();
        shownUuids = new Set(directoryRecords.map((r) => r.getString("openbetaUuid")));
    } catch (_) {}

    // Search Crags / Sub-areas
    const areasResult = getAreas(1, 40, cleanQuery);
    const crags = (areasResult.items || [])
        .filter((r) => {
            const obUuid = r.getString("openbetaUuid");
            return !shownUuids.has(obUuid);
        })
        .map((r) => {
            const name = r.getString("name");
            const tc = r.getInt("totalClimbs") || 0;
            let pathTokens = [];
            try {
                const rawPt = r.getString("pathTokens") || r.get("pathTokens");
                pathTokens = Array.isArray(rawPt)
                    ? rawPt
                    : typeof rawPt === "string" && rawPt.startsWith("[")
                        ? JSON.parse(rawPt)
                        : [];
            } catch (_) {}

            const pathSummary = pathTokens.length > 1
                ? pathTokens.slice(0, -1).join(" › ")
                : (pathTokens[0] || "");

            return {
                id: r.id,
                name,
                totalClimbs: tc,
                formattedClimbs: formatNumberWithCommas(tc),
                pathTokens,
                pathSummary,
                url: buildAreaUrl(r.id, name)
            };
        })
        .filter((crag) => {
            if (!targetCountryName) return true;
            return (
                crag.pathTokens.some((tok) => tok.toLowerCase().includes(targetCountryName.toLowerCase())) ||
                crag.pathSummary.toLowerCase().includes(targetCountryName.toLowerCase())
            );
        })
        .sort((a, b) => {
            const aNameMatch = a.name.toLowerCase().includes(cleanQuery.toLowerCase());
            const bNameMatch = b.name.toLowerCase().includes(cleanQuery.toLowerCase());
            if (aNameMatch && !bNameMatch) return -1;
            if (!aNameMatch && bNameMatch) return 1;
            return (b.totalClimbs || 0) - (a.totalClimbs || 0);
        });

    // Search Climbs
    const climbsResult = getClimbs(1, 50, cleanQuery);
    const climbs = (climbsResult.items || [])
        .map((cl) => {
            const name = cl.getString("name");
            const { primaryGrade } = buildGradeDetails(cl);
            const clPathTokens = parseJsonArrayField(cl, "pathTokens");
            const disciplines = parseJsonArrayField(cl, "disciplines");
            const areaId = cl.getString("area") || cl.getString("areaUuid") || "";
            const areaName = clPathTokens.length > 0 ? clPathTokens[clPathTokens.length - 1] : "Area";
            const pathSummary = clPathTokens.length > 1
                ? clPathTokens.slice(0, -1).join(" › ")
                : (clPathTokens[0] || "");

            return {
                id: cl.id,
                name,
                grade: primaryGrade,
                disciplines,
                pathTokens: clPathTokens,
                pathSummary,
                areaName,
                areaUrl: areaId ? buildAreaUrl(areaId, areaName) : "/",
                url: buildClimbUrl(cl.id, name)
            };
        })
        .filter((climb) => {
            if (!targetCountryName) return true;
            return (
                climb.pathTokens.some((tok) => tok.toLowerCase().includes(targetCountryName.toLowerCase())) ||
                climb.pathSummary.toLowerCase().includes(targetCountryName.toLowerCase())
            );
        })
        .sort((a, b) => {
            const aNameMatch = a.name.toLowerCase().includes(cleanQuery.toLowerCase());
            const bNameMatch = b.name.toLowerCase().includes(cleanQuery.toLowerCase());
            if (aNameMatch && !bNameMatch) return -1;
            if (!aNameMatch && bNameMatch) return 1;
            return 0;
        });

    return {
        crags,
        climbs,
        totalCrags: crags.length,
        totalClimbs: climbs.length
    };
}

/**
 * Prepare homepage Countries & Climbing Locations directory view model from PocketBase DB
 * @param {object} params
 * @param {object} reqObj
 * @param {object} data
 * @returns {object}
 */
function prepareHomepageDirectoryViewData(params = {}, reqObj = null, data = null) {
    const {
        getHomepageDirectoryAreas,
        getDatabaseCatalogStats,
        getAreas,
        getClimbs
    } = require(`${__hooks}/pages/utils/pocket.js`);

    const siteConfig = data?.siteConfig || prepareSiteAndHeroViewData();
    const rawQuery = typeof params?.query === "string" ? params.query.trim() : "";
    const cleanQuery = sanitizeSearchTerm(rawQuery);
    const countryFilter = typeof params?.country === "string" ? params.country.trim().toUpperCase() : "";

    if (cleanQuery && reqObj) {
        trackGAEvent("view_search_results", {
            search_term: cleanQuery,
            search_category: "climbing_locations"
        }, reqObj);
    }

    const directoryRecords = getHomepageDirectoryAreas();
    const areaItems = directoryRecords.map((r) => {
        const uuid = r.getString("openbetaUuid");
        const name = r.getString("name");
        const totalClimbs = r.getInt("totalClimbs") || 0;
        const geoPoint = r.getGeoPoint("coordinates");
        const pathTokens = parseJsonArrayField(r, "pathTokens");
        const ancestors = parseJsonArrayField(r, "ancestors");

        return {
            id: r.id,
            uuid,
            name,
            shortCode: r.getString("shortCode") || "",
            parentUuid: r.getString("parentUuid") || "",
            totalClimbs,
            formattedClimbs: formatNumberWithCommas(totalClimbs),
            isDestination: r.getBool("isDestination"),
            isBoulder: r.getBool("isBoulder"),
            coordinates: {
                lon: geoPoint?.lon || 0,
                lat: geoPoint?.lat || 0
            },
            lat: geoPoint?.lat || 0,
            lng: geoPoint?.lon || 0,
            pathTokens,
            ancestors,
            url: buildAreaUrl(r.id, name)
        };
    });

    const rootCountries = areaItems.filter((a) => !a.parentUuid);
    const usaRoot = rootCountries.find((c) => c.shortCode === "USA" || c.name === "USA") || null;
    const usaUuid = usaRoot ? usaRoot.uuid : "";

    // Group direct children by parentUuid and destinations by country/state ancestor UUID
    const childrenByParentUuid = {};
    const destinationsByGroupUuid = {};
    for (const item of areaItems) {
        if (!item.parentUuid) continue;

        (childrenByParentUuid[item.parentUuid] ||= []).push(item);

        if (item.isDestination) {
            const groupUuid = (usaUuid && item.ancestors[0] === usaUuid && item.ancestors.length >= 2)
                ? item.ancestors[1]
                : (item.ancestors[0] || item.parentUuid);
            if (groupUuid && groupUuid !== item.uuid) {
                (destinationsByGroupUuid[groupUuid] ||= []).push(item);
            }
        }
    }

    const qLower = rawQuery.toLowerCase();
    const matchesSearch = (item, childList = []) => {
        if (!qLower) return true;
        if (item.name.toLowerCase().includes(qLower) || item.shortCode.toLowerCase().includes(qLower)) {
            return true;
        }
        return childList.some((ch) => ch.name.toLowerCase().includes(qLower));
    };

    // Priority order from DB `FEATURED_COUNTRY_CODES` setting
    const priorityOrder = {};
    for (let i = 0; i < siteConfig.featuredCountries.length; i++) {
        const fc = siteConfig.featuredCountries[i];
        if (fc && fc.code && fc.priority > 0) {
            priorityOrder[fc.code] = fc.priority;
        }
    }

    const allInternationalCountries = rootCountries
        .filter((c) => !usaRoot || c.uuid !== usaRoot.uuid)
        .sort((a, b) => {
            const pA = priorityOrder[a.shortCode] || 99;
            const pB = priorityOrder[b.shortCode] || 99;
            if (pA !== pB) return pA - pB;
            return a.name.localeCompare(b.name);
        })
        .map((country) => {
            const dests = destinationsByGroupUuid[country.uuid] || [];
            const rawChildren = childrenByParentUuid[country.uuid] || [];
            const seenLocUuids = {};
            const mergedLocations = [];
            for (let i = 0; i < rawChildren.length; i++) {
                const rc = rawChildren[i];
                if (rc.uuid && !seenLocUuids[rc.uuid]) {
                    seenLocUuids[rc.uuid] = true;
                    mergedLocations.push(rc);
                }
            }
            for (let i = 0; i < dests.length; i++) {
                const d = dests[i];
                if (d.uuid && !seenLocUuids[d.uuid]) {
                    seenLocUuids[d.uuid] = true;
                    mergedLocations.push(d);
                }
            }
            const locations = mergedLocations.sort((a, b) =>
                b.totalClimbs - a.totalClimbs || a.name.localeCompare(b.name)
            );
            return {
                ...country,
                isFeaturedCountry: Boolean(priorityOrder[country.shortCode]),
                locations
            };
        });

    const internationalCountries = allInternationalCountries
        .map((country) => {
            const filteredLocations = qLower
                ? country.locations.filter(
                    (loc) =>
                        loc.name.toLowerCase().includes(qLower) ||
                        country.name.toLowerCase().includes(qLower)
                )
                : country.locations;
            return {
                ...country,
                locations: filteredLocations
            };
        })
        .filter((country) => {
            if (countryFilter && countryFilter !== "ALL" && countryFilter !== "INTL") {
                if (country.shortCode !== countryFilter && country.uuid !== countryFilter) return false;
            }
            if (countryFilter === "USA") return false;
            return matchesSearch(country, country.locations);
        });

    const rawUsaStates = usaRoot
        ? (childrenByParentUuid[usaRoot.uuid] || []).sort((a, b) => a.name.localeCompare(b.name))
        : [];

    const allUsaStates = rawUsaStates.map((state) => {
        const stateDests = (destinationsByGroupUuid[state.uuid] || []).sort(
            (a, b) => b.totalClimbs - a.totalClimbs || a.name.localeCompare(b.name)
        );
        return {
            ...state,
            destinations: stateDests
        };
    });

    const usaStates = allUsaStates
        .map((state) => {
            const filteredDestinations = qLower
                ? state.destinations.filter(
                    (dest) =>
                        dest.name.toLowerCase().includes(qLower) ||
                        state.name.toLowerCase().includes(qLower)
                )
                : state.destinations;

            return {
                ...state,
                destinations: filteredDestinations
            };
        })
        .filter((state) => {
            if (countryFilter && countryFilter !== "ALL" && countryFilter !== "USA") {
                return false;
            }
            return matchesSearch(state, state.destinations);
        });

    // Build quick country navigation links dynamically from DB countries + DB settings
    const quickNavLinks = [{ code: "ALL", label: "All Countries", href: "/" }];
    for (let i = 0; i < siteConfig.featuredCountries.length; i++) {
        const fc = siteConfig.featuredCountries[i];
        if (!fc || !fc.code) continue;
        const countryRec = rootCountries.find((c) => c.shortCode === fc.code || c.name === fc.label);
        if (countryRec) {
            quickNavLinks.push({
                code: countryRec.shortCode || fc.code,
                label: fc.label || countryRec.name,
                href: `/?country=${encodeURIComponent(countryRec.shortCode || fc.code)}`,
                areaUrl: countryRec.url
            });
        }
    }

    // Query database catalog counts directly from PocketBase SQLite tables
    const dbStats = getDatabaseCatalogStats(usaUuid);

    // If user entered a search query, search deep areas/crags and climbs in the DB
    let matchingSubAreas = [];
    let matchingClimbs = [];
    if (rawQuery) {
        const searchResults = searchDirectoryItems(rawQuery, countryFilter);
        matchingSubAreas = searchResults.crags;
        matchingClimbs = searchResults.climbs;
    }

    return {
        searchQuery: rawQuery,
        hasSearchQuery: Boolean(rawQuery),
        countryFilter: countryFilter || "ALL",
        quickNavLinks,
        stats: {
            totalCountries: dbStats.totalCountries,
            totalStates: dbStats.totalStates,
            totalAreas: dbStats.totalAreas,
            formattedTotalAreas: formatNumberWithCommas(dbStats.totalAreas),
            totalDestinations: dbStats.totalDestinations,
            totalClimbs: dbStats.totalClimbs,
            formattedTotalClimbs: formatNumberWithCommas(dbStats.totalClimbs),
            totalTicks: dbStats.totalTicks,
            formattedTotalTicks: formatNumberWithCommas(dbStats.totalTicks),
            totalOrganizations: dbStats.totalOrganizations
        },
        internationalCountries,
        allInternationalCountries,
        usa: usaRoot
            ? {
                ...usaRoot,
                states: usaStates
            }
            : null,
        allUsa: usaRoot
            ? {
                ...usaRoot,
                states: allUsaStates
            }
            : null,
        matchingSubAreas,
        matchingClimbs,
        hasResults:
            internationalCountries.length > 0 ||
            usaStates.length > 0 ||
            matchingSubAreas.length > 0 ||
            matchingClimbs.length > 0
    };
}

/**
 * Safely parse a JSON array field from a PocketBase Record
 * @param {Record} record
 * @param {string} fieldName
 * @returns {Array<any>}
 */
function parseJsonArrayField(record, fieldName) {
    if (!record || !fieldName) return [];
    try {
        const raw = record.getString(fieldName) || record.get(fieldName);
        if (Array.isArray(raw)) return raw;
        if (typeof raw === "string") {
            const trimmed = raw.trim();
            if (trimmed.startsWith("[")) {
                const parsed = JSON.parse(trimmed);
                return Array.isArray(parsed) ? parsed : [];
            }
            if (trimmed) return [trimmed];
        }
    } catch (_) {}
    return [];
}

const GRADE_CONVERSION_TABLE = [
    { rank: 10, yds: '5.5',   fr: '4b',  font: '4',   v: 'VB',  uiaa: 'IV+',  ewbank: '13', brit: '4b', tier: 'Beginner' },
    { rank: 14, yds: '5.6',   fr: '4c',  font: '4+',  v: 'V0-', uiaa: 'V-',   ewbank: '14', brit: '4b', tier: 'Beginner' },
    { rank: 17, yds: '5.7',   fr: '5a',  font: '5',   v: 'V0',  uiaa: 'V',    ewbank: '15', brit: '4c', tier: 'Beginner' },
    { rank: 20, yds: '5.8',   fr: '5b',  font: '5+',  v: 'V1',  uiaa: 'VI-',  ewbank: '16', brit: '4c', tier: 'Intermediate' },
    { rank: 24, yds: '5.9',   fr: '5c',  font: '6A',  v: 'V2',  uiaa: 'VI',   ewbank: '17', brit: '5a', tier: 'Intermediate' },
    { rank: 28, yds: '5.10a', fr: '6a',  font: '6A+', v: 'V3',  uiaa: 'VI+',  ewbank: '18', brit: '5a', tier: 'Intermediate' },
    { rank: 30, yds: '5.10b', fr: '6a+', font: '6B',  v: 'V3',  uiaa: 'VII-', ewbank: '19', brit: '5b', tier: 'Intermediate' },
    { rank: 32, yds: '5.10c', fr: '6b',  font: '6B+', v: 'V4',  uiaa: 'VII',  ewbank: '20', brit: '5b', tier: 'Intermediate' },
    { rank: 34, yds: '5.10d', fr: '6b+', font: '6C',  v: 'V4',  uiaa: 'VII+', ewbank: '21', brit: '5c', tier: 'Intermediate' },
    { rank: 38, yds: '5.11a', fr: '6c',  font: '6C+', v: 'V5',  uiaa: 'VIII-',ewbank: '22', brit: '5c', tier: 'Advanced' },
    { rank: 40, yds: '5.11b', fr: '6c',  font: '7A',  v: 'V5',  uiaa: 'VIII', ewbank: '23', brit: '6a', tier: 'Advanced' },
    { rank: 42, yds: '5.11c', fr: '6c+', font: '7A',  v: 'V6',  uiaa: 'VIII', ewbank: '24', brit: '6a', tier: 'Advanced' },
    { rank: 44, yds: '5.11d', fr: '7a',  font: '7A+', v: 'V6',  uiaa: 'VIII+',ewbank: '25', brit: '6a', tier: 'Advanced' },
    { rank: 48, yds: '5.12a', fr: '7a+', font: '7B',  v: 'V7',  uiaa: 'IX-',  ewbank: '26', brit: '6b', tier: 'Advanced' },
    { rank: 50, yds: '5.12b', fr: '7b',  font: '7B+', v: 'V8',  uiaa: 'IX',   ewbank: '27', brit: '6b', tier: 'Advanced' },
    { rank: 52, yds: '5.12c', fr: '7b+', font: '7C',  v: 'V8',  uiaa: 'IX+',  ewbank: '28', brit: '6c', tier: 'Advanced' },
    { rank: 54, yds: '5.12d', fr: '7c',  font: '7C+', v: 'V9',  uiaa: 'IX+',  ewbank: '29', brit: '6c', tier: 'Advanced' },
    { rank: 58, yds: '5.13a', fr: '7c+', font: '8A',  v: 'V10', uiaa: 'X-',   ewbank: '30', brit: '7a', tier: 'Expert' },
    { rank: 60, yds: '5.13b', fr: '8a',  font: '8A+', v: 'V11', uiaa: 'X',    ewbank: '31', brit: '7a', tier: 'Expert' },
    { rank: 62, yds: '5.13c', fr: '8a+', font: '8B',  v: 'V12', uiaa: 'X+',   ewbank: '32', brit: '7b', tier: 'Expert' },
    { rank: 64, yds: '5.13d', fr: '8b',  font: '8B+', v: 'V13', uiaa: 'X+',   ewbank: '33', brit: '7b', tier: 'Expert' },
    { rank: 68, yds: '5.14a', fr: '8b+', font: '8C',  v: 'V14', uiaa: 'XI-',  ewbank: '34', brit: '7b', tier: 'Elite' },
    { rank: 70, yds: '5.14b', fr: '8c',  font: '8C+', v: 'V15', uiaa: 'XI',   ewbank: '35', brit: '7c', tier: 'Elite' },
    { rank: 72, yds: '5.14c', fr: '8c+', font: '9A',  v: 'V16', uiaa: 'XI+',  ewbank: '36', brit: '7c', tier: 'Elite' },
    { rank: 74, yds: '5.14d', fr: '9a',  font: '9A+', v: 'V17', uiaa: 'XI+',  ewbank: '37', brit: '7c', tier: 'Elite' },
    { rank: 78, yds: '5.15a', fr: '9a+', font: '9B',  v: 'V17', uiaa: 'XII-', ewbank: '38', brit: '8a', tier: 'Elite' },
    { rank: 82, yds: '5.15b', fr: '9b',  font: '9B+', v: 'V18', uiaa: 'XII',  ewbank: '39', brit: '8a', tier: 'Elite' }
];

/**
 * Compute difficulty rank, difficulty tier, and cross-system equivalent grades
 * @param {object} gradesObj
 * @returns {object}
 */
function computeClimbGradeMetrics(gradesObj = {}) {
    const raw = String(gradesObj.primaryGrade || gradesObj.gradeYds || gradesObj.gradeVscale || '').trim();
    if (!raw) {
        return {
            difficultyRank: 0,
            difficultyTier: 'Unrated',
            isBouldering: false,
            gradeConversions: []
        };
    }

    const s = raw.toUpperCase();
    let rank = 20;

    const V_RANKS = [17, 20, 24, 28, 32, 38, 42, 48, 50, 54, 58, 60, 62];
    const LOW_YDS_RANKS = { 6: 14, 7: 17, 8: 20, 9: 24 };
    const YDS_SUB_OFFSETS = { a: 0, '-': 0, b: 2, c: 4, '+': 4, d: 6 };

    const vMatch = s.match(/^V(\d+)/);
    if (vMatch) {
        const vNum = parseInt(vMatch[1], 10);
        rank = vNum < V_RANKS.length ? V_RANKS[vNum] : 64 + Math.min(18, (vNum - 13) * 2);
    } else if (s === 'VB' || s === 'V-EASY') {
        rank = 10;
    } else {
        const ydsMatch = s.match(/^5\.(\d+)([ABCD+-]?)/);
        if (ydsMatch) {
            const num = parseInt(ydsMatch[1], 10);
            const mod = (ydsMatch[2] || '').toLowerCase();
            if (num < 6) {
                rank = 10;
            } else if (LOW_YDS_RANKS[num]) {
                rank = LOW_YDS_RANKS[num];
            } else {
                const sub = YDS_SUB_OFFSETS[mod] ?? 2;
                rank = 28 + (Math.min(num, 15) - 10) * 10 + sub;
            }
        } else {
            const frMatch = s.match(/^([4-9])([ABC])(\+?)/);
            if (frMatch) {
                const base = parseInt(frMatch[1], 10);
                const letter = frMatch[2].toLowerCase();
                const plus = frMatch[3] === '+';
                const sub = (letter === 'a' ? 0 : letter === 'b' ? 2 : 4) + (plus ? 1 : 0);
                rank = 14 + (base - 4) * 8 + sub;
            }
        }
    }

    let tier = 'Beginner';
    if (rank > 64) tier = 'Elite';
    else if (rank > 54) tier = 'Expert';
    else if (rank > 34) tier = 'Advanced';
    else if (rank > 17) tier = 'Intermediate';

    let bestRow = GRADE_CONVERSION_TABLE[0];
    let minDiff = 999;
    for (let i = 0; i < GRADE_CONVERSION_TABLE.length; i++) {
        const row = GRADE_CONVERSION_TABLE[i];
        const diff = Math.abs(row.rank - rank);
        if (diff < minDiff) {
            minDiff = diff;
            bestRow = row;
        }
    }

    const isBouldering = Boolean(gradesObj.gradeVscale || gradesObj.gradeFont || vMatch || s.startsWith('V'));

    const gradeConversions = [
        { system: 'YDS', value: gradesObj.gradeYds || bestRow.yds, region: 'USA' },
        { system: 'French', value: gradesObj.gradeFrench || bestRow.fr, region: 'Europe / Sport' },
        { system: 'Font', value: gradesObj.gradeFont || bestRow.font, region: 'Fontainebleau' },
        { system: 'V-Scale', value: gradesObj.gradeVscale || bestRow.v, region: 'USA Bouldering' },
        { system: 'UIAA', value: gradesObj.gradeUiaa || bestRow.uiaa, region: 'Central Europe' },
        { system: 'Ewbank', value: gradesObj.gradeEwbank || bestRow.ewbank, region: 'Australia / NZ' },
        { system: 'British', value: bestRow.brit, region: 'UK Tech' }
    ];

    return {
        difficultyRank: rank,
        difficultyTier: tier,
        isBouldering,
        gradeConversions
    };
}

/**
 * Extract normalized grade strings and ordered grade pills from a climb or pitch record
 * @param {Record} record
 * @returns {object}
 */
function buildGradeDetails(record) {
    const getStr = (f) => (record && typeof record.getString === "function" ? record.getString(f) || "" : "");
    const gradeYds = getStr("gradeYds");
    const gradeVscale = getStr("gradeVscale");
    const gradeFrench = getStr("gradeFrench");
    const gradeFont = getStr("gradeFont");
    const gradeEwbank = getStr("gradeEwbank");
    const gradeBrazilianCrux = getStr("gradeBrazilianCrux");
    const gradeUiaa = getStr("gradeUiaa");
    const gradeWi = getStr("gradeWi");

    const primaryGrade =
        gradeYds ||
        gradeVscale ||
        gradeFrench ||
        gradeFont ||
        gradeEwbank ||
        gradeUiaa ||
        gradeWi ||
        gradeBrazilianCrux ||
        "";

    const allGrades = [];
    if (gradeYds) allGrades.push({ system: "YDS", value: gradeYds });
    if (gradeVscale) allGrades.push({ system: "V", value: gradeVscale });
    if (gradeFrench && gradeFrench !== gradeYds) allGrades.push({ system: "FR", value: gradeFrench });
    if (gradeFont && gradeFont !== gradeVscale) allGrades.push({ system: "Font", value: gradeFont });
    if (gradeEwbank) allGrades.push({ system: "Ewbank", value: gradeEwbank });
    if (gradeUiaa) allGrades.push({ system: "UIAA", value: gradeUiaa });
    if (gradeWi) allGrades.push({ system: "WI", value: gradeWi });
    if (gradeBrazilianCrux) allGrades.push({ system: "BR", value: gradeBrazilianCrux });

    const { difficultyRank, difficultyTier, isBouldering, gradeConversions } = computeClimbGradeMetrics({
        primaryGrade,
        gradeYds,
        gradeVscale,
        gradeFrench,
        gradeFont,
        gradeEwbank,
        gradeUiaa
    });

    return {
        primaryGrade,
        gradeYds,
        gradeVscale,
        gradeFrench,
        gradeFont,
        gradeEwbank,
        gradeBrazilianCrux,
        gradeUiaa,
        gradeWi,
        allGrades,
        difficultyRank,
        difficultyTier,
        isBouldering,
        gradeConversions
    };
}

/**
 * Build area breadcrumb links from pathTokens and ancestor UUIDs
 * @param {Array<string>} pathTokens
 * @param {Array<string>} ancestors
 * @param {boolean} markLastCurrent
 * @returns {Array<object>}
 */
function buildAreaBreadcrumbs(pathTokens = [], ancestors = [], markLastCurrent = true) {
    const { getAreasMapByUuids } = require(`${__hooks}/pages/utils/pocket.js`);
    const ancestorRecordsByUuid = getAreasMapByUuids(ancestors);
    const breadcrumbs = [];
    const crumbLen = Math.min(pathTokens.length, ancestors.length);
    for (let i = 0; i < crumbLen; i++) {
        const ancUuid = ancestors[i];
        const ancRec = ancestorRecordsByUuid[ancUuid];
        const ancId = ancRec ? ancRec.id : ancUuid;
        breadcrumbs.push({
            name: pathTokens[i],
            id: ancId,
            uuid: ancUuid,
            url: buildAreaUrl(ancId, pathTokens[i]),
            isCurrent: markLastCurrent && i === crumbLen - 1
        });
    }
    return breadcrumbs;
}

/**
 * Format and group climb_media records by climb ID, sorted newest-first
 * @param {Array<Record>} rawMediaRecords
 * @param {string} currentUserId
 * @returns {Object<string, Array<object>>}
 */
function groupFormattedClimbMedia(rawMediaRecords = [], currentUserId = '') {
    const mediaByClimbId = {};
    for (const mRec of rawMediaRecords) {
        const mClimbId = mRec.getString('climb');
        if (!mClimbId) continue;
        const formatted = formatClimbMediaItem(mRec, currentUserId);
        if (!formatted) continue;
        (mediaByClimbId[mClimbId] ||= []).push(formatted);
    }
    for (const items of Object.values(mediaByClimbId)) {
        items.sort((a, b) => (b.sortTimestamp || 0) - (a.sortTimestamp || 0));
    }
    return mediaByClimbId;
}

/**
 * Format a climb PocketBase record into a full view object shared across Area and Climb views
 * @param {Record} cl
 * @param {Array<object>} mediaList
 * @returns {object}
 */
function formatClimbSummary(cl, mediaList = []) {
    const name = cl.getString("name") || "Unnamed Climb";
    const gradeInfo = buildGradeDetails(cl);
    const disciplines = parseJsonArrayField(cl, "disciplines");
    const clPathTokens = parseJsonArrayField(cl, "pathTokens");

    const clAreaId = cl.getString("area") || cl.getString("areaUuid") || "";
    const clSubAreaName = clPathTokens.length > 0 ? clPathTokens[clPathTokens.length - 1] : "";

    const safety = cl.getString("safety") || "";
    const clGeo = cl.getGeoPoint("coordinates");
    const clLat = clGeo?.lat || 0;
    const clLng = clGeo?.lon || 0;
    const pitchesCount = cl.getInt("pitchesCount") || 1;

    const clDesc = cl.getString("description") || "";
    const clLoc = cl.getString("location") || "";
    const clProt = cl.getString("protection") || "";
    const rawFa = cl.getString("fa") || "";

    return {
        id: cl.id,
        uuid: cl.getString("openbetaUuid"),
        name,
        url: buildClimbUrl(cl.id, name),
        fa: rawFa && rawFa.toLowerCase() !== "unknown" ? rawFa : "",
        length: cl.getInt("length") || 0,
        boltsCount: cl.getInt("boltsCount") || 0,
        pitchesCount,
        safety: safety !== "UNSPECIFIED" ? safety : "",
        ...gradeInfo,
        disciplines,
        coordinates: {
            lon: clLng,
            lat: clLat
        },
        lat: clLat,
        lng: clLng,
        hasCoords: typeof clLat === "number" && typeof clLng === "number" && (clLat !== 0 || clLng !== 0),
        description: clDesc,
        descriptionHtml: clDesc ? renderMarkdown(clDesc) : "",
        location: clLoc,
        locationHtml: clLoc ? renderMarkdown(clLoc, { inline: true }) : "",
        protection: clProt,
        protectionHtml: clProt ? renderMarkdown(clProt, { inline: true }) : "",
        createdByUser: cl.getString("createdByUser") || "",
        updatedByUser: cl.getString("updatedByUser") || "",
        subAreaName: clSubAreaName && clSubAreaName !== name ? clSubAreaName : "",
        subAreaUrl: clAreaId && clSubAreaName ? buildAreaUrl(clAreaId, clSubAreaName) : "",
        media: mediaList
    };
}

const _areaDetailViewCache = new Map();
const AREA_VIEW_CACHE_TTL_MS = 120 * 1000;

const _climbDetailViewCache = new Map();
const CLIMB_VIEW_CACHE_TTL_MS = 120 * 1000;

function applyClimbMetadata(metadata, viewData) {
    if (!metadata || !viewData || !viewData.climb) return;
    const { climb, parentArea, canonicalPath } = viewData;
    const gradeSuffix = climb.primaryGrade ? ` (${climb.primaryGrade})` : "";
    const areaSuffix = parentArea ? ` — ${parentArea.name}` : "";
    const pageTitle = `${climb.name}${gradeSuffix}${areaSuffix} | Wiki Bloc`;
    const descPieces = [];
    if (climb.primaryGrade) descPieces.push(climb.primaryGrade);
    if (climb.disciplines && climb.disciplines.length > 0) descPieces.push(climb.disciplines.join(", "));
    if (parentArea) descPieces.push(`in ${parentArea.name}`);
    const pageDesc = climb.description
        ? extractPreviewText(climb.description).slice(0, 160)
        : `${climb.name}${descPieces.length ? " — " + descPieces.join(" • ") : ""} climbing route details, photos, and beta on Wiki Bloc.`;
    const canonicalUrl = `${getBaseUrl()}${canonicalPath}`;

    setOrUpdateMeta(metadata, "title", pageTitle);
    setOrUpdateMeta(metadata, "og:title", pageTitle);
    setOrUpdateMeta(metadata, "twitter:title", pageTitle);
    setOrUpdateMeta(metadata, "description", pageDesc);
    setOrUpdateMeta(metadata, "og:description", pageDesc);
    setOrUpdateMeta(metadata, "twitter:description", pageDesc);
    setOrUpdateMeta(metadata, "url", canonicalUrl);
    setOrUpdateMeta(metadata, "og:url", canonicalUrl);
    setOrUpdateMeta(metadata, "twitter:url", canonicalUrl);

    if (climb.media && climb.media.length > 0 && climb.media[0].url) {
        setOrUpdateMeta(metadata, "og:image", climb.media[0].url);
        setOrUpdateMeta(metadata, "og:image:secure_url", climb.media[0].url);
        setOrUpdateMeta(metadata, "twitter:image", climb.media[0].url);
    }
}

function applyAreaMetadata(metadata, viewData) {
    if (!metadata || !viewData) return;
    const pageTitle = `${viewData.name} Climbing Guide | Wiki Bloc`;
    const pageDesc = viewData.description
        ? extractPreviewText(viewData.description).slice(0, 160)
        : `Explore ${formatNumberWithCommas(viewData.totalClimbs)} rock climbing routes, boulders, and crags in ${viewData.name}.`;
    const canonicalUrl = `${getBaseUrl()}${viewData.canonicalPath}`;

    setOrUpdateMeta(metadata, "title", pageTitle);
    setOrUpdateMeta(metadata, "og:title", pageTitle);
    setOrUpdateMeta(metadata, "twitter:title", pageTitle);
    setOrUpdateMeta(metadata, "description", pageDesc);
    setOrUpdateMeta(metadata, "og:description", pageDesc);
    setOrUpdateMeta(metadata, "twitter:description", pageDesc);
    setOrUpdateMeta(metadata, "url", canonicalUrl);
    setOrUpdateMeta(metadata, "og:url", canonicalUrl);
    setOrUpdateMeta(metadata, "twitter:url", canonicalUrl);
}

/**
 * Prepare single Area page view model (/area/:slug/:id)
 * Also supports legacy /area/:uuid/:slug, /area/:uuid, and /area/:slug with 301 canonical redirect.
 * @param {object} params
 * @param {object} reqObj
 * @param {object} data
 * @returns {object|null}
 */
function prepareAreaDetailViewData(params = {}, reqObj = null, data = null) {
    const {
        getOrSyncAreaDetail,
        getAreasByNamePrefix,
        getClimbMediaByClimbIds
    } = require(`${__hooks}/pages/utils/pocket.js`);

    const seg1 = typeof (params?.title ?? params?.uuid) === "string"
        ? (params.title ?? params.uuid).trim()
        : "";
    const seg2 = typeof (params?.id ?? params?.slug) === "string"
        ? (params.id ?? params.slug).trim()
        : "";

    if (!seg1 && !seg2) return null;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let lookupKey = "";
    if (uuidRegex.test(seg1)) {
        // Legacy /area/:uuid/:slug or /area/:uuid
        lookupKey = seg1;
    } else if (seg2) {
        // Canonical /area/:slug/:id (or /area/:slug/:uuid)
        lookupKey = seg2;
    } else {
        // Single segment /area/:idOrSlug
        lookupKey = seg1;
    }

    const cachedEntry = _areaDetailViewCache.get(lookupKey);
    if (cachedEntry && (Date.now() - cachedEntry.time < AREA_VIEW_CACHE_TTL_MS)) {
        applyAreaMetadata(data?.metadata, cachedEntry.data);
        return cachedEntry.data;
    }

    const _t0 = Date.now();
    let { areaRecord, childAreas, climbs, isDescendantClimbs } = getOrSyncAreaDetail(lookupKey);
    const _t1 = Date.now();

    // Fallback: if single-segment /area/:slug was visited, resolve by slug match
    if (!areaRecord && seg1 && !seg2 && !uuidRegex.test(seg1)) {
        const firstWord = seg1.split("-")[0].replace(/"/g, '\\"');
        const candidates = getAreasByNamePrefix(firstWord);
        const targetSlug = seg1.toLowerCase();
        const matched = candidates.find(
            (a) => slugifyTitle(a.getString("name")) === targetSlug
        );
        if (matched) {
            const detail = getOrSyncAreaDetail(matched.id);
            areaRecord = detail.areaRecord;
            childAreas = detail.childAreas;
            climbs = detail.climbs;
            isDescendantClimbs = detail.isDescendantClimbs;
        }
    }
    const _t2 = Date.now();

    if (!areaRecord) return null;

    const uuid = areaRecord.getString("openbetaUuid") || lookupKey;
    const name = areaRecord.getString("name") || "Climbing Area";
    const canonicalSlug = slugifyTitle(name) || "area";
    const canonicalPath = buildAreaUrl(areaRecord.id, name);
    const shouldRedirect = seg1 !== canonicalSlug || seg2 !== areaRecord.id;

    const totalClimbs = areaRecord.getInt("totalClimbs") || climbs.length || 0;
    const description = areaRecord.getString("description") || "";
    const areaLocation = areaRecord.getString("areaLocation") || "";
    const areaGeo = areaRecord.getGeoPoint("coordinates");
    const lat = areaGeo?.lat || 0;
    const lng = areaGeo?.lon || 0;
    const shortCode = areaRecord.getString("shortCode") || "";
    const createdByUser = areaRecord.getString("createdByUser") || "";
    const updatedByUser = areaRecord.getString("updatedByUser") || "";

    const pathTokens = parseJsonArrayField(areaRecord, "pathTokens");
    const ancestors = parseJsonArrayField(areaRecord, "ancestors");
    const breadcrumbs = buildAreaBreadcrumbs(pathTokens, ancestors, true);
    if (breadcrumbs.length === 0) {
        breadcrumbs.push({
            name,
            id: areaRecord.id,
            uuid,
            url: canonicalPath,
            isCurrent: true
        });
    }

    const formattedChildren = (childAreas || []).map((ch) => {
        const chUuid = ch.getString("openbetaUuid");
        const chName = ch.getString("name");
        const chClimbs = ch.getInt("totalClimbs") || 0;
        const chGeo = ch.getGeoPoint("coordinates");
        return {
            id: ch.id,
            uuid: chUuid,
            name: chName,
            shortCode: ch.getString("shortCode") || "",
            totalClimbs: chClimbs,
            formattedClimbs: formatNumberWithCommas(chClimbs),
            isDestination: ch.getBool("isDestination"),
            isLeaf: ch.getBool("isLeaf"),
            isBoulder: ch.getBool("isBoulder"),
            coordinates: {
                lon: chGeo?.lon || 0,
                lat: chGeo?.lat || 0
            },
            lat: chGeo?.lat || 0,
            lng: chGeo?.lon || 0,
            url: buildAreaUrl(ch.id, chName)
        };
    });

    const currentUser = data?.user || getAuthenticatedUser(reqObj);
    const currentUserId = currentUser?.id || '';
    const imgurClientId = getImgurClientId();

    const _t3 = Date.now();
    const climbIds = (climbs || []).map((cl) => cl.id).filter(Boolean);
    const mediaByClimbId = groupFormattedClimbMedia(getClimbMediaByClimbIds(climbIds), currentUserId);
    const _t4 = Date.now();
    const formattedClimbs = (climbs || []).map((cl) => formatClimbSummary(cl, mediaByClimbId[cl.id] || []));
    const _t5 = Date.now();

    if (reqObj && !shouldRedirect) {
        trackGAEvent("select_content", {
            content_type: "climbing_area",
            item_id: areaRecord.id,
            item_name: sanitizeSearchTerm(name)
        }, reqObj);
    }
    const _t6 = Date.now();

    if (typeof $app !== "undefined" && $app.logger) {
        $app.logger().info("prepareAreaDetailViewData timing",
            "getOrSyncAreaDetail", (_t1 - _t0),
            "mediaQuery", (_t4 - _t3),
            "formatClimbs", (_t5 - _t4),
            "trackGAEvent", (_t6 - _t5),
            "total", (_t6 - _t0)
        );
    }

    if (data?.metadata) {
        const pageTitle = `${name} Climbing Guide | Wiki Bloc`;
        const pageDesc = description
            ? extractPreviewText(description).slice(0, 160)
            : `Explore ${formatNumberWithCommas(totalClimbs)} rock climbing routes, boulders, and crags in ${name}.`;
        const canonicalUrl = `${getBaseUrl()}${canonicalPath}`;

        setOrUpdateMeta(data.metadata, "title", pageTitle);
        setOrUpdateMeta(data.metadata, "og:title", pageTitle);
        setOrUpdateMeta(data.metadata, "twitter:title", pageTitle);
        setOrUpdateMeta(data.metadata, "description", pageDesc);
        setOrUpdateMeta(data.metadata, "og:description", pageDesc);
        setOrUpdateMeta(data.metadata, "twitter:description", pageDesc);
        setOrUpdateMeta(data.metadata, "url", canonicalUrl);
        setOrUpdateMeta(data.metadata, "og:url", canonicalUrl);
        setOrUpdateMeta(data.metadata, "twitter:url", canonicalUrl);
    }

    const result = {
        id: areaRecord.id,
        uuid,
        name,
        shortCode,
        totalClimbs,
        formattedClimbs: formatNumberWithCommas(totalClimbs),
        description,
        descriptionHtml: renderMarkdown(description),
        areaLocation,
        areaLocationHtml: renderMarkdown(areaLocation),
        createdByUser,
        updatedByUser,
        lat,
        lng,
        hasCoords: typeof lat === "number" && typeof lng === "number" && (lat !== 0 || lng !== 0),
        breadcrumbs,
        children: formattedChildren,
        climbs: formattedClimbs,
        isDescendantClimbs: Boolean(isDescendantClimbs),
        url: canonicalPath,
        canonicalPath,
        shouldRedirect,
        isAuthenticated: Boolean(currentUser),
        isImgurConfigured: Boolean(imgurClientId),
        imgurClientId: currentUser ? imgurClientId : ''
    };

    if (_areaDetailViewCache.size > 200) {
        const firstKey = _areaDetailViewCache.keys().next().value;
        _areaDetailViewCache.delete(firstKey);
    }
    _areaDetailViewCache.set(lookupKey, { time: Date.now(), data: result });
    if (areaRecord.id !== lookupKey) {
        _areaDetailViewCache.set(areaRecord.id, { time: Date.now(), data: result });
    }

    return result;
}

/**
 * Prepare single Climb page view model (/climb/:slug/:id)
 * Supports /climb/:slug/:id, /climb/:uuid/:slug, /climb/:uuid, /climb/:id, and /climb/:slug with 301 canonical redirect.
 * @param {object} params
 * @param {object} reqObj
 * @param {object} data
 * @returns {object|null}
 */
function prepareClimbDetailViewData(params = {}, reqObj = null, data = null) {
    const {
        getOrSyncClimbDetail,
        getClimbsByNamePrefix
    } = require(`${__hooks}/pages/utils/pocket.js`);

    const seg1 = typeof (params?.title ?? params?.uuid) === "string"
        ? (params.title ?? params.uuid).trim()
        : "";
    const seg2 = typeof (params?.id ?? params?.slug) === "string"
        ? (params.id ?? params.slug).trim()
        : "";

    if (!seg1 && !seg2) return null;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let lookupKey = "";
    if (uuidRegex.test(seg1)) {
        lookupKey = seg1;
    } else if (seg2) {
        lookupKey = seg2;
    } else {
        lookupKey = seg1;
    }

    const cachedEntry = _climbDetailViewCache.get(lookupKey);
    if (cachedEntry && (Date.now() - cachedEntry.time < CLIMB_VIEW_CACHE_TTL_MS)) {
        applyClimbMetadata(data?.metadata, cachedEntry.data);
        return cachedEntry.data;
    }

    let detail = getOrSyncClimbDetail(lookupKey);

    if (!detail.climbRecord && seg1 && !seg2 && !uuidRegex.test(seg1)) {
        const firstWord = seg1.split("-")[0].replace(/"/g, '\\"');
        const candidates = getClimbsByNamePrefix(firstWord);
        const targetSlug = seg1.toLowerCase();
        const matched = candidates.find(
            (c) => slugifyTitle(c.getString("name")) === targetSlug
        );
        if (matched) {
            detail = getOrSyncClimbDetail(matched.id);
        }
    }

    const { climbRecord, areaRecord, pitches, ticks, media, siblingClimbs } = detail;
    if (!climbRecord) return null;

    const currentUser = data?.user || getAuthenticatedUser(reqObj);
    const currentUserId = currentUser?.id || '';
    const imgurClientId = getImgurClientId();

    const mediaByClimbId = groupFormattedClimbMedia(media, currentUserId);
    const climb = formatClimbSummary(climbRecord, mediaByClimbId[climbRecord.id] || []);
    const canonicalSlug = slugifyTitle(climb.name) || "climb";
    const canonicalPath = climb.url;
    const shouldRedirect = seg1 !== canonicalSlug || seg2 !== climbRecord.id;

    const pathTokens = parseJsonArrayField(climbRecord, "pathTokens");
    const ancestors = parseJsonArrayField(climbRecord, "ancestors");
    const breadcrumbs = buildAreaBreadcrumbs(pathTokens, ancestors, false);

    let parentArea = null;
    if (areaRecord) {
        const areaName = areaRecord.getString("name") || "Area";
        parentArea = {
            id: areaRecord.id,
            name: areaName,
            url: buildAreaUrl(areaRecord.id, areaName)
        };
    } else if (breadcrumbs.length > 0) {
        const lastArea = breadcrumbs[breadcrumbs.length - 1];
        parentArea = {
            id: lastArea.id,
            name: lastArea.name,
            url: lastArea.url
        };
    }

    breadcrumbs.push({
        name: climb.name,
        id: climb.id,
        uuid: climb.uuid,
        url: canonicalPath,
        isCurrent: true
    });

    const formattedPitches = (pitches || []).map((p, idx) => {
        const pitchDesc = p.getString("description") || "";
        return {
            id: p.id,
            pitchNumber: p.getInt("pitchNumber") || idx + 1,
            length: p.getInt("length") || 0,
            boltsCount: p.getInt("boltsCount") || 0,
            ...buildGradeDetails(p),
            disciplines: parseJsonArrayField(p, "disciplines"),
            description: pitchDesc,
            descriptionHtml: renderMarkdown(pitchDesc)
        };
    });

    const formattedTicks = (ticks || []).map((t) => {
        const rawDate = t.getString("dateClimbed") || t.getString("created") || "";
        return {
            id: t.id,
            name: t.getString("name") || "",
            style: t.getString("style") || "",
            attemptType: t.getString("attemptType") || "",
            grade: t.getString("grade") || "",
            dateFormatted: formatClimbMediaDate(rawDate),
            notes: t.getString("notes") || ""
        };
    });

    const formattedSiblings = (siblingClimbs || []).map((s) => {
        const sName = s.getString("name") || "Unnamed Climb";
        const { primaryGrade } = buildGradeDetails(s);
        return {
            id: s.id,
            name: sName,
            primaryGrade,
            disciplines: parseJsonArrayField(s, "disciplines"),
            url: buildClimbUrl(s.id, sName)
        };
    });

    if (reqObj && !shouldRedirect) {
        trackGAEvent("select_content", {
            content_type: "climbing_route",
            item_id: climb.id,
            item_name: sanitizeSearchTerm(climb.name)
        }, reqObj);
    }

    if (data?.metadata) {
        const gradeSuffix = climb.primaryGrade ? ` (${climb.primaryGrade})` : "";
        const areaSuffix = parentArea ? ` — ${parentArea.name}` : "";
        const pageTitle = `${climb.name}${gradeSuffix}${areaSuffix} | Wiki Bloc`;
        const descPieces = [];
        if (climb.primaryGrade) descPieces.push(climb.primaryGrade);
        if (climb.disciplines.length > 0) descPieces.push(climb.disciplines.join(", "));
        if (parentArea) descPieces.push(`in ${parentArea.name}`);
        const pageDesc = climb.description
            ? extractPreviewText(climb.description).slice(0, 160)
            : `${climb.name}${descPieces.length ? " — " + descPieces.join(" • ") : ""} climbing route details, photos, and beta on Wiki Bloc.`;
        const canonicalUrl = `${getBaseUrl()}${canonicalPath}`;

        setOrUpdateMeta(data.metadata, "title", pageTitle);
        setOrUpdateMeta(data.metadata, "og:title", pageTitle);
        setOrUpdateMeta(data.metadata, "twitter:title", pageTitle);
        setOrUpdateMeta(data.metadata, "description", pageDesc);
        setOrUpdateMeta(data.metadata, "og:description", pageDesc);
        setOrUpdateMeta(data.metadata, "twitter:description", pageDesc);
        setOrUpdateMeta(data.metadata, "url", canonicalUrl);
        setOrUpdateMeta(data.metadata, "og:url", canonicalUrl);
        setOrUpdateMeta(data.metadata, "twitter:url", canonicalUrl);

        if (climb.media && climb.media.length > 0 && climb.media[0].url) {
            setOrUpdateMeta(data.metadata, "og:image", climb.media[0].url);
            setOrUpdateMeta(data.metadata, "og:image:secure_url", climb.media[0].url);
            setOrUpdateMeta(data.metadata, "twitter:image", climb.media[0].url);
        }
    }

    const result = {
        climb,
        parentArea,
        breadcrumbs,
        pitches: formattedPitches,
        ticks: formattedTicks,
        siblingClimbs: formattedSiblings,
        url: canonicalPath,
        canonicalPath,
        shouldRedirect,
        isAuthenticated: Boolean(currentUser),
        isImgurConfigured: Boolean(imgurClientId),
        imgurClientId: currentUser ? imgurClientId : ''
    };

    if (_climbDetailViewCache.size > 300) {
        const firstKey = _climbDetailViewCache.keys().next().value;
        _climbDetailViewCache.delete(firstKey);
    }
    _climbDetailViewCache.set(lookupKey, { time: Date.now(), data: result });
    if (climbRecord.id !== lookupKey) {
        _climbDetailViewCache.set(climbRecord.id, { time: Date.now(), data: result });
    }

    return result;
}

module.exports = {
    formatDateTime,
    getAdminSetting,
    getImgurClientId,
    normalizeImgurUrl,
    isValidImgurDirectUrl,
    resolveClimbMediaUrl,
    formatClimbMediaItem,
    uploadBase64ToImgur,
    uploadImageUrlToImgur,
    slugifyTitle,
    trackGAEvent,
    sanitizeSearchTerm,
    extractPreviewText,
    escapeHtml,
    resolveMarkdownHref,
    renderInlineMarkdown,
    renderMarkdown,
    toNoCookie,
    setOrUpdateMeta,
    applyPageMetadata,
    getBaseUrl,
    sanitizeRedirectPath,
    getAuthenticatedUser,
    setAuthCookie,
    clearAuthCookie,
    prepareLoginPageViewData,
    formatNumberWithCommas,
    buildAreaUrl,
    buildClimbUrl,
    searchDirectoryItems,
    prepareSiteAndHeroViewData,
    prepareHomepageDirectoryViewData,
    prepareAreaDetailViewData,
    prepareClimbDetailViewData,
    computeClimbGradeMetrics
};

