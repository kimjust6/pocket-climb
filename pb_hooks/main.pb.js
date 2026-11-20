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

/**
 * Verify that an incoming sync/cron request is authorized via either
 * PocketBase superuser auth or a configured CRON_SECRET token.
 */
function isAuthorizedSyncRequest(e, getParam) {
    if (e.auth && typeof e.auth.isSuperuser === "function" && e.auth.isSuperuser()) {
        return true;
    }

    const { getAdminSetting } = require(`${__hooks}/pages/utils/common.js`);
    const expectedSecret = (process.env.CRON_SECRET || getAdminSetting("CRON_SECRET") || "").trim();
    if (!expectedSecret) {
        return false;
    }

    const authHeader = String(e.request?.headers?.get("Authorization") || "");
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const queryToken = String(getParam("token") || getParam("secret") || "").trim();
    const providedToken = queryToken || bearerToken;

    return Boolean(providedToken && providedToken === expectedSecret);
}

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

    if (!isAuthorizedSyncRequest(e, getParam)) {
        return e.json(401, {
            ok: false,
            status: "unauthorized",
            message: "Unauthorized: Provide a valid CRON_SECRET or superuser token.",
        });
    }

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

    if (!isAuthorizedSyncRequest(e, getParam)) {
        return e.json(401, {
            ok: false,
            status: "unauthorized",
            message: "Unauthorized: Invalid or missing cron secret or superuser token. Provide ?token=... or Authorization: Bearer ...",
        });
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

