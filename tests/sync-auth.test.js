const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMainHooks(cronSecret = '') {
    const hooksDir = path.resolve(__dirname, '../pb_hooks');
    const source = fs.readFileSync(path.join(hooksDir, 'main.pb.js'), 'utf8');

    const routes = [];
    const customRequire = (id) => {
        if (id.endsWith('/pages/utils/common.js')) {
            return {
                getAdminSetting: () => cronSecret,
            };
        }
        return require(id);
    };

    const sandbox = {
        __hooks: hooksDir,
        require: customRequire,
        process: { env: cronSecret ? { CRON_SECRET: cronSecret } : {} },
        routerUse: () => {},
        routerAdd: (method, routePath, handler) => {
            routes.push({ method, routePath, handler });
        },
        onRecordAfterCreateSuccess: () => {},
        $app: {
            logger: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
        },
        URLSearchParams,
    };

    vm.runInNewContext(source, sandbox, { filename: 'main.pb.js' });
    return { routes, isAuthorizedSyncRequest: sandbox.isAuthorizedSyncRequest };
}

function makeEvent({ auth = null, headers = {}, query = {}, body = {} } = {}) {
    let statusCode = null;
    let jsonPayload = null;
    return {
        auth,
        request: {
            headers: {
                get: (name) => headers[name] || headers[name.toLowerCase()] || '',
            },
        },
        requestInfo: () => ({ query, body }),
        json: (code, payload) => {
            statusCode = code;
            jsonPayload = payload;
            return { statusCode, jsonPayload };
        },
        getResponse: () => ({ statusCode, jsonPayload }),
    };
}

test('sync endpoints reject unauthenticated requests even when CRON_SECRET is unset', () => {
    const { routes } = loadMainHooks('');
    const syncPaths = ['/api/openbeta/update-climbs', '/api/climbs/update', '/api/sync', '/api/cron/sync'];

    for (const p of syncPaths) {
        const route = routes.find((r) => r.method === 'POST' && r.routePath === p);
        assert.ok(route, `Expected POST ${p} route to be registered`);

        const event = makeEvent();
        const res = route.handler(event);
        assert.equal(res.statusCode, 401);
        assert.equal(res.jsonPayload.status, 'unauthorized');
    }
});

test('isAuthorizedSyncRequest accepts valid CRON_SECRET or superuser auth and rejects invalid tokens', () => {
    const { isAuthorizedSyncRequest } = loadMainHooks('top-secret-123');

    assert.equal(
        isAuthorizedSyncRequest(makeEvent({ headers: { Authorization: 'Bearer top-secret-123' } }), () => undefined),
        true
    );
    assert.equal(
        isAuthorizedSyncRequest(makeEvent(), (k) => (k === 'token' ? 'top-secret-123' : undefined)),
        true
    );
    assert.equal(
        isAuthorizedSyncRequest(makeEvent({ auth: { isSuperuser: () => true } }), () => undefined),
        true
    );
    assert.equal(
        isAuthorizedSyncRequest(makeEvent({ headers: { Authorization: 'Bearer wrong' } }), () => undefined),
        false
    );
});

