const { POCKET_SYNC_LOGS } = require('./constants');

/**
 * Create a new record in the sync_logs collection tracking a sync operation.
 * @param {Object} data
 * @returns {Object|null} Formatted plain object of the created record, or null on error
 */
function createSyncLogRecord(data = {}) {
    try {
        const collection = $app.findCollectionByNameOrId(POCKET_SYNC_LOGS);
        if (!collection) {
            $app.logger().error("[Sync Logs] Collection not found: " + POCKET_SYNC_LOGS);
            return null;
        }

        const record = new Record(collection);
        const status = data.status || "success";
        record.set("status", String(status).slice(0, 50));
        record.set("syncType", String(data.syncType || "unified").slice(0, 50));
        record.set("mode", String(data.mode || "").slice(0, 50));

        const duration = parseFloat(data.durationSeconds !== undefined ? data.durationSeconds : (data.duration || 0));
        record.set("durationSeconds", Number.isFinite(duration) ? Math.round(duration * 100) / 100 : 0);

        const startedAt = data.startedAt || new Date().toISOString();
        const completedAt = data.completedAt || new Date().toISOString();
        record.set("startedAt", String(startedAt));
        record.set("completedAt", String(completedAt));

        record.set("areasProcessed", parseInt(data.areasProcessed || 0, 10));
        record.set("climbsUpdated", parseInt(data.climbsUpdated || 0, 10));
        record.set("pitchesUpdated", parseInt(data.pitchesUpdated || 0, 10));
        record.set("mediaUploaded", parseInt(data.mediaUploaded || 0, 10));
        record.set("mediaRemaining", parseInt(data.mediaRemaining || 0, 10));
        record.set("requestsMade", parseInt(data.requestsMade || 0, 10));

        if (data.errorMessage) {
            record.set("errorMessage", String(data.errorMessage).slice(0, 2000));
        }

        if (data.details !== undefined && data.details !== null) {
            record.set("details", data.details);
        }

        record.set("triggeredBy", String(data.triggeredBy || "api").slice(0, 50));
        record.set("isDeleted", false);

        $app.save(record);

        return {
            id: record.id,
            status: record.getString("status"),
            syncType: record.getString("syncType"),
            mode: record.getString("mode"),
            durationSeconds: record.getFloat("durationSeconds"),
            startedAt: record.getString("startedAt"),
            completedAt: record.getString("completedAt"),
            areasProcessed: record.getInt("areasProcessed"),
            climbsUpdated: record.getInt("climbsUpdated"),
            pitchesUpdated: record.getInt("pitchesUpdated"),
            mediaUploaded: record.getInt("mediaUploaded"),
            mediaRemaining: record.getInt("mediaRemaining"),
            requestsMade: record.getInt("requestsMade"),
            errorMessage: record.getString("errorMessage"),
            details: record.get("details"),
            triggeredBy: record.getString("triggeredBy"),
            created: record.getString("created"),
            updated: record.getString("updated"),
        };
    } catch (err) {
        $app.logger().error("[Sync Logs] Failed to create sync log record", "error", err);
        return null;
    }
}

/**
 * Retrieve recent sync logs from the database
 * Enforces `isDeleted = false` filter as per project guidelines.
 *
 * @param {number} [limit=10]
 * @param {number} [offset=0]
 * @returns {Array<Object>}
 */
function getRecentSyncLogs(limit = 10, offset = 0) {
    try {
        const records = $app.findRecordsByFilter(
            POCKET_SYNC_LOGS,
            "isDeleted = false",
            "-created",
            limit > 0 ? limit : 10,
            offset >= 0 ? offset : 0
        );

        return (records || []).map((r) => ({
            id: r.id,
            status: r.getString("status"),
            syncType: r.getString("syncType"),
            mode: r.getString("mode"),
            durationSeconds: r.getFloat("durationSeconds"),
            startedAt: r.getString("startedAt"),
            completedAt: r.getString("completedAt"),
            areasProcessed: r.getInt("areasProcessed"),
            climbsUpdated: r.getInt("climbsUpdated"),
            pitchesUpdated: r.getInt("pitchesUpdated"),
            mediaUploaded: r.getInt("mediaUploaded"),
            mediaRemaining: r.getInt("mediaRemaining"),
            requestsMade: r.getInt("requestsMade"),
            errorMessage: r.getString("errorMessage"),
            details: r.get("details"),
            triggeredBy: r.getString("triggeredBy"),
            created: r.getString("created"),
            updated: r.getString("updated"),
        }));
    } catch (err) {
        $app.logger().warn("[Sync Logs] Failed to retrieve sync logs", "error", err);
        return [];
    }
}

/**
 * Retrieve the latest sync log entry from the database
 * @returns {Object|null}
 */
function getLatestSyncLog() {
    const logs = getRecentSyncLogs(1, 0);
    return logs.length > 0 ? logs[0] : null;
}



module.exports = {
    createSyncLogRecord,
    getRecentSyncLogs,
    getLatestSyncLog,
};
