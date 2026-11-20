const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

globalThis.__hooks = path.resolve(__dirname, '../pb_hooks');

const {
    sanitizeSearchTerm,
    normalizeImgurUrl,
    isValidImgurDirectUrl,
    slugifyTitle,
    buildAreaUrl,
    buildClimbUrl,
    escapeHtml,
    resolveMarkdownHref,
    sanitizeRedirectPath,
    formatNumberWithCommas,
    computeClimbGradeMetrics,
    applyPageMetadata,
} = require('../pb_hooks/pages/utils/common.js');

test('sanitizeSearchTerm strips HTML, rejects sensitive patterns, and caps length', () => {
    assert.equal(sanitizeSearchTerm('  <b>Squamish</b>  '), 'Squamish');
    assert.equal(sanitizeSearchTerm('user@example.com'), '');
    assert.equal(sanitizeSearchTerm('https://evil.example/test'), '');
    assert.equal(sanitizeSearchTerm('my secret token'), '');
    assert.equal(sanitizeSearchTerm(null), '');
    assert.equal(sanitizeSearchTerm('a'.repeat(150)).length, 100);
});

test('normalizeImgurUrl and isValidImgurDirectUrl validate direct i.imgur.com URLs', () => {
    assert.equal(normalizeImgurUrl('http://i.imgur.com/abc1234.jpg'), 'https://i.imgur.com/abc1234.jpg');
    assert.equal(isValidImgurDirectUrl('http://i.imgur.com/abc1234.png?foo=1'), true);
    assert.equal(isValidImgurDirectUrl('https://i.imgur.com/abc1234.webp'), true);
    assert.equal(isValidImgurDirectUrl('https://imgur.com/abc1234'), false);
    assert.equal(isValidImgurDirectUrl('https://example.com/abc1234.jpg'), false);
    assert.equal(isValidImgurDirectUrl(''), false);
});

test('slugifyTitle, buildAreaUrl, and buildClimbUrl build canonical paths', () => {
    assert.equal(slugifyTitle('The Grand Wall!'), 'the-grand-wall');
    assert.equal(buildAreaUrl('area-123', 'Squamish Chief'), '/area/squamish-chief/area-123');
    assert.equal(buildClimbUrl('climb-456', 'Midnight Lightning'), '/climb/midnight-lightning/climb-456');
});

test('escapeHtml escapes special HTML characters', () => {
    assert.equal(
        escapeHtml('<script>alert("xss" & \'test\')</script>'),
        '&lt;script&gt;alert(&quot;xss&quot; &amp; &#39;test&#39;)&lt;/script&gt;'
    );
    assert.equal(escapeHtml(null), '');
});

test('resolveMarkdownHref blocks dangerous schemes and preserves safe external URLs', () => {
    assert.deepEqual(resolveMarkdownHref('javascript:alert(1)'), { href: '#', isExternal: false });
    assert.deepEqual(resolveMarkdownHref('data:text/html,hi'), { href: '#', isExternal: false });
    assert.deepEqual(resolveMarkdownHref(''), { href: '#', isExternal: false });

    const ext = resolveMarkdownHref('https://example.com/guide');
    assert.equal(ext.href, 'https://example.com/guide');
    assert.equal(ext.isExternal, true);
});

test('sanitizeRedirectPath prevents open redirects and auth loops', () => {
    assert.equal(sanitizeRedirectPath('/area/squamish/123'), '/area/squamish/123');
    assert.equal(sanitizeRedirectPath('//evil.com'), '/');
    assert.equal(sanitizeRedirectPath('https://evil.com'), '/');
    assert.equal(sanitizeRedirectPath('/\\evil.com'), '/');
    assert.equal(sanitizeRedirectPath('/login?next=/'), '/');
    assert.equal(sanitizeRedirectPath('/logout'), '/');
    assert.equal(sanitizeRedirectPath(''), '/');
});

test('formatNumberWithCommas formats integers cleanly', () => {
    assert.equal(formatNumberWithCommas(206261), '206,261');
    assert.equal(formatNumberWithCommas(0), '0');
    assert.equal(formatNumberWithCommas(42), '42');
});

test('computeClimbGradeMetrics ranks unrated, V-scale, and YDS grades', () => {
    const unrated = computeClimbGradeMetrics({});
    assert.equal(unrated.difficultyRank, 0);
    assert.equal(unrated.difficultyTier, 'Unrated');

    const v0 = computeClimbGradeMetrics({ primaryGrade: 'V0' });
    const v8 = computeClimbGradeMetrics({ primaryGrade: 'V8' });
    assert.ok(v8.difficultyRank > v0.difficultyRank);

    const yds59 = computeClimbGradeMetrics({ primaryGrade: '5.9' });
    const yds512a = computeClimbGradeMetrics({ primaryGrade: '5.12a' });
    assert.ok(yds512a.difficultyRank > yds59.difficultyRank);
});

test('applyPageMetadata updates title, description, url, image, and robots', () => {
    const metadata = [
        { name: 'title', content: 'Old' },
        { name: 'robots', content: 'index, follow' },
    ];
    applyPageMetadata(metadata, {
        title: 'FAQ | Wiki Bloc',
        description: 'Helpful FAQ',
        url: 'https://wiki-bloc.jkim.win/faq',
        image: 'https://wiki-bloc.jkim.win/og-image.png',
        robots: 'noindex, nofollow',
    });

    const get = (k) => metadata.find((m) => m.name === k)?.content;
    assert.equal(get('title'), 'FAQ | Wiki Bloc');
    assert.equal(get('og:title'), 'FAQ | Wiki Bloc');
    assert.equal(get('twitter:title'), 'FAQ | Wiki Bloc');
    assert.equal(get('description'), 'Helpful FAQ');
    assert.equal(get('og:url'), 'https://wiki-bloc.jkim.win/faq');
    assert.equal(get('og:image'), 'https://wiki-bloc.jkim.win/og-image.png');
    assert.equal(get('robots'), 'noindex, nofollow');
});

