const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

test('npm run push exclusion configuration', async (t) => {
    // Dynamic import of scripts/push.mjs (ESM)
    const pushModule = await import('../scripts/push.mjs');
    const { DEPLOY_EXCLUDE_PATTERNS, buildPhioArgs } = pushModule;

    await t.test('DEPLOY_EXCLUDE_PATTERNS contains required test exclusions', () => {
        assert.ok(Array.isArray(DEPLOY_EXCLUDE_PATTERNS));

        const requiredExclusions = [
            'tests',
            'tests/**/*',
            'test',
            'test/**/*',
            '**/tests/**',
            '**/test/**',
            '**/*.test.*',
            '**/*.spec.*',
        ];

        for (const pattern of requiredExclusions) {
            assert.ok(
                DEPLOY_EXCLUDE_PATTERNS.includes(pattern),
                `DEPLOY_EXCLUDE_PATTERNS must include '${pattern}' to prevent test files from syncing`
            );
        }
    });

    await t.test('buildPhioArgs constructs arguments containing exclude patterns', () => {
        const args = buildPhioArgs('test-instance');
        assert.equal(args[0], 'phio');
        assert.equal(args[1], 'deploy');
        assert.equal(args[2], 'test-instance');
        assert.equal(args[3], '-e');

        const excludeSlice = args.slice(4);
        assert.ok(excludeSlice.includes('tests'));
        assert.ok(excludeSlice.includes('tests/**/*'));
        assert.ok(excludeSlice.includes('**/*.test.*'));
    });

    await t.test('multimatch excludes test files and preserves production files', async () => {
        const multimatchModule = await import('multimatch');
        const multimatch = multimatchModule.default;

        const testPaths = [
            'tests',
            'tests/',
            'tests/common.test.js',
            'tests/collection.test.js',
            'tests/push.test.js',
            'test/unit.spec.js',
            'pb_hooks/pages/utils/common.test.js',
            'pb_hooks/tests/sample.js',
        ];

        for (const p of testPaths) {
            const matches = multimatch([p], DEPLOY_EXCLUDE_PATTERNS, { matchBase: true, dot: true });
            assert.ok(
                matches.length > 0,
                `Path '${p}' should match exclude patterns and NOT be synced`
            );
        }

        const prodPaths = [
            'pb_hooks/pages/utils/common.js',
            'pb_hooks/pages/utils/pocket.js',
            'pb_hooks/main.pb.js',
            'pb_public/app.css',
        ];

        for (const p of prodPaths) {
            const matches = multimatch([p], DEPLOY_EXCLUDE_PATTERNS, { matchBase: true, dot: true });
            assert.equal(
                matches.length,
                0,
                `Production path '${p}' should NOT be excluded`
            );
        }
    });

    await t.test('dry-run execution outputs exclude arguments', () => {
        const rootDir = path.resolve(__dirname, '..');
        const result = spawnSync('node', ['scripts/push.mjs', 'my-blog', '--dry-run', '--skip-migrate'], {
            cwd: rootDir,
            encoding: 'utf-8',
        });

        assert.equal(result.status, 0);
        assert.ok(
            result.stdout.includes('npx phio deploy my-blog -e'),
            'Dry-run output should show phio deploy command with -e'
        );
        assert.ok(
            result.stdout.includes('tests tests/**/*'),
            'Dry-run output should show tests excluded'
        );
        assert.ok(
            result.stdout.includes('**/*.test.*'),
            'Dry-run output should show test wildcards excluded'
        );
    });

    await t.test('rejects malicious or invalid instance names to prevent injection', () => {
        const rootDir = path.resolve(__dirname, '..');
        const result = spawnSync('node', ['scripts/push.mjs', 'my-blog;rm -rf /', '--dry-run', '--skip-migrate'], {
            cwd: rootDir,
            encoding: 'utf-8',
        });

        assert.equal(result.status, 1);
        assert.ok(result.stderr.includes('Invalid instance name'));
    });

    await t.test('package.json scripts are properly configured', () => {
        const pkgJson = JSON.parse(
            fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8')
        );

        assert.equal(pkgJson.scripts.push, 'node scripts/push.mjs my-blog');
        assert.equal(pkgJson.scripts.push2, 'node scripts/push.mjs mlt-blog');
        assert.ok(pkgJson.scripts.test, 'package.json should have a "test" script');
        assert.ok(
            pkgJson.scripts['push:code'].includes('tests') &&
            pkgJson.scripts['push:code'].includes('**/*.test.*'),
            'push:code should also exclude test directories and patterns'
        );
    });
});
