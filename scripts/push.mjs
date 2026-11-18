import 'dotenv/config'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import { setupCollections } from './setup-openbeta-collections.mjs'

export const DEPLOY_EXCLUDE_PATTERNS = [
    'pb_data',
    'pb_data/**/*',
    'package.json',
    'bun.lock',
    'bun.lockb',
    'patches',
    'patches/**/*',
    '*.db',
    '*.db-shm',
    '*.db-wal',
    'tests',
    'tests/**/*',
    'test',
    'test/**/*',
    '**/tests/**',
    '**/test/**',
    '**/*.test.*',
    '**/*.spec.*',
]

export function buildPhioArgs(targetInstance, excludes = DEPLOY_EXCLUDE_PATTERNS) {
    return [
        'phio',
        'deploy',
        targetInstance,
        '-e',
        ...excludes,
    ]
}

const args = process.argv.slice(2)
const skipMigrate = args.includes('--skip-migrate') || args.includes('--skip-db')
const dryRun = args.includes('--dry-run')
const filteredArgs = args.filter((a) => !a.startsWith('--'))
const instanceName = filteredArgs[0] || process.env.PHIO_INSTANCE || 'my-blog'

if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) {
    console.error(
        `[ERROR] Invalid instance name: "${instanceName}". Only alphanumeric characters, dashes, and underscores are allowed.`
    )
    process.exit(1)
}

const INSTANCE_URLS = {
    'my-blog': process.env.PB_PROD_URL || 'https://wiki-bloc.jkim.win',
    'mlt-blog': process.env.MLT_BLOG_URL || 'https://mlt-blog.pockethost.io',
}

const targetUrl =
    process.env.PB_TARGET_URL ||
    INSTANCE_URLS[instanceName] ||
    `https://${instanceName}.pockethost.io`

const username = process.env.PB_TYPEGEN_USERNAME || process.env.PB_TYPEGEN_EMAIL
const password = process.env.PB_TYPEGEN_PASSWORD

export async function run() {
    console.log('='.repeat(60))
    console.log(`Push to Prod: [${instanceName}]`)
    console.log(`Target URL:   ${targetUrl}`)
    console.log('='.repeat(60))

    // Step 1: Database Schema Migration / Sync
    if (skipMigrate) {
        console.log('\n[1/2] Skipping database migration (--skip-migrate passed)')
    } else {
        console.log(`\n[1/2] Checking and updating database schema on ${targetUrl}...`)
        try {
            if (!username || !password) {
                console.warn(
                    '[WARN] Skipping remote schema sync: PB_TYPEGEN_USERNAME or PB_TYPEGEN_PASSWORD missing in .env'
                )
            } else {
                await setupCollections({
                    url: targetUrl,
                    username,
                    password,
                })
                console.log('  Remote database schema is verified and up-to-date.')
            }
        } catch (err) {
            console.error(
                '[ERROR] Remote database migration failed:',
                err?.response?.message || err?.message || err
            )
            console.error('Aborting deploy to prevent inconsistent state.')
            process.exit(1)
        }
    }

    // Step 2: Deploy code via phio deploy
    console.log(`\n[2/2] Deploying code to PocketHost (${instanceName})...`)
    const phioArgs = buildPhioArgs(instanceName)

    if (dryRun) {
        console.log('  [Dry Run] Would execute: npx ' + phioArgs.join(' '))
        console.log('\n' + '='.repeat(60))
        console.log(`[Dry Run] Push simulated successfully for ${targetUrl}`)
        console.log('='.repeat(60))
        if (isMainModule) {
            process.exit(0)
        }
        return
    }

    const deployResult = spawnSync('npx', phioArgs, {
        stdio: 'inherit',
        shell: process.platform === 'win32',
    })

    if (deployResult.status !== 0) {
        console.error(`\n[ERROR] Deployment failed with exit code ${deployResult.status}`)
        process.exit(deployResult.status || 1)
    }

    console.log('\n' + '='.repeat(60))
    console.log(`Push complete! Database and application are synced at ${targetUrl}`)
    console.log('='.repeat(60))
    if (isMainModule) {
        process.exit(0)
    }
}

let isMainModule = false
if (process.argv[1]) {
    try {
        isMainModule = fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])
    } catch {
        isMainModule = path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])
    }
}

if (isMainModule) {
    run()
        .then(() => {
            process.exit(0)
        })
        .catch((err) => {
            console.error('Fatal error during push:', err)
            process.exit(1)
        })
}
