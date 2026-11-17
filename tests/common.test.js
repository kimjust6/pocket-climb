const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Ensure __hooks global is available for pb_hooks module resolution in Node
if (!global.__hooks) {
    global.__hooks = path.resolve(__dirname, '../pb_hooks');
}

const common = require('../pb_hooks/pages/utils/common.js');

test('slugifyTitle', async (t) => {
    await t.test('converts basic titles to lowercase slug', () => {
        assert.equal(common.slugifyTitle('Hello World'), 'hello-world');
        assert.equal(common.slugifyTitle('Red River Gorge'), 'red-river-gorge');
    });

    await t.test('strips special characters and collapses dashes', () => {
        assert.equal(common.slugifyTitle('Climb #42: The Send! (5.12a)'), 'climb-42-the-send-5-12a');
        assert.equal(common.slugifyTitle('---leading---and---trailing---'), 'leading-and-trailing');
        assert.equal(common.slugifyTitle('multiple   spaces  and___symbols***'), 'multiple-spaces-and-symbols');
    });

    await t.test('handles empty, null, or undefined values gracefully', () => {
        assert.equal(common.slugifyTitle(''), '');
        assert.equal(common.slugifyTitle(null), '');
        assert.equal(common.slugifyTitle(undefined), '');
    });
});

test('sanitizeSearchTerm (Privacy & Security)', async (t) => {
    await t.test('cleans normal search strings', () => {
        assert.equal(common.sanitizeSearchTerm('bouldering in bishop'), 'bouldering in bishop');
        assert.equal(common.sanitizeSearchTerm('  red rock  '), 'red rock');
    });

    await t.test('strips HTML tags to prevent XSS payloads', () => {
        assert.equal(common.sanitizeSearchTerm('<script>alert("xss")</script>climb'), 'alert("xss")climb');
        assert.equal(common.sanitizeSearchTerm('<b>bold</b> route'), 'bold route');
    });

    await t.test('rejects inputs containing email addresses', () => {
        assert.equal(common.sanitizeSearchTerm('user@example.com'), '');
        assert.equal(common.sanitizeSearchTerm('contact me at test@domain.org please'), '');
    });

    await t.test('rejects inputs containing URLs or protocol tokens', () => {
        assert.equal(common.sanitizeSearchTerm('https://malicious.site/phish'), '');
        assert.equal(common.sanitizeSearchTerm('http://openbeta.io'), '');
        assert.equal(common.sanitizeSearchTerm('ftp://files.example.com'), '');
        assert.equal(common.sanitizeSearchTerm('file:///etc/passwd'), '');
    });

    await t.test('rejects inputs containing credential keywords', () => {
        assert.equal(common.sanitizeSearchTerm('my password is 123'), '');
        assert.equal(common.sanitizeSearchTerm('auth_token_value'), '');
        assert.equal(common.sanitizeSearchTerm('api secret token'), '');
    });

    await t.test('truncates strings exceeding 100 characters', () => {
        const longTerm = 'a'.repeat(150);
        const result = common.sanitizeSearchTerm(longTerm);
        assert.equal(result.length, 100);
        assert.equal(result, 'a'.repeat(100));
    });

    await t.test('handles null, undefined, and non-string inputs', () => {
        assert.equal(common.sanitizeSearchTerm(null), '');
        assert.equal(common.sanitizeSearchTerm(undefined), '');
        assert.equal(common.sanitizeSearchTerm(12345), '');
        assert.equal(common.sanitizeSearchTerm({}), '');
    });
});

test('sanitizeRedirectPath (Open Redirect Prevention)', async (t) => {
    await t.test('allows safe relative paths', () => {
        assert.equal(common.sanitizeRedirectPath('/area/123/gunks'), '/area/123/gunks');
        assert.equal(common.sanitizeRedirectPath('/climb/456/the-great-roof'), '/climb/456/the-great-roof');
        assert.equal(common.sanitizeRedirectPath('/faq'), '/faq');
    });

    await t.test('rejects external protocol URLs', () => {
        assert.equal(common.sanitizeRedirectPath('https://evil.com'), '/');
        assert.equal(common.sanitizeRedirectPath('http://attacker.com/steal'), '/');
        assert.equal(common.sanitizeRedirectPath('javascript:alert(1)'), '/');
    });

    await t.test('rejects protocol-relative and backslash evasion attempts', () => {
        assert.equal(common.sanitizeRedirectPath('//evil.com'), '/');
        assert.equal(common.sanitizeRedirectPath('/\\evil.com'), '/');
        assert.equal(common.sanitizeRedirectPath('\\evil.com'), '/');
    });

    await t.test('rejects login and logout redirect loops', () => {
        assert.equal(common.sanitizeRedirectPath('/login'), '/');
        assert.equal(common.sanitizeRedirectPath('/login?next=/'), '/');
        assert.equal(common.sanitizeRedirectPath('/logout'), '/');
    });

    await t.test('handles null, undefined, empty, or invalid inputs', () => {
        assert.equal(common.sanitizeRedirectPath(''), '/');
        assert.equal(common.sanitizeRedirectPath(null), '/');
        assert.equal(common.sanitizeRedirectPath(undefined), '/');
        assert.equal(common.sanitizeRedirectPath(42), '/');
    });
});

test('escapeHtml (HTML Entity Sanitization)', async (t) => {
    await t.test('escapes HTML special characters', () => {
        assert.equal(common.escapeHtml('&'), '&amp;');
        assert.equal(common.escapeHtml('<script>'), '&lt;script&gt;');
        assert.equal(common.escapeHtml('"hello"'), '&quot;hello&quot;');
        assert.equal(common.escapeHtml("'world'"), '&#39;world&#39;');
        assert.equal(
            common.escapeHtml('<a href="test?a=1&b=2">Link</a>'),
            '&lt;a href=&quot;test?a=1&amp;b=2&quot;&gt;Link&lt;/a&gt;'
        );
    });

    await t.test('handles empty and null values', () => {
        assert.equal(common.escapeHtml(''), '');
        assert.equal(common.escapeHtml(null), '');
        assert.equal(common.escapeHtml(undefined), '');
    });
});

test('buildAreaUrl and buildClimbUrl', async (t) => {
    await t.test('builds canonical area URL', () => {
        assert.equal(common.buildAreaUrl('uuid-123', 'The Gunks'), '/area/the-gunks/uuid-123');
        assert.equal(common.buildAreaUrl('abc', 'Red River Gorge (RRG)'), '/area/red-river-gorge-rrg/abc');
        assert.equal(common.buildAreaUrl('789', ''), '/area/area/789');
    });

    await t.test('builds canonical climb URL', () => {
        assert.equal(common.buildClimbUrl('uuid-456', 'Midnight Lightning'), '/climb/midnight-lightning/uuid-456');
        assert.equal(common.buildClimbUrl('xyz', 'Action Directe!'), '/climb/action-directe/xyz');
        assert.equal(common.buildClimbUrl('999', ''), '/climb/climb/999');
    });
});

test('normalizeImgurUrl and isValidImgurDirectUrl', async (t) => {
    await t.test('normalizes http imgur URLs to https', () => {
        assert.equal(common.normalizeImgurUrl('http://i.imgur.com/abcd123.jpg'), 'https://i.imgur.com/abcd123.jpg');
        assert.equal(common.normalizeImgurUrl('https://i.imgur.com/abcd123.jpg'), 'https://i.imgur.com/abcd123.jpg');
        assert.equal(common.normalizeImgurUrl('  https://i.imgur.com/xyz.png  '), 'https://i.imgur.com/xyz.png');
    });

    await t.test('handles empty or non-string inputs', () => {
        assert.equal(common.normalizeImgurUrl(''), '');
        assert.equal(common.normalizeImgurUrl(null), '');
        assert.equal(common.normalizeImgurUrl(undefined), '');
    });

    await t.test('validates direct imgur image links', () => {
        assert.equal(common.isValidImgurDirectUrl('https://i.imgur.com/abcd123.jpg'), true);
        assert.equal(common.isValidImgurDirectUrl('https://i.imgur.com/abcd123.png'), true);
        assert.equal(common.isValidImgurDirectUrl('https://i.imgur.com/abcd123.webp'), true);
        assert.equal(common.isValidImgurDirectUrl('https://i.imgur.com/abcd123.jpeg'), true);
        assert.equal(common.isValidImgurDirectUrl('http://i.imgur.com/abcd123.gif'), true);

        // Invalid links
        assert.equal(common.isValidImgurDirectUrl('https://imgur.com/a/albumId'), false);
        assert.equal(common.isValidImgurDirectUrl('https://i.imgur.com/abcd123.html'), false);
        assert.equal(common.isValidImgurDirectUrl('https://evil.com/abcd123.jpg'), false);
        assert.equal(common.isValidImgurDirectUrl('not-a-url'), false);
        assert.equal(common.isValidImgurDirectUrl(''), false);
    });
});

test('resolveClimbMediaUrl', async (t) => {
    await t.test('returns full http/https URLs as-is (with imgur normalization)', () => {
        assert.equal(
            common.resolveClimbMediaUrl('http://i.imgur.com/test.jpg'),
            'https://i.imgur.com/test.jpg'
        );
        assert.equal(
            common.resolveClimbMediaUrl('https://example.com/photo.jpg'),
            'https://example.com/photo.jpg'
        );
    });

    await t.test('resolves relative paths to OpenBeta media CDN', () => {
        assert.equal(
            common.resolveClimbMediaUrl('/images/climb1.jpg'),
            'https://media.openbeta.io/images/climb1.jpg'
        );
        assert.equal(
            common.resolveClimbMediaUrl('images/climb2.jpg'),
            'https://media.openbeta.io/images/climb2.jpg'
        );
    });

    await t.test('returns empty string for null or empty input', () => {
        assert.equal(common.resolveClimbMediaUrl(''), '');
        assert.equal(common.resolveClimbMediaUrl(null), '');
    });
});

test('parseCookieHeader', async (t) => {
    await t.test('parses multiple cookies from header string', () => {
        const header = 'pb_auth=token123; theme=nord; session=abc';
        const parsed = common.parseCookieHeader(header);
        assert.deepEqual(parsed, {
            pb_auth: 'token123',
            theme: 'nord',
            session: 'abc',
        });
    });

    await t.test('unquotes quoted cookie values and decodes URI components', () => {
        const header = 'user="Justin%20Kim"; pref="dark"';
        const parsed = common.parseCookieHeader(header);
        assert.equal(parsed.user, 'Justin Kim');
        assert.equal(parsed.pref, 'dark');
    });

    await t.test('handles empty, null, or malformed cookies', () => {
        assert.deepEqual(common.parseCookieHeader(''), {});
        assert.deepEqual(common.parseCookieHeader(null), {});
        assert.deepEqual(common.parseCookieHeader('invalid-cookie; =no-key; key='), { key: '' });
    });
});

test('formatNumberWithCommas', async (t) => {
    await t.test('formats numbers with thousands separators', () => {
        assert.equal(common.formatNumberWithCommas(1000), '1,000');
        assert.equal(common.formatNumberWithCommas(1234567), '1,234,567');
        assert.equal(common.formatNumberWithCommas(0), '0');
        assert.equal(common.formatNumberWithCommas(99), '99');
    });

    await t.test('handles string representations of numbers', () => {
        assert.equal(common.formatNumberWithCommas('50000'), '50,000');
    });

    await t.test('handles falsy or empty inputs', () => {
        assert.equal(common.formatNumberWithCommas(null), '0');
        assert.equal(common.formatNumberWithCommas(''), '0');
    });
});

test('computeClimbGradeMetrics', async (t) => {
    await t.test('returns unrated tier when no grade data is provided', () => {
        const defaultEmpty = common.computeClimbGradeMetrics();
        assert.equal(defaultEmpty.difficultyTier, 'Unrated');
        assert.equal(defaultEmpty.difficultyRank, 0);

        const emptyObj = common.computeClimbGradeMetrics({});
        assert.equal(emptyObj.difficultyTier, 'Unrated');
        assert.equal(emptyObj.difficultyRank, 0);
    });

    await t.test('computes metrics for V-scale bouldering grades', () => {
        const metrics = common.computeClimbGradeMetrics({ gradeVscale: 'V4' });
        assert.ok(metrics);
        assert.equal(metrics.difficultyTier, 'Intermediate');
        assert.equal(metrics.difficultyRank, 32);
        assert.equal(metrics.isBouldering, true);
    });

    await t.test('computes metrics for YDS sport/trad grades', () => {
        const metrics = common.computeClimbGradeMetrics({ gradeYds: '5.10a' });
        assert.ok(metrics);
        assert.equal(metrics.difficultyTier, 'Intermediate');
        assert.equal(metrics.difficultyRank, 28);
        assert.equal(metrics.isBouldering, false);
    });

    await t.test('computes elite metrics for hard grades', () => {
        const metrics = common.computeClimbGradeMetrics({ primaryGrade: '5.15a' });
        assert.ok(metrics);
        assert.equal(metrics.difficultyTier, 'Elite');
        assert.ok(metrics.difficultyRank > 64);
    });
});

test('Zendesk Webhook / Ticket Payload Helpers', async (t) => {
    await t.test('privateGetBody extracts body from webhook format', () => {
        const webhookData = { body: { body: { id: 1234, type: 'test' } } };
        assert.deepEqual(common.privateGetBody(webhookData), { id: 1234, type: 'test' });

        const simpleData = { body: { id: 5678 } };
        assert.deepEqual(common.privateGetBody(simpleData), { id: 5678 });

        const directDetail = { detail: { id: 999 } };
        assert.deepEqual(common.privateGetBody(directDetail), directDetail);
    });

    await t.test('getTicketId parses numeric and string ticket IDs', () => {
        assert.equal(common.getTicketId({ body: { detail: { id: 456 } } }), 456);
        assert.equal(common.getTicketId({ body: { id: 789 } }), 789);
        assert.equal(common.getTicketId({ body: { subject: 'Ticket: 101112' } }), 101112);
        assert.equal(common.getTicketId({ body: { subject: 'NoNumberHere' } }), 0);
    });

    await t.test('getTicketTitle extracts ticket subject', () => {
        assert.equal(common.getTicketTitle({ body: { detail: { subject: 'Urgent Issue' } } }), 'Urgent Issue');
        assert.equal(common.getTicketTitle({ body: { subject: 'General Question' } }), 'General Question');
        assert.equal(common.getTicketTitle({}), null);
    });
});
