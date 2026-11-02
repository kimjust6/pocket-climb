const {
    POCKET_BLOGPOSTS,
    POCKET_CLIMBING_POSTS,
    POCKET_AREAS,
    POCKET_CLIMBS,
    POCKET_PITCHES,
    POCKET_TICKS,
    POCKET_ORGANIZATIONS,
    POCKET_CLIMB_MEDIA,
    POCKET_USERS,
} = require('./constants')

/**
 * Get a single blog post by ID using server-side $app
 * @param {string} id - The blog post ID
 * @returns {Record} The blog post Record object (use .getString(), .get() to access fields)
 */
const getBlogPostById = (id) => {
    return $app.findFirstRecordByFilter(
        POCKET_BLOGPOSTS,
        "id = {:id} && isDeleted = false",
        { id }
    )
}

/**
 * Get a single climbing post by ID using server-side $app
 * @param {string} id - The climbing post ID
 * @returns {Record} The climbing post Record object
 */
const getClimbingPostById = (id) => {
    return $app.findFirstRecordByFilter(
        POCKET_CLIMBING_POSTS,
        "id = {:id} && isDeleted = false",
        { id }
    )
}

/**
 * Get blog posts by title prefix using server-side $app
 * @param {string} titlePrefix - The prefix of the title to search for
 * @returns {array} Array of blog post Record objects
 */
const getBlogPostsByTitlePrefix = (titlePrefix) => {
    return $app.findRecordsByFilter(
        POCKET_BLOGPOSTS,
        "title ~ {:titlePrefix} && isDeleted = false",
        "-manualPublishDate,-updated",
        0, // no limit
        0,
        { titlePrefix }
    ) || []
}

/**
 * Get a paginated list of blog posts using server-side $app
 * @param {number} page - Page number (1-indexed)
 * @param {number} perPage - Items per page
 * @param {string} query - Optional search query
 * @returns {object} Object with items array (Record objects) and pagination info
 */
const getBlogPosts = (page, perPage, query) => {
    const offset = (page - 1) * perPage
    let filter = "isDeleted = false"
    let filterParams = {}

    if (query) {
        filter = "isDeleted = false && (title ~ {:query} || tags ~ {:query} || content1 ~ {:query} || content2 ~ {:query})"
        filterParams = { query }
    }

    const records = $app.findRecordsByFilter(
        POCKET_BLOGPOSTS,
        filter,
        "-manualPublishDate,-created",
        perPage,
        offset,
        filterParams
    )

    // Get total count for pagination using efficient DB query
    const countResult = arrayOf(new DynamicModel({
        "total": 0
    }))

    let queryBuilder = $app.db()
        .select("COUNT(*) as total")
        .from("blog_posts")
        .where($dbx.exp("isDeleted = 0"))

    if (query) {
        queryBuilder.andWhere(
            $dbx.exp(
                "(title LIKE {:query} OR tags LIKE {:query} OR content1 LIKE {:query} OR content2 LIKE {:query})",
                { query: `%${query}%` }
            )
        )
    }

    queryBuilder.all(countResult)
    const totalItems = countResult[0]?.total || 0
    const totalPages = Math.ceil(totalItems / perPage)

    return {
        items: records || [],
        totalItems,
        totalPages,
        page
    }
}

/**
 * Get all blog posts (for sitemap/RSS) using server-side $app
 * @param {string} sort - Sort order (e.g., "-updated", "-created")
 * @returns {array} Array of blog post Record objects
 */
const getAllBlogPosts = (sort = "-updated") => {
    return $app.findRecordsByFilter(
        POCKET_BLOGPOSTS,
        "isDeleted = false",
        sort,
        0, // no limit (returns all)
        0
    ) || []
}

/**
 * Helper to determine if a record object is from climbing_posts
 * @param {Record} record 
 * @returns {boolean}
 */
function isClimbingRecord(record) {
    if (!record) return false;
    if (record.collectionName === 'climbing_posts' || record.collection?.name === 'climbing_posts') return true;
    if (typeof record.getString === 'function' && !!record.getString('climbType')) return true;
    return false;
}

/**
 * Get combined blog posts and climbing logs sorted chronologically for the homepage
 * @param {number} page 
 * @param {number} perPage 
 * @param {string} query 
 * @returns {object} Object with items array and pagination metadata
 */
function getCombinedHomepagePosts(page = 1, perPage = 6, query = '') {
    const devPostsResult = getBlogPosts(1, 100, query);
    const climbingPostsResult = getClimbingLogs(1, 100, query);

    const allItems = [...(devPostsResult?.items || []), ...(climbingPostsResult?.items || [])];

    allItems.sort((a, b) => {
        const aIsClimb = isClimbingRecord(a);
        const bIsClimb = isClimbingRecord(b);
        const aDate = new Date(aIsClimb ? (a.getString('date') || a.getString('created')) : (a.getString('manualPublishDate') || a.getString('created')));
        const bDate = new Date(bIsClimb ? (b.getString('date') || b.getString('created')) : (b.getString('manualPublishDate') || b.getString('created')));
        return bDate - aDate;
    });

    const totalItems = allItems.length;
    let offset = 0;
    let limit = perPage;

    if (page === 1) {
        offset = 0;
        limit = 7; // 1 featured/hero post + 6 grid posts
    } else {
        offset = 7 + (page - 2) * perPage;
        limit = perPage;
    }

    const items = allItems.slice(offset, offset + limit);
    const totalPages = totalItems <= 7 ? 1 : (1 + Math.ceil((totalItems - 7) / perPage));

    return {
        items,
        totalItems,
        totalPages,
        page
    };
}

module.exports = {
    getBlogPostById,
    getClimbingPostById,
    getBlogPostsByTitlePrefix,
    getBlogPosts,
    getAllBlogPosts,
    POCKET_BLOGPOSTS,
    getClimbingLogs,
    getClimbingLogsByTitlePrefix,
    getAllClimbingLogs,
    POCKET_CLIMBING_POSTS,
    POCKET_AREAS,
    POCKET_CLIMBS,
    POCKET_PITCHES,
    POCKET_TICKS,
    POCKET_ORGANIZATIONS,
    POCKET_CLIMB_MEDIA,
    POCKET_USERS,
    isClimbingRecord,
    getCombinedHomepagePosts,
    findUserByIdentity,
    authenticateUserWithPassword,
    getAuthRecordFromToken,
    getOAuthProviders,
    requestPasswordResetByEmail,
    registerNewUser,
    getAreaByUuid,
    getAreas,
    getClimbByUuid,
    getClimbs,
    getPitchesByClimbId,
    getTicksByClimbId,
    getOrganizations,
    getClimbMedia
}


/**
 * Get a paginated list of climbing logs using server-side $app
 * @param {number} page - Page number (1-indexed)
 * @param {number} perPage - Items per page
 * @param {string} query - Optional search query
 * @param {string} climbType - Optional climb type filter
 * @returns {object} Object with items array (Record objects) and pagination info
 */
function getClimbingLogs(page, perPage, query, climbType) {
    const offset = (page - 1) * perPage
    let filter = "isDeleted = false"
    let filterParams = {}

    if (query) {
        filter += " && (title ~ {:query} || location ~ {:query} || content ~ {:query} || climbType ~ {:query} || grade ~ {:query} || style ~ {:query})"
        filterParams.query = query
    }
    if (climbType) {
        filter += " && climbType = {:climbType}"
        filterParams.climbType = climbType
    }

    const records = $app.findRecordsByFilter(
        POCKET_CLIMBING_POSTS,
        filter,
        "-date,-created",
        perPage,
        offset,
        filterParams
    )

    // Get total count for pagination using efficient DB query
    const countResult = arrayOf(new DynamicModel({
        "total": 0
    }))

    let queryBuilder = $app.db()
        .select("COUNT(*) as total")
        .from("climbing_posts")
        .where($dbx.exp("isDeleted = 0"))

    if (query) {
        queryBuilder.andWhere(
            $dbx.exp(
                "(title LIKE {:query} OR location LIKE {:query} OR content LIKE {:query} OR climbType LIKE {:query} OR grade LIKE {:query} OR style LIKE {:query})",
                { query: `%${query}%` }
            )
        )
    }
    if (climbType) {
        queryBuilder.andWhere(
            $dbx.exp("climbType = {:climbType}", { climbType })
        )
    }

    queryBuilder.all(countResult)
    const totalItems = countResult[0]?.total || 0
    const totalPages = Math.ceil(totalItems / perPage)

    return {
        items: records || [],
        totalItems,
        totalPages,
        page
    }
}

/**
 * Get climbing logs by title prefix using server-side $app (for slugs)
 * @param {string} titlePrefix - The prefix of the title to search for
 * @returns {array} Array of climbing log Record objects
 */
function getClimbingLogsByTitlePrefix(titlePrefix) {
    return $app.findRecordsByFilter(
        POCKET_CLIMBING_POSTS,
        "title ~ {:titlePrefix} && isDeleted = false",
        "-date,-created",
        0, // no limit
        0,
        { titlePrefix }
    ) || []
}

/**
 * Get all climbing logs using server-side $app
 * @param {string} sort - Sort order (e.g., "-date", "-created")
 * @returns {array} Array of climbing log Record objects
 */
function getAllClimbingLogs(sort = "-date") {
    return $app.findRecordsByFilter(
        POCKET_CLIMBING_POSTS,
        "isDeleted = false",
        sort,
        0, // no limit (returns all)
        0
    ) || []
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



