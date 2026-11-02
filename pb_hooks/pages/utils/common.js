const {
    POCKET_SLA_BREACHING_SOON,
    ZENDESK_API_ENDPOINT,
    ZENDESK_ASSIGNEE_ID_JUSTIN,
    POCKET_COLLECTION_ZENDESK_TICKETS,
    POCKET_ZENDESKUSER_DISCORDUSER,
    POCKET_COLLECTION_ADMIN_SETTINGS,
    POCKET_ADMIN_DISCORD_BOT_TOKEN,
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
            if (appUrl) {
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
 * @param {Object} blog 
 * @returns {string|null}
 */
function getImageUrl(blog) {
    if (!blog) return null;

    // Handle PocketBase Record objects (server-side)
    if (typeof blog.getString === 'function') {
        const coverImage = blog.getString('coverImage');
        const collectionId = blog.collectionId || blog.getString('collectionId') || blog.collection?.()?.id;
        const id = blog.id;

        if (coverImage && collectionId && id) {
            return `${getBaseUrl()}/api/files/${collectionId}/${id}/${coverImage}`;
        }
        return null;
    }

    // Handle plain objects (client-side or serialized)
    if (blog.coverImage && blog.collectionId && blog.id) {
        return (
            `${getBaseUrl()}/api/files/${blog.collectionId}/${blog.id}/${blog.coverImage}`
        )
    }
    return null;
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
                let cookies = null;
                if (typeof req.cookies === 'function') {
                    cookies = req.cookies();
                } else if (req.cookies) {
                    cookies = req.cookies;
                }
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
 * Format a post record into a clean view-model object for cards (hero & grid)
 */
function formatPostViewModel(post, isHomepage = false, isClimbing = false) {
    if (!post) return null;
    const { isClimbingRecord } = require(`${__hooks}/pages/utils/pocket.js`);
    const itemIsClimbing = isClimbing || isClimbingRecord(post);
    const title = post.getString('title') || '';
    const slug = slugifyTitle(title);
    const rawText = (itemIsClimbing ? post.getString('content') : post.getString('content1')) || '';
    const previewText = extractPreviewText(rawText);

    const rawImg = getImageUrl(post);
    const heroImageUrl = itemIsClimbing
        ? (rawImg ? `${rawImg}?thumb=800x0` : '/background.webp')
        : (rawImg ? `${rawImg}?thumb=800x0` : (post.getString('coverImageAlt') || null));

    const gridImageUrl = itemIsClimbing
        ? (rawImg ? `${rawImg}?thumb=350x0` : '/background.webp')
        : (rawImg ? `${rawImg}?thumb=350x0` : (post.getString('coverImageAlt') || null));

    const postId = post.id;
    const link = itemIsClimbing
        ? `/climbing/${encodeURIComponent(slug)}/${postId}`
        : `/blog/posts/${encodeURIComponent(slug)}/${postId}`;

    const dateRaw = itemIsClimbing
        ? (post.getString('date') || post.getString('created'))
        : (post.getString('manualPublishDate') || post.getString('created'));
    const formattedDate = formatDateTime(new Date(dateRaw));

    let badges = [];
    if (itemIsClimbing) {
        if (post.getString('climbType')) badges.push({ text: post.getString('climbType'), query: post.getString('climbType').trim() });
        if (post.getString('grade')) badges.push({ text: post.getString('grade'), query: post.getString('grade').trim() });
        if (post.getString('style')) badges.push({ text: post.getString('style'), query: post.getString('style').trim() });
    } else {
        const blogTags = post.getString('tags');
        if (blogTags && blogTags.length > 0) {
            blogTags.split(';').forEach(tag => {
                const t = tag.trim();
                if (t) badges.push({ text: t, query: t });
            });
        }
    }

    return {
        id: post.id,
        title,
        slug,
        link,
        previewText,
        heroImageUrl,
        gridImageUrl,
        formattedDate,
        itemIsClimbing,
        badges,
        location: itemIsClimbing ? post.getString('location') : null,
        rawRecord: post
    };
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
 * Prepares blog posts view data on the server
 */
function prepareBlogPostsViewData(blogposts, isHomepage, isClimbing, params = {}, req = null, data = {}) {
    const rawQuery = params?.query || '';
    const query = sanitizeSearchTerm(rawQuery);
    const hasSearchQuery = !isHomepage && !!query;

    const items = (blogposts?.items || []).map(post => formatPostViewModel(post, isHomepage, isClimbing));

    let heroPost = null;
    let gridPosts = items;
    if (isHomepage && gridPosts.length > 0) {
        heroPost = gridPosts[0];
        gridPosts = gridPosts.slice(1);
    }

    const hasPosts = !!heroPost || gridPosts.length > 0;
    const hasNoSearchResults = hasSearchQuery && !hasPosts;

    let fullParams = hasSearchQuery ? `&query=${encodeURIComponent(query)}` : '';
    if (isClimbing && params?.climbType) {
        fullParams += `&climbType=${encodeURIComponent(params.climbType)}`;
    }

    if (data?.metadata) {
        try {
            if (isClimbing) {
                const title = 'The Climbing Blog | Justin Kim';
                const description = 'A personal record of my falls, projects, and sends (on rock and in the gym).';
                const url = `${getBaseUrl()}/climbing`;
                const ogImg = `${getBaseUrl()}/og-image.png`;

                setOrUpdateMeta(data.metadata, 'title', title);
                setOrUpdateMeta(data.metadata, 'og:title', 'The Climbing Blog');
                setOrUpdateMeta(data.metadata, 'twitter:title', 'The Climbing Blog');
                setOrUpdateMeta(data.metadata, 'description', description);
                setOrUpdateMeta(data.metadata, 'og:description', description);
                setOrUpdateMeta(data.metadata, 'twitter:description', description);
                setOrUpdateMeta(data.metadata, 'url', url);
                setOrUpdateMeta(data.metadata, 'og:url', url);
                setOrUpdateMeta(data.metadata, 'twitter:url', url);
                setOrUpdateMeta(data.metadata, 'og:image', ogImg);
                setOrUpdateMeta(data.metadata, 'twitter:image', ogImg);
                setOrUpdateMeta(data.metadata, 'og:site_name', 'The Climbing Blog');
                setOrUpdateMeta(data.metadata, 'og:type', 'website');
            } else if (!isHomepage) {
                const title = 'The Dev Blog | Justin Kim';
                const description = 'Keeping a personal record of my mistakes and lessons learned as a developer.';
                const url = `${getBaseUrl()}/blog/posts`;
                const ogImg = `${getBaseUrl()}/og-image.png`;

                setOrUpdateMeta(data.metadata, 'title', title);
                setOrUpdateMeta(data.metadata, 'og:title', 'The Development Blog');
                setOrUpdateMeta(data.metadata, 'twitter:title', 'The Development Blog');
                setOrUpdateMeta(data.metadata, 'description', description);
                setOrUpdateMeta(data.metadata, 'og:description', description);
                setOrUpdateMeta(data.metadata, 'twitter:description', description);
                setOrUpdateMeta(data.metadata, 'url', url);
                setOrUpdateMeta(data.metadata, 'og:url', url);
                setOrUpdateMeta(data.metadata, 'twitter:url', url);
                setOrUpdateMeta(data.metadata, 'og:image', ogImg);
                setOrUpdateMeta(data.metadata, 'twitter:image', ogImg);
                setOrUpdateMeta(data.metadata, 'og:site_name', 'Wiki Bloc');
                setOrUpdateMeta(data.metadata, 'og:type', 'website');
            }
        } catch (err) {
            console.error('Error preparing blog posts view metadata: ', err);
        }
    }

    return {
        query,
        hasSearchQuery,
        heroPost,
        gridPosts,
        hasPosts,
        hasNoSearchResults,
        fullParams
    };
}

/**
 * Prepares single blog view data on the server, including metadata updates and GA view_item tracking
 */
function prepareBlogSingleViewData(singleBlog, isClimbing, params = {}, data = {}, req = null) {
    if (!singleBlog && (params?.title || params?.id)) {
        try {
            const { getBlogPostById, getBlogPostsByTitlePrefix, getClimbingPostById, getClimbingLogsByTitlePrefix } = require(`${__hooks}/pages/utils/pocket.js`);

            // New URL format: /climbing/:title/:id or /blog/posts/:title/:id
            // params.id is the PocketBase record ID (direct lookup — fastest path)
            if (params.id) {
                try {
                    singleBlog = isClimbing
                        ? getClimbingPostById(params.id)
                        : getBlogPostById(params.id);
                } catch (_) {
                    singleBlog = null;
                }
            }

            // Fallback: old-format URL — resolve by slug match (for redirect pages)
            if (!singleBlog && params.title) {
                const titleParam = params.title;
                const firstWord = titleParam.split('-')[0].replace(/"/g, '\\"');
                const possibleBlogs = isClimbing
                    ? getClimbingLogsByTitlePrefix(firstWord)
                    : getBlogPostsByTitlePrefix(firstWord);

                const targetSlug = titleParam.toLowerCase();
                singleBlog = possibleBlogs.find(
                    (b) => slugifyTitle(b.getString('title')) === targetSlug
                ) || null;
            }
        } catch (error) {
            console.error('Error fetching single blog post: ', error);
        }
    }

    let viewModel = null;

    if (singleBlog) {
        const postTitle = singleBlog.getString('title') || '';
        const slug = slugifyTitle(postTitle);
        const canonicalPath = isClimbing
            ? `/climbing/${encodeURIComponent(slug)}/${singleBlog.id}`
            : `/blog/posts/${encodeURIComponent(slug)}/${singleBlog.id}`;
        const canonicalUrl = `${getBaseUrl()}${canonicalPath}`;

        if (data?.metadata) {
            try {
                const pageTitle = isClimbing
                    ? `${postTitle} | Wiki Bloc`
                    : `${postTitle} | Wiki Bloc`;

                setOrUpdateMeta(data.metadata, 'title', pageTitle);
                setOrUpdateMeta(data.metadata, 'og:title', postTitle);
                setOrUpdateMeta(data.metadata, 'twitter:title', postTitle);

                const rawContent = singleBlog.getString(isClimbing ? 'content' : 'content1') || '';
                const previewText = extractPreviewText(rawContent);
                const metaDescription = previewText.slice(0, 160) || (isClimbing ? 'Climbing journal log by Justin Kim.' : 'Blog post by Justin Kim.');

                setOrUpdateMeta(data.metadata, 'description', metaDescription);
                setOrUpdateMeta(data.metadata, 'og:description', metaDescription);
                setOrUpdateMeta(data.metadata, 'twitter:description', metaDescription);

                // URL metadata
                setOrUpdateMeta(data.metadata, 'url', canonicalUrl);
                setOrUpdateMeta(data.metadata, 'og:url', canonicalUrl);
                setOrUpdateMeta(data.metadata, 'twitter:url', canonicalUrl);

                // Type & site name
                setOrUpdateMeta(data.metadata, 'og:type', 'article');
                setOrUpdateMeta(data.metadata, 'og:site_name', 'Wiki Bloc');
                setOrUpdateMeta(data.metadata, 'og:locale', 'en_CA');

                // Image handling
                const rawImgUrl = getImageUrl(singleBlog);
                const ogImageUrl = rawImgUrl ? `${rawImgUrl}?thumb=1200x630` : `${getBaseUrl()}/og-image.png`;
                const coverAlt = singleBlog.getString('coverImageAlt') || postTitle || 'Blog post cover image';
                const isWebp = ogImageUrl.includes('.webp');
                const isJpg = ogImageUrl.includes('.jpg') || ogImageUrl.includes('.jpeg');
                const mimeType = isWebp ? 'image/webp' : (isJpg ? 'image/jpeg' : 'image/png');

                setOrUpdateMeta(data.metadata, 'og:image', ogImageUrl);
                setOrUpdateMeta(data.metadata, 'og:image:secure_url', ogImageUrl);
                setOrUpdateMeta(data.metadata, 'og:image:type', mimeType);
                setOrUpdateMeta(data.metadata, 'twitter:image', ogImageUrl);
                setOrUpdateMeta(data.metadata, 'og:image:alt', coverAlt);
                setOrUpdateMeta(data.metadata, 'og:image:width', '1200');
                setOrUpdateMeta(data.metadata, 'og:image:height', '630');

                // Robots & Crawlers
                setOrUpdateMeta(data.metadata, 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');

                // Twitter Card
                setOrUpdateMeta(data.metadata, 'twitter:card', 'summary_large_image');
                setOrUpdateMeta(data.metadata, 'twitter:site', '@MatchaLatteTea');
                setOrUpdateMeta(data.metadata, 'twitter:creator', '@MatchaLatteTea');

                // Author & Publisher
                setOrUpdateMeta(data.metadata, 'author', 'Justin Kim');
                setOrUpdateMeta(data.metadata, 'article:author', 'https://www.justink.dev');
                setOrUpdateMeta(data.metadata, 'article:author:name', 'Justin Kim');
                setOrUpdateMeta(data.metadata, 'article:publisher', 'https://www.justink.dev/');
                setOrUpdateMeta(data.metadata, 'article:section', isClimbing ? 'Climbing' : 'Software Development');

                // Dates
                const publishedDate = isClimbing
                    ? singleBlog.getString('date') || singleBlog.getString('created')
                    : singleBlog.getString('manualPublishDate') || singleBlog.getString('created');
                if (publishedDate) {
                    setOrUpdateMeta(data.metadata, 'article:published_time', new Date(publishedDate).toISOString());
                }

                const updatedDate = singleBlog.getString('updated');
                if (updatedDate) {
                    setOrUpdateMeta(data.metadata, 'article:modified_time', new Date(updatedDate).toISOString());
                }

                // Tags & Keywords
                // Remove previous article:tag entries in place to prevent duplicates
                for (let i = data.metadata.length - 1; i >= 0; i--) {
                    if (data.metadata[i].name === 'article:tag') {
                        data.metadata.splice(i, 1);
                    }
                }

                let tagsList = [];
                if (isClimbing) {
                    const climbType = singleBlog.getString('climbType');
                    const grade = singleBlog.getString('grade');
                    const style = singleBlog.getString('style');
                    const location = singleBlog.getString('location');
                    tagsList = [climbType, grade, style, location].filter(Boolean);
                } else {
                    const blogTags = singleBlog.getString('tags');
                    if (blogTags && blogTags.length > 0) {
                        tagsList = blogTags.split(';').map(t => t.trim()).filter(Boolean);
                    }
                }

                tagsList.forEach((tag) => {
                    data.metadata.push({ name: 'article:tag', content: tag });
                });
                if (tagsList.length > 0) {
                    setOrUpdateMeta(data.metadata, 'keywords', tagsList.join(', '));
                }

                trackGAEvent('view_item', {
                    event_category: isClimbing ? 'climbing_engagement' : 'blog_engagement',
                    item_id: singleBlog.id,
                    item_name: postTitle,
                    item_category: isClimbing ? (singleBlog.getString('climbType') || '') : (singleBlog.getString('tags') || ''),
                    author: 'Justin K'
                }, req);
            } catch (err) {
                console.error('Error preparing single blog view metadata: ', err);
            }
        }

        // Assemble view-model for rendering
        const coverImageAlt = singleBlog.getString('coverImageAlt');
        const imageUrl = isClimbing
            ? (getImageUrl(singleBlog) ? `${getImageUrl(singleBlog)}?thumb=1000x0` : '/background.webp')
            : (getImageUrl(singleBlog) ? `${getImageUrl(singleBlog)}?thumb=1000x0` : (coverImageAlt || null));

        let badges = [];
        if (isClimbing) {
            if (singleBlog.getString('climbType')) badges.push({ text: singleBlog.getString('climbType'), query: singleBlog.getString('climbType').trim() });
            if (singleBlog.getString('grade')) badges.push({ text: singleBlog.getString('grade'), query: singleBlog.getString('grade').trim() });
            if (singleBlog.getString('style')) badges.push({ text: singleBlog.getString('style'), query: singleBlog.getString('style').trim() });
            if (singleBlog.getString('location')) badges.push({ text: singleBlog.getString('location'), query: singleBlog.getString('location').trim(), isLocation: true });
        } else {
            const pageTags = singleBlog.getString('tags');
            if (pageTags && pageTags.length > 0) {
                pageTags.split(';').forEach(tag => {
                    const t = tag.trim();
                    if (t) badges.push({ text: t, query: t });
                });
            }
        }

        const dateRaw = isClimbing
            ? (singleBlog.getString('date') || singleBlog.getString('created'))
            : (singleBlog.getString('manualPublishDate') || singleBlog.getString('created'));
        const formattedDate = formatDateTime(new Date(dateRaw));

        const updatedRaw = singleBlog.getString('updated');
        const formattedUpdated = updatedRaw ? formatDateTime(new Date(updatedRaw)) : null;

        const cleanContent = toNoCookie(isClimbing ? singleBlog.getString('content') : singleBlog.getString('content1'));
        const cleanContent2 = !isClimbing && singleBlog.getString('content2') ? toNoCookie(singleBlog.getString('content2')) : null;

        viewModel = {
            id: singleBlog.id,
            rawBlog: singleBlog,
            title: singleBlog.getString('title'),
            imageUrl,
            badges,
            isClimbing,
            formattedDate,
            formattedUpdated,
            cleanContent,
            cleanContent2,
            backLink: isClimbing ? '/climbing' : '/blog/posts',
            backLabel: isClimbing ? 'More Climbing' : 'More Dev Posts',
            dateLabel: isClimbing ? 'Logged' : 'Posted'
        };
    }

    return viewModel;
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
 * Extract the authenticated user from request cookies or request auth context
 * @param {Object|null} req
 * @returns {{ id: string, email: string, name: string, username: string, verified: boolean } | null}
 */
function getAuthenticatedUser(req) {
    if (!req) return null;

    try {
        const { getAuthRecordFromToken } = require(`${__hooks}/pages/utils/pocket.js`);
        let record = req.auth || req.event?.auth || null;

        if (!record) {
            let cookiesMap = null;
            if (typeof req.cookies === 'function') {
                cookiesMap = req.cookies();
            } else if (req.cookies) {
                cookiesMap = req.cookies;
            }

            const rawCookie = cookiesMap ? cookiesMap[AUTH_COOKIE_NAME] : null;
            let token = null;
            if (typeof rawCookie === 'string') {
                token = rawCookie;
            } else if (rawCookie && typeof rawCookie === 'object') {
                token = rawCookie.token || rawCookie.value || null;
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
        } catch (_) {}
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
 * Build canonical OpenBeta-style area URL (/area/:uuid/:slug)
 * @param {string} uuid
 * @param {string} name
 * @returns {string}
 */
function buildAreaUrl(uuid, name) {
    const slug = slugifyTitle(String(name || "area"));
    return `/area/${encodeURIComponent(String(uuid || ""))}/${encodeURIComponent(slug || "area")}`;
}

/**
 * Prepare homepage Countries & Climbing Locations directory view model (OpenBeta style)
 * @param {object} params
 * @param {object} reqObj
 * @param {object} data
 * @returns {object}
 */
function prepareHomepageDirectoryViewData(params = {}, reqObj = null, data = null) {
    const { getAllActiveAreas } = require(`${__hooks}/pages/utils/pocket.js`);

    const rawQuery = typeof params?.query === "string" ? params.query.trim() : "";
    const cleanQuery = sanitizeSearchTerm(rawQuery);
    const countryFilter = typeof params?.country === "string" ? params.country.trim().toUpperCase() : "";

    if (cleanQuery && reqObj) {
        trackGAEvent(reqObj, "view_search_results", {
            search_term: cleanQuery,
            search_category: "climbing_locations"
        });
    }

    const allRecords = getAllActiveAreas();
    const areaItems = allRecords.map((r) => {
        const uuid = r.getString("openbetaUuid");
        const name = r.getString("name");
        const totalClimbs = r.getInt("totalClimbs") || 0;
        const geoPoint = r.getGeoPoint("coordinates");
        let pathTokens = [];
        try {
            const rawTokens = r.get("pathTokens");
            if (Array.isArray(rawTokens)) {
                pathTokens = rawTokens;
            } else if (typeof rawTokens === "string" && rawTokens.startsWith("[")) {
                pathTokens = JSON.parse(rawTokens);
            }
        } catch (_) {}

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
            url: buildAreaUrl(uuid, name)
        };
    });

    // Separate root countries vs child areas
    const rootCountries = areaItems.filter((a) => !a.parentUuid);
    const childrenByParentUuid = {};
    for (let i = 0; i < areaItems.length; i++) {
        const item = areaItems[i];
        if (item.parentUuid) {
            if (!childrenByParentUuid[item.parentUuid]) {
                childrenByParentUuid[item.parentUuid] = [];
            }
            childrenByParentUuid[item.parentUuid].push(item);
        }
    }

    const usaRoot = rootCountries.find((c) => c.name === "USA" || c.shortCode === "USA") || {
        uuid: "1db1e8ba-a40e-587c-88a4-64f5ea814b8e",
        name: "USA",
        shortCode: "USA",
        totalClimbs: 206261,
        formattedClimbs: "206,261",
        url: buildAreaUrl("1db1e8ba-a40e-587c-88a4-64f5ea814b8e", "USA")
    };

    const qLower = rawQuery.toLowerCase();
    const matchesSearch = (item, childList = []) => {
        if (!qLower) return true;
        if (item.name.toLowerCase().includes(qLower) || item.shortCode.toLowerCase().includes(qLower)) {
            return true;
        }
        return childList.some((ch) => ch.name.toLowerCase().includes(qLower));
    };

    // Featured International countries on OpenBeta homepage (Canada, Germany, South Africa) + other active countries
    const priorityOrder = { CAN: 1, DEU: 2, ZAF: 3 };
    const internationalCountries = rootCountries
        .filter((c) => c.uuid !== usaRoot.uuid)
        .sort((a, b) => {
            const pA = priorityOrder[a.shortCode] || 99;
            const pB = priorityOrder[b.shortCode] || 99;
            if (pA !== pB) return pA - pB;
            return a.name.localeCompare(b.name);
        })
        .map((country) => {
            const rawChildren = childrenByParentUuid[country.uuid] || [];
            // Show destination areas first; if none explicitly marked, show top climbing sub-areas
            const dests = rawChildren.filter((ch) => ch.isDestination);
            const locations = (dests.length > 0 ? dests : rawChildren).sort((a, b) =>
                b.totalClimbs - a.totalClimbs || a.name.localeCompare(b.name)
            );
            const filteredLocations = qLower
                ? locations.filter(
                      (loc) =>
                          loc.name.toLowerCase().includes(qLower) ||
                          country.name.toLowerCase().includes(qLower)
                  )
                : locations;

            return {
                ...country,
                isFeaturedCountry: Boolean(priorityOrder[country.shortCode]),
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

    // USA States + Featured Destinations under each state
    const rawUsaStates = (childrenByParentUuid[usaRoot.uuid] || []).sort((a, b) =>
        a.name.localeCompare(b.name)
    );

    const usaStates = rawUsaStates
        .map((state) => {
            const stateChildren = (childrenByParentUuid[state.uuid] || []).sort(
                (a, b) => b.totalClimbs - a.totalClimbs || a.name.localeCompare(b.name)
            );
            const filteredDestinations = qLower
                ? stateChildren.filter(
                      (dest) =>
                          dest.name.toLowerCase().includes(qLower) ||
                          state.name.toLowerCase().includes(qLower)
                  )
                : stateChildren;

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

    const totalGlobalClimbs = rootCountries.reduce((sum, c) => sum + (c.totalClimbs || 0), 0);
    const totalDestinations = areaItems.filter((a) => a.isDestination).length;

    const quickNavLinks = [
        { code: "ALL", label: "All Countries", href: "/" },
        {
            code: "ZAF",
            label: "S. Africa",
            href: "/?country=ZAF",
            areaUrl: buildAreaUrl("1d33c773-e381-5b8a-a13f-3dfd7991732b", "South Africa")
        },
        {
            code: "CAN",
            label: "Canada",
            href: "/?country=CAN",
            areaUrl: buildAreaUrl("2996145f-e1ba-5b56-9da8-30c64ccc3776", "Canada")
        },
        {
            code: "DEU",
            label: "Germany",
            href: "/?country=DEU",
            areaUrl: buildAreaUrl("be9733db-21a2-53ec-86a2-3fb6fab552d9", "Germany")
        },
        {
            code: "USA",
            label: "USA",
            href: "/?country=USA",
            areaUrl: usaRoot.url
        }
    ];

    return {
        searchQuery: rawQuery,
        hasSearchQuery: Boolean(rawQuery),
        countryFilter: countryFilter || "ALL",
        quickNavLinks,
        stats: {
            totalCountries: rootCountries.length,
            totalStates: rawUsaStates.length,
            totalDestinations,
            totalClimbs: totalGlobalClimbs,
            formattedTotalClimbs: formatNumberWithCommas(totalGlobalClimbs)
        },
        internationalCountries,
        usa: {
            ...usaRoot,
            states: usaStates
        },
        hasResults: internationalCountries.length > 0 || usaStates.length > 0
    };
}

/**
 * Prepare single Area page view model (/area/:uuid/:slug)
 * @param {object} params
 * @param {object} reqObj
 * @param {object} data
 * @returns {object|null}
 */
function prepareAreaDetailViewData(params = {}, reqObj = null, data = null) {
    const { getOrSyncAreaDetail } = require(`${__hooks}/pages/utils/pocket.js`);
    const uuid = typeof params?.uuid === "string" ? params.uuid.trim() : "";
    if (!uuid) return null;

    const { areaRecord, childAreas, climbs, isDescendantClimbs } = getOrSyncAreaDetail(uuid);
    if (!areaRecord) return null;

    const name = areaRecord.getString("name") || "Climbing Area";
    const totalClimbs = areaRecord.getInt("totalClimbs") || climbs.length || 0;
    const description = areaRecord.getString("description") || "";
    const areaLocation = areaRecord.getString("areaLocation") || "";
    const areaGeo = areaRecord.getGeoPoint("coordinates");
    const lat = areaGeo?.lat || 0;
    const lng = areaGeo?.lon || 0;
    const shortCode = areaRecord.getString("shortCode") || "";
    const createdByUser = areaRecord.getString("createdByUser") || "";
    const updatedByUser = areaRecord.getString("updatedByUser") || "";

    let pathTokens = [];
    let ancestors = [];
    try {
        const rawTokens = areaRecord.get("pathTokens");
        pathTokens = Array.isArray(rawTokens)
            ? rawTokens
            : typeof rawTokens === "string" && rawTokens.startsWith("[")
              ? JSON.parse(rawTokens)
              : [];
    } catch (_) {}
    try {
        const rawAnc = areaRecord.get("ancestors");
        ancestors = Array.isArray(rawAnc)
            ? rawAnc
            : typeof rawAnc === "string" && rawAnc.startsWith("[")
              ? JSON.parse(rawAnc)
              : [];
    } catch (_) {}

    const breadcrumbs = [];
    const crumbLen = Math.min(pathTokens.length, ancestors.length);
    for (let i = 0; i < crumbLen; i++) {
        breadcrumbs.push({
            name: pathTokens[i],
            uuid: ancestors[i],
            url: buildAreaUrl(ancestors[i], pathTokens[i]),
            isCurrent: ancestors[i] === uuid || i === crumbLen - 1
        });
    }
    if (breadcrumbs.length === 0) {
        breadcrumbs.push({
            name,
            uuid,
            url: buildAreaUrl(uuid, name),
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
            url: buildAreaUrl(chUuid, chName)
        };
    });

    const formattedClimbs = (climbs || []).map((cl) => {
        const gradeYds = cl.getString("gradeYds") || "";
        const gradeVscale = cl.getString("gradeVscale") || "";
        const gradeFrench = cl.getString("gradeFrench") || "";
        const gradeFont = cl.getString("gradeFont") || "";
        const gradeEwbank = cl.getString("gradeEwbank") || "";
        const gradeBrazilianCrux = cl.getString("gradeBrazilianCrux") || "";
        const gradeUiaa = cl.getString("gradeUiaa") || "";
        const gradeWi = cl.getString("gradeWi") || "";
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

        let disciplines = [];
        try {
            const rawDisc = cl.get("disciplines");
            if (Array.isArray(rawDisc)) {
                disciplines = rawDisc;
            } else if (typeof rawDisc === "string" && rawDisc.startsWith("[")) {
                disciplines = JSON.parse(rawDisc);
            } else if (typeof rawDisc === "string" && rawDisc) {
                disciplines = [rawDisc];
            }
        } catch (_) {}

        let clPathTokens = [];
        try {
            const rawPt = cl.get("pathTokens");
            if (Array.isArray(rawPt)) {
                clPathTokens = rawPt;
            } else if (typeof rawPt === "string" && rawPt.startsWith("[")) {
                clPathTokens = JSON.parse(rawPt);
            }
        } catch (_) {}

        const clAreaUuid = cl.getString("areaUuid") || "";
        const clSubAreaName = clPathTokens.length > 0 ? clPathTokens[clPathTokens.length - 1] : "";

        const safety = cl.getString("safety") || "";
        const clGeo = cl.getGeoPoint("coordinates");
        const clLat = clGeo?.lat || 0;
        const clLng = clGeo?.lon || 0;
        const pitchesCount = cl.getInt("pitchesCount") || 1;

        return {
            id: cl.id,
            uuid: cl.getString("openbetaUuid"),
            name: cl.getString("name"),
            fa: cl.getString("fa") || "",
            length: cl.getInt("length") || 0,
            boltsCount: cl.getInt("boltsCount") || 0,
            pitchesCount,
            safety: safety !== "UNSPECIFIED" ? safety : "",
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
            disciplines,
            coordinates: {
                lon: clLng,
                lat: clLat
            },
            lat: clLat,
            lng: clLng,
            hasCoords: typeof clLat === "number" && typeof clLng === "number" && (clLat !== 0 || clLng !== 0),
            description: cl.getString("description") || "",
            location: cl.getString("location") || "",
            protection: cl.getString("protection") || "",
            createdByUser: cl.getString("createdByUser") || "",
            updatedByUser: cl.getString("updatedByUser") || "",
            subAreaName: clSubAreaName && clSubAreaName !== name ? clSubAreaName : "",
            subAreaUrl: clAreaUuid && clSubAreaName ? buildAreaUrl(clAreaUuid, clSubAreaName) : ""
        };
    });

    if (reqObj) {
        trackGAEvent(reqObj, "select_content", {
            content_type: "climbing_area",
            item_id: uuid,
            item_name: sanitizeSearchTerm(name)
        });
    }

    if (data?.metadata) {
        const pageTitle = `${name} Climbing Guide | Wiki Bloc`;
        const pageDesc = description
            ? extractPreviewText(description).slice(0, 160)
            : `Explore ${formatNumberWithCommas(totalClimbs)} rock climbing routes, boulders, and crags in ${name}.`;
        const canonicalUrl = `https://wiki-bloc.jkim.win${buildAreaUrl(uuid, name)}`;

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
        areaLocation,
        createdByUser,
        updatedByUser,
        lat,
        lng,
        hasCoords: typeof lat === "number" && typeof lng === "number" && (lat !== 0 || lng !== 0),
        breadcrumbs,
        children: formattedChildren,
        climbs: formattedClimbs,
        isDescendantClimbs: Boolean(isDescendantClimbs),
        url: buildAreaUrl(uuid, name)
    };
}

module.exports = {
    formatDateTime,
    getImageUrl,
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
    prepareBlogPostsViewData,
    prepareBlogSingleViewData,
    sanitizeSearchTerm,
    extractPreviewText,
    toNoCookie,
    formatPostViewModel,
    setOrUpdateMeta,
    sanitizeRedirectPath,
    getAuthenticatedUser,
    setAuthCookie,
    clearAuthCookie,
    prepareLoginPageViewData,
    formatNumberWithCommas,
    buildAreaUrl,
    prepareHomepageDirectoryViewData,
    prepareAreaDetailViewData
}

