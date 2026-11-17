const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

if (!global.__hooks) {
    global.__hooks = path.resolve(__dirname, '../pb_hooks');
}

const collection = require('../pb_hooks/pages/utils/collection.js');

test('parseCsv', async (t) => {
    await t.test('parses CSV into array of header-keyed objects', () => {
        const csv = 'Calendar,WeekStarting,GreenBin,Garbage\nTuesday 1,2026-11-02,2,0\nTuesday 2,2026-11-09,2,2';
        const rows = collection.parseCsv(csv);
        assert.equal(rows.length, 2);
        assert.deepEqual(rows[0], {
            Calendar: 'Tuesday 1',
            WeekStarting: '2026-11-02',
            GreenBin: '2',
            Garbage: '0',
        });
        assert.deepEqual(rows[1], {
            Calendar: 'Tuesday 2',
            WeekStarting: '2026-11-09',
            GreenBin: '2',
            Garbage: '2',
        });
    });

    await t.test('handles empty lines, CRLF, and trailing whitespace', () => {
        const csv = 'Name,Code\r\nItem 1, 100 \r\n\r\nItem 2, 200\r\n';
        const rows = collection.parseCsv(csv);
        assert.equal(rows.length, 2);
        assert.equal(rows[0].Name, 'Item 1');
        assert.equal(rows[0].Code, '100');
        assert.equal(rows[1].Name, 'Item 2');
        assert.equal(rows[1].Code, '200');
    });

    await t.test('returns empty array on empty or falsy inputs', () => {
        assert.deepEqual(collection.parseCsv(''), []);
        assert.deepEqual(collection.parseCsv('   \n  '), []);
        assert.deepEqual(collection.parseCsv(null), []);
    });
});

test('decodeHttpBody and getHttpJson / getHttpText', async (t) => {
    await t.test('decodes plain string body', () => {
        assert.equal(collection.decodeHttpBody('hello world'), 'hello world');
    });

    await t.test('decodes Uint8Array or byte array', () => {
        const bytes = new TextEncoder().encode('sample utf8 string');
        assert.equal(collection.decodeHttpBody(bytes), 'sample utf8 string');
        assert.equal(collection.decodeHttpBody(Array.from(bytes)), 'sample utf8 string');
    });

    await t.test('handles null or undefined body gracefully', () => {
        assert.equal(collection.decodeHttpBody(null), '');
        assert.equal(collection.decodeHttpBody(undefined), '');
    });

    await t.test('getHttpJson parses json payloads from responses', () => {
        // Pre-parsed json property
        assert.deepEqual(collection.getHttpJson({ json: { ok: true, count: 5 } }), { ok: true, count: 5 });

        // String body
        assert.deepEqual(collection.getHttpJson({ body: '{"success":true}' }), { success: true });

        // Raw body
        assert.deepEqual(collection.getHttpJson({ raw: '{"name":"test"}' }), { name: 'test' });

        // Malformed json
        assert.equal(collection.getHttpJson({ body: '{invalid-json}' }), null);
        assert.equal(collection.getHttpJson({ body: '' }), null);
    });

    await t.test('getHttpText returns raw decoded string', () => {
        assert.equal(collection.getHttpText({ body: 'response text' }), 'response text');
        assert.equal(collection.getHttpText({ raw: 'raw text' }), 'raw text');
    });
});

test('Date Helpers (parseIsoDate, formatIsoDate, addUtcDays, getWeekStart, getWeekEnd)', async (t) => {
    await t.test('parseIsoDate and formatIsoDate round-trip correctly in UTC', () => {
        const parsed = collection.parseIsoDate('2026-11-17');
        assert.equal(parsed.getUTCFullYear(), 2026);
        assert.equal(parsed.getUTCMonth(), 10); // 0-indexed month (November)
        assert.equal(parsed.getUTCDate(), 17);

        assert.equal(collection.formatIsoDate(parsed), '2026-11-17');
    });

    await t.test('addUtcDays adds and subtracts days without time zone shifts', () => {
        const d = collection.parseIsoDate('2026-11-17');
        const next = collection.addUtcDays(d, 5);
        assert.equal(collection.formatIsoDate(next), '2026-11-22');

        const prev = collection.addUtcDays(d, -10);
        assert.equal(collection.formatIsoDate(prev), '2026-11-07');
    });

    await t.test('getWeekStart and getWeekEnd compute Sunday to Saturday bounds', () => {
        // 2026-11-17 is a Tuesday (UTCDay 2)
        const tuesday = collection.parseIsoDate('2026-11-17');
        const sunday = collection.getWeekStart(tuesday);
        const saturday = collection.getWeekEnd(tuesday);

        assert.equal(collection.formatIsoDate(sunday), '2026-11-15');
        assert.equal(collection.formatIsoDate(saturday), '2026-11-21');
        assert.equal(sunday.getUTCDay(), 0);
        assert.equal(saturday.getUTCDay(), 6);
    });
});

test('formatCollectionDiscordMessage', async (t) => {
    await t.test('formats discord markdown message with schedule details', () => {
        const msg = collection.formatCollectionDiscordMessage({
            statusCode: 200,
            json: {
                address: '123 Main St',
                collectionArea: { description: 'District 4' },
                pdfUrl: 'https://toronto.ca/schedule.pdf',
                collectionCalendar: [
                    { title: 'Green Bin', start: '2026-11-17' },
                    { title: 'Garbage', start: '2026-11-17' }
                ],
            }
        });

        assert.ok(msg.includes('**Waste Collection Schedule**'));
        assert.ok(msg.includes('**Address**: 123 Main St (District 4)'));
        assert.ok(msg.includes('**Next Pickup Date**: Tuesday, November 17, 2026'));
        assert.ok(msg.includes('- Green Bin'));
        assert.ok(msg.includes('- Garbage'));
        assert.ok(msg.includes('[Download Schedule PDF](${pdfUrl})') || msg.includes('[Download Schedule PDF](https://toronto.ca/schedule.pdf)'));
    });

    await t.test('handles empty collectionCalendar', () => {
        const msg = collection.formatCollectionDiscordMessage({
            statusCode: 200,
            json: {
                address: '456 Elm Ave',
                collectionCalendar: [],
            }
        });

        assert.ok(msg.includes('Waste Collection Schedule for **456 Elm Ave**:'));
        assert.ok(msg.includes('No upcoming pickups found in the calendar.'));
    });

    await t.test('handles missing json data', () => {
        const msg = collection.formatCollectionDiscordMessage({
            statusCode: 404,
        });

        assert.ok(msg.includes('Collection status: 404'));
        assert.ok(msg.includes('No schedule data available.'));
    });
});
