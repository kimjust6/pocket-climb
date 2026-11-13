const {
    POCKET_SLA_BREACHING_SOON,
    ZENDESK_API_ENDPOINT,
    ZENDESK_ASSIGNEE_ID_JUSTIN,
    POCKET_COLLECTION_ZENDESK_TICKETS,
    POCKET_ZENDESKUSER_DISCORDUSER,
    POCKET_COLLECTION_ADMIN_SETTINGS,
    POCKET_ADMIN_DISCORD_BOT_TOKEN,
    POCKET_ADMIN_IMGUR_CLIENT_ID,
    OPENBETA_MEDIA_BASE_URL,
    IMGUR_UPLOAD_ENDPOINT,
    DISCORD_API_ENDPOINT,
    DISCORD_ID_JUSTIN,
    POCKET_COLLECTION_ZENDESK_ORGANIZATIONS,
    ZENDESK_STATUS_CHANGED_TYPE,
    ZENDESK_CLOSED_STATUS,
    ZENDESK_TICKET_CREATED,
    AUTH_COOKIE_NAME,
    AUTH_COOKIE_MAX_AGE
} = require(`${__hooks}/pages/utils/constants.js`);


/**
 * 
 * @param {Object} data 
 * @returns {Object|null}
 */
function privateGetBody(data) {
    // Handle both webhook format and stored record format
    // Webhook format: data.body.body or data.body
    // Stored format: data (already at the body level)

    // If data has body.body structure (webhook format)
    if (data?.body?.body) {
        return data.body.body;
    }

    // If data has body structure (webhook format)
    if (data?.body) {
        return data.body;
    }

    // If data has detail directly (stored format after JSON.parse)
    if (data?.detail) {
        return data;
    }

    // Otherwise return data as-is (might be the body itself)
    return data ?? null;
}

/**
 *
 * @param {Object} data
 * @returns {boolean}
 */
function privateIsStatusChangedEvent(data) {
    const body = privateGetBody(data);
    return body?.type === ZENDESK_STATUS_CHANGED_TYPE;
}

function isTicketClosed(data) {
    const body = privateGetBody(data);
    return privateIsStatusChangedEvent(data)
        && body?.detail?.status === ZENDESK_CLOSED_STATUS;
}

/**
 *
 * @param {Object} data
 * @returns {number}
 */
function getTicketId(data) {
    const body = privateGetBody(data);
    // Try multiple paths to find ticket ID
    let ticketId = body?.detail?.id ?? body?.id ?? body?.subject ?? "0";

    // If it's already a number, return it
    if (typeof ticketId === 'number') {
        return ticketId;
    }

    // If it's a string with format like "Ticket: 12345", extract the number
    if (typeof ticketId === 'string') {
        ticketId = ticketId.split(":").pop().trim();
    }

    return parseInt(ticketId) || 0;
}

/**
 *
 * @param {Object} data
 * @returns {string|null}
 */
function getTicketTitle(data) {
    const body = privateGetBody(data);
    return body?.detail?.subject ?? body?.subject ?? null;
}

/**
 *
 * @param {Object} data
 * @returns {string|null}
 */
function getTicketType(data) {
    const body = privateGetBody(data);
    return body?.type ?? body?.detail?.type ?? null;
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
 * @param {Object} data
 * @param {string} assignee_id
 * @returns {boolean}
 */
function isJustinsTicket(data, assignee_id = ZENDESK_ASSIGNEE_ID_JUSTIN) {
    // get zendesk_user_id from data from collection
    // const zendeskUserId = $app.collection("zendeskuser_discorduser").findOne({ description: "justin.kim@verndale.com" })?.zendesk_id;
    const body = privateGetBody(data);
    return body?.detail?.assignee_id === assignee_id;
}

/**
 * 
 * @param {Object} data 
 * @returns {string|null}
 */
function getAssigneeId(data) {
    const body = privateGetBody(data);
    return body?.detail?.assignee_id ?? body?.assignee_id ?? null;
}

/**
 * 
 * @param {Object} data 
 * @returns {string|null}
 */
function getActorId(data) {
    const body = privateGetBody(data);
    return body?.detail?.actor_id ?? body?.actor_id ?? null;
}

/**
 * 
 * @param {Object} ticket 
 * @returns {boolean}
 */
function isSlaBreaching(ticket) {
    const body = privateGetBody(ticket);
    const tagsAdded = body?.event?.tags_added ?? body?.tags_added ?? [];
    return Array.isArray(tagsAdded) && tagsAdded.includes(POCKET_SLA_BREACHING_SOON);
}

/**
 *
 * @param {Object} data
 * @returns {string|null}
 */
function getZendeskUrl(data) {
    let ticketId = getTicketId(data);
    if (!ticketId) {
        return null;
    }
    return `${ZENDESK_API_ENDPOINT}${ticketId}`
}

/**
 * Execute a function after a random delay (0..maxSeconds) using PocketBase cron.
 * Falls back to 1 second window if invalid maxSeconds provided.
 * @param {Function} fn callback to execute
 * @param {number} maxSeconds upper bound of random delay window (seconds)
 */
function runAfterRandomDelay(fn, maxSeconds = 1) {
    try {
        if (typeof fn !== 'function') {
            $app.logger().error('runAfterRandomDelay: fn must be a function');
            return;
        }
        let windowSec = parseFloat(maxSeconds);
        if (isNaN(windowSec) || windowSec < 0) {
            windowSec = 1;
        }
        const delayInSeconds = Math.random() * windowSec; // 0..maxSeconds (ms)
        runAfterDelay(fn, delayInSeconds);
    } catch (err) {
        $app.logger().error('runAfterRandomDelay setup failed', 'error', err);
    }
}


/**
 * Execute a function after delay using PocketBase cron.
 * Falls back to 1 second window if invalid maxSeconds provided.
 * @param {Function} fn callback to execute
 * @param {number} delayInSeconds upper bound of random delay window (seconds)
 */
function runAfterDelay(fn, delayInSeconds = 4) {
    try {
        const delayMs = delayInSeconds * 1000;
        if (typeof setTimeout === 'function') {
            setTimeout(() => {
                try { fn(); } catch (err) { $app.logger().error('runAfterDelay execution error', 'error', err); }
            }, delayMs);
        } else {
            // Fallback: execute immediately if timers unsupported.
            try { fn(); } catch (err) { $app.logger().error('runAfterDelay immediate fallback error', 'error', err); }
        }
    } catch (err) {
        $app.logger().error('runAfterDelay setup failed', 'error', err);
    }
}


// pocketbase.js

/**
 * 
 * @param {Object} data 
 * @returns 
 */
function saveZendeskRecord(data) {
    if (!data) {
        throw new Error("Invalid collection or data");
    }

    let collection = $app.findCollectionByNameOrId(POCKET_COLLECTION_ZENDESK_TICKETS)

    if (!collection) {
        return e.json(404, { error: "zendesk_tickets collection not found" });
    }

    const assigneeId = parseInt(getAssigneeId(data) ?? "0")
    const actorId = parseInt(getActorId(data) ?? "0")

    let record = new Record(collection)
    record.set("data", JSON.stringify(data))
    record.set("ticketId", getTicketId(data))
    record.set("ticketType", getTicketType(data))
    record.set("zendeskUserId", assigneeId)
    record.set("zendeskActorId", actorId)
    record.set("created", Date.now())
    record.set("updated", Date.now())

    $app.save(record);

}


/**
 * 
 * @param {number} data 
 * @param {number} timeInSeconds 
 * @returns 
 */
function findRecentTicketByTicketNumber(data, timeInSeconds = 10) {
    let ticketId
    if (typeof data !== "number") {
        ticketId = getTicketId(data);
    }
    else {
        ticketId = data;
    }

    if (!ticketId) {
        return null;
    }

    let record = new Record();
    $app.recordQuery(POCKET_COLLECTION_ZENDESK_TICKETS)
        .andWhere($dbx.hashExp({ "ticketId": ticketId }))
        .andWhere($dbx.rangeExp("created", Date.now() - timeInSeconds * 1000, Date.now()))
        .orderBy("created DESC")
        .limit(1)
        .one(record)
    // check if the record was created within the last `timeInSeconds` seconds
    if (record) {
        const createdTime = new Date(record.get("created")).getTime();
        const currentTime = Date.now();
        const timeDiff = (currentTime - createdTime)
        if (timeDiff && timeDiff <= timeInSeconds * 1000) {
            return record;
        }
    }
    return null;
}

/**
 * 
 * @param {number} data 
 * @param {number} timeInSeconds 
 * @returns {Array|null}
 */
function findRecentTicketsByTicketNumber(data, timeInSeconds = 10) {
    let ticketId
    if (typeof data !== "number") {
        ticketId = getTicketId(data);
    }
    else {
        ticketId = data;
    }

    if (!ticketId) {
        return [];
    }
    const now = Date.now();
    const dateStart = now - timeInSeconds * 1000;
    const dateEnd = now;

    const records = $app.findRecordsByFilter(
        POCKET_COLLECTION_ZENDESK_TICKETS,
        "ticketId = {:ticketId} && created >= {:dateStart} && created <= {:dateEnd}",
        "created",
        20,
        0,
        {
            "ticketId": ticketId,
            "dateStart": dateStart,
            "dateEnd": dateEnd
        }
    );

    return records || [];
}

/**
 * 
 * @param {number} data 
 * @param {number} timeInSeconds 
 * @returns {Array|null}
 */
function findRecentTicketsByTicketNumber(data, timeInSeconds = 10) {
    let ticketId
    if (typeof data !== "number") {
        ticketId = getTicketId(data);
    }
    else {
        ticketId = data;
    }

    if (!ticketId) {
        return [];
    }
    const now = Date.now();
    const dateStart = now - timeInSeconds * 1000;
    const dateEnd = now;

    const records = $app.findRecordsByFilter(
        POCKET_COLLECTION_ZENDESK_TICKETS,
        "ticketId = {:ticketId} && created >= {:dateStart} && created <= {:dateEnd}",
        "created",
        20,
        0,
        {
            "ticketId": ticketId,
            "dateStart": dateStart,
            "dateEnd": dateEnd
        }
    );

    return records || [];
}

/**
 * Find recent tickets by Zendesk ticketId.
 * @param {number|string|object} data 
 * @param {number} timeInSeconds 
 * @returns {Array}
 */
function findRecentTicketsByTicketNumber2(data, timeInSeconds = 10, actorId = null) {
    let ticketId = typeof data === "number" ? data : getTicketId(data);
    if (ticketId == null) return [];

    // PocketBase expects UTC datetime like "2025-11-02 15:45:22.123Z"
    const now = new Date();
    const dateStart = new Date(now.getTime() - timeInSeconds * 1000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", "Z"); // ensures space separator instead of 'T'

    let filter = `ticketId = ${ticketId} && created >= "${dateStart}"`;
    if (actorId) {
        filter += ` && zendeskActorId = "${actorId}"`;
    }

    const records = $app.findRecordsByFilter(
        POCKET_COLLECTION_ZENDESK_TICKETS,
        filter,
        "created",
        20,
        0
    );

    return records || [];
}

/**
 * 
 * @param {string} assignee_id 
 * @returns {string|null}
 */
function getDiscordIdByAssigneeId(assignee_id) {
    if (!assignee_id) {
        $app.logger().info("No assignee_id provided");
        return null;
    }

    try {
        const records = $app.findRecordsByFilter(
            POCKET_ZENDESKUSER_DISCORDUSER,
            "zendesk_id = {:assigneeId}",
            "-created",
            1,
            0,
            { "assigneeId": String(assignee_id) }
        );

        $app.logger().info("Found records:", "count", records?.length ?? 0);

        if (records && records.length > 0) {
            const discordId = records[0].get("discord_id");
            $app.logger().info("Discord ID found:", "discordId", discordId);
            return discordId ?? null;
        }
        return null;
    } catch (error) {
        $app.logger().error("Error getting Discord ID from PocketBase:", "error", error);
        return null;
    }
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

    const dbVal = getAdminSetting(POCKET_ADMIN_IMGUR_CLIENT_ID);
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

    const getStr = (field) => (typeof record.getString === 'function' ? record.getString(field) : (record[field] || ''));
    const getIntVal = (field) => (typeof record.getInt === 'function' ? record.getInt(field) : (parseInt(record[field], 10) || 0));

    const uploadTimeRaw = getStr('uploadTime');
    const createdRaw = getStr('created');
    const ownerId = getStr('user');

    return {
        id: record.id,
        url,
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

/**
 *
 * @returns {string} discord bot token
 */
function getDiscordBotToken() {
    const envToken = process?.env?.DISCORD_BOT_TOKEN;
    const envTokenTrimmed = envToken ? envToken.trim() : "";
    if (envTokenTrimmed) {
        return envTokenTrimmed;
    }
    const dbToken = getAdminSetting(POCKET_ADMIN_DISCORD_BOT_TOKEN);
    return dbToken ? dbToken.trim() : null;
}



/**
    * Send Discord message using external API endpoint
    * @param {string} message - The message to send
    * @param {string} userId - Discord user ID
    */
function sendDiscordMessage2(message, userId = DISCORD_ID_JUSTIN) {
    const payload = {
        userId,
        message,
    };
    try {
        const res = $http.send({
            url: DISCORD_API_ENDPOINT,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const status = res?.status ?? res?.statusCode ?? 0;
        const rawBody = res?.raw ?? res?.body;
        const text = typeof rawBody === "string" ? rawBody : String(rawBody ?? "");
        $app.logger().info("sendDiscordMessage2 response:", "status", status, "body", text);

        if (status !== 200) {
            $app.logger().warn("sendDiscordMessage2 failed, falling back to sendDiscordMessage");
            const result = sendDiscordMessage(message, userId);
            if (!result?.ok) {
                $app.logger().error("Direct Discord send failed:", "error", result?.error, "diagnostics", JSON.stringify(result?.diagnostics ?? {}));
            } else {
                $app.logger().info("Direct Discord send succeeded");
            }
        }
    } catch (error) {
        $app.logger().error("Error sending Discord message via proxy:", "error", error);
        $app.logger().warn("sendDiscordMessage2 threw, falling back to sendDiscordMessage");
        const result = sendDiscordMessage(message, userId);
        if (!result?.ok) {
            $app.logger().error("Direct Discord send failed:", "error", result?.error, "diagnostics", JSON.stringify(result?.diagnostics ?? {}));
        } else {
            $app.logger().info("Direct Discord send succeeded");
        }
    }
}



/**
 *
 * @param {string} message
 * @param {string} userId
 */
function sendDiscordMessage(message, userId = DISCORD_ID_JUSTIN) {
    const token = getDiscordBotToken();
    if (!token) {
        return { ok: false, error: 'Missing Discord bot token', diagnostics: {} };
    }

    // Small internal helpers
    const decodeBody = (raw) => {
        if (raw == null) return '';
        if (typeof raw === 'string') return raw;
        if (raw instanceof Uint8Array) { try { return new TextDecoder().decode(raw); } catch { return ''; } }
        if (Array.isArray(raw)) { try { return new TextDecoder().decode(Uint8Array.from(raw)); } catch { return raw.map(n => String.fromCharCode(n)).join(''); } }
        return '';
    };
    const parseJson = (raw) => {
        const txt = decodeBody(raw);
        if (!txt.trim()) return null;
        try { return JSON.parse(txt); } catch (err) { return { _raw: txt.slice(0, 300), _parseError: err.message }; }
    };
    const readStatus = (res) => res?.status ?? res?.statusCode ?? res?.code ?? null;
    const mkError = (phase, status, extra) => `${phase} failed: ${extra || ('HTTP ' + status)}`;

    const diagnostics = {};
    try {
        // 1. Create DM channel
        const dmRes = $http.send({
            url: 'https://discord.com/api/v10/users/@me/channels',
            method: 'POST',
            headers: { Authorization: 'Bot ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient_id: userId })
        });
        const dmStatus = readStatus(dmRes);
        const dmJson = parseJson(dmRes.body);
        diagnostics.dm = {
            status: dmStatus,
            keys: Object.keys(dmRes || {}),
            preview: decodeBody(dmRes.body).slice(0, 120),
            parsedHasId: !!dmJson?.id,
            parseError: dmJson?._parseError
        };
        const dmOk = (dmStatus === 200) || (!dmStatus && dmJson?.id);
        if (!dmOk) {
            const reason = dmStatus === 401 ? 'unauthorized (token)' : dmStatus === 403 ? 'forbidden (privacy / no mutual server)' : dmStatus === 429 ? 'rate limited' : 'HTTP ' + dmStatus;
            return { ok: false, error: mkError('channel create', dmStatus, reason), diagnostics };
        }
        if (!dmJson || dmJson._parseError || !dmJson.id) {
            return { ok: false, error: 'channel create parse error', diagnostics };
        }

        // 2. Send message
        const msgRes = $http.send({
            url: `https://discord.com/api/v10/channels/${dmJson.id}/messages`,
            method: 'POST',
            headers: { Authorization: 'Bot ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: message })
        });
        const msgStatus = readStatus(msgRes);
        const msgJson = parseJson(msgRes.body);
        diagnostics.send = {
            status: msgStatus,
            keys: Object.keys(msgRes || {}),
            preview: decodeBody(msgRes.body).slice(0, 120),
            parsedHasId: !!msgJson?.id,
            parseError: msgJson?._parseError
        };
        const msgOk = (msgStatus === 200) || (!msgStatus && (msgJson?.id || msgJson?.message?.id));
        if (!msgOk) {
            const reason = msgStatus === 401 ? 'unauthorized (scope)' : msgStatus === 403 ? 'forbidden (channel)' : msgStatus === 429 ? 'rate limited' : 'HTTP ' + msgStatus;
            return { ok: false, error: mkError('message send', msgStatus, reason), diagnostics };
        }
        if (!msgJson || msgJson._parseError) {
            return { ok: false, error: 'message parse error', diagnostics };
        }

        return { ok: true, channel: dmJson, message: msgJson, diagnostics };
    } catch (err) {
        return { ok: false, error: err?.message || String(err), diagnostics };
    }
}

/**
 * 
 * @param {string | int} id 
 * returns {string | null}
 */
function getOrganizationById(id) {
    if (!id) {
        return null;
    }

    let record = new Record();
    try {
        $app.recordQuery(POCKET_COLLECTION_ZENDESK_ORGANIZATIONS)
            .andWhere($dbx.hashExp({ organizationId: id }))
            .limit(1)
            .one(record);

        // check if record has data
        if (!record || !record.get("id")) {
            return null;
        }

        return record.get("shortHand") ?? null;
    } catch (err) {
        $app.logger().error("Error getting organization:", "error", err);
        return null;
    }
}


function generateNormalTicketMessage(data) {
    organizationName = getOrganizationName(data) ?? "Updated"
    const title = getTicketTitle(data);
    const id = getTicketId(data);
    const url = getZendeskUrl(data);
    if (url && id && title) {
        return ` ${organizationName} | ${id}: [${title}](${url})`;
    }
    else {
        return `Your ticket has been updated: ${url ?? 'No URL available'}`;
    }
}

function generateSlaBreachingSoonMessage(data) {
    const organizationName = `Check SLA ${getOrganizationName(data)}` ?? "Check SLA";
    const title = getTicketTitle(data);
    const id = getTicketId(data);
    const url = getZendeskUrl(data);
    if (url && id && title) {
        return ` ${organizationName} | ${id}: [${title}](${url})`;
    }
    else {
        return `SLA breaching soon: ${url ?? 'No URL available'}`;
    }
}

/**
 * 
 * @param {Object} data 
 */
function getOrganizationName(data) {
    const body = privateGetBody(data);
    const id = body?.detail?.organization_id ?? body?.organization_id ?? null;
    return getOrganizationById(id);
}

function getDiscordIdfromData(data) {
    const assigneeId = getAssigneeId(data);
    if (!assigneeId) {
        $app.logger().error(`Error getting assigneeId from Data in PocketBase:`, "error");
        return null;
    }

    try {
        discordId = getDiscordIdByAssigneeId(assigneeId);
    } catch (error) {
        $app.logger().error(`2: Error getting Discord ID for assignee: ${assigneeId} from PocketBase:`, "error", error);
    }

    if (!discordId) {
        return null;
    }

    return discordId;
}

function isTicketCreated(data) {
    const body = privateGetBody(data);
    return body?.type === ZENDESK_TICKET_CREATED;
}

/**
 * Sanitize search terms to prevent tracking sensitive data, credentials, URLs, or malicious payloads
 * @param {string} term 
 * @returns {string}
 */
function sanitizeSearchTerm(term) {
    if (!term || typeof term !== 'string') return '';
    let clean = term.trim().replace(/<[^>]*>/g, '');
    if (/@|\b(https?|ftp|file):\/\/|password|token|secret/i.test(clean)) {
        return '';
    }
    return clean.slice(0, 100);
}

/**
 * Send an event to Google Analytics 4 Measurement Protocol from the server
 * @param {string} eventName 
 * @param {Object} eventParams 
 * @param {Object|null} req 
 */
function trackGAEvent(eventName, eventParams = {}, req = null) {
    try {
        const { GA_MEASUREMENT_ID } = require(`${__hooks}/pages/utils/constants.js`);
        const measurementId = GA_MEASUREMENT_ID || 'G-6P8M4DJNQL';

        let clientId = 'pb_server_client';
        if (req) {
            try {
                const cookies = extractCookiesMap(req);
                if (cookies && cookies._ga) {
                    const gaVal = cookies._ga.value || cookies._ga;
                    const parts = String(gaVal).split('.');
                    if (parts.length >= 4) {
                        clientId = parts.slice(2).join('.');
                    }
                }
            } catch (_) { }
        }

        const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}`;
        const payload = {
            client_id: clientId,
            events: [{
                name: eventName,
                params: Object.assign({}, eventParams, {
                    anonymize_ip: true,
                    allow_google_signals: false
                })
            }]
        };

        const sendRequest = () => {
            try {
                if (typeof $http !== 'undefined' && $http.send) {
                    $http.send({
                        url: url,
                        method: 'POST',
                        body: JSON.stringify(payload),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                }
            } catch (err) {
                if (typeof $app !== 'undefined' && $app.logger) {
                    $app.logger().error('Failed to send GA event from backend', 'error', err);
                }
            }
        };

        if (typeof setTimeout === 'function') {
            setTimeout(sendRequest, 0);
        } else {
            sendRequest();
        }
    } catch (err) {
        if (typeof $app !== 'undefined' && $app.logger) {
            $app.logger().error('Failed to prepare GA event tracking', 'error', err);
        }
    }
}

/**
 * Sanitizes iframe video tags in HTML string to use youtube-nocookie, preserve aspect ratios,
 * and ensure responsive scaling on mobile viewports.
 * @param {string} s - HTML content
 * @returns {string}
 */
function toNoCookie(s) {
    if (!s || typeof s !== 'string') return '';
    return s
        .replace(/https?:\/\/(www\.)?youtube\.com\/embed\//g, 'https://www.youtube-nocookie.com/embed/')
        .replace(/<iframe([^>]*?)>/gi, (match, attrs) => {
            const isYT = /youtube(-nocookie)?\.com\/embed\//.test(match);
            if (!isYT) return match;

            let cleanAttrs = attrs.replace(/\s+sandbox="[^"]*"/gi, '');

            const wMatch = cleanAttrs.match(/\bwidth=["']?(\d+)/i);
            const hMatch = cleanAttrs.match(/\bheight=["']?(\d+)/i);
            const width = wMatch ? parseInt(wMatch[1], 10) : null;
            const height = hMatch ? parseInt(hMatch[1], 10) : null;

            let isVertical = false;
            let aspectRatio = '16 / 9';
            if (width && height && height > width) {
                isVertical = true;
                aspectRatio = `${width} / ${height}`;
            } else if (width && height) {
                aspectRatio = `${width} / ${height}`;
            }

            if (!/\btitle=/i.test(cleanAttrs)) {
                cleanAttrs = ' title="YouTube video player"' + cleanAttrs;
            }
            if (!/\ballow=/i.test(cleanAttrs)) {
                cleanAttrs += ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"';
            }
            if (!/\ballowfullscreen\b/i.test(cleanAttrs)) {
                cleanAttrs += ' allowfullscreen';
            }
            if (!/\bloading=/i.test(cleanAttrs)) {
                cleanAttrs += ' loading="lazy"';
            }

            // Extract existing style
            const styleMatch = cleanAttrs.match(/\bstyle=["']([^"']*)["']/i);
            let styleContent = styleMatch ? styleMatch[1].trim() : '';
            if (styleContent && !styleContent.endsWith(';')) styleContent += ';';

            // Strip conflicting width/height/max-width/display/aspect-ratio/margin from existing inline style
            styleContent = styleContent
                .replace(/(?:^|;)\s*display:[^;]+;?/gi, ';')
                .replace(/(?:^|;)\s*margin-left:[^;]+;?/gi, ';')
                .replace(/(?:^|;)\s*margin-right:[^;]+;?/gi, ';')
                .replace(/(?:^|;)\s*max-width:[^;]+;?/gi, ';')
                .replace(/(?:^|;)\s*width:[^;]+;?/gi, ';')
                .replace(/(?:^|;)\s*height:[^;]+;?/gi, ';')
                .replace(/(?:^|;)\s*aspect-ratio:[^;]+;?/gi, ';')
                .replace(/;+/g, ';')
                .trim();
            if (styleContent.startsWith(';')) styleContent = styleContent.slice(1).trim();

            const maxWidthVal = isVertical ? `min(100%, ${width || 400}px)` : '100%';
            const responsiveStyles = `max-width: ${maxWidthVal}; width: 100%; height: auto; aspect-ratio: ${aspectRatio}; display: block; margin-left: auto; margin-right: auto;`;
            const finalStyle = styleContent ? `${styleContent} ${responsiveStyles}` : responsiveStyles;

            if (styleMatch) {
                cleanAttrs = cleanAttrs.replace(/\bstyle=["'][^"']*["']/i, `style="${finalStyle}"`);
            } else {
                cleanAttrs += ` style="${finalStyle}"`;
            }

            return `<iframe${cleanAttrs}>`;
        });
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
 * Clean HTML for card previews and meta descriptions:
 * - Removes leading bold titles/subheadings (e.g. <strong>Title:</strong> or <b>...</b> or <h1>..<h6>)
 * - Strips HTML tags
 * - Decodes HTML entities (&nbsp;, &amp;, &lt;, &gt;, etc.)
 * - Normalizes whitespace
 * @param {string} html 
 * @returns {string}
 */
function extractPreviewText(html) {
    if (!html || typeof html !== 'string') return '';

    let clean = html;

    // Strip multiple leading headers or leading bold elements at the start of content
    let prev = '';
    while (clean !== prev) {
        prev = clean;
        // Remove leading heading tags (h1-h6) at start
        clean = clean.replace(/^\s*<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '');
        // Remove leading <strong> or <b> tags (and optional trailing colon) at start, whether standalone or inside a leading <p>
        clean = clean.replace(/^\s*(?:<p[^>]*>\s*)?(?:<strong[^>]*>[\s\S]*?<\/strong>|<b[^>]*>[\s\S]*?<\/b>)\s*:?\s*/gi, '');
    }

    // Strip remaining HTML tags
    clean = clean.replace(/<[^>]*>/g, '');

    // Strip Markdown images, links, headings, emphasis, and code markers
    clean = clean
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/(?:^|\n)\s*#{1,6}\s+/g, ' ')
        .replace(/(\*\*\*|___|\*\*|__|~~|`)/g, '')
        .replace(/(?:^|[\s([{>"'])\*([^*\n]+)\*(?=$|[\s.,!?:;)\]}<"'])/g, ' $1')
        .replace(/(?:^|[\s([{>"'])_([^_\n]+)_(?=$|[\s.,!?:;)\]}<"'])/g, ' $1');

    // Replace HTML entities
    clean = clean
        .replace(/&nbsp;/gi, ' ')
        .replace(/&#160;/g, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'")
        .replace(/&[a-z0-9#]+;/gi, ' ');

    // Normalize whitespace
    return clean.replace(/\s+/g, ' ').trim();
}

/**
 * Escape raw text for safe HTML interpolation
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Resolve OpenBeta / relative markdown link URLs to canonical internal routes where possible
 * @param {string} rawHref
 * @returns {{ href: string, isExternal: boolean }}
 */
function resolveMarkdownHref(rawHref) {
    if (!rawHref || typeof rawHref !== 'string') {
        return { href: '#', isExternal: false };
    }
    const cleanHref = rawHref.trim().replace(/&amp;/g, '&');
    if (!cleanHref || /^(?:javascript|data|vbscript):/i.test(cleanHref)) {
        return { href: '#', isExternal: false };
    }

    const { getAreaByUuid, getClimbByUuid } = require(`${__hooks}/pages/utils/pocket.js`);

    // Match OpenBeta or relative area/crag links: ../<uuid>, /area/<uuid>, /crag/<uuid>, https://openbeta.io/crag/<uuid>, etc.
    const areaMatch = cleanHref.match(
        /^(?:https?:\/\/(?:www\.)?openbeta\.io)?(?:\/?(?:\.\.\/|\.\/)*(?:area|crag)s?\/|(?:\.\.\/|\.\/)+)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/[a-z0-9-]*)?\/?$/i
    );
    if (areaMatch) {
        const targetUuid = areaMatch[1];
        try {
            const areaRec = getAreaByUuid(targetUuid);
            if (areaRec) {
                return {
                    href: buildAreaUrl(areaRec.id, areaRec.getString('name')),
                    isExternal: false
                };
            }
        } catch (_) {}
        return {
            href: `/area/${targetUuid}`,
            isExternal: false
        };
    }

    // Match OpenBeta or relative climb links: /climb/<uuid>, /climbs/<uuid>, https://openbeta.io/climbs/<uuid>, etc.
    const climbMatch = cleanHref.match(
        /^(?:https?:\/\/(?:www\.)?openbeta\.io)?(?:\/?(?:\.\.\/|\.\/)*climbs?\/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/[a-z0-9-]*)?\/?$/i
    );
    if (climbMatch) {
        const climbUuid = climbMatch[1];
        try {
            const climbRec = getClimbByUuid(climbUuid);
            if (climbRec) {
                return {
                    href: buildClimbUrl(climbRec.id, climbRec.getString('name')),
                    isExternal: false
                };
            }
        } catch (_) {}
        return {
            href: `/climb/${climbUuid}`,
            isExternal: false
        };
    }

    if (cleanHref.startsWith('/') || cleanHref.startsWith('#')) {
        return { href: cleanHref, isExternal: false };
    }

    if (/^(?:https?:\/\/|mailto:)/i.test(cleanHref)) {
        return { href: cleanHref, isExternal: true };
    }

    return { href: cleanHref, isExternal: true };
}

/**
 * Apply bold, italic, and strikethrough formatting to an already HTML-escaped string
 * @param {string} escapedStr
 * @returns {string}
 */
function formatInlineMarkdownText(escapedStr) {
    if (!escapedStr) return '';
    return escapedStr
        .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong class="font-semibold text-base-content"><em class="italic">$1</em></strong>')
        .replace(/___([^_]+)___/g, '<strong class="font-semibold text-base-content"><em class="italic">$1</em></strong>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-base-content">$1</strong>')
        .replace(/__([^_]+)__/g, '<strong class="font-semibold text-base-content">$1</strong>')
        .replace(/~~([^~]+)~~/g, '<del>$1</del>')
        .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em class="italic">$2</em>')
        .replace(/(^|[\s([{&]|&quot;|&#39;)_([^_\n]+)_(?=$|[\s.,!?:;)\]}&]|&quot;|&#39;)/g, '$1<em class="italic">$2</em>');
}

/**
 * Render inline Markdown (code spans, images, links, bare URLs, bold, italic, strikethrough) safely to HTML
 * @param {string} rawLine
 * @returns {string}
 */
function renderInlineMarkdown(rawLine) {
    if (!rawLine || typeof rawLine !== 'string') return '';

    const tokens = [];
    const stash = (html) => {
        const idx = tokens.length;
        tokens.push(html);
        return `\u0000MDTOK_${idx}_\u0000`;
    };

    let working = rawLine;

    // 1. Inline code spans: `code`
    working = working.replace(/`([^`\n]+)`/g, (_, code) =>
        stash(
            `<code class="px-1.5 py-0.5 rounded bg-base-100/80 border border-base-content/15 font-mono text-xs text-accent">${escapeHtml(code)}</code>`
        )
    );

    // 2. Markdown images: ![alt](url)
    working = working.replace(/!\[([^\]]*)\]\(((?:[^()\s]+|\([^()\s]*\))+)\)/g, (_, alt, rawUrl) => {
        const resolved = resolveMarkdownHref(rawUrl);
        return stash(
            `<img src="${escapeHtml(resolved.href)}" alt="${escapeHtml(alt)}" class="rounded-lg max-h-80 my-2 border border-base-content/10" loading="lazy" />`
        );
    });

    // 3. Markdown links: [label](url)
    working = working.replace(/\[([^\]]+)\]\(((?:[^()\s]+|\([^()\s]*\))+)\)/g, (_, label, rawUrl) => {
        const resolved = resolveMarkdownHref(rawUrl);
        const escapedLabel = formatInlineMarkdownText(escapeHtml(label));
        const targetAttrs = resolved.isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
        return stash(
            `<a href="${escapeHtml(resolved.href)}"${targetAttrs} class="text-accent hover:underline font-medium">${escapedLabel}</a>`
        );
    });

    // 4. Bare URLs: https://... or http://...
    working = working.replace(/https?:\/\/[^\s<>"')\]]+/gi, (matchedUrl) => {
        let cleanUrl = matchedUrl;
        let trailing = '';
        const trailMatch = cleanUrl.match(/([.,;:!?]+)$/);
        if (trailMatch) {
            trailing = trailMatch[1];
            cleanUrl = cleanUrl.slice(0, -trailing.length);
        }
        const resolved = resolveMarkdownHref(cleanUrl);
        const targetAttrs = resolved.isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
        return (
            stash(
                `<a href="${escapeHtml(resolved.href)}"${targetAttrs} class="text-accent hover:underline break-all">${escapeHtml(cleanUrl)}</a>`
            ) + trailing
        );
    });

    // 5. Escape remaining plain text and format bold/italic/strikethrough
    let formatted = formatInlineMarkdownText(escapeHtml(working));

    // 6. Restore stashed HTML tokens (including any nested inline code tokens inside link labels)
    let prev = '';
    while (formatted !== prev && formatted.includes('\u0000MDTOK_')) {
        prev = formatted;
        formatted = formatted.replace(/\u0000MDTOK_(\d+)_\u0000/g, (_, idx) => tokens[Number(idx)] || '');
    }

    return formatted;
}

/**
 * Render block and inline Markdown to safe, styled HTML for area/climb descriptions, locations, and beta
 * @param {string} markdownText
 * @param {{ inline?: boolean }} [options]
 * @returns {string}
 */
function renderMarkdown(markdownText, options = {}) {
    if (!markdownText || typeof markdownText !== 'string') return '';
    const normalized = markdownText.replace(/\r\n?/g, '\n').trim();
    if (!normalized) return '';

    if (options.inline && !normalized.includes('\n') && !/^\s*(?:#{1,6}\s+|[-*+]\s+|\d+\.\s+)/.test(normalized)) {
        return renderInlineMarkdown(normalized);
    }

    const lines = normalized.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) {
            i++;
            continue;
        }

        // Fenced code block: ```
        if (trimmed.startsWith('```')) {
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            if (i < lines.length) i++;
            blocks.push(
                `<pre class="p-3 rounded-xl bg-base-100/80 border border-base-content/15 font-mono text-xs overflow-x-auto my-2"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`
            );
            continue;
        }

        // Horizontal rule: ---, ***, ___
        if (/^(?:[-]{3,}|[*]{3,}|[_]{3,})$/.test(trimmed)) {
            blocks.push('<hr class="my-3 border-t border-base-content/20" />');
            i++;
            continue;
        }

        // ATX Headings: # through ###### (requires space after # so "#5 cam" is not treated as a heading)
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+?)\s*#*$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const headingContent = renderInlineMarkdown(headingMatch[2]);
            const headingClasses = {
                1: 'text-lg font-bold text-secondary mt-4 mb-1.5 first:mt-0',
                2: 'text-base font-bold text-secondary mt-4 mb-1.5 first:mt-0',
                3: 'text-sm font-bold text-secondary mt-3.5 mb-1 first:mt-0',
                4: 'text-xs font-bold uppercase tracking-wider text-secondary mt-3.5 mb-1 first:mt-0',
                5: 'text-xs font-semibold uppercase tracking-wider text-secondary/90 mt-3 mb-1 first:mt-0',
                6: 'text-xs font-semibold text-base-content/80 mt-2.5 mb-1 first:mt-0'
            };
            const tag = `h${Math.min(Math.max(level, 2), 6)}`;
            blocks.push(`<${tag} class="${headingClasses[level] || headingClasses[4]}">${headingContent}</${tag}>`);
            i++;
            continue;
        }

        // Blockquote: > ...
        if (/^>\s?/.test(trimmed)) {
            const quoteLines = [];
            while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
                quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
                i++;
            }
            blocks.push(
                `<blockquote class="border-l-2 border-accent/60 pl-3 italic text-base-content/80 my-2">${quoteLines.map(renderInlineMarkdown).join('<br />')}</blockquote>`
            );
            continue;
        }

        // Unordered list: * item, - item, + item
        if (/^[-*+]\s+/.test(trimmed)) {
            const items = [];
            while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
                const itemText = lines[i].trim().replace(/^[-*+]\s+/, '');
                items.push(`<li>${renderInlineMarkdown(itemText)}</li>`);
                i++;
            }
            blocks.push(`<ul class="list-disc pl-5 space-y-1 my-2">${items.join('')}</ul>`);
            continue;
        }

        // Ordered list: 1. item, 2. item
        if (/^\d+\.\s+/.test(trimmed)) {
            const items = [];
            while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
                const itemText = lines[i].trim().replace(/^\d+\.\s+/, '');
                items.push(`<li>${renderInlineMarkdown(itemText)}</li>`);
                i++;
            }
            blocks.push(`<ol class="list-decimal pl-5 space-y-1 my-2">${items.join('')}</ol>`);
            continue;
        }

        // Standard paragraph: collect consecutive non-blank, non-block-starter lines
        const paraLines = [];
        while (
            i < lines.length &&
            lines[i].trim() !== '' &&
            !lines[i].trim().startsWith('```') &&
            !/^(?:[-]{3,}|[*]{3,}|[_]{3,})$/.test(lines[i].trim()) &&
            !/^#{1,6}\s+/.test(lines[i].trim()) &&
            !/^>\s?/.test(lines[i].trim()) &&
            !/^[-*+]\s+/.test(lines[i].trim()) &&
            !/^\d+\.\s+/.test(lines[i].trim())
        ) {
            paraLines.push(renderInlineMarkdown(lines[i].trim()));
            i++;
        }
        if (paraLines.length > 0) {
            blocks.push(`<p class="leading-relaxed">${paraLines.join('<br />')}</p>`);
        }
    }

    return blocks.join('\n');
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
            let token = null;
            if (typeof rawCookie === 'string') {
                token = rawCookie;
            } else if (rawCookie && typeof rawCookie === 'object') {
                token = rawCookie.token || rawCookie.value || null;
            }

            if (!token) {
                const headerAccessor = reqOrEvent.request?.header || reqOrEvent.header;
                let authHeader = '';
                if (headerAccessor && typeof headerAccessor.get === 'function') {
                    authHeader = headerAccessor.get('Authorization') || '';
                } else if (typeof headerAccessor === 'function') {
                    authHeader = headerAccessor('Authorization') || '';
                }
                const bearerMatch = String(authHeader).match(/^Bearer\s+(.+)$/i);
                if (bearerMatch) {
                    token = bearerMatch[1].trim();
                }
            }

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
        trackGAEvent(reqObj, "view_search_results", {
            search_term: cleanQuery,
            search_category: "climbing_locations"
        });
    }

    const directoryRecords = getHomepageDirectoryAreas();
    const areaItems = directoryRecords.map((r) => {
        const uuid = r.getString("openbetaUuid");
        const name = r.getString("name");
        const totalClimbs = r.getInt("totalClimbs") || 0;
        const geoPoint = r.getGeoPoint("coordinates");
        let pathTokens = [];
        let ancestors = [];
        try {
            const rawTokens = r.getString("pathTokens") || r.get("pathTokens");
            if (Array.isArray(rawTokens)) {
                pathTokens = rawTokens;
            } else if (typeof rawTokens === "string" && rawTokens.startsWith("[")) {
                pathTokens = JSON.parse(rawTokens);
            }
        } catch (_) { }
        try {
            const rawAnc = r.getString("ancestors") || r.get("ancestors");
            if (Array.isArray(rawAnc)) {
                ancestors = rawAnc;
            } else if (typeof rawAnc === "string" && rawAnc.startsWith("[")) {
                ancestors = JSON.parse(rawAnc);
            }
        } catch (_) { }

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
    for (let i = 0; i < areaItems.length; i++) {
        const item = areaItems[i];
        if (!item.parentUuid) continue;

        if (!childrenByParentUuid[item.parentUuid]) {
            childrenByParentUuid[item.parentUuid] = [];
        }
        childrenByParentUuid[item.parentUuid].push(item);

        if (item.isDestination) {
            const groupUuid = (usaUuid && item.ancestors[0] === usaUuid && item.ancestors.length >= 2)
                ? item.ancestors[1]
                : (item.ancestors[0] || item.parentUuid);
            if (groupUuid && groupUuid !== item.uuid) {
                if (!destinationsByGroupUuid[groupUuid]) {
                    destinationsByGroupUuid[groupUuid] = [];
                }
                destinationsByGroupUuid[groupUuid].push(item);
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

    // If user entered a search query, also search deep areas/crags and climbs in the DB
    let matchingSubAreas = [];
    let matchingClimbs = [];
    if (rawQuery) {
        const areasResult = getAreas(1, 24, rawQuery);
        const shownUuids = new Set(areaItems.map((a) => a.uuid));
        matchingSubAreas = (areasResult.items || [])
            .filter((r) => !shownUuids.has(r.getString("openbetaUuid")))
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
                return {
                    id: r.id,
                    name,
                    totalClimbs: tc,
                    formattedClimbs: formatNumberWithCommas(tc),
                    pathSummary: pathTokens.slice(0, -1).join(" › "),
                    url: buildAreaUrl(r.id, name)
                };
            });

        const climbsResult = getClimbs(1, 24, rawQuery);
        matchingClimbs = (climbsResult.items || []).map((cl) => {
            const name = cl.getString("name");
            const { primaryGrade } = buildGradeDetails(cl);
            const clPathTokens = parseJsonArrayField(cl, "pathTokens");
            const disciplines = parseJsonArrayField(cl, "disciplines");
            const areaId = cl.getString("area") || cl.getString("areaUuid") || "";
            const areaName = clPathTokens.length > 0 ? clPathTokens[clPathTokens.length - 1] : "Area";
            return {
                id: cl.id,
                name,
                grade: primaryGrade,
                disciplines,
                pathSummary: clPathTokens.join(" › "),
                url: buildClimbUrl(cl.id, name),
                areaUrl: areaId ? buildAreaUrl(areaId, areaName) : "/"
            };
        });
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

    const vMatch = s.match(/^V(\d+)/);
    if (vMatch) {
        const vNum = parseInt(vMatch[1], 10);
        if (vNum === 0) rank = 17;
        else if (vNum === 1) rank = 20;
        else if (vNum === 2) rank = 24;
        else if (vNum === 3) rank = 28;
        else if (vNum === 4) rank = 32;
        else if (vNum === 5) rank = 38;
        else if (vNum === 6) rank = 42;
        else if (vNum === 7) rank = 48;
        else if (vNum === 8) rank = 50;
        else if (vNum === 9) rank = 54;
        else if (vNum === 10) rank = 58;
        else if (vNum === 11) rank = 60;
        else if (vNum === 12) rank = 62;
        else rank = 64 + Math.min(18, (vNum - 13) * 2);
    } else if (s === 'VB' || s === 'V-EASY') {
        rank = 10;
    } else {
        const ydsMatch = s.match(/^5\.(\d+)([ABCD+-]?)/);
        if (ydsMatch) {
            const num = parseInt(ydsMatch[1], 10);
            const mod = ydsMatch[2] ? ydsMatch[2].toLowerCase() : '';
            if (num < 6) rank = 10;
            else if (num === 6) rank = 14;
            else if (num === 7) rank = 17;
            else if (num === 8) rank = 20;
            else if (num === 9) rank = 24;
            else {
                let sub = 2;
                if (mod === 'a' || mod === '-') sub = 0;
                else if (mod === 'b') sub = 2;
                else if (mod === 'c' || mod === '+') sub = 4;
                else if (mod === 'd') sub = 6;

                if (num === 10) rank = 28 + sub;
                else if (num === 11) rank = 38 + sub;
                else if (num === 12) rank = 48 + sub;
                else if (num === 13) rank = 58 + sub;
                else if (num === 14) rank = 68 + sub;
                else rank = 78 + sub;
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
    for (let mIdx = 0; mIdx < rawMediaRecords.length; mIdx++) {
        const mRec = rawMediaRecords[mIdx];
        const mClimbId = mRec.getString('climb');
        if (!mClimbId) continue;
        const formatted = formatClimbMediaItem(mRec, currentUserId);
        if (!formatted) continue;
        if (!mediaByClimbId[mClimbId]) {
            mediaByClimbId[mClimbId] = [];
        }
        mediaByClimbId[mClimbId].push(formatted);
    }
    Object.keys(mediaByClimbId).forEach((cid) => {
        mediaByClimbId[cid].sort((a, b) => (b.sortTimestamp || 0) - (a.sortTimestamp || 0));
    });
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
        descriptionHtml: renderMarkdown(clDesc),
        location: clLoc,
        locationHtml: renderMarkdown(clLoc, { inline: true }),
        protection: clProt,
        protectionHtml: renderMarkdown(clProt, { inline: true }),
        createdByUser: cl.getString("createdByUser") || "",
        updatedByUser: cl.getString("updatedByUser") || "",
        subAreaName: clSubAreaName && clSubAreaName !== name ? clSubAreaName : "",
        subAreaUrl: clAreaId && clSubAreaName ? buildAreaUrl(clAreaId, clSubAreaName) : "",
        media: mediaList
    };
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

    let { areaRecord, childAreas, climbs, isDescendantClimbs } = getOrSyncAreaDetail(lookupKey);

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

    const climbIds = (climbs || []).map((cl) => cl.id).filter(Boolean);
    const mediaByClimbId = groupFormattedClimbMedia(getClimbMediaByClimbIds(climbIds), currentUserId);
    const formattedClimbs = (climbs || []).map((cl) => formatClimbSummary(cl, mediaByClimbId[cl.id] || []));

    if (reqObj && !shouldRedirect) {
        trackGAEvent("select_content", {
            content_type: "climbing_area",
            item_id: areaRecord.id,
            item_name: sanitizeSearchTerm(name)
        }, reqObj);
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

    return {
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

    return {
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
}

module.exports = {
    formatDateTime,
    getZendeskUrl,
    isJustinsTicket,
    isSlaBreaching,
    getTicketId,
    getTicketType,
    getAssigneeId,
    getActorId,
    runAfterRandomDelay,
    runAfterDelay,
    privateGetBody,
    privateIsStatusChangedEvent,
    saveZendeskRecord,
    findRecentTicketByTicketNumber,
    findRecentTicketsByTicketNumber,
    findRecentTicketsByTicketNumber2,
    getDiscordIdByAssigneeId,
    getAdminSetting,
    getDiscordBotToken,
    getImgurClientId,
    normalizeImgurUrl,
    isValidImgurDirectUrl,
    resolveClimbMediaUrl,
    formatClimbMediaItem,
    uploadBase64ToImgur,
    sendDiscordMessage,
    getOrganizationById,
    sendDiscordMessage2,
    generateNormalTicketMessage,
    generateSlaBreachingSoonMessage,
    isTicketClosed,
    getDiscordIdfromData,
    isTicketCreated,
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
    sanitizeRedirectPath,
    getAuthenticatedUser,
    setAuthCookie,
    clearAuthCookie,
    prepareLoginPageViewData,
    formatNumberWithCommas,
    buildAreaUrl,
    buildClimbUrl,
    prepareSiteAndHeroViewData,
    prepareHomepageDirectoryViewData,
    prepareAreaDetailViewData,
    prepareClimbDetailViewData,
    computeClimbGradeMetrics
};

