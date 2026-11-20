const {
    POCKET_ADMIN_IMGUR_CLIENT_ID,
    OPENBETA_MEDIA_BASE_URL,
    IMGUR_UPLOAD_ENDPOINT,
} = require(`${__hooks}/pages/utils/constants.js`);

function _getAdminSetting(key) {
    const { getAdminSetting } = require(`${__hooks}/pages/utils/common.js`);
    return getAdminSetting(key);
}


/**
 * Read the Imgur Client-ID from environment variables or admin_settings
 * @returns {string}
 */
function getImgurClientId() {
    try {
        if (typeof process !== 'undefined' && process?.env?.IMGUR_CLIENT_ID) {
            const val = String(process.env.IMGUR_CLIENT_ID).trim();
            if (val) return val;
        }
    } catch (_) {}

    try {
        if (typeof $os !== 'undefined' && typeof $os.getenv === 'function') {
            const val = String($os.getenv('IMGUR_CLIENT_ID') || '').trim();
            if (val) return val;
        }
    } catch (_) {}

    const dbVal = _getAdminSetting(POCKET_ADMIN_IMGUR_CLIENT_ID);
    return dbVal ? String(dbVal).trim() : '';
}

/**
 * Normalize an Imgur direct image URL to HTTPS
 * @param {string} rawUrl
 * @returns {string}
 */
function normalizeImgurUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    return rawUrl.trim().replace(/^http:\/\/i\.imgur\.com\//i, 'https://i.imgur.com/');
}

/**
 * Validate that a URL is a direct Imgur image link
 * @param {string} rawUrl
 * @returns {boolean}
 */
function isValidImgurDirectUrl(rawUrl) {
    const clean = normalizeImgurUrl(rawUrl).split(/[?#]/)[0];
    return /^https:\/\/i\.imgur\.com\/[A-Za-z0-9]{4,16}\.(jpe?g|png|gif|webp)$/i.test(clean);
}

/**
 * Resolve stored climb_media.mediaUrl into a renderable HTTPS image URL
 * @param {string} rawUrl
 * @returns {string}
 */
function resolveClimbMediaUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    const trimmed = normalizeImgurUrl(rawUrl);
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('/')) return `${OPENBETA_MEDIA_BASE_URL}${trimmed}`;
    return `${OPENBETA_MEDIA_BASE_URL}/${trimmed}`;
}

/**
 * Parse climb_media uploadTime or created timestamp into epoch milliseconds
 * @param {string} uploadTime
 * @param {string} created
 * @returns {number}
 */
function parseClimbMediaTimestamp(uploadTime = '', created = '') {
    const candidates = [uploadTime, created];
    for (let i = 0; i < candidates.length; i++) {
        const raw = String(candidates[i] || '').trim();
        if (!raw) continue;
        if (/^\d{10,13}$/.test(raw)) {
            const num = parseInt(raw, 10);
            return raw.length === 10 ? num * 1000 : num;
        }
        const normalized = raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw;
        const ms = Date.parse(normalized);
        if (!isNaN(ms)) return ms;
    }
    return 0;
}

/**
 * Format climb_media timestamp for display
 * @param {string} rawDate
 * @returns {string}
 */
function formatClimbMediaDate(rawDate) {
    const ms = parseClimbMediaTimestamp(rawDate, '');
    if (!ms) return '';
    try {
        return new Date(ms).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (_) {
        return '';
    }
}

/**
 * Format a climb_media PocketBase record into a safe view model
 * @param {Record} record
 * @param {string} currentUserId
 * @returns {object|null}
 */
function formatClimbMediaItem(record, currentUserId = '') {
    if (!record) return null;
    const rawUrl = typeof record.getString === 'function' ? record.getString('mediaUrl') : (record.mediaUrl || '');
    const url = resolveClimbMediaUrl(rawUrl);
    if (!url) return null;

    const rawOriginal = typeof record.getString === 'function' ? record.getString('originalUrl') : (record.originalUrl || '');
    let fallbackUrl = resolveClimbMediaUrl(rawOriginal);
    if (!fallbackUrl && record.entityTags) {
        try {
            const tags = typeof record.entityTags === 'string' ? JSON.parse(record.entityTags) : record.entityTags;
            if (tags && typeof tags === 'object' && !Array.isArray(tags) && tags.originalUrl) {
                fallbackUrl = resolveClimbMediaUrl(tags.originalUrl);
            }
        } catch (_) {}
    }
    if (!fallbackUrl) {
        fallbackUrl = url;
    }

    const getStr = (field) => (typeof record.getString === 'function' ? record.getString(field) : (record[field] || ''));
    const getIntVal = (field) => (typeof record.getInt === 'function' ? record.getInt(field) : (parseInt(record[field], 10) || 0));

    const uploadTimeRaw = getStr('uploadTime');
    const createdRaw = getStr('created');
    const ownerId = getStr('user');

    return {
        id: record.id,
        url,
        fallbackUrl,
        originalUrl: fallbackUrl,
        width: getIntVal('width'),
        height: getIntVal('height'),
        format: getStr('format'),
        size: getIntVal('size'),
        username: getStr('username'),
        uploadTime: formatClimbMediaDate(uploadTimeRaw || createdRaw),
        sortTimestamp: parseClimbMediaTimestamp(uploadTimeRaw, createdRaw),
        canDelete: Boolean(currentUserId && ownerId && ownerId === currentUserId)
    };
}

/**
 * Upload an image URL directly to Imgur anonymously via Client-ID
 * @param {string} imageUrl
 * @param {string} title
 * @param {string} clientId
 * @returns {{ ok: boolean, status: number, error?: string, link?: string }}
 */
function uploadImageUrlToImgur(imageUrl, title = '', clientId = '') {
    const resolvedClientId = (clientId || getImgurClientId() || '').trim();
    if (!resolvedClientId) {
        return {
            ok: false,
            status: 503,
            error: 'Imgur upload is not configured. Set IMGUR_CLIENT_ID in .env or admin_settings.'
        };
    }

    const rawUrl = String(imageUrl || '').trim();
    if (!rawUrl) {
        return { ok: false, status: 400, error: 'Image URL is required.' };
    }

    if (typeof $http === 'undefined' || !$http.send) {
        return { ok: false, status: 500, error: 'HTTP client is unavailable.' };
    }

    try {
        const bodyParts = [
            `image=${encodeURIComponent(rawUrl)}`,
            'type=url'
        ];
        if (title) {
            bodyParts.push(`title=${encodeURIComponent(String(title).slice(0, 120))}`);
        }

        const res = $http.send({
            url: IMGUR_UPLOAD_ENDPOINT,
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'WikiBloc/1.0',
                Authorization: `Client-ID ${resolvedClientId}`
            },
            body: bodyParts.join('&'),
            timeout: 25
        });

        let json = null;
        try {
            json = typeof res.json === 'object' && res.json !== null ? res.json : JSON.parse(res.raw || '{}');
        } catch (_) {
            json = null;
        }

        if (!res || res.statusCode < 200 || res.statusCode >= 300 || !json?.success || !json?.data?.link) {
            const errMsg = json?.data?.error?.message || json?.data?.error || `Imgur upload failed (${res?.statusCode || 'network error'}).`;
            return {
                ok: false,
                status: res?.statusCode || 500,
                error: errMsg
            };
        }

        let link = String(json.data.link);
        if (link.startsWith('http://')) {
            link = 'https://' + link.slice(7);
        }

        return {
            ok: true,
            status: res.statusCode,
            link,
            id: json.data.id || '',
            width: json.data.width || 0,
            height: json.data.height || 0,
            size: json.data.size || 0
        };
    } catch (err) {
        return {
            ok: false,
            status: 500,
            error: err?.message || String(err)
        };
    }
}

/**
 * Upload a base64 image string to Imgur anonymously via Client-ID (server fallback)
 * @param {string} base64Input
 * @param {string} title
 * @param {string} clientId
 * @returns {{ ok: boolean, status: number, error?: string, data?: object }}
 */
function uploadBase64ToImgur(base64Input, title = '', clientId = '') {
    const resolvedClientId = (clientId || getImgurClientId() || '').trim();
    if (!resolvedClientId) {
        return {
            ok: false,
            status: 503,
            error: 'Imgur upload is not configured. Set IMGUR_CLIENT_ID in .env or admin_settings.'
        };
    }

    const stripped = String(base64Input || '')
        .trim()
        .replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
    if (!stripped) {
        return { ok: false, status: 400, error: 'Image data is required.' };
    }

    // ~20 MB binary image limit (~27.5 MB base64 string)
    if (stripped.length > 28000000) {
        return { ok: false, status: 413, error: 'Image is too large. Maximum size is 20 MB.' };
    }

    if (typeof $http === 'undefined' || !$http.send) {
        return { ok: false, status: 500, error: 'HTTP client is unavailable.' };
    }

    try {
        const payload = {
            image: stripped,
            type: 'base64'
        };
        if (title) {
            payload.title = String(title).slice(0, 120);
        }

        const res = $http.send({
            url: IMGUR_UPLOAD_ENDPOINT,
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'WikiBloc/1.0',
                Authorization: `Client-ID ${resolvedClientId}`
            },
            body: JSON.stringify(payload),
            timeout: 30
        });

        let json = null;
        try {
            json = typeof res.json === 'object' && res.json !== null ? res.json : JSON.parse(res.raw || '{}');
        } catch (_) {
            json = null;
        }

        if (!res || res.statusCode < 200 || res.statusCode >= 300 || !json?.success || !json?.data?.link) {
            const errMsg = json?.data?.error?.message || json?.data?.error || `Imgur upload failed (${res?.statusCode || 'network error'}).`;
            return {
                ok: false,
                status: res?.statusCode >= 400 && res?.statusCode < 600 ? res.statusCode : 502,
                error: String(errMsg)
            };
        }

        const imgData = json.data;
        const mimeType = String(imgData.type || '');
        const format = mimeType.includes('/') ? mimeType.split('/')[1] : '';
        return {
            ok: true,
            status: 200,
            data: {
                mediaUrl: normalizeImgurUrl(imgData.link),
                width: parseInt(imgData.width, 10) || 0,
                height: parseInt(imgData.height, 10) || 0,
                size: parseInt(imgData.size, 10) || 0,
                format,
                imgurId: String(imgData.id || '')
            }
        };
    } catch (err) {
        return {
            ok: false,
            status: 502,
            error: err?.message || 'Failed to upload image to Imgur.'
        };
    }
}

module.exports = {
    getImgurClientId,
    normalizeImgurUrl,
    isValidImgurDirectUrl,
    resolveClimbMediaUrl,
    parseClimbMediaTimestamp,
    formatClimbMediaDate,
    formatClimbMediaItem,
    uploadImageUrlToImgur,
    uploadBase64ToImgur,
};
