const {
    POCKET_AREAS,
    POCKET_CLIMBS,
    POCKET_PITCHES,
    POCKET_TICKS,
    POCKET_ORGANIZATIONS,
    POCKET_CLIMB_MEDIA,
    POCKET_USERS,
    POCKET_COLLECTION_ADMIN_SETTINGS,
    OPENBETA_API_ENDPOINT,
} = require('./constants')

module.exports = {
    POCKET_AREAS,
    POCKET_CLIMBS,
    POCKET_PITCHES,
    POCKET_TICKS,
    POCKET_ORGANIZATIONS,
    POCKET_CLIMB_MEDIA,
    POCKET_USERS,
    findUserByIdentity,
    authenticateUserWithPassword,
    getAuthRecordFromToken,
    getOAuthProviders,
    requestPasswordResetByEmail,
    registerNewUser,
    getAreaByUuid,
    getAreasByNamePrefix,
    getAreasMapByUuids,
    getAreas,
    getAllActiveAreas,
    getHomepageDirectoryAreas,
    getDatabaseCatalogStats,
    getHomepageSettingsMap,
    getClimbByUuid,
    getClimbs,
    getPitchesByClimbId,
    getTicksByClimbId,
    getOrganizations,
    getClimbMedia,
    getOrSyncAreaDetail,
    upsertOpenBetaAreaRecord,
    upsertOpenBetaClimbRecord,
    upsertOpenBetaPitchRecord,
    updateClimbsFromOpenBeta,
    getLastClimbsSyncStats,
}

/**
 * Find a user record in the `users` collection by email, username, or name
 * @param {string} identity - Email or username
 * @returns {Record|null}
 */
function findUserByIdentity(identity) {
    if (!identity || typeof identity !== 'string') return null;
    const clean = identity.trim();
    if (!clean) return null;

    try {
        const byEmail = $app.findAuthRecordByEmail(POCKET_USERS, clean);
        if (byEmail) return byEmail;
    } catch (_) {}

    try {
        const byFilter = $app.findFirstRecordByFilter(
            POCKET_USERS,
            "email = {:identity} || name = {:identity}",
            { identity: clean }
        );
        if (byFilter) return byFilter;
    } catch (_) {}

    try {
        const byUsername = $app.findFirstRecordByFilter(
            POCKET_USERS,
            "username = {:identity}",
            { identity: clean }
        );
        if (byUsername) return byUsername;
    } catch (_) {}

    return null;
}

/**
 * Authenticate a user in the `users` collection with identity (email/username) and password
 * @param {string} identity
 * @param {string} password
 * @returns {{ record: Record, token: string } | null}
 */
function authenticateUserWithPassword(identity, password) {
    if (!identity || !password) return null;
    const record = findUserByIdentity(identity);
    if (!record) return null;

    try {
        const isValid = record.validatePassword(String(password));
        if (!isValid) return null;
        const token = record.newAuthToken();
        if (!token) return null;
        return { record, token };
    } catch (_) {
        return null;
    }
}

/**
 * Resolve an authenticated user Record from a PocketBase JWT auth token
 * @param {string} token
 * @returns {Record|null}
 */
function getAuthRecordFromToken(token) {
    if (!token || typeof token !== 'string') return null;
    const cleanToken = token.trim();
    if (!cleanToken) return null;

    try {
        const record = $app.findAuthRecordByToken(cleanToken, "auth");
        if (record) return record;
    } catch (_) {
        try {
            const fallbackRecord = $app.findAuthRecordByToken(cleanToken);
            if (fallbackRecord) return fallbackRecord;
        } catch (_) {}
    }
    return null;
}

/**
 * Get configured OAuth2 providers for the `users` collection
 * @returns {Array<{ name: string, displayName: string }>}
 */
function getOAuthProviders() {
    try {
        const collection = $app.findCollectionByNameOrId(POCKET_USERS);
        if (!collection || !collection.oauth2 || !collection.oauth2.enabled) {
            return [];
        }
        const providers = collection.oauth2.providers || [];
        return providers.map((p) => ({
            name: p.name || '',
            displayName: p.displayName || p.name || 'OAuth'
        })).filter((p) => Boolean(p.name));
    } catch (_) {
        return [];
    }
}

/**
 * Request a password reset email for a user in the `users` collection
 * @param {string} email
 * @returns {boolean}
 */
function requestPasswordResetByEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const cleanEmail = email.trim();
    if (!cleanEmail) return false;

    try {
        const record = $app.findAuthRecordByEmail(POCKET_USERS, cleanEmail);
        if (record && typeof $mails !== 'undefined' && $mails.sendRecordPasswordReset) {
            $mails.sendRecordPasswordReset($app, record);
        }
        return true;
    } catch (_) {
        // Return true even if record is not found to avoid account enumeration
        return true;
    }
}

/**
 * Create a new user in the `users` collection and return the record and auth token
 * @param {{ email: string, password: string, name?: string }} params
 * @returns {{ ok: boolean, record?: Record, token?: string, error?: string }}
 */
function registerNewUser({ email, password, name }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(name || '').trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return { ok: false, error: 'Please enter a valid email address.' };
    }
    if (!password || String(password).length < 8) {
        return { ok: false, error: 'Password must be at least 8 characters long.' };
    }

    try {
        const existing = $app.findAuthRecordByEmail(POCKET_USERS, cleanEmail);
        if (existing) {
            return { ok: false, error: 'An account with this email already exists.' };
        }
    } catch (_) {}

    try {
        const collection = $app.findCollectionByNameOrId(POCKET_USERS);
        if (!collection) {
            return { ok: false, error: 'Users collection is not available.' };
        }

        const record = new Record(collection);
        record.set('email', cleanEmail);
        record.set('emailVisibility', false);
        if (cleanName) {
            record.set('name', cleanName);
        }
        record.setPassword(String(password));
        $app.save(record);

        const token = record.newAuthToken();
        return { ok: true, record, token };
    } catch (err) {
        const msg = err?.message ? String(err.message) : 'Unable to create account. Please check your details and try again.';
        return { ok: false, error: msg };
    }
}

/**
 * Get a single area record by OpenBeta UUID or PocketBase ID
 * @param {string} uuidOrId
 * @returns {Record|null}
 */
function getAreaByUuid(uuidOrId) {
    if (!uuidOrId) return null;
    try {
        return $app.findFirstRecordByFilter(
            POCKET_AREAS,
            "(openbetaUuid = {:uuidOrId} || id = {:uuidOrId}) && isDeleted = false",
            { uuidOrId }
        );
    } catch (_) {
        return null;
    }
}

/**
 * Get areas by name prefix (used for slug fallback lookup)
 * @param {string} namePrefix
 * @returns {Array<Record>}
 */
function getAreasByNamePrefix(namePrefix) {
    if (!namePrefix) return [];
    try {
        return $app.findRecordsByFilter(
            POCKET_AREAS,
            "name ~ {:namePrefix} && isDeleted = false",
            "-totalClimbs,name",
            0,
            0,
            { namePrefix }
        ) || [];
    } catch (_) {
        return [];
    }
}

/**
 * Look up a map of OpenBeta UUID -> Area Record for a list of UUIDs
 * @param {Array<string>} uuids
 * @returns {Object<string, Record>}
 */
function getAreasMapByUuids(uuids = []) {
    const map = {};
    if (!Array.isArray(uuids) || uuids.length === 0) return map;
    for (let i = 0; i < uuids.length; i++) {
        const u = uuids[i];
        if (!u || map[u]) continue;
        const rec = getAreaByUuid(u);
        if (rec) {
            map[u] = rec;
        }
    }
    return map;
}

/**
 * Get a paginated list of areas
 * @param {number} page
 * @param {number} perPage
 * @param {string} query
 * @param {string} parentId
 * @returns {object}
 */
function getAreas(page = 1, perPage = 20, query = "", parentId = "") {
    const offset = (page - 1) * perPage;
    let filter = "isDeleted = false";
    const filterParams = {};

    if (query) {
        filter += " && (name ~ {:query} || description ~ {:query} || areaLocation ~ {:query} || shortCode ~ {:query})";
        filterParams.query = query;
    }
    if (parentId) {
        filter += " && (parent = {:parentId} || parentUuid = {:parentId})";
        filterParams.parentId = parentId;
    }

    const records = $app.findRecordsByFilter(
        POCKET_AREAS,
        filter,
        "leftRightIndex,name",
        perPage,
        offset,
        filterParams
    );

    const countResult = arrayOf(new DynamicModel({ total: 0 }));
    let queryBuilder = $app.db()
        .select("COUNT(*) as total")
        .from(POCKET_AREAS)
        .where($dbx.exp("isDeleted = 0"));

    if (query) {
        queryBuilder.andWhere(
            $dbx.exp(
                "(name LIKE {:query} OR description LIKE {:query} OR areaLocation LIKE {:query} OR shortCode LIKE {:query})",
                { query: `%${query}%` }
            )
        );
    }
    if (parentId) {
        queryBuilder.andWhere(
            $dbx.exp("(parent = {:parentId} OR parentUuid = {:parentId})", { parentId })
        );
    }

    queryBuilder.all(countResult);
    const totalItems = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / perPage);

    return {
        items: records || [],
        totalItems,
        totalPages,
        page
    };
}

/**
 * Get a single climb record by OpenBeta UUID or PocketBase ID
 * @param {string} uuidOrId
 * @returns {Record|null}
 */
function getClimbByUuid(uuidOrId) {
    if (!uuidOrId) return null;
    try {
        return $app.findFirstRecordByFilter(
            POCKET_CLIMBS,
            "(openbetaUuid = {:uuidOrId} || id = {:uuidOrId}) && isDeleted = false",
            { uuidOrId }
        );
    } catch (_) {
        return null;
    }
}

/**
 * Get a paginated list of climbs
 * @param {number} page
 * @param {number} perPage
 * @param {string} query
 * @param {object} options - Optional { areaId, discipline, grade }
 * @returns {object}
 */
function getClimbs(page = 1, perPage = 20, query = "", options = {}) {
    const offset = (page - 1) * perPage;
    let filter = "isDeleted = false";
    const filterParams = {};
    const { areaId, discipline, grade } = options || {};

    if (query) {
        filter += " && (name ~ {:query} || description ~ {:query} || location ~ {:query} || fa ~ {:query} || gradeYds ~ {:query} || gradeVscale ~ {:query})";
        filterParams.query = query;
    }
    if (areaId) {
        filter += " && (area = {:areaId} || areaUuid = {:areaId})";
        filterParams.areaId = areaId;
    }
    if (discipline) {
        filter += " && disciplines ~ {:discipline}";
        filterParams.discipline = discipline;
    }
    if (grade) {
        filter += " && (gradeYds = {:grade} || gradeVscale = {:grade} || gradeFont = {:grade} || gradeFrench = {:grade})";
        filterParams.grade = grade;
    }

    const records = $app.findRecordsByFilter(
        POCKET_CLIMBS,
        filter,
        "leftRightIndex,name",
        perPage,
        offset,
        filterParams
    );

    const countResult = arrayOf(new DynamicModel({ total: 0 }));
    let queryBuilder = $app.db()
        .select("COUNT(*) as total")
        .from(POCKET_CLIMBS)
        .where($dbx.exp("isDeleted = 0"));

    if (query) {
        queryBuilder.andWhere(
            $dbx.exp(
                "(name LIKE {:query} OR description LIKE {:query} OR location LIKE {:query} OR fa LIKE {:query} OR gradeYds LIKE {:query} OR gradeVscale LIKE {:query})",
                { query: `%${query}%` }
            )
        );
    }
    if (areaId) {
        queryBuilder.andWhere(
            $dbx.exp("(area = {:areaId} OR areaUuid = {:areaId})", { areaId })
        );
    }
    if (discipline) {
        queryBuilder.andWhere(
            $dbx.exp("disciplines LIKE {:discipline}", { discipline: `%${discipline}%` })
        );
    }
    if (grade) {
        queryBuilder.andWhere(
            $dbx.exp("(gradeYds = {:grade} OR gradeVscale = {:grade} OR gradeFont = {:grade} OR gradeFrench = {:grade})", { grade })
        );
    }

    queryBuilder.all(countResult);
    const totalItems = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / perPage);

    return {
        items: records || [],
        totalItems,
        totalPages,
        page
    };
}

/**
 * Get pitches for a climb ordered by pitchNumber
 * @param {string} climbIdOrUuid
 * @returns {Array<Record>}
 */
function getPitchesByClimbId(climbIdOrUuid) {
    if (!climbIdOrUuid) return [];
    return $app.findRecordsByFilter(
        POCKET_PITCHES,
        "(climb = {:climbIdOrUuid} || parentUuid = {:climbIdOrUuid}) && isDeleted = false",
        "pitchNumber",
        0,
        0,
        { climbIdOrUuid }
    ) || [];
}

/**
 * Get ticks for a climb ordered by dateClimbed descending
 * @param {string} climbIdOrUuid
 * @returns {Array<Record>}
 */
function getTicksByClimbId(climbIdOrUuid) {
    if (!climbIdOrUuid) return [];
    return $app.findRecordsByFilter(
        POCKET_TICKS,
        "(climb = {:climbIdOrUuid} || climbUuid = {:climbIdOrUuid}) && isDeleted = false",
        "-dateClimbed,-created",
        0,
        0,
        { climbIdOrUuid }
    ) || [];
}

/**
 * Get climbing organizations
 * @param {string} areaId - Optional PocketBase area ID
 * @returns {Array<Record>}
 */
function getOrganizations(areaId = "") {
    let filter = "isDeleted = false";
    const filterParams = {};
    if (areaId) {
        filter += " && areas ~ {:areaId}";
        filterParams.areaId = areaId;
    }
    return $app.findRecordsByFilter(
        POCKET_ORGANIZATIONS,
        filter,
        "displayName",
        0,
        0,
        filterParams
    ) || [];
}

/**
 * Get media associated with a climb or area
 * @param {{ climbId?: string, areaId?: string }} params
 * @returns {Array<Record>}
 */
function getClimbMedia({ climbId = "", areaId = "" } = {}) {
    let filter = "isDeleted = false";
    const filterParams = {};
    if (climbId) {
        filter += " && climb = {:climbId}";
        filterParams.climbId = climbId;
    }
    if (areaId) {
        filter += " && area = {:areaId}";
        filterParams.areaId = areaId;
    }
    return $app.findRecordsByFilter(
        POCKET_CLIMB_MEDIA,
        filter,
        "-uploadTime,-created",
        0,
        0,
        filterParams
    ) || [];
}

/**
 * Get homepage/site configuration records from `admin_settings` collection in PocketBase
 * @returns {Object<string, string>}
 */
function getHomepageSettingsMap() {
    const map = {};
    try {
        const records = $app.findRecordsByFilter(
            POCKET_COLLECTION_ADMIN_SETTINGS,
            "category = 'HOMEPAGE'",
            "key",
            0,
            0
        ) || [];
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const k = r.getString("key");
            if (k) {
                map[k] = r.getString("value");
            }
        }
    } catch (_) {}
    return map;
}

/**
 * Get all non-deleted areas sorted by leftRightIndex and name
 * @returns {Array<Record>}
 */
function getAllActiveAreas() {
    try {
        return $app.findRecordsByFilter(
            POCKET_AREAS,
            "isDeleted = false",
            "leftRightIndex,name",
            0,
            0
        ) || [];
    } catch (_) {
        return [];
    }
}

/**
 * Get homepage directory areas (root countries, direct children of countries/US states, and destination areas) from PocketBase
 * @returns {Array<Record>}
 */
function getHomepageDirectoryAreas() {
    try {
        const roots = $app.findRecordsByFilter(
            POCKET_AREAS,
            "isDeleted = false && parentUuid = ''",
            "leftRightIndex,name",
            0,
            0
        ) || [];

        const rootUuids = roots
            .map((r) => r.getString("openbetaUuid"))
            .filter(Boolean);

        let filter = "isDeleted = false && (parentUuid = '' || isDestination = true";
        const filterParams = {};
        for (let i = 0; i < rootUuids.length; i++) {
            const paramKey = `rootUuid${i}`;
            filter += ` || parentUuid = {:${paramKey}}`;
            filterParams[paramKey] = rootUuids[i];
        }
        filter += ")";

        return $app.findRecordsByFilter(
            POCKET_AREAS,
            filter,
            "leftRightIndex,name",
            0,
            0,
            filterParams
        ) || [];
    } catch (_) {
        return [];
    }
}

/**
 * Query aggregate catalog counts directly from PocketBase SQLite tables (`isDeleted = 0`)
 * @param {string} [usaUuid]
 * @returns {{ totalCountries: number, totalStates: number, totalAreas: number, totalDestinations: number, totalClimbs: number, totalTicks: number, totalOrganizations: number }}
 */
function getDatabaseCatalogStats(usaUuid = "") {
    const queryCount = (table, whereClause = "isDeleted = 0", params = {}) => {
        try {
            const res = arrayOf(new DynamicModel({ total: 0 }));
            $app.db()
                .select("COUNT(*) as total")
                .from(table)
                .where($dbx.exp(whereClause, params))
                .all(res);
            return res[0]?.total || 0;
        } catch (_) {
            return 0;
        }
    };

    const totalCountries = queryCount(POCKET_AREAS, "isDeleted = 0 AND parentUuid = ''");
    const totalStates = usaUuid
        ? queryCount(POCKET_AREAS, "isDeleted = 0 AND parentUuid = {:usaUuid}", { usaUuid })
        : 0;
    const totalAreas = queryCount(POCKET_AREAS, "isDeleted = 0");
    const totalDestinations = queryCount(POCKET_AREAS, "isDeleted = 0 AND isDestination = 1");
    const totalClimbs = queryCount(POCKET_CLIMBS, "isDeleted = 0");
    const totalTicks = queryCount(POCKET_TICKS, "isDeleted = 0");
    const totalOrganizations = queryCount(POCKET_ORGANIZATIONS, "isDeleted = 0");

    return {
        totalCountries,
        totalStates,
        totalAreas,
        totalDestinations,
        totalClimbs,
        totalTicks,
        totalOrganizations
    };
}

/**
 * Upsert an OpenBeta Area object into the `areas` collection
 * @param {object} areaObj
 * @param {string} [overrideParentUuid]
 * @param {string} [parentRecordId]
 * @returns {Record|null}
 */
function upsertOpenBetaAreaRecord(areaObj, overrideParentUuid, parentRecordId, customApp = null) {
    if (!areaObj || !areaObj.uuid) return null;
    const app = customApp || $app;
    try {
        const collection = app.findCollectionByNameOrId(POCKET_AREAS);
        if (!collection) return null;

        let record = null;
        try {
            record = app.findFirstRecordByFilter(
                POCKET_AREAS,
                "openbetaUuid = {:uuid}",
                { uuid: areaObj.uuid }
            );
        } catch (_) {
            record = null;
        }

        const isNew = !record;
        if (isNew) {
            record = new Record(collection);
        }

        const ancestors = Array.isArray(areaObj.ancestors) ? areaObj.ancestors : [];
        const selfIdx = ancestors.indexOf(areaObj.uuid);
        const derivedParentUuid = selfIdx > 0
            ? ancestors[selfIdx - 1]
            : (ancestors.length >= 2 ? ancestors[ancestors.length - 2] : "");
        const finalParentUuid = derivedParentUuid
            || (typeof overrideParentUuid === "string" ? overrideParentUuid : "")
            || (isNew ? "" : record.getString("parentUuid"));

        let resolvedParentId = parentRecordId || "";
        if (finalParentUuid && (!resolvedParentId || (overrideParentUuid && finalParentUuid !== overrideParentUuid))) {
            try {
                const parentRec = app.findFirstRecordByFilter(
                    POCKET_AREAS,
                    "openbetaUuid = {:pUuid}",
                    { pUuid: finalParentUuid }
                );
                if (parentRec) {
                    resolvedParentId = parentRec.id;
                }
            } catch (_) {}
        }

        record.set("openbetaUuid", areaObj.uuid);
        record.set("openbetaId", String(areaObj.id || areaObj.metadata?.area_id || ""));
        record.set("mpId", String(areaObj.metadata?.mp_id || ""));
        record.set("name", String(areaObj.area_name || areaObj.areaName || "Unknown Area"));
        record.set("shortCode", String(areaObj.shortCode || record.getString("shortCode") || ""));
        if (finalParentUuid) {
            record.set("parentUuid", finalParentUuid);
        }
        if (resolvedParentId) {
            record.set("parent", resolvedParentId);
        }
        if (Array.isArray(areaObj.pathTokens)) {
            record.set("pathTokens", areaObj.pathTokens);
        }
        if (ancestors.length > 0) {
            record.set("ancestors", ancestors);
        }
        record.set("gradeContext", String(areaObj.gradeContext || "US"));
        if (typeof areaObj.metadata?.lat === "number" && typeof areaObj.metadata?.lng === "number") {
            record.set("coordinates", {
                lon: areaObj.metadata.lng,
                lat: areaObj.metadata.lat
            });
        }
        if (areaObj.metadata?.bbox) {
            record.set("bbox", areaObj.metadata.bbox);
        }
        if (typeof areaObj.metadata?.leftRightIndex === "number") {
            record.set("leftRightIndex", areaObj.metadata.leftRightIndex);
        }
        if (isNew) {
            record.set("isDestination", Boolean(areaObj.metadata?.isDestination));
        }
        record.set("isLeaf", Boolean(areaObj.metadata?.leaf));
        record.set("isBoulder", Boolean(areaObj.metadata?.isBoulder));
        if (typeof areaObj.totalClimbs === "number") {
            record.set("totalClimbs", areaObj.totalClimbs);
        }
        if (typeof areaObj.density === "number") {
            record.set("density", areaObj.density);
        }
        if (areaObj.content?.description) {
            record.set("description", String(areaObj.content.description));
        }
        if (areaObj.content?.areaLocation) {
            record.set("areaLocation", String(areaObj.content.areaLocation));
        }
        if (areaObj.content) {
            record.set("content", areaObj.content);
        }
        if (areaObj.metadata) {
            record.set("metadata", areaObj.metadata);
        }
        if (areaObj.aggregate) {
            record.set("aggregate", areaObj.aggregate);
        }
        if (areaObj.pathHash) {
            record.set("pathHash", String(areaObj.pathHash));
        }
        if (areaObj.polygon) {
            record.set("polygon", areaObj.polygon);
        }
        if (areaObj.authorMetadata) {
            record.set("authorMetadata", areaObj.authorMetadata);
            const createdBy = areaObj.authorMetadata.createdByUser?.displayName || areaObj.authorMetadata.createdByUser;
            const updatedBy = areaObj.authorMetadata.updatedByUser?.displayName || areaObj.authorMetadata.updatedByUser;
            if (createdBy) {
                record.set("createdByUser", String(createdBy));
            }
            if (updatedBy) {
                record.set("updatedByUser", String(updatedBy));
            }
        }
        record.set("isDeleted", false);

        app.save(record);
        return record;
    } catch (err) {
        $app.logger().error("Failed to upsert OpenBeta area record", "uuid", areaObj?.uuid, "error", err);
        return null;
    }
}

/**
 * Upsert an OpenBeta Climb object into the `climbs` collection
 * @param {object} climbObj
 * @param {string} areaUuid
 * @param {string} areaRecordId
 * @returns {Record|null}
 */
function upsertOpenBetaClimbRecord(climbObj, areaUuid, areaRecordId, parentAreaObj = null, customApp = null) {
    if (!climbObj || !climbObj.uuid) return null;
    const app = customApp || $app;
    try {
        const collection = app.findCollectionByNameOrId(POCKET_CLIMBS);
        if (!collection) return null;

        let record = null;
        try {
            record = app.findFirstRecordByFilter(
                POCKET_CLIMBS,
                "openbetaUuid = {:uuid}",
                { uuid: climbObj.uuid }
            );
        } catch (_) {
            record = null;
        }

        if (!record) {
            record = new Record(collection);
        }

        const typeObj = climbObj.type || {};
        const disciplineKeys = [
            "trad",
            "sport",
            "bouldering",
            "deepwatersolo",
            "alpine",
            "snow",
            "ice",
            "mixed",
            "aid",
            "tr"
        ];
        const activeDisciplines = disciplineKeys.filter((k) => Boolean(typeObj[k]));
        const pitchesArr = Array.isArray(climbObj.pitches) ? climbObj.pitches : [];

        record.set("openbetaUuid", climbObj.uuid);
        record.set("openbetaId", String(climbObj.id || climbObj.metadata?.climb_id || ""));
        record.set("mpId", String(climbObj.metadata?.mp_id || ""));
        record.set("name", String(climbObj.name || "Unnamed Climb"));
        if (areaRecordId) {
            record.set("area", areaRecordId);
        }
        if (areaUuid) {
            record.set("areaUuid", areaUuid);
        }
        record.set("fa", String(climbObj.fa || ""));
        if (typeof climbObj.length === "number") {
            record.set("length", climbObj.length);
        }
        if (typeof climbObj.boltsCount === "number") {
            record.set("boltsCount", climbObj.boltsCount);
        }
        record.set("pitchesCount", pitchesArr.length > 0 ? pitchesArr.length : 1);
        if (climbObj.safety) {
            record.set("safety", String(climbObj.safety));
        }
        record.set("gradeContext", String(climbObj.gradeContext || "US"));
        record.set("gradeYds", String(climbObj.grades?.yds || ""));
        record.set("gradeVscale", String(climbObj.grades?.vscale || ""));
        record.set("gradeFont", String(climbObj.grades?.font || ""));
        record.set("gradeFrench", String(climbObj.grades?.french || ""));
        record.set("gradeEwbank", String(climbObj.grades?.ewbank || ""));
        record.set("gradeBrazilianCrux", String(climbObj.grades?.brazilianCrux || ""));
        record.set("gradeUiaa", String(climbObj.grades?.uiaa || ""));
        record.set("gradeWi", String(climbObj.grades?.wi || ""));
        record.set("disciplines", activeDisciplines);
        record.set("isTrad", Boolean(typeObj.trad));
        record.set("isSport", Boolean(typeObj.sport));
        record.set("isBouldering", Boolean(typeObj.bouldering));
        record.set("isTr", Boolean(typeObj.tr));
        record.set("isAlpine", Boolean(typeObj.alpine));
        record.set("isIce", Boolean(typeObj.ice));
        record.set("isMixed", Boolean(typeObj.mixed));
        record.set("isAid", Boolean(typeObj.aid));
        record.set("isDeepwatersolo", Boolean(typeObj.deepwatersolo));
        record.set("isSnow", Boolean(typeObj.snow));
        if (typeof climbObj.metadata?.lat === "number" && typeof climbObj.metadata?.lng === "number") {
            record.set("coordinates", {
                lon: climbObj.metadata.lng,
                lat: climbObj.metadata.lat
            });
        }
        if (typeof climbObj.metadata?.leftRightIndex === "number") {
            record.set("leftRightIndex", climbObj.metadata.leftRightIndex);
        }
        record.set("description", String(climbObj.content?.description || ""));
        record.set("location", String(climbObj.content?.location || ""));
        record.set("protection", String(climbObj.content?.protection || ""));
        const finalPathTokens = Array.isArray(climbObj.pathTokens) && climbObj.pathTokens.length > 0
            ? climbObj.pathTokens
            : (Array.isArray(parentAreaObj?.pathTokens) ? parentAreaObj.pathTokens : []);
        const finalAncestors = Array.isArray(climbObj.ancestors) && climbObj.ancestors.length > 0
            ? climbObj.ancestors
            : (Array.isArray(parentAreaObj?.ancestors) ? parentAreaObj.ancestors : []);
        if (finalPathTokens.length > 0) {
            record.set("pathTokens", finalPathTokens);
        }
        if (finalAncestors.length > 0) {
            record.set("ancestors", finalAncestors);
        }
        if (climbObj.grades) {
            record.set("grades", climbObj.grades);
        }
        if (climbObj.type) {
            record.set("type", climbObj.type);
        }
        if (climbObj.content) {
            record.set("content", climbObj.content);
        }
        if (climbObj.metadata) {
            record.set("metadata", climbObj.metadata);
        }
        if (climbObj.authorMetadata) {
            record.set("authorMetadata", climbObj.authorMetadata);
            const createdBy = climbObj.authorMetadata.createdByUser?.displayName || climbObj.authorMetadata.createdByUser;
            const updatedBy = climbObj.authorMetadata.updatedByUser?.displayName || climbObj.authorMetadata.updatedByUser;
            if (createdBy) {
                record.set("createdByUser", String(createdBy));
            }
            if (updatedBy) {
                record.set("updatedByUser", String(updatedBy));
            }
        }
        record.set("isDeleted", false);

        app.save(record);

        // Upsert child pitches if provided
        if (pitchesArr.length > 0) {
            for (let pIdx = 0; pIdx < pitchesArr.length; pIdx++) {
                upsertOpenBetaPitchRecord(pitchesArr[pIdx], climbObj.uuid, record.id, pIdx + 1, app);
            }
        }

        // Upsert climb media if provided
        const mediaArr = Array.isArray(climbObj.media) ? climbObj.media : [];
        for (let mIdx = 0; mIdx < mediaArr.length; mIdx++) {
            upsertOpenBetaMediaRecord(mediaArr[mIdx], { areaId: areaRecordId, climbId: record.id }, app);
        }

        // Upsert climb ticks if provided
        const ticksArr = Array.isArray(climbObj.ticks) ? climbObj.ticks : [];
        for (let tIdx = 0; tIdx < ticksArr.length; tIdx++) {
            upsertOpenBetaTickRecord(ticksArr[tIdx], climbObj.uuid, record.id, climbObj.name, app);
        }

        return record;
    } catch (err) {
        $app.logger().error("Failed to upsert OpenBeta climb record", "uuid", climbObj?.uuid, "error", err);
        return null;
    }
}

/**
 * Upsert an OpenBeta Pitch object into the `pitches` collection
 */
function upsertOpenBetaPitchRecord(pitchObj, climbUuid, climbRecordId, defaultPitchNum = 1, customApp = null) {
    if (!pitchObj || !climbRecordId) return null;
    const app = customApp || $app;
    try {
        const collection = app.findCollectionByNameOrId(POCKET_PITCHES);
        if (!collection) return null;

        const pitchNum = typeof pitchObj.pitchNumber === "number" ? pitchObj.pitchNumber : defaultPitchNum;
        let record = null;
        try {
            record = app.findFirstRecordByFilter(
                POCKET_PITCHES,
                "climb = {:climbId} && pitchNumber = {:pitchNum}",
                { climbId: climbRecordId, pitchNum }
            );
        } catch (_) {
            record = null;
        }
        if (!record) {
            record = new Record(collection);
        }

        const pType = pitchObj.type || {};
        const disciplineKeys = ["trad", "sport", "bouldering", "deepwatersolo", "alpine", "snow", "ice", "mixed", "aid", "tr"];
        const pDiscs = disciplineKeys.filter((k) => Boolean(pType[k]));

        record.set("openbetaId", String(pitchObj.id || ""));
        record.set("climb", climbRecordId);
        record.set("parentUuid", String(pitchObj.parentId || climbUuid || ""));
        record.set("pitchNumber", pitchNum);
        if (typeof pitchObj.length === "number") {
            record.set("length", pitchObj.length);
        }
        if (typeof pitchObj.boltsCount === "number") {
            record.set("boltsCount", pitchObj.boltsCount);
        }
        record.set("description", String(pitchObj.description || ""));
        record.set("gradeYds", String(pitchObj.grades?.yds || ""));
        record.set("gradeVscale", String(pitchObj.grades?.vscale || ""));
        record.set("gradeFrench", String(pitchObj.grades?.french || ""));
        record.set("gradeFont", String(pitchObj.grades?.font || ""));
        record.set("gradeEwbank", String(pitchObj.grades?.ewbank || ""));
        record.set("gradeBrazilianCrux", String(pitchObj.grades?.brazilianCrux || ""));
        record.set("gradeUiaa", String(pitchObj.grades?.uiaa || ""));
        record.set("gradeWi", String(pitchObj.grades?.wi || ""));
        record.set("disciplines", pDiscs);
        if (pitchObj.grades) record.set("grades", pitchObj.grades);
        if (pitchObj.type) record.set("type", pitchObj.type);
        record.set("isDeleted", false);

        app.save(record);
        return record;
    } catch (_) {
        return null;
    }
}

/**
 * Upsert an OpenBeta Media object into the `climb_media` collection
 */
function upsertOpenBetaMediaRecord(mediaObj, { areaId = "", climbId = "" } = {}, customApp = null) {
    if (!mediaObj || !mediaObj.mediaUrl) return null;
    const app = customApp || $app;
    try {
        const collection = app.findCollectionByNameOrId(POCKET_CLIMB_MEDIA);
        if (!collection) return null;

        let record = null;
        try {
            record = app.findFirstRecordByFilter(
                POCKET_CLIMB_MEDIA,
                "mediaUrl = {:url}",
                { url: mediaObj.mediaUrl }
            );
        } catch (_) {
            record = null;
        }
        if (!record) {
            record = new Record(collection);
        }

        record.set("openbetaId", String(mediaObj.id || ""));
        record.set("mediaUrl", String(mediaObj.mediaUrl));
        if (areaId) record.set("area", areaId);
        if (climbId) record.set("climb", climbId);
        if (typeof mediaObj.width === "number") record.set("width", mediaObj.width);
        if (typeof mediaObj.height === "number") record.set("height", mediaObj.height);
        record.set("format", String(mediaObj.format || ""));
        if (typeof mediaObj.size === "number") record.set("size", mediaObj.size);
        const userObj = mediaObj.user || mediaObj.userProfile || {};
        record.set("username", String(mediaObj.username || userObj.username || userObj.displayName || ""));
        record.set("userUuid", String(mediaObj.userUuid || userObj.userUuid || ""));
        if (mediaObj.uploadTime) record.set("uploadTime", String(mediaObj.uploadTime));
        if (mediaObj.entityTags) record.set("entityTags", mediaObj.entityTags);
        if (mediaObj.userProfile || mediaObj.user) record.set("userProfile", mediaObj.userProfile || mediaObj.user);
        record.set("isDeleted", false);

        app.save(record);
        return record;
    } catch (_) {
        return null;
    }
}

/**
 * Upsert an OpenBeta Tick object into the `ticks` collection
 */
function upsertOpenBetaTickRecord(tickObj, climbUuid, climbRecordId, climbName = "", customApp = null) {
    if (!tickObj || !climbUuid) return null;
    const app = customApp || $app;
    try {
        const collection = app.findCollectionByNameOrId(POCKET_TICKS);
        if (!collection) return null;

        const openbetaId = String(tickObj._id || "");
        let record = null;
        if (openbetaId) {
            try {
                record = app.findFirstRecordByFilter(
                    POCKET_TICKS,
                    "openbetaId = {:obId}",
                    { obId: openbetaId }
                );
            } catch (_) {
                record = null;
            }
        }
        if (!record) {
            record = new Record(collection);
        }

        record.set("openbetaId", openbetaId);
        if (climbRecordId) record.set("climb", climbRecordId);
        record.set("climbUuid", climbUuid);
        record.set("name", String(tickObj.name || climbName || ""));
        record.set("openbetaUserId", String(tickObj.userId || ""));
        record.set("style", String(tickObj.style || ""));
        record.set("attemptType", String(tickObj.attemptType || ""));
        if (tickObj.dateClimbed) record.set("dateClimbed", String(tickObj.dateClimbed));
        record.set("grade", String(tickObj.grade || ""));
        record.set("notes", String(tickObj.notes || ""));
        record.set("source", String(tickObj.source || "OB"));
        if (tickObj.userProfile) record.set("userProfile", tickObj.userProfile);
        record.set("isDeleted", false);

        app.save(record);
        return record;
    } catch (_) {
        return null;
    }
}

/**
 * Get an area and its immediate sub-areas and climbs from PocketBase,
 * syncing from OpenBeta GraphQL API on-demand if children/climbs are not yet cached locally.
 * @param {string} idOrUuid
 * @returns {{ areaRecord: Record|null, childAreas: Array<Record>, climbs: Array<Record>, isDescendantClimbs: boolean }}
 */
function getOrSyncAreaDetail(idOrUuid) {
    if (!idOrUuid || typeof idOrUuid !== "string") {
        return { areaRecord: null, childAreas: [], climbs: [], isDescendantClimbs: false };
    }

    let areaRecord = getAreaByUuid(idOrUuid);
    const uuid = areaRecord ? (areaRecord.getString("openbetaUuid") || idOrUuid) : idOrUuid;
    const recId = areaRecord?.id || idOrUuid;

    let childAreas = $app.findRecordsByFilter(
        POCKET_AREAS,
        "(parentUuid = {:uuid} || parent = {:id}) && isDeleted = false",
        "leftRightIndex,name",
        0,
        0,
        { uuid, id: recId }
    ) || [];

    let climbs = $app.findRecordsByFilter(
        POCKET_CLIMBS,
        "(areaUuid = {:uuid} || area = {:id}) && isDeleted = false",
        "leftRightIndex,name",
        0,
        0,
        { uuid, id: recId }
    ) || [];

    const isUuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
    const needsSync = isUuidFormat && (
        !areaRecord || (
            childAreas.length === 0 &&
            climbs.length === 0
        )
    );

    if (needsSync && typeof $http !== "undefined") {
        try {
            const gqlQuery = `query GetArea($uuid: ID!) {
                area(uuid: $uuid) {
                    id
                    uuid
                    area_name
                    shortCode
                    totalClimbs
                    density
                    pathTokens
                    ancestors
                    gradeContext
                    content { description areaLocation }
                    metadata { isDestination leaf isBoulder lat lng bbox leftRightIndex mp_id area_id }
                    authorMetadata {
                        createdAt
                        createdBy
                        createdByUser
                        updatedAt
                        updatedBy
                        updatedByUser
                    }
                    children {
                        id
                        uuid
                        area_name
                        shortCode
                        totalClimbs
                        density
                        pathTokens
                        ancestors
                        gradeContext
                        content { description areaLocation }
                        metadata { isDestination leaf isBoulder lat lng bbox leftRightIndex mp_id area_id }
                    }
                    climbs {
                        id
                        uuid
                        name
                        fa
                        length
                        boltsCount
                        safety
                        gradeContext
                        grades { yds vscale font french ewbank brazilianCrux uiaa wi }
                        type { trad sport bouldering tr alpine ice mixed aid deepwatersolo snow }
                        metadata { lat lng leftRightIndex mp_id climb_id }
                        content { description location protection }
                        pathTokens
                        ancestors
                        authorMetadata {
                            createdAt
                            createdBy
                            createdByUser
                            updatedAt
                            updatedBy
                            updatedByUser
                        }
                        pitches {
                            id
                            parentId
                            pitchNumber
                            length
                            boltsCount
                            description
                            grades { yds vscale font french ewbank brazilianCrux uiaa wi }
                            type { trad sport bouldering tr alpine ice mixed aid deepwatersolo snow }
                        }
                        media {
                            id
                            mediaUrl
                            width
                            height
                            format
                            size
                            username
                            user { userUuid username displayName }
                            uploadTime
                        }
                        ticks {
                            _id
                            name
                            userId
                            style
                            attemptType
                            dateClimbed
                            grade
                            notes
                            source
                        }
                    }
                }
            }`;

            const res = $http.send({
                url: OPENBETA_API_ENDPOINT,
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: gqlQuery,
                    variables: { uuid }
                }),
                timeout: 15
            });

            if (res && res.statusCode >= 200 && res.statusCode < 300) {
                const payload = typeof res.json === "object" && res.json !== null
                    ? res.json
                    : JSON.parse(res.raw || "{}");
                const remoteArea = payload?.data?.area;
                if (remoteArea && remoteArea.uuid) {
                    areaRecord = upsertOpenBetaAreaRecord(remoteArea) || areaRecord;
                    const parentId = areaRecord?.id || "";

                    const remoteChildren = Array.isArray(remoteArea.children) ? remoteArea.children : [];
                    for (let i = 0; i < remoteChildren.length; i++) {
                        const ch = remoteChildren[i];
                        if (ch && ch.uuid && ch.area_name !== "Test Area 2014") {
                            upsertOpenBetaAreaRecord(ch, remoteArea.uuid, parentId);
                        }
                    }

                    const remoteClimbs = Array.isArray(remoteArea.climbs) ? remoteArea.climbs : [];
                    for (let i = 0; i < remoteClimbs.length; i++) {
                        const cl = remoteClimbs[i];
                        if (cl && cl.uuid) {
                            upsertOpenBetaClimbRecord(cl, remoteArea.uuid, parentId, remoteArea);
                        }
                    }

                    childAreas = $app.findRecordsByFilter(
                        POCKET_AREAS,
                        "(parentUuid = {:uuid} || parent = {:id}) && isDeleted = false",
                        "leftRightIndex,name",
                        0,
                        0,
                        { uuid, id: parentId }
                    ) || [];

                    climbs = $app.findRecordsByFilter(
                        POCKET_CLIMBS,
                        "(areaUuid = {:uuid} || area = {:id}) && isDeleted = false",
                        "leftRightIndex,name",
                        0,
                        0,
                        { uuid, id: parentId }
                    ) || [];
                }
            }
        } catch (err) {
            $app.logger().error("On-demand OpenBeta area sync failed", "uuid", uuid, "error", err);
        }
    }

    if (childAreas.length === 0 && isUuidFormat) {
        try {
            const descAreas = $app.findRecordsByFilter(
                POCKET_AREAS,
                "ancestors ~ {:uuid} && openbetaUuid != {:uuid} && isDeleted = false",
                "leftRightIndex,name",
                0,
                0,
                { uuid }
            ) || [];
            if (descAreas.length > 0) {
                const directDesc = [];
                for (let i = 0; i < descAreas.length; i++) {
                    const da = descAreas[i];
                    let anc = [];
                    try {
                        const rawAnc = da.getString("ancestors") || da.get("ancestors");
                        anc = Array.isArray(rawAnc)
                            ? rawAnc
                            : (typeof rawAnc === "string" && rawAnc.startsWith("[") ? JSON.parse(rawAnc) : []);
                    } catch (_) {}
                    const daUuid = da.getString("openbetaUuid");
                    const idx = anc.indexOf(daUuid);
                    if (idx > 0 && anc[idx - 1] === uuid) {
                        directDesc.push(da);
                    }
                }
                childAreas = directDesc.length > 0 ? directDesc : descAreas.slice(0, 24);
            }
        } catch (_) {}
    }

    let isDescendantClimbs = false;
    if (climbs.length === 0 && childAreas.length > 0) {
        try {
            const descClimbs = $app.findRecordsByFilter(
                POCKET_CLIMBS,
                "ancestors ~ {:uuid} && isDeleted = false",
                "leftRightIndex,name",
                60,
                0,
                { uuid }
            ) || [];
            if (descClimbs.length > 0) {
                climbs = descClimbs;
                isDescendantClimbs = true;
            }
        } catch (_) {}
    }

    return {
        areaRecord,
        childAreas,
        climbs,
        isDescendantClimbs
    };
}

let lastClimbsSyncStats = null;

function getLastClimbsSyncStats() {
    return lastClimbsSyncStats;
}

const OPENBETA_CLIMB_FIELDS_FRAGMENT = `
fragment ClimbFields on Climb {
    id
    uuid
    name
    fa
    length
    boltsCount
    safety
    gradeContext
    grades {
        yds
        vscale
        font
        french
        ewbank
        brazilianCrux
        uiaa
        wi
    }
    type {
        trad
        sport
        bouldering
        tr
        alpine
        ice
        mixed
        aid
        deepwatersolo
        snow
    }
    metadata {
        lat
        lng
        leftRightIndex
        mp_id
        climb_id
    }
    content {
        description
        location
        protection
    }
    pathTokens
    ancestors
    authorMetadata {
        createdAt
        createdBy
        createdByUser
        updatedAt
        updatedBy
        updatedByUser
    }
    pitches {
        id
        parentId
        pitchNumber
        length
        boltsCount
        description
        grades {
            yds
            vscale
            font
            french
            ewbank
            brazilianCrux
            uiaa
            wi
        }
        type {
            trad
            sport
            bouldering
            tr
            alpine
            ice
            mixed
            aid
            deepwatersolo
            snow
        }
    }
}
`;

function sendOpenBetaGraphQL(query, variables = {}, retries = 2) {
    let lastErr = null;
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
            const res = $http.send({
                url: OPENBETA_API_ENDPOINT,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "PocketClimb/1.0",
                },
                body: JSON.stringify({ query, variables }),
                timeout: 35,
            });

            if (res && res.statusCode >= 200 && res.statusCode < 300) {
                const payload = typeof res.json === "object" && res.json !== null
                    ? res.json
                    : JSON.parse(res.raw || "{}");
                if (payload.errors && !payload.data) {
                    throw new Error(payload.errors[0]?.message || "GraphQL error");
                }
                return payload.data;
            }
            throw new Error(`OpenBeta HTTP error ${res ? res.statusCode : "unknown"}`);
        } catch (err) {
            lastErr = err;
            if (attempt <= retries && typeof sleep === "function") {
                sleep(500 * attempt);
            }
        }
    }
    throw lastErr;
}

/**
 * Synchronize/update climbs from OpenBeta API (https://api.openbeta.io/)
 * with the fewest requests possible.
 *
 * Strategies:
 * 1. "areas" mode (default):
 *    Batches leaf area UUIDs present in our database into GraphQL aliased queries.
 *    By bundling 50-60 areas per single HTTP request, each request fetches ~500-1000 climbs,
 *    updating all 22,000+ climbs in only ~35-42 requests total!
 * 2. "catalog" mode:
 *    Paginates OpenBeta catalog using areas(filter: { leaf_status: { isLeaf: true } }, limit: $batchSize, offset: $offset).
 *    Fetches up to 100-200 leaf crags and ~1,000-1,600 climbs per request.
 * 3. Specific Area:
 *    If areaUuid is provided, fetches only that area and its climbs in 1 single request.
 *
 * @param {object} options
 * @param {string} [options.mode="areas"] - "areas" | "catalog"
 * @param {number} [options.batchSize=50] - Areas per GraphQL request
 * @param {number} [options.limit=0] - Max areas to process (0 = all)
 * @param {number} [options.offset=0] - Starting offset
 * @param {boolean} [options.all=false] - Whether to continue looping through all batches
 * @param {boolean} [options.dryRun=false] - Simulate without writing to DB
 * @param {string|string[]} [options.areaUuid] - Specific area UUID(s) to sync
 * @param {number} [options.timeoutSeconds=50] - Safety timeout in seconds (0 = disabled)
 * @returns {object} Sync result statistics
 */
function updateClimbsFromOpenBeta(options = {}) {
    const startTime = Date.now();
    const mode = (options.mode === "catalog") ? "catalog" : "areas";
    const dryRun = Boolean(options.dryRun);
    const timeoutSec = (typeof options.timeoutSeconds === "number") ? options.timeoutSeconds : 50;
    const maxDurationMs = timeoutSec > 0 ? timeoutSec * 1000 : 0;
    const runAll = Boolean(options.all) || (!options.limit && !options.offset);

    let totalTargetCount = 0;
    let areasProcessed = 0;
    let climbsUpdated = 0;
    let pitchesUpdated = 0;
    let requestsMade = 0;
    let failedBatches = [];
    let timedOut = false;

    if (mode === "areas") {
        let targetUuids = [];
        if (options.areaUuid) {
            targetUuids = Array.isArray(options.areaUuid)
                ? options.areaUuid
                : String(options.areaUuid).split(",").map((s) => s.trim()).filter(Boolean);
        } else {
            // Find all active leaf areas from PocketBase (enforcing isDeleted = false)
            const leafAreas = $app.findRecordsByFilter(
                POCKET_AREAS,
                "isDeleted = false && isLeaf = true",
                "name",
                0,
                0
            ) || [];
            targetUuids = leafAreas.map((r) => r.getString("openbetaUuid")).filter(Boolean);
        }

        totalTargetCount = targetUuids.length;
        const batchSize = Math.min(Math.max(parseInt(options.batchSize, 10) || 50, 1), 100);
        let currentOffset = Math.max(parseInt(options.offset, 10) || 0, 0);
        const maxLimit = (parseInt(options.limit, 10) > 0)
            ? parseInt(options.limit, 10)
            : (runAll ? totalTargetCount : batchSize);
        const limitOffset = Math.min(currentOffset + maxLimit, totalTargetCount);

        // Preload area records map for fast resolution
        const areaIdMap = {};
        try {
            const allDbAreas = $app.findRecordsByFilter(
                POCKET_AREAS,
                "isDeleted = false",
                "",
                0,
                0
            ) || [];
            for (let i = 0; i < allDbAreas.length; i++) {
                const u = allDbAreas[i].getString("openbetaUuid");
                if (u) {
                    areaIdMap[u] = allDbAreas[i].id;
                }
            }
        } catch (_) {}

        while (currentOffset < limitOffset) {
            if (maxDurationMs > 0 && (Date.now() - startTime) >= maxDurationMs) {
                timedOut = true;
                break;
            }

            const chunkUuids = targetUuids.slice(currentOffset, Math.min(currentOffset + batchSize, limitOffset));
            if (chunkUuids.length === 0) break;

            const aliases = chunkUuids.map((u, i) =>
                `a${i}: area(uuid: "${u}") { uuid area_name shortCode totalClimbs climbs { ...ClimbFields } }`
            ).join("\n");

            const gqlQuery = `${OPENBETA_CLIMB_FIELDS_FRAGMENT}\nquery {\n${aliases}\n}`;

            try {
                requestsMade++;
                const payloadData = sendOpenBetaGraphQL(gqlQuery) || {};

                const batchAreas = [];
                for (let i = 0; i < chunkUuids.length; i++) {
                    const areaData = payloadData[`a${i}`];
                    if (areaData && areaData.uuid) {
                        batchAreas.push(areaData);
                    }
                }

                let batchClimbsCount = 0;
                let batchPitchesCount = 0;

                for (let a = 0; a < batchAreas.length; a++) {
                    const cList = Array.isArray(batchAreas[a].climbs) ? batchAreas[a].climbs : [];
                    batchClimbsCount += cList.length;
                    for (let c = 0; c < cList.length; c++) {
                        const pList = Array.isArray(cList[c].pitches) ? cList[c].pitches : [];
                        batchPitchesCount += pList.length;
                    }
                }

                if (!dryRun) {
                    $app.runInTransaction((txApp) => {
                        for (let a = 0; a < batchAreas.length; a++) {
                            const areaData = batchAreas[a];
                            const areaUuid = areaData.uuid;
                            const areaRecordId = areaIdMap[areaUuid] || "";
                            const climbs = Array.isArray(areaData.climbs) ? areaData.climbs : [];
                            for (let c = 0; c < climbs.length; c++) {
                                upsertOpenBetaClimbRecord(climbs[c], areaUuid, areaRecordId, areaData, txApp);
                            }
                        }
                    });
                }

                areasProcessed += chunkUuids.length;
                climbsUpdated += batchClimbsCount;
                pitchesUpdated += batchPitchesCount;
                currentOffset += chunkUuids.length;

                $app.logger().info(
                    `[OpenBeta Climbs Sync] Batch complete: offset ${currentOffset}/${totalTargetCount}, ${batchClimbsCount} climbs processed (Requests: ${requestsMade})`
                );
            } catch (batchErr) {
                $app.logger().error("[OpenBeta Climbs Sync] Batch failed", "offset", currentOffset, "error", batchErr);
                failedBatches.push({ offset: currentOffset, count: chunkUuids.length, error: batchErr?.message || String(batchErr) });
                currentOffset += chunkUuids.length;
                areasProcessed += chunkUuids.length;
            }
        }

        const durationSeconds = Math.round((Date.now() - startTime) / 100) / 10;
        const hasMore = currentOffset < totalTargetCount;
        const resultStats = {
            status: timedOut ? "partial_success" : (failedBatches.length > 0 && areasProcessed === 0 ? "error" : "success"),
            message: timedOut
                ? `Processed ${areasProcessed} areas (${climbsUpdated} climbs updated across ${requestsMade} requests) before safety timeout. Call again with offset=${currentOffset} to continue.`
                : `Successfully updated climbs from OpenBeta with ${requestsMade} requests (${climbsUpdated} climbs updated across ${areasProcessed} areas).`,
            mode: "areas",
            dryRun,
            totalAreas: totalTargetCount,
            areasProcessed,
            climbsUpdated,
            pitchesUpdated,
            requestsMade,
            offset: parseInt(options.offset, 10) || 0,
            nextOffset: hasMore ? currentOffset : null,
            hasMore,
            failedBatches,
            durationSeconds,
            timestamp: new Date().toISOString(),
        };

        lastClimbsSyncStats = resultStats;
        return resultStats;
    } else {
        // "catalog" mode: paginate OpenBeta catalog
        const batchSize = Math.min(Math.max(parseInt(options.batchSize, 10) || 100, 1), 200);
        let currentOffset = Math.max(parseInt(options.offset, 10) || 0, 0);
        const maxLimit = parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : (runAll ? 100000 : batchSize);
        let remainingToProcess = maxLimit;

        const catalogQuery = `${OPENBETA_CLIMB_FIELDS_FRAGMENT}
query GetCatalogLeafAreas($limit: Int!, $offset: Int!) {
    areas(filter: { leaf_status: { isLeaf: true } }, limit: $limit, offset: $offset) {
        id
        uuid
        area_name
        shortCode
        totalClimbs
        density
        pathTokens
        ancestors
        pathHash
        gradeContext
        content { description areaLocation }
        metadata { isDestination leaf isBoulder lat lng bbox leftRightIndex mp_id area_id }
        authorMetadata { createdAt createdBy createdByUser updatedAt updatedBy updatedByUser }
        climbs {
            ...ClimbFields
        }
    }
}`;

        let hasMore = true;
        while (hasMore && remainingToProcess > 0) {
            if (maxDurationMs > 0 && (Date.now() - startTime) >= maxDurationMs) {
                timedOut = true;
                break;
            }

            const currentBatchLimit = Math.min(batchSize, remainingToProcess);
            try {
                requestsMade++;
                const payloadData = sendOpenBetaGraphQL(catalogQuery, {
                    limit: currentBatchLimit,
                    offset: currentOffset,
                });

                const returnedAreas = Array.isArray(payloadData?.areas) ? payloadData.areas : [];
                if (returnedAreas.length === 0) {
                    hasMore = false;
                    break;
                }

                let batchClimbsCount = 0;
                let batchPitchesCount = 0;

                for (let a = 0; a < returnedAreas.length; a++) {
                    const cList = Array.isArray(returnedAreas[a].climbs) ? returnedAreas[a].climbs : [];
                    batchClimbsCount += cList.length;
                    for (let c = 0; c < cList.length; c++) {
                        const pList = Array.isArray(cList[c].pitches) ? cList[c].pitches : [];
                        batchPitchesCount += pList.length;
                    }
                }

                if (!dryRun) {
                    $app.runInTransaction((txApp) => {
                        for (let a = 0; a < returnedAreas.length; a++) {
                            const areaObj = returnedAreas[a];
                            const areaRecord = upsertOpenBetaAreaRecord(areaObj, null, null, txApp);
                            const areaRecordId = areaRecord?.id || "";
                            const climbs = Array.isArray(areaObj.climbs) ? areaObj.climbs : [];
                            for (let c = 0; c < climbs.length; c++) {
                                upsertOpenBetaClimbRecord(climbs[c], areaObj.uuid, areaRecordId, areaObj, txApp);
                            }
                        }
                    });
                }

                areasProcessed += returnedAreas.length;
                climbsUpdated += batchClimbsCount;
                pitchesUpdated += batchPitchesCount;
                currentOffset += returnedAreas.length;
                remainingToProcess -= returnedAreas.length;

                $app.logger().info(
                    `[OpenBeta Catalog Climbs Sync] Batch complete: offset ${currentOffset}, ${batchClimbsCount} climbs processed (Requests: ${requestsMade})`
                );

                if (returnedAreas.length < currentBatchLimit) {
                    hasMore = false;
                }
            } catch (catErr) {
                $app.logger().error("[OpenBeta Catalog Climbs Sync] Batch failed", "offset", currentOffset, "error", catErr);
                failedBatches.push({ offset: currentOffset, error: catErr?.message || String(catErr) });
                hasMore = false;
            }
        }

        const durationSeconds = Math.round((Date.now() - startTime) / 100) / 10;
        const resultStats = {
            status: timedOut ? "partial_success" : (failedBatches.length > 0 && areasProcessed === 0 ? "error" : "success"),
            message: timedOut
                ? `Processed ${areasProcessed} areas (${climbsUpdated} climbs updated across ${requestsMade} requests) before safety timeout. Call again with offset=${currentOffset} to continue.`
                : `Successfully updated climbs from OpenBeta catalog with ${requestsMade} requests (${climbsUpdated} climbs updated across ${areasProcessed} areas).`,
            mode: "catalog",
            dryRun,
            areasProcessed,
            climbsUpdated,
            pitchesUpdated,
            requestsMade,
            offset: parseInt(options.offset, 10) || 0,
            nextOffset: hasMore ? currentOffset : null,
            hasMore,
            failedBatches,
            durationSeconds,
            timestamp: new Date().toISOString(),
        };

        lastClimbsSyncStats = resultStats;
        return resultStats;
    }
}




