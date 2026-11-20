import 'dotenv/config'
import { spawnSync } from 'child_process'
import { setupCollections } from './setup-openbeta-collections.mjs'

const args = process.argv.slice(2)
const skipMigrate = args.includes('--skip-migrate') || args.includes('--skip-db')
const dryRun = args.includes('--dry-run')
const filteredArgs = args.filter((a) => !a.startsWith('--'))
const instanceName = filteredArgs[0] || process.env.PHIO_INSTANCE || 'my-blog'

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

async function run() {
    console.log('='.repeat(60))
    console.log(`Push to Prod: [${instanceName}]`)
    console.log(`Target URL:   ${targetUrl}`)
    console.log('='.repeat(60))

    // Step 1: Build minified CSS
    console.log('\n[1/3] Building minified Tailwind CSS...')
    if (dryRun) {
        console.log('  [Dry Run] Would execute: npm run build')
    } else {
        const buildResult = spawnSync('npm', ['run', 'build'], {
            stdio: 'inherit',
            shell: true,
        })
        if (buildResult.status !== 0) {
            console.error(`\n[ERROR] CSS build failed with exit code ${buildResult.status}`)
            process.exit(buildResult.status || 1)
        }
    }

    // Step 2: Database Schema Migration / Sync
    if (skipMigrate) {
        console.log('\n[2/3] Skipping database migration (--skip-migrate passed)')
    } else {
        console.log(`\n[2/3] Checking and updating database schema on ${targetUrl}...`)
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

    // Step 3: Deploy code via phio deploy
    console.log(`\n[3/3] Deploying code to PocketHost (${instanceName})...`)
    if (dryRun) {
        console.log('  [Dry Run] Would execute: npx phio deploy ' + instanceName)
        console.log('\n' + '='.repeat(60))
        console.log(`[Dry Run] Push simulated successfully for ${targetUrl}`)
        console.log('='.repeat(60))
        return
    }
    const phioArgs = [
        'phio',
        'deploy',
        instanceName,
        '-e',
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
    ]

    const deployResult = spawnSync('npx', phioArgs, {
        stdio: 'inherit',
        shell: true,
    })

    if (deployResult.status !== 0) {
        console.error(`\n[ERROR] Deployment failed with exit code ${deployResult.status}`)
        process.exit(deployResult.status || 1)
    }

    console.log('\n' + '='.repeat(60))
    console.log(`Push complete! Database and application are synced at ${targetUrl}`)
    console.log('='.repeat(60))
}

run().catch((err) => {
    console.error('Fatal error during push:', err)
    process.exit(1)
})
