const { POCKET_USERS } = require('./constants');

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

module.exports = {
    findUserByIdentity,
    authenticateUserWithPassword,
    getAuthRecordFromToken,
    getOAuthProviders,
    requestPasswordResetByEmail,
    registerNewUser,
};
