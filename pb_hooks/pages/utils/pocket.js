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
    OPENBETA_API_ENDPOINT,
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
    getAllActiveAreas,
    ensureOpenBetaDirectorySeeded,
    getClimbByUuid,
    getClimbs,
    getPitchesByClimbId,
    getTicksByClimbId,
    getOrganizations,
    getClimbMedia,
    getOrSyncAreaDetail
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

const FEATURED_DESTINATION_SEEDS = [
    // Canada
    { uuid: "a354b580-870b-5444-9f11-2c0e78995841", name: "Squamish", parentUuid: "2996145f-e1ba-5b56-9da8-30c64ccc3776", totalClimbs: 673, pathTokens: ["Canada", "British Columbia", "Squamish"] },
    { uuid: "4624f40a-b644-5256-9287-aa19002ce00f", name: "Powell River", parentUuid: "2996145f-e1ba-5b56-9da8-30c64ccc3776", totalClimbs: 325, pathTokens: ["Canada", "British Columbia", "Powell River"] },
    { uuid: "a33bf360-9bf1-5d0f-b082-9ef3a51aa231", name: "Skaha", parentUuid: "2996145f-e1ba-5b56-9da8-30c64ccc3776", totalClimbs: 112, pathTokens: ["Canada", "British Columbia", "Skaha"] },
    { uuid: "26913742-ffc5-5c8f-834b-7f0cd1b58d81", name: "The Bugaboos", parentUuid: "2996145f-e1ba-5b56-9da8-30c64ccc3776", totalClimbs: 54, pathTokens: ["Canada", "British Columbia", "The Bugaboos"] },
    { uuid: "fa6ebe07-759f-5a35-b715-c39bbb8424d2", name: "Lake Louise", parentUuid: "2996145f-e1ba-5b56-9da8-30c64ccc3776", totalClimbs: 128, pathTokens: ["Canada", "Alberta", "Lake Louise"] },
    // Germany
    { uuid: "f67770f6-9aba-52da-a597-c8738ffa56e4", name: "Plankenstein", parentUuid: "be9733db-21a2-53ec-86a2-3fb6fab552d9", totalClimbs: 21, pathTokens: ["Germany", "Bavaria", "Plankenstein"] },
    // South Africa
    { uuid: "4ed6c976-ee02-564a-801e-20ccc10e6e26", name: "Rocklands", parentUuid: "1d33c773-e381-5b8a-a13f-3dfd7991732b", totalClimbs: 3260, pathTokens: ["South Africa", "Western Cape", "Rocklands"] },
    // Arizona
    { uuid: "f2591e24-8f94-5cb3-9f02-92bfe3f5cd61", name: "Mount Lemmon (Santa Catalina Mountains)", parentUuid: "24e148bb-4884-59e8-9870-43ce21f1a337", totalClimbs: 3015, pathTokens: ["USA", "Arizona", "Mount Lemmon (Santa Catalina Mountains)"] },
    { uuid: "74a365ae-142f-5b24-8198-2ac56dfd2922", name: "Mount Lemmon (Catalina Highway)", parentUuid: "24e148bb-4884-59e8-9870-43ce21f1a337", totalClimbs: 1580, pathTokens: ["USA", "Arizona", "Mount Lemmon (Catalina Highway)"] },
    { uuid: "acd5e4e7-2972-5435-a237-4cea3dffe6cb", name: "Queen Creek Canyon", parentUuid: "24e148bb-4884-59e8-9870-43ce21f1a337", totalClimbs: 785, pathTokens: ["USA", "Arizona", "Queen Creek Canyon"] },
    // California
    { uuid: "58a4c1de-fc5b-5e0c-89ad-ab28ac59e4fe", name: "Bishop Area", parentUuid: "1e18b6dd-d8b1-5c36-b555-175190184622", totalClimbs: 2969, pathTokens: ["USA", "California", "Sierra Eastside", "Bishop Area"] },
    { uuid: "5af729d8-71a6-5bc2-a925-0f9adf369f4e", name: "Central Joshua Tree", parentUuid: "1e18b6dd-d8b1-5c36-b555-175190184622", totalClimbs: 4120, pathTokens: ["USA", "California", "Joshua Tree National Park", "Central Joshua Tree"] },
    { uuid: "6e4088c3-20f4-5e36-a319-c539b3b72275", name: "Big Bear Lake Area", parentUuid: "1e18b6dd-d8b1-5c36-b555-175190184622", totalClimbs: 480, pathTokens: ["USA", "California", "Big Bear Lake Area"] },
    { uuid: "0dde3658-d0f7-5305-8f32-e15b35086518", name: "Owens River Gorge", parentUuid: "1e18b6dd-d8b1-5c36-b555-175190184622", totalClimbs: 765, pathTokens: ["USA", "California", "Sierra Eastside", "Owens River Gorge"] },
    { uuid: "bbf60ea4-d8bb-5949-a144-061868db1e5e", name: "Hidden Valley Area", parentUuid: "1e18b6dd-d8b1-5c36-b555-175190184622", totalClimbs: 1210, pathTokens: ["USA", "California", "Joshua Tree National Park", "Hidden Valley Area"] },
    { uuid: "ce6ec458-d8d0-5439-aa24-025a8a8ec2e4", name: "Tuolumne Meadows", parentUuid: "1e18b6dd-d8b1-5c36-b555-175190184622", totalClimbs: 1390, pathTokens: ["USA", "California", "Yosemite National Park", "Tuolumne Meadows"] },
    // Colorado
    { uuid: "decc1251-4a67-52b9-b23f-3243e10e93d0", name: "Boulder", parentUuid: "ab48aed5-2e8d-54bb-b099-6140fe1f098f", totalClimbs: 6540, pathTokens: ["USA", "Colorado", "Boulder"] },
    { uuid: "4246501c-a558-5494-8fdc-ef635bbb8bbb", name: "Unaweep Canyon", parentUuid: "ab48aed5-2e8d-54bb-b099-6140fe1f098f", totalClimbs: 620, pathTokens: ["USA", "Colorado", "Unaweep Canyon"] },
    { uuid: "b9b123a7-fbea-5dff-81ca-bb33975aa143", name: "Nine Mile Hill", parentUuid: "ab48aed5-2e8d-54bb-b099-6140fe1f098f", totalClimbs: 215, pathTokens: ["USA", "Colorado", "Nine Mile Hill"] },
    { uuid: "f4c2e930-325e-56ce-850c-ca86bed85c98", name: "Nine Mile Bouldering", parentUuid: "ab48aed5-2e8d-54bb-b099-6140fe1f098f", totalClimbs: 185, pathTokens: ["USA", "Colorado", "Nine Mile Bouldering"] },
    { uuid: "b34b81ad-639b-5002-8b62-fcc081599499", name: "Golden", parentUuid: "ab48aed5-2e8d-54bb-b099-6140fe1f098f", totalClimbs: 2940, pathTokens: ["USA", "Colorado", "Golden"] },
    { uuid: "e519a674-a620-509c-9e86-a246f84a8e40", name: "Boulder Canyon", parentUuid: "ab48aed5-2e8d-54bb-b099-6140fe1f098f", totalClimbs: 2890, pathTokens: ["USA", "Colorado", "Boulder", "Boulder Canyon"] },
    { uuid: "47053277-7738-5e02-b3b0-a0fc26a64b07", name: "Canon City", parentUuid: "ab48aed5-2e8d-54bb-b099-6140fe1f098f", totalClimbs: 1540, pathTokens: ["USA", "Colorado", "Canon City"] },
    { uuid: "d0ca78b6-a3cb-517c-adee-d9c6f8c2d2d8", name: "Flatirons", parentUuid: "ab48aed5-2e8d-54bb-b099-6140fe1f098f", totalClimbs: 1870, pathTokens: ["USA", "Colorado", "Boulder", "Flatirons"] },
    { uuid: "8af5df63-9dd1-5fb2-9ef1-c3c3860494f5", name: "Clear Creek Canyon", parentUuid: "ab48aed5-2e8d-54bb-b099-6140fe1f098f", totalClimbs: 1980, pathTokens: ["USA", "Colorado", "Golden", "Clear Creek Canyon"] },
    { uuid: "7fea44a6-af9d-583e-9abc-274876289cd7", name: "Eldorado Canyon State Park", parentUuid: "ab48aed5-2e8d-54bb-b099-6140fe1f098f", totalClimbs: 1120, pathTokens: ["USA", "Colorado", "Boulder", "Eldorado Canyon State Park"] },
    { uuid: "198facc2-f25b-5ee9-a386-df4e3c4c5ee2", name: "Shelf Road", parentUuid: "ab48aed5-2e8d-54bb-b099-6140fe1f098f", totalClimbs: 1260, pathTokens: ["USA", "Colorado", "Canon City", "Shelf Road"] },
    { uuid: "f27f00b7-1968-5942-bffb-931b2cd00345", name: "Poudre Canyon", parentUuid: "ab48aed5-2e8d-54bb-b099-6140fe1f098f", totalClimbs: 890, pathTokens: ["USA", "Colorado", "Poudre Canyon"] },
    // Kentucky
    { uuid: "78da26bc-cd94-5ac8-8e1c-815f7f30a28b", name: "Red River Gorge", parentUuid: "8677a1b5-08b9-5ce8-b15f-0653205bbc48", totalClimbs: 2680, pathTokens: ["USA", "Kentucky", "Red River Gorge"] },
    // Massachusetts
    { uuid: "2a40e704-cca6-5cd0-8b7d-404654e65186", name: "Lynn Woods", parentUuid: "e5b1ee9c-9c10-5a01-91e0-850f40c2e1be", totalClimbs: 1120, pathTokens: ["USA", "Massachusetts", "Lynn Woods"] },
    // Nevada
    { uuid: "bea6bf11-de53-5046-a5b4-b89217b7e9bc", name: "Red Rocks", parentUuid: "a31fb323-0db7-5e02-b522-f21d3b49b531", totalClimbs: 3420, pathTokens: ["USA", "Nevada", "Red Rocks"] },
    // New Hampshire
    { uuid: "fdf16fa4-e20a-5cda-8c1b-dad225df6dce", name: "Rumney", parentUuid: "8a63706f-b14c-536f-b8ab-3cea90093e36", totalClimbs: 1180, pathTokens: ["USA", "New Hampshire", "Rumney"] },
    { uuid: "f472e63d-9089-5206-ab16-8385450ac7a4", name: "Pawtuckaway", parentUuid: "8a63706f-b14c-536f-b8ab-3cea90093e36", totalClimbs: 940, pathTokens: ["USA", "New Hampshire", "Pawtuckaway"] },
    // New York
    { uuid: "14cd0edf-22b5-5cfe-881d-c4a21245b333", name: "The Gunks", parentUuid: "589a474a-bbce-5213-a77d-8138a22e0474", totalClimbs: 1850, pathTokens: ["USA", "New York", "The Gunks"] },
    // Oregon
    { uuid: "f3c655b6-9c95-597f-aaa6-fd7d8a4865ec", name: "Smith Rock", parentUuid: "5f05ed84-1a18-52d9-b8cf-77f8fd01e061", totalClimbs: 1790, pathTokens: ["USA", "Oregon", "Smith Rock"] },
    // Rhode Island
    { uuid: "da04f374-e87e-512a-af4a-0dff8754db36", name: "Lincoln Woods", parentUuid: "10f89d9c-9003-5a54-bad9-5849a525a2de", totalClimbs: 1150, pathTokens: ["USA", "Rhode Island", "Lincoln Woods"] },
    // South Dakota
    { uuid: "fcb9c76c-57ba-50f2-aa2c-1b574137f473", name: "Needles Of Rushmore, The", parentUuid: "253ab2e3-944f-5c5f-8477-58a428c86291", totalClimbs: 980, pathTokens: ["USA", "South Dakota", "Needles Of Rushmore, The"] },
    { uuid: "3b48a6c3-f8e6-52f5-b57a-35a299fb1b7a", name: "Mount Rushmore National Memorial", parentUuid: "253ab2e3-944f-5c5f-8477-58a428c86291", totalClimbs: 740, pathTokens: ["USA", "South Dakota", "Mount Rushmore National Memorial"] },
    { uuid: "72e16981-389a-5984-940d-40c1c28d0732", name: "Spearfish Canyon", parentUuid: "253ab2e3-944f-5c5f-8477-58a428c86291", totalClimbs: 820, pathTokens: ["USA", "South Dakota", "Spearfish Canyon"] },
    // Utah
    { uuid: "e838736e-03de-5522-b170-850c7ffcb2ac", name: "Central Wasatch", parentUuid: "ee1d37e7-dc41-5c26-a358-5d51af01f499", totalClimbs: 4820, pathTokens: ["USA", "Utah", "Central Wasatch"] },
    { uuid: "007f1fc1-3268-5660-b397-b7543d332216", name: "Little Cottonwood Canyon", parentUuid: "ee1d37e7-dc41-5c26-a358-5d51af01f499", totalClimbs: 2150, pathTokens: ["USA", "Utah", "Central Wasatch", "Little Cottonwood Canyon"] },
    { uuid: "f166e672-4a52-56d3-94f1-14c876feb670", name: "Indian Creek", parentUuid: "ee1d37e7-dc41-5c26-a358-5d51af01f499", totalClimbs: 1290, pathTokens: ["USA", "Utah", "Indian Creek"] },
    { uuid: "26a193ca-cb5e-5423-8ead-6db185433cfb", name: "Big Cottonwood Canyon", parentUuid: "ee1d37e7-dc41-5c26-a358-5d51af01f499", totalClimbs: 1410, pathTokens: ["USA", "Utah", "Central Wasatch", "Big Cottonwood Canyon"] },
    { uuid: "c6dbcb5f-af07-5552-b2a1-a98549545436", name: "Boulders - Little Cottonwood", parentUuid: "ee1d37e7-dc41-5c26-a358-5d51af01f499", totalClimbs: 1120, pathTokens: ["USA", "Utah", "Boulders - Little Cottonwood"] },
    // Virginia
    { uuid: "522337f4-f041-5101-b2a3-4603eebbf4b4", name: "Grayson Highlands State Park", parentUuid: "a42e6847-4548-5299-820a-7a75bfe34c71", totalClimbs: 980, pathTokens: ["USA", "Virginia", "Grayson Highlands State Park"] },
    // Washington
    { uuid: "04e395a7-b62f-5055-b5c3-e0a7b724df28", name: "Leavenworth", parentUuid: "cfe129f6-5f60-5bc8-87b3-3d3bfaff9472", totalClimbs: 2410, pathTokens: ["USA", "Washington", "Leavenworth"] },
    { uuid: "1a4b9fe5-403c-5a9c-b802-1d0ab5e68e1d", name: "Icicle Creek", parentUuid: "cfe129f6-5f60-5bc8-87b3-3d3bfaff9472", totalClimbs: 1650, pathTokens: ["USA", "Washington", "Leavenworth", "Icicle Creek"] },
    // West Virginia
    { uuid: "8a004a82-852f-54ab-ad77-bcbed7774cb5", name: "New River Gorge, The", parentUuid: "77388747-52f3-59bf-a6e7-e9a28094aba4", totalClimbs: 2890, pathTokens: ["USA", "West Virginia", "New River Gorge, The"] },
    { uuid: "859a8442-3fbd-542b-98fd-0eb6b3d2d762", name: "New River Gorge Proper", parentUuid: "77388747-52f3-59bf-a6e7-e9a28094aba4", totalClimbs: 1940, pathTokens: ["USA", "West Virginia", "New River Gorge Proper"] },
    // Wisconsin
    { uuid: "8c8a16c4-3fea-5c7c-b93d-f7b4f32d7b62", name: "Baraboo Range", parentUuid: "6f566d5b-d7f9-56d3-96e6-c4808c4fcc10", totalClimbs: 3410, pathTokens: ["USA", "Wisconsin", "Baraboo Range"] },
    { uuid: "bf4481e8-d698-5b5f-a46d-81f807c26d7d", name: "Devil's Lake", parentUuid: "6f566d5b-d7f9-56d3-96e6-c4808c4fcc10", totalClimbs: 2790, pathTokens: ["USA", "Wisconsin", "Devil's Lake"] },
    { uuid: "3f816201-d74f-56f0-b555-3a760031664b", name: "Devil's Lake Bouldering", parentUuid: "6f566d5b-d7f9-56d3-96e6-c4808c4fcc10", totalClimbs: 1120, pathTokens: ["USA", "Wisconsin", "Devil's Lake Bouldering"] },
    // Wyoming
    { uuid: "b1166235-3328-5537-b5ed-92f406ea8495", name: "Lander Area", parentUuid: "afc3c77e-efc9-50f7-a248-5b1d2864b858", totalClimbs: 1420, pathTokens: ["USA", "Wyoming", "Lander Area"] },
    { uuid: "183fb1aa-8d3f-5bf1-b176-049cf356e744", name: "Vedauwoo", parentUuid: "afc3c77e-efc9-50f7-a248-5b1d2864b858", totalClimbs: 1180, pathTokens: ["USA", "Wyoming", "Vedauwoo"] },
    { uuid: "9abad566-2113-587e-95a5-b3abcfaa28ac", name: "Ten Sleep Canyon", parentUuid: "afc3c77e-efc9-50f7-a248-5b1d2864b858", totalClimbs: 1360, pathTokens: ["USA", "Wyoming", "Ten Sleep Canyon"] }
];

/**
 * Ensure the `areas` table is seeded with OpenBeta countries, US states, and climbing destinations.
 * Runs automatically via server-side `$app` if `areas` is empty.
 */
function ensureOpenBetaDirectorySeeded() {
    try {
        const countResult = arrayOf(new DynamicModel({ total: 0 }));
        $app.db()
            .select("COUNT(*) as total")
            .from(POCKET_AREAS)
            .where($dbx.exp("isDeleted = 0"))
            .all(countResult);
        const existingCount = countResult[0]?.total || 0;
        if (existingCount >= 50) {
            return;
        }

        if (typeof $http === "undefined") return;

        const gqlQuery = `{
            countries {
                id
                uuid
                area_name
                shortCode
                totalClimbs
                density
                pathTokens
                ancestors
                gradeContext
                metadata { isDestination leaf isBoulder lat lng bbox leftRightIndex mp_id area_id }
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
                    metadata { isDestination leaf isBoulder lat lng leftRightIndex mp_id area_id }
                }
            }
        }`;

        const res = $http.send({
            url: OPENBETA_API_ENDPOINT,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: gqlQuery }),
            timeout: 20
        });

        if (!res || res.statusCode < 200 || res.statusCode >= 300) {
            return;
        }

        const payload = typeof res.json === "object" && res.json !== null
            ? res.json
            : JSON.parse(res.raw || "{}");
        const countries = Array.isArray(payload?.data?.countries) ? payload.data.countries : [];
        const activeCountries = countries.filter(
            (c) => c && c.totalClimbs > 0 && c.area_name !== "Test Area 2014"
        );

        const uuidToId = {};

        for (let i = 0; i < activeCountries.length; i++) {
            const c = activeCountries[i];
            const rec = upsertOpenBetaAreaRecord(c, "", "");
            if (rec) {
                uuidToId[c.uuid] = rec.id;
            }
        }

        for (let i = 0; i < activeCountries.length; i++) {
            const c = activeCountries[i];
            const isUsa = c.area_name === "USA" || c.shortCode === "USA";
            const children = Array.isArray(c.children) ? c.children : [];
            const parentId = uuidToId[c.uuid] || "";

            for (let j = 0; j < children.length; j++) {
                const ch = children[j];
                if (!ch || ch.area_name === "Test Area 2014") continue;
                if (!isUsa && (!ch.totalClimbs || ch.totalClimbs <= 0)) continue;

                const isIntlDest = !isUsa && !["CAN", "DEU", "ZAF"].includes(c.shortCode) && ch.totalClimbs > 0;
                if (isIntlDest && ch.metadata) {
                    ch.metadata.isDestination = true;
                }
                const chRec = upsertOpenBetaAreaRecord(ch, c.uuid, parentId);
                if (chRec) {
                    uuidToId[ch.uuid] = chRec.id;
                }
            }
        }

        for (let i = 0; i < FEATURED_DESTINATION_SEEDS.length; i++) {
            const seed = FEATURED_DESTINATION_SEEDS[i];
            const parentId = uuidToId[seed.parentUuid] || "";
            upsertOpenBetaAreaRecord(
                {
                    uuid: seed.uuid,
                    area_name: seed.name,
                    totalClimbs: seed.totalClimbs,
                    pathTokens: seed.pathTokens,
                    ancestors: [seed.parentUuid, seed.uuid],
                    metadata: { isDestination: true, leaf: false }
                },
                seed.parentUuid,
                parentId
            );
        }
    } catch (err) {
        $app.logger().error("Failed to seed OpenBeta directory", "error", err);
    }
}

/**
 * Get all non-deleted areas sorted by leftRightIndex and name
 * @returns {Array<Record>}
 */
function getAllActiveAreas() {
    try {
        ensureOpenBetaDirectorySeeded();
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
 * Upsert an OpenBeta Area object into the `areas` collection
 * @param {object} areaObj
 * @param {string} [overrideParentUuid]
 * @param {string} [parentRecordId]
 * @returns {Record|null}
 */
function upsertOpenBetaAreaRecord(areaObj, overrideParentUuid, parentRecordId) {
    if (!areaObj || !areaObj.uuid) return null;
    try {
        const collection = $app.findCollectionByNameOrId(POCKET_AREAS);
        if (!collection) return null;

        let record = null;
        try {
            record = $app.findFirstRecordByFilter(
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
        const finalParentUuid = typeof overrideParentUuid === "string"
            ? overrideParentUuid
            : (isNew ? derivedParentUuid : (record.getString("parentUuid") || derivedParentUuid));

        record.set("openbetaUuid", areaObj.uuid);
        record.set("openbetaId", String(areaObj.id || areaObj.metadata?.area_id || ""));
        record.set("mpId", String(areaObj.metadata?.mp_id || ""));
        record.set("name", String(areaObj.area_name || areaObj.areaName || "Unknown Area"));
        record.set("shortCode", String(areaObj.shortCode || record.getString("shortCode") || ""));
        if (finalParentUuid) {
            record.set("parentUuid", finalParentUuid);
        }
        if (parentRecordId) {
            record.set("parent", parentRecordId);
        }
        if (Array.isArray(areaObj.pathTokens)) {
            record.set("pathTokens", areaObj.pathTokens);
        }
        if (ancestors.length > 0) {
            record.set("ancestors", ancestors);
        }
        record.set("gradeContext", String(areaObj.gradeContext || "US"));
        if (typeof areaObj.metadata?.lat === "number") {
            record.set("lat", areaObj.metadata.lat);
        }
        if (typeof areaObj.metadata?.lng === "number") {
            record.set("lng", areaObj.metadata.lng);
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
        record.set("isDeleted", false);

        $app.save(record);
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
function upsertOpenBetaClimbRecord(climbObj, areaUuid, areaRecordId) {
    if (!climbObj || !climbObj.uuid) return null;
    try {
        const collection = $app.findCollectionByNameOrId(POCKET_CLIMBS);
        if (!collection) return null;

        let record = null;
        try {
            record = $app.findFirstRecordByFilter(
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
        if (climbObj.safety) {
            record.set("safety", String(climbObj.safety));
        }
        record.set("gradeContext", String(climbObj.gradeContext || "US"));
        record.set("gradeYds", String(climbObj.grades?.yds || ""));
        record.set("gradeVscale", String(climbObj.grades?.vscale || ""));
        record.set("gradeFont", String(climbObj.grades?.font || ""));
        record.set("gradeFrench", String(climbObj.grades?.french || ""));
        record.set("gradeEwbank", String(climbObj.grades?.ewbank || ""));
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
        if (typeof climbObj.metadata?.lat === "number") {
            record.set("lat", climbObj.metadata.lat);
        }
        if (typeof climbObj.metadata?.lng === "number") {
            record.set("lng", climbObj.metadata.lng);
        }
        if (typeof climbObj.metadata?.leftRightIndex === "number") {
            record.set("leftRightIndex", climbObj.metadata.leftRightIndex);
        }
        record.set("description", String(climbObj.content?.description || ""));
        record.set("location", String(climbObj.content?.location || ""));
        record.set("protection", String(climbObj.content?.protection || ""));
        if (Array.isArray(climbObj.pathTokens)) {
            record.set("pathTokens", climbObj.pathTokens);
        }
        if (Array.isArray(climbObj.ancestors)) {
            record.set("ancestors", climbObj.ancestors);
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
        record.set("isDeleted", false);

        $app.save(record);
        return record;
    } catch (err) {
        $app.logger().error("Failed to upsert OpenBeta climb record", "uuid", climbObj?.uuid, "error", err);
        return null;
    }
}

/**
 * Get an area and its immediate sub-areas and climbs from PocketBase,
 * syncing from OpenBeta GraphQL API on-demand if children/climbs are not yet cached locally.
 * @param {string} uuid
 * @returns {{ areaRecord: Record|null, childAreas: Array<Record>, climbs: Array<Record> }}
 */
function getOrSyncAreaDetail(uuid) {
    if (!uuid || typeof uuid !== "string") {
        return { areaRecord: null, childAreas: [], climbs: [] };
    }

    let areaRecord = getAreaByUuid(uuid);
    let childAreas = $app.findRecordsByFilter(
        POCKET_AREAS,
        "(parentUuid = {:uuid} || parent = {:id}) && isDeleted = false",
        "leftRightIndex,name",
        0,
        0,
        { uuid, id: areaRecord?.id || "" }
    ) || [];

    let climbs = $app.findRecordsByFilter(
        POCKET_CLIMBS,
        "(areaUuid = {:uuid} || area = {:id}) && isDeleted = false",
        "leftRightIndex,name",
        0,
        0,
        { uuid, id: areaRecord?.id || "" }
    ) || [];

    const needsSync = !areaRecord || (
        childAreas.length === 0 &&
        climbs.length === 0 &&
        (areaRecord.getInt("totalClimbs") > 0 || !areaRecord.getBool("isLeaf"))
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
                        metadata { isDestination leaf isBoulder lat lng leftRightIndex mp_id area_id }
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
                        grades { yds vscale font french ewbank uiaa wi }
                        type { trad sport bouldering tr alpine ice mixed aid deepwatersolo snow }
                        metadata { lat lng leftRightIndex mp_id climb_id }
                        content { description location protection }
                        pathTokens
                        ancestors
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
                            upsertOpenBetaClimbRecord(cl, remoteArea.uuid, parentId);
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

    return {
        areaRecord,
        childAreas,
        climbs
    };
}



