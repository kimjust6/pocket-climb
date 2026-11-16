/// <reference path="../pb_data/types.d.ts" />

// Middleware to set HTTP Cache-Control headers for images and static media
routerUse((e) => {
    try {
        const path = String(e?.request?.url?.path || e?.request?.url || "");
        if (
            path.startsWith("/api/files/") ||
            /\.(webp|png|jpg|jpeg|gif|svg|ico|woff2)$/i.test(path)
        ) {
            e.response.header().set("Cache-Control", "public, max-age=31536000, immutable");
        }
    } catch (_) {}
    return e.next();
});

routerAdd("GET", "/api/collection-schedule", (e) => {
    const {
        COLLECTION_CONFIG_URL,
        COLLECTION_CALENDAR_URL,
        COLLECTION_ENDPOINT_HEADERS,
        buildCollectionScheduleResponse,
        formatCollectionDiscordMessage,
        getHttpJson,
    } = require(`${__hooks}/pages/utils/collection.js`);

    const {
        DISCORD_ID_JUSTIN,
        COLLECTION_ENDPOINT_BASE_URL,
        COLLECTION_SUGGEST_URL,
    } = require(`${__hooks}/pages/utils/constants.js`);

    const {
        sendDiscordMessage2,
    } = require(`${__hooks}/pages/utils/common.js`);

    const buildEndpointFromKeyString = (keyString) => {
        return `${COLLECTION_ENDPOINT_BASE_URL}?f=json&keyString=${encodeURIComponent(keyString)}&unit=%25&areaTypeCode1=RESW&areaTypeCode2=CITW`;
    };

    const buildEndpointFromLocation = (location) => {
        return `${COLLECTION_ENDPOINT_BASE_URL}?f=json&singleLine=${encodeURIComponent(location)}&unit=%25&areaTypeCode1=RESW&areaTypeCode2=CITW`;
    };

    const sendHttpOrThrowLocal = (label, requestOptions) => {
        try {
            return $http.send(requestOptions);
        } catch (_) {
            throw new Error(`${label} request failed.`);
        }
    };

    try {
        const resolveCollectionEndpointUrlLocal = () => {
            let location = "5 o'meara court";

            // Normalize common address suffixes to Toronto geocoder abbreviations
            location = location
                .replace(/\bcourt\b/gi, "crt")
                .replace(/\bct\b/gi, "crt")
                .replace(/\bstreet\b/gi, "st")
                .replace(/\broad\b/gi, "rd")
                .replace(/\bavenue\b/gi, "ave")
                .replace(/\bdrive\b/gi, "dr")
                .replace(/\bboulevard\b/gi, "blvd")
                .replace(/\bplace\b/gi, "pl")
                .replace(/\bcrescent\b/gi, "cres");

            const suggestUrl = `${COLLECTION_SUGGEST_URL}?f=json&matchAddress=1&matchPlaceName=1&matchPostalCode=1&addressOnly=0&retRowLimit=100&searchString=${encodeURIComponent(location)}&filter=5`;
            const suggestResponse = sendHttpOrThrowLocal("Toronto suggest", {
                url: suggestUrl,
                headers: COLLECTION_ENDPOINT_HEADERS,
            });
            const suggestJson = getHttpJson(suggestResponse);
            const suggestRows = suggestJson?.result?.rows;
            if (Array.isArray(suggestRows) && suggestRows.length > 0) {
                const keyString = suggestRows[0]?.KEYSTRING ?? suggestRows[0]?.keyString;
                if (keyString) {
                    return buildEndpointFromKeyString(String(keyString));
                }
            }

            return buildEndpointFromLocation(location);
        };

        const geocoderUrl = resolveCollectionEndpointUrlLocal();
        const geocoderResponse = sendHttpOrThrowLocal("Toronto geocoder", {
            url: geocoderUrl,
            headers: COLLECTION_ENDPOINT_HEADERS,
        });
        const configResponse = sendHttpOrThrowLocal("Collection config", {
            url: COLLECTION_CONFIG_URL,
            headers: {
                Accept: "application/json",
            },
        });
        const calendarCsvResponse = sendHttpOrThrowLocal("Collection calendar", {
            url: COLLECTION_CALENDAR_URL,
        });
        const scheduleResponse = buildCollectionScheduleResponse(
            geocoderResponse,
            configResponse,
            calendarCsvResponse,
        );
        const response = {
            statusCode: geocoderResponse.statusCode,
            json: scheduleResponse,
        };

        sendDiscordMessage2(formatCollectionDiscordMessage(response), DISCORD_ID_JUSTIN);

        return e.json(response.statusCode, {
            status: response.statusCode,
            data: response.json ?? response.raw,
        });
    } catch (err) {
        $app.logger().error("Failed to check collection endpoint", "error", err);
        sendDiscordMessage2([
            "Collection status: 502",
            err?.message ?? String(err),
        ].join("\n\n"), DISCORD_ID_JUSTIN);

        return e.json(502, {
            message: "Failed to check collection endpoint.",
            error: err?.message ?? String(err),
        });
    }
});

routerAdd("POST", "/clippy/zendesk", (e) => {

    const {
        saveZendeskRecord,
    } = require(`${__hooks}/pages/utils/common.js`);

    let data;
    try {
        data = e.requestInfo();
    } catch (err) {
        $app.logger().error("Failed to parse request info", "error", err);
        return e.json(400, { message: "Invalid request" });
    }

    try {
        saveZendeskRecord(data);
    } catch (err) {
        $app.logger().error("Error saving Zendesk record", "error", err);
    }

    return e.json(202, { status: "accepted" });

});

routerAdd("GET", "/clippy/zendesk", (e) => {
    return e.json(405, { "message": "Method not allowed." })
})

// Hook for when a new zendesk_tickets record is created
onRecordAfterCreateSuccess((e) => {
    const {
        getAssigneeId,
        getActorId,
        sendDiscordMessage,
        findRecentTicketsByTicketNumber2,
        getAdminSetting,
        generateNormalTicketMessage,
        isTicketClosed,
        isSlaBreaching,
        getDiscordIdfromData,
        generateSlaBreachingSoonMessage,
        isTicketCreated,
    } = require(`${__hooks}/pages/utils/common.js`);

    const {
        POCKET_ADMIN_IGNORE_DUPLICATE_ZENDESK_CALLBACK_IN_SECONDS,
        DISCORD_ID_JUSTIN
    } = require(`${__hooks}/pages/utils/constants.js`);

    function handleTicketCreated(data) {
        const myMessage = generateNormalTicketMessage(data);
        sendDiscordMessage(`New Ticket: ${myMessage}`);
    }

    function handleSendMessage(data, createdDate = new Date()) {
        const discordId = getDiscordIdfromData(data);
        if (!discordId) {
            return;
        }

        try {
            const settingRaw = getAdminSetting(POCKET_ADMIN_IGNORE_DUPLICATE_ZENDESK_CALLBACK_IN_SECONDS) ?? "10";
            const appsettingsDelaySeconds = parseInt(settingRaw, 10);
            const timeInSeconds = isNaN(appsettingsDelaySeconds) ? 10 : appsettingsDelaySeconds;

            const actorId = getActorId(data);
            const assigneeId = getAssigneeId(data);
            const recentTickets = findRecentTicketsByTicketNumber2(data, timeInSeconds, actorId);

            // Check if there are no recent tickets
            if (actorId === assigneeId || isTicketClosed(data)) {
                return;
            }

            if (recentTickets.length > 1 && new Date(recentTickets[0]?.get("created")) < createdDate) {
                return;
            }

            const myMessage = generateNormalTicketMessage(data);
            sendDiscordMessage(myMessage, discordId);
        } catch (error) {
            $app.logger().error(`Error sending ticket update message: ${myMessage}.`, "error", error);
        }
    }

    function handleSLABreaching(data) {
        const discordId = getDiscordIdfromData(data);
        const myMessage = generateSlaBreachingSoonMessage(data);
        if (discordId) {
            sendDiscordMessage(myMessage, discordId);
        }

        if (discordId !== DISCORD_ID_JUSTIN) {
            sendDiscordMessage(myMessage);
        }
    }

    // Get the data field and convert to string
    const data = JSON.parse(e.record.get("data"));
    if (!data) {
        $app.logger().error(`No Data in PocketBase:`, "error");
        return;
    }

    if (isTicketCreated(data)) {
        handleTicketCreated(data);
    }
    else if (isSlaBreaching(data)) {
        handleSLABreaching(data);
    }
    else {
        handleSendMessage(data, new Date(e.record.get("created")));
    }

}, "zendesk_tickets");

/**
 * OpenBeta Climbs Sync Endpoint
 *
 * GET/POST /api/openbeta/update-climbs
 * GET/POST /api/climbs/update
 *
 * Queries OpenBeta (https://api.openbeta.io/) and updates climbs with the fewest requests possible:
 * 1. "areas" mode (default): Bundles up to 50-60 leaf areas per request using GraphQL aliases,
 *    updating all ~22,000+ local climbs in only ~35-42 HTTP requests!
 * 2. "catalog" mode: Paginates OpenBeta global leaf areas with limit=100 crags per request.
 * 3. Specific Area: If areaUuid is provided, syncs that area in 1 single HTTP request.
 */
function handleUpdateClimbsRequest(e) {
    const {
        updateClimbsFromOpenBeta,
        getLastClimbsSyncStats,
        createSyncLogRecord,
        getRecentSyncLogs,
    } = require(`${__hooks}/pages/utils/pocket.js`);

    let query = {};
    let body = {};
    try {
        const info = e.requestInfo();
        query = info?.query || {};
        body = info?.body || {};
    } catch (_) {}

    const getParam = (key) => (body && body[key] !== undefined ? body[key] : (query && query[key] !== undefined ? query[key] : undefined));

    const isStatusQuery = String(getParam("status") || "").toLowerCase();
    if (isStatusQuery === "1" || isStatusQuery === "true") {
        const recentLogs = getRecentSyncLogs(5);
        return e.json(200, {
            status: "ok",
            lastSync: recentLogs[0] || getLastClimbsSyncStats(),
            history: recentLogs,
        });
    }

    const mode = getParam("mode") || "areas";
    const batchSize = parseInt(getParam("batchSize") || getParam("batch_size") || 0, 10);
    const limit = parseInt(getParam("limit") || 0, 10);
    const offset = parseInt(getParam("offset") || 0, 10);
    const all = String(getParam("all") || "").toLowerCase() === "true" || getParam("all") === true;
    const dryRun = String(getParam("dryRun") || getParam("dry_run") || "").toLowerCase() === "true" || getParam("dryRun") === true;
    const areaUuid = getParam("areaUuid") || getParam("area_uuid") || getParam("area");
    const timeoutSeconds = parseInt(getParam("timeoutSeconds") || getParam("timeout") || -1, 10);

    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    try {
        const stats = updateClimbsFromOpenBeta({
            mode,
            batchSize: batchSize > 0 ? batchSize : undefined,
            limit: limit > 0 ? limit : undefined,
            offset,
            all,
            dryRun,
            areaUuid,
            timeoutSeconds: timeoutSeconds >= 0 ? timeoutSeconds : undefined,
        });

        const completedAt = new Date().toISOString();
        const durationSeconds = Math.round((Date.now() - startTime) / 10) / 100;
        const errorMessage = stats.status === "error"
            ? (stats.message || "Climbs update failed")
            : (stats.failedBatches && stats.failedBatches.length > 0 ? `Failed batches: ${stats.failedBatches.length}` : "");

        const syncLog = createSyncLogRecord({
            status: stats.status || "success",
            syncType: "climbs",
            mode,
            durationSeconds: stats.durationSeconds || durationSeconds,
            startedAt,
            completedAt,
            areasProcessed: stats.areasProcessed || 0,
            climbsUpdated: stats.climbsUpdated || 0,
            pitchesUpdated: stats.pitchesUpdated || 0,
            requestsMade: stats.requestsMade || 0,
            errorMessage,
            details: stats,
            triggeredBy: "api",
        });

        const httpStatus = stats.status === "error" ? 500 : (stats.status === "partial_success" ? 206 : 200);
        return e.json(httpStatus, {
            ...stats,
            syncLogId: syncLog?.id || null,
        });
    } catch (err) {
        $app.logger().error("Failed to update climbs from OpenBeta", "error", err);
        const completedAt = new Date().toISOString();
        const durationSeconds = Math.round((Date.now() - startTime) / 10) / 100;
        const syncLog = createSyncLogRecord({
            status: "error",
            syncType: "climbs",
            mode,
            durationSeconds,
            startedAt,
            completedAt,
            errorMessage: err?.message || String(err),
            details: { error: err?.message || String(err) },
            triggeredBy: "api",
        });

        return e.json(500, {
            status: "error",
            message: "Failed to update climbs from OpenBeta",
            error: err?.message || String(err),
            syncLogId: syncLog?.id || null,
        });
    }
}

routerAdd("POST", "/api/openbeta/update-climbs", handleUpdateClimbsRequest);
routerAdd("GET", "/api/openbeta/update-climbs", handleUpdateClimbsRequest);
routerAdd("POST", "/api/climbs/update", handleUpdateClimbsRequest);
routerAdd("GET", "/api/climbs/update", handleUpdateClimbsRequest);

/**
 * Unified Data Sync Endpoint for Cron Jobs & Webhooks
 *
 * GET/POST /api/sync
 * GET/POST /api/cron/sync
 *
 * Supported query / body params:
 * - token / secret: optional token matching CRON_SECRET from .env or admin_settings
 * - status: "1" to return the last sync stats without triggering a new sync
 * - mode: "areas" (default) or "catalog"
 * - batchSize: number of areas per GraphQL request (default: 50)
 * - limit: max leaf areas to process (default: 0 = all)
 * - offset: start offset for pagination
 * - all: "true" to process all areas
 * - timeoutSeconds: safety timeout in seconds (default: 55)
 * - syncMedia: "true" to also sync pending photos to Imgur (default: true if IMGUR_CLIENT_ID is set)
 * - mediaLimit: max photos to sync to Imgur in this run (default: 10)
 * - dryRun: "true" to simulate without writing
 */
function handleUnifiedSyncRequest(e) {
    const {
        updateClimbsFromOpenBeta,
        getLastClimbsSyncStats,
        syncPendingMediaToImgur,
        createSyncLogRecord,
        getRecentSyncLogs,
        getLatestSyncLog,
    } = require(`${__hooks}/pages/utils/pocket.js`);

    const {
        getAdminSetting,
        getImgurClientId,
    } = require(`${__hooks}/pages/utils/common.js`);

    let query = {};
    let body = {};
    try {
        const info = e.requestInfo();
        query = info?.query || {};
        body = info?.body || {};
    } catch (_) {}

    const getParam = (key) => (body && body[key] !== undefined ? body[key] : (query && query[key] !== undefined ? query[key] : undefined));

    // Optional secret token authentication (CRON_SECRET)
    const expectedSecret = (process.env.CRON_SECRET || getAdminSetting("CRON_SECRET") || "").trim();
    if (expectedSecret) {
        const authHeader = String(e.request?.headers?.get("Authorization") || "");
        const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
        const queryToken = String(getParam("token") || getParam("secret") || "").trim();
        const providedToken = queryToken || bearerToken;

        if (!providedToken || providedToken !== expectedSecret) {
            return e.json(401, {
                ok: false,
                status: "unauthorized",
                message: "Unauthorized: Invalid or missing cron secret token. Provide ?token=... or Authorization: Bearer ...",
            });
        }
    }

    // Status check
    const isStatusQuery = String(getParam("status") || "").toLowerCase();
    if (isStatusQuery === "1" || isStatusQuery === "true") {
        const recentLogs = getRecentSyncLogs(10);
        return e.json(200, {
            ok: true,
            status: "ok",
            lastSync: recentLogs[0] || getLatestSyncLog() || getLastClimbsSyncStats(),
            history: recentLogs,
        });
    }

    const mode = getParam("mode") || "areas";
    const batchSize = parseInt(getParam("batchSize") || getParam("batch_size") || 50, 10);
    const limit = parseInt(getParam("limit") || 0, 10);
    const offset = parseInt(getParam("offset") || 0, 10);
    const all = String(getParam("all") || "true").toLowerCase() === "true" || getParam("all") === true;
    const dryRun = String(getParam("dryRun") || getParam("dry_run") || "").toLowerCase() === "true" || getParam("dryRun") === true;
    const areaUuid = getParam("areaUuid") || getParam("area_uuid") || getParam("area");
    const timeoutSeconds = parseInt(getParam("timeoutSeconds") || getParam("timeout") || 55, 10);

    const syncMediaParam = getParam("syncMedia") !== undefined ? getParam("syncMedia") : getParam("sync_media");
    const imgurClientId = getImgurClientId();
    const shouldSyncMedia = syncMediaParam !== undefined
        ? (String(syncMediaParam).toLowerCase() === "true" || syncMediaParam === true)
        : Boolean(imgurClientId);
    const mediaLimit = parseInt(getParam("mediaLimit") || getParam("media_limit") || 10, 10);

    $app.logger().info("[Sync API] Cron data sync triggered", "mode", mode, "all", all, "timeoutSeconds", timeoutSeconds);

    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    try {
        const climbsStats = updateClimbsFromOpenBeta({
            mode,
            batchSize: batchSize > 0 ? batchSize : 50,
            limit: limit > 0 ? limit : undefined,
            offset,
            all,
            dryRun,
            areaUuid,
            timeoutSeconds: timeoutSeconds > 0 ? timeoutSeconds : 55,
        });

        let mediaStats = null;
        if (shouldSyncMedia && !dryRun && climbsStats.status !== "error") {
            try {
                mediaStats = syncPendingMediaToImgur(mediaLimit);
            } catch (mediaErr) {
                $app.logger().warn("[Sync API] Media sync error during cron", "error", mediaErr);
                mediaStats = { error: mediaErr?.message || String(mediaErr) };
            }
        }

        const completedAt = new Date().toISOString();
        const durationSeconds = Math.round((Date.now() - startTime) / 10) / 100;

        let syncStatus = climbsStats.status || "success";
        if (mediaStats && mediaStats.error && syncStatus === "success") {
            syncStatus = "partial_success";
        }

        let errorMessage = "";
        if (climbsStats.status === "error") {
            errorMessage = climbsStats.message || "Climbs update failed";
        } else if (mediaStats && mediaStats.error) {
            errorMessage = "Media sync warning: " + (mediaStats.error?.message || mediaStats.error);
        } else if (climbsStats.failedBatches && climbsStats.failedBatches.length > 0) {
            errorMessage = `Failed batches: ${climbsStats.failedBatches.length}`;
        }

        const userAgent = String(e.request?.headers?.get("User-Agent") || "");
        const triggeredBy = userAgent.toLowerCase().includes("cron") ? "cron" : "api";

        const syncLog = createSyncLogRecord({
            status: syncStatus,
            syncType: "unified",
            mode,
            durationSeconds,
            startedAt,
            completedAt,
            areasProcessed: climbsStats.areasProcessed || 0,
            climbsUpdated: climbsStats.climbsUpdated || 0,
            pitchesUpdated: climbsStats.pitchesUpdated || 0,
            mediaUploaded: mediaStats?.uploaded || 0,
            mediaRemaining: mediaStats?.remaining || 0,
            requestsMade: climbsStats.requestsMade || 0,
            errorMessage,
            details: {
                climbs: climbsStats,
                media: mediaStats,
            },
            triggeredBy,
        });

        const httpStatus = climbsStats.status === "error" ? 500 : (climbsStats.status === "partial_success" ? 206 : 200);

        return e.json(httpStatus, {
            ok: climbsStats.status !== "error",
            status: climbsStats.status,
            message: climbsStats.message,
            timestamp: completedAt,
            durationSeconds,
            syncLogId: syncLog?.id || null,
            climbs: climbsStats,
            media: mediaStats,
            tip: expectedSecret ? undefined : "Tip: You can secure this endpoint by setting CRON_SECRET in .env or PocketBase admin_settings."
        });
    } catch (err) {
        $app.logger().error("[Sync API] Sync failed", "error", err);
        const completedAt = new Date().toISOString();
        const durationSeconds = Math.round((Date.now() - startTime) / 10) / 100;

        const syncLog = createSyncLogRecord({
            status: "error",
            syncType: "unified",
            mode,
            durationSeconds,
            startedAt,
            completedAt,
            errorMessage: err?.message || String(err),
            details: { error: err?.message || String(err) },
            triggeredBy: "api",
        });

        return e.json(500, {
            ok: false,
            status: "error",
            message: "Failed to execute data sync",
            error: err?.message || String(err),
            syncLogId: syncLog?.id || null,
        });
    }
}

routerAdd("POST", "/api/sync", handleUnifiedSyncRequest);
routerAdd("GET", "/api/sync", handleUnifiedSyncRequest);
routerAdd("POST", "/api/cron/sync", handleUnifiedSyncRequest);
routerAdd("GET", "/api/cron/sync", handleUnifiedSyncRequest);

/**
 * Built-in Weekly OpenBeta Data Sync Cron Job
 * Runs automatically every Sunday at 03:00 UTC ("0 3 * * 0")
 */
cronAdd("weekly_openbeta_data_sync", "0 3 * * 0", () => {
    $app.logger().info("[Weekly Cron] Starting scheduled weekly OpenBeta data sync...");
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    try {
        const {
            updateClimbsFromOpenBeta,
            syncPendingMediaToImgur,
            createSyncLogRecord,
        } = require(`${__hooks}/pages/utils/pocket.js`);
        const { getImgurClientId } = require(`${__hooks}/pages/utils/common.js`);

        const climbsStats = updateClimbsFromOpenBeta({
            all: true,
            timeoutSeconds: 55,
        });
        $app.logger().info("[Weekly Cron] Climbs sync completed", "stats", JSON.stringify(climbsStats));

        let mediaStats = null;
        if (getImgurClientId()) {
            try {
                mediaStats = syncPendingMediaToImgur(15);
                $app.logger().info("[Weekly Cron] Media sync completed", "uploaded", mediaStats.uploaded, "remaining", mediaStats.remaining);
            } catch (mediaErr) {
                $app.logger().warn("[Weekly Cron] Media sync error", "error", mediaErr);
                mediaStats = { error: mediaErr?.message || String(mediaErr) };
            }
        }

        const completedAt = new Date().toISOString();
        const durationSeconds = Math.round((Date.now() - startTime) / 10) / 100;

        let syncStatus = climbsStats.status || "success";
        if (mediaStats && mediaStats.error && syncStatus === "success") {
            syncStatus = "partial_success";
        }

        let errorMessage = "";
        if (climbsStats.status === "error") {
            errorMessage = climbsStats.message || "Climbs update failed";
        } else if (mediaStats && mediaStats.error) {
            errorMessage = "Media sync warning: " + (mediaStats.error?.message || mediaStats.error);
        }

        createSyncLogRecord({
            status: syncStatus,
            syncType: "cron",
            mode: "areas",
            durationSeconds,
            startedAt,
            completedAt,
            areasProcessed: climbsStats.areasProcessed || 0,
            climbsUpdated: climbsStats.climbsUpdated || 0,
            pitchesUpdated: climbsStats.pitchesUpdated || 0,
            mediaUploaded: mediaStats?.uploaded || 0,
            mediaRemaining: mediaStats?.remaining || 0,
            requestsMade: climbsStats.requestsMade || 0,
            errorMessage,
            details: { climbs: climbsStats, media: mediaStats },
            triggeredBy: "cron",
        });
    } catch (err) {
        $app.logger().error("[Weekly Cron] Scheduled sync error", "error", err);
        const completedAt = new Date().toISOString();
        const durationSeconds = Math.round((Date.now() - startTime) / 10) / 100;
        try {
            const { createSyncLogRecord } = require(`${__hooks}/pages/utils/pocket.js`);
            createSyncLogRecord({
                status: "error",
                syncType: "cron",
                mode: "areas",
                durationSeconds,
                startedAt,
                completedAt,
                errorMessage: err?.message || String(err),
                details: { error: err?.message || String(err) },
                triggeredBy: "cron",
            });
        } catch (_) {}
    }
});

/**
 * Create a climb_media record after uploading an image to Imgur (or via server Imgur fallback)
 * POST /api/climbs/{climbId}/media
 */
routerAdd("POST", "/api/climbs/{climbId}/media", (e) => {
    const {
        getAuthenticatedUser,
        getImgurClientId,
        normalizeImgurUrl,
        isValidImgurDirectUrl,
        formatClimbMediaItem,
        uploadBase64ToImgur,
        trackGAEvent,
    } = require(`${__hooks}/pages/utils/common.js`);
    const {
        getClimbByUuid,
        createClimbMediaRecord,
    } = require(`${__hooks}/pages/utils/pocket.js`);

    const authUser = getAuthenticatedUser(e);
    if (!authUser) {
        return e.json(401, {
            ok: false,
            message: "Please sign in to upload climb photos.",
        });
    }

    const climbId = String(e.request?.pathValue?.("climbId") || "").trim();
    const climbRecord = getClimbByUuid(climbId);
    if (!climbRecord) {
        return e.json(404, {
            ok: false,
            message: "Climb not found.",
        });
    }

    let body = {};
    try {
        body = e.requestInfo()?.body || {};
    } catch (_) {
        return e.json(400, {
            ok: false,
            message: "Invalid request payload.",
        });
    }

    let mediaPayload = null;
    if (body && typeof body.mediaUrl === "string" && body.mediaUrl.trim()) {
        const normalizedUrl = normalizeImgurUrl(body.mediaUrl);
        if (!isValidImgurDirectUrl(normalizedUrl)) {
            return e.json(400, {
                ok: false,
                message: "Only direct https://i.imgur.com/ image URLs are supported.",
            });
        }
        mediaPayload = {
            mediaUrl: normalizedUrl,
            width: body.width,
            height: body.height,
            format: body.format,
            size: body.size,
            imgurId: body.imgurId,
        };
    } else if (body && typeof body.imageBase64 === "string" && body.imageBase64.trim()) {
        const uploadResult = uploadBase64ToImgur(
            body.imageBase64,
            climbRecord.getString("name") || "",
            getImgurClientId()
        );
        if (!uploadResult.ok || !uploadResult.data?.mediaUrl) {
            return e.json(uploadResult.status || 502, {
                ok: false,
                message: uploadResult.error || "Failed to upload image to Imgur.",
            });
        }
        if (!isValidImgurDirectUrl(uploadResult.data.mediaUrl)) {
            return e.json(502, {
                ok: false,
                message: "Imgur returned an unexpected URL format.",
            });
        }
        mediaPayload = uploadResult.data;
    } else {
        return e.json(400, {
            ok: false,
            message: "Please provide an Imgur image URL or image payload.",
        });
    }

    try {
        const saved = createClimbMediaRecord({
            climbRecord,
            user: authUser,
            mediaUrl: mediaPayload.mediaUrl,
            width: mediaPayload.width,
            height: mediaPayload.height,
            format: mediaPayload.format,
            size: mediaPayload.size,
            imgurId: mediaPayload.imgurId,
        });

        if (!saved) {
            return e.json(500, {
                ok: false,
                message: "Failed to save climb media record.",
            });
        }

        trackGAEvent("upload_climb_media", {
            content_type: "climb_media",
            item_id: climbRecord.id,
        }, e.request);

        return e.json(201, {
            ok: true,
            media: formatClimbMediaItem(saved, authUser.id),
        });
    } catch (err) {
        $app.logger().error("Failed to save climb media", "climbId", climbRecord.id, "error", err);
        return e.json(500, {
            ok: false,
            message: "Failed to save climb photo.",
        });
    }
});

/**
 * Soft-delete a user's own uploaded climb_media record
 * DELETE /api/climbs/{climbId}/media/{mediaId}
 */
function handleDeleteClimbMediaRequest(e) {
    const { getAuthenticatedUser } = require(`${__hooks}/pages/utils/common.js`);
    const {
        getClimbByUuid,
        getClimbMediaById,
        softDeleteClimbMediaRecord,
    } = require(`${__hooks}/pages/utils/pocket.js`);

    const authUser = getAuthenticatedUser(e);
    if (!authUser) {
        return e.json(401, {
            ok: false,
            message: "Please sign in to delete climb photos.",
        });
    }

    const climbId = String(e.request?.pathValue?.("climbId") || "").trim();
    const mediaId = String(e.request?.pathValue?.("mediaId") || "").trim();
    const climbRecord = getClimbByUuid(climbId);
    if (!climbRecord) {
        return e.json(404, {
            ok: false,
            message: "Climb not found.",
        });
    }

    const mediaRecord = getClimbMediaById(mediaId);
    if (!mediaRecord || mediaRecord.getString("climb") !== climbRecord.id) {
        return e.json(404, {
            ok: false,
            message: "Photo not found for this climb.",
        });
    }

    try {
        const result = softDeleteClimbMediaRecord(mediaId, authUser.id);
        return e.json(result.status || 200, result.ok
            ? { ok: true, id: mediaId }
            : { ok: false, message: result.error || "Could not delete photo." });
    } catch (err) {
        $app.logger().error("Failed to delete climb media", "mediaId", mediaId, "error", err);
        return e.json(500, {
            ok: false,
            message: "Failed to delete photo.",
        });
    }
}

routerAdd("DELETE", "/api/climbs/{climbId}/media/{mediaId}", handleDeleteClimbMediaRequest);
routerAdd("POST", "/api/climbs/{climbId}/media/{mediaId}/delete", handleDeleteClimbMediaRequest);

/**
 * Directory Search API Endpoint
 * GET /api/search?q={query}&country={country}
 * Returns matching crags (areas) and climbs with privacy-compliant analytics
 */
routerAdd("GET", "/api/search", (e) => {
    const {
        searchDirectoryItems,
        sanitizeSearchTerm,
        trackGAEvent,
    } = require(`${__hooks}/pages/utils/common.js`);

    let query = {};
    try {
        const info = e.requestInfo();
        query = info?.query || {};
    } catch (_) {}

    const rawQ = String(query.q || query.query || "").trim();
    const cleanQ = sanitizeSearchTerm(rawQ);
    const country = String(query.country || "ALL").trim().toUpperCase();

    if (cleanQ && e.request) {
        try {
            trackGAEvent("view_search_results", {
                search_term: cleanQ,
                search_category: "climbing_locations",
            }, e.request);
        } catch (_) {}
    }

    const results = searchDirectoryItems(cleanQ, country);

    return e.json(200, {
        ok: true,
        query: cleanQ,
        country: country || "ALL",
        crags: results.crags || [],
        climbs: results.climbs || [],
        totalCrags: results.totalCrags || 0,
        totalClimbs: results.totalClimbs || 0,
    });
});

