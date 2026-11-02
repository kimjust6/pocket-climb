import 'dotenv/config'
import PocketBase from 'pocketbase'

const url = process.env.PB_TYPEGEN_URL || 'http://127.0.0.1:8090'
const username = process.env.PB_TYPEGEN_USERNAME || process.env.PB_TYPEGEN_EMAIL
const password = process.env.PB_TYPEGEN_PASSWORD
const OPENBETA_API = 'https://api.openbeta.io'

if (!username || !password) {
    console.error('Missing PB_TYPEGEN_USERNAME or PB_TYPEGEN_PASSWORD in .env')
    process.exit(1)
}

const pb = new PocketBase(url)
pb.autoCancellation(false)

// Featured destination UUIDs displayed on https://openbeta.io/ homepage
const FEATURED_DESTINATION_UUIDS = [
    // Canada
    'a354b580-870b-5444-9f11-2c0e78995841', // Squamish
    '4624f40a-b644-5256-9287-aa19002ce00f', // Powell River
    'a33bf360-9bf1-5d0f-b082-9ef3a51aa231', // Skaha
    '26913742-ffc5-5c8f-834b-7f0cd1b58d81', // The Bugaboos
    'fa6ebe07-759f-5a35-b715-c39bbb8424d2', // Lake Louise
    // Germany
    'f67770f6-9aba-52da-a597-c8738ffa56e4', // Plankenstein
    // South Africa
    '4ed6c976-ee02-564a-801e-20ccc10e6e26', // Rocklands
    // Arizona
    'f2591e24-8f94-5cb3-9f02-92bfe3f5cd61', // Mount Lemmon (Santa Catalina Mountains)
    '74a365ae-142f-5b24-8198-2ac56dfd2922', // Mount Lemmon (Catalina Highway)
    'acd5e4e7-2972-5435-a237-4cea3dffe6cb', // Queen Creek Canyon
    // California
    '58a4c1de-fc5b-5e0c-89ad-ab28ac59e4fe', // Bishop Area
    '5af729d8-71a6-5bc2-a925-0f9adf369f4e', // Central Joshua Tree
    '6e4088c3-20f4-5e36-a319-c539b3b72275', // Big Bear Lake Area
    '0dde3658-d0f7-5305-8f32-e15b35086518', // Owens River Gorge
    'bbf60ea4-d8bb-5949-a144-061868db1e5e', // Hidden Valley Area
    'ce6ec458-d8d0-5439-aa24-025a8a8ec2e4', // Tuolumne Meadows
    // Colorado
    'decc1251-4a67-52b9-b23f-3243e10e63d0', // Boulder (fallback handled if not found)
    'decc1251-4a67-52b9-b23f-3243e10e93d0', // Boulder
    '4246501c-a558-5494-8fdc-ef635bbb8bbb', // Unaweep Canyon
    'b9b123a7-fbea-5dff-81ca-bb33975aa143', // Nine Mile Hill
    'f4c2e930-325e-56ce-850c-ca86bed85c98', // Nine Mile Bouldering
    'b34b81ad-639b-5002-8b62-fcc081599499', // Golden
    'e519a674-a620-509c-9e86-a246f84a8e40', // Boulder Canyon
    '47053277-7738-5e02-b3b0-a0fc26a64b07', // Canon City
    'd0ca78b6-a3cb-517c-adee-d9c6f8c2d2d8', // Flatirons
    '8af5df63-9dd1-5fb2-9ef1-c3c3860494f5', // Clear Creek Canyon
    '7fea44a6-af9d-583e-9abc-274876289cd7', // Eldorado Canyon State Park
    '198facc2-f25b-5ee9-a386-df4e3c4c5ee2', // Shelf Road
    'f27f00b7-1968-5942-bffb-931b2cd00345', // Poudre Canyon
    // Kentucky
    '78da26bc-cd94-5ac8-8e1c-815f7f30a28b', // Red River Gorge
    // Massachusetts
    '2a40e704-cca6-5cd0-8b7d-404654e65186', // Lynn Woods
    // Nevada
    'bea6bf11-de53-5046-a5b4-b89217b7e9bc', // Red Rocks
    // New Hampshire
    'fdf16fa4-e20a-5cda-8c1b-dad225df6dce', // Rumney
    'f472e63d-9089-5206-ab16-8385450ac7a4', // Pawtuckaway
    // New York
    '14cd0edf-22b5-5cfe-881d-c4a21245b333', // The Gunks
    // Oregon
    'f3c655b6-9c95-597f-aaa6-fd7d8a4865ec', // Smith Rock
    // Rhode Island
    'da04f374-e87e-512a-af4a-0dff8754db36', // Lincoln Woods
    // South Dakota
    'fcb9c76c-57ba-50f2-aa2c-1b574137f473', // Needles Of Rushmore, The
    '3b48a6c3-f8e6-52f5-b57a-35a299fb1b7a', // Mount Rushmore National Memorial
    '72e16981-389a-5984-940d-40c1c28d0732', // Spearfish Canyon
    // Utah
    'e838736e-03de-5522-b170-850c7ffcb2ac', // Central Wasatch
    '007f1fc1-3268-5660-b397-b7543d332216', // Little Cottonwood Canyon
    'f166e672-4a52-56d3-94f1-14c876feb670', // Indian Creek
    '26a193ca-cb5e-5423-8ead-6db185433cfb', // Big Cottonwood Canyon
    'c6dbcb5f-af07-5552-b2a1-a98549545436', // Boulders - Little Cottonwood
    // Virginia
    '522337f4-f041-5101-b2a3-4603eebbf4b4', // Grayson Highlands State Park
    // Washington
    '04e395a7-b62f-5055-b5c3-e0a7b724df28', // Leavenworth
    '1a4b9fe5-403c-5a9c-b802-1d0ab5e68e1d', // Icicle Creek
    // West Virginia
    '8a004a82-852f-54ab-ad77-bcbed7774cb5', // New River Gorge, The
    '859a8442-3fbd-542b-98fd-0eb6b3d2d762', // New River Gorge Proper
    // Wisconsin
    '8c8a16c4-3fea-5c7c-b93d-f7b4f32d7b62', // Baraboo Range
    'bf4481e8-d698-5b5f-a46d-81f807c26d7d', // Devil's Lake
    '3f816201-d74f-56f0-b555-3a760031664b', // Devil's Lake Bouldering
    // Wyoming
    'b1166235-3328-5537-b5ed-92f406ea8495', // Lander Area
    '183fb1aa-8d3f-5bf1-b176-049cf356e744', // Vedauwoo
    '9abad566-2113-587e-95a5-b3abcfaa28ac', // Ten Sleep Canyon
]

async function gqlQuery(query, variables = {}, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await fetch(OPENBETA_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables }),
            })
            if (!res.ok) {
                throw new Error(`OpenBeta API HTTP ${res.status}`)
            }
            const json = await res.json()
            return json.data
        } catch (err) {
            if (attempt === retries) throw err
            await new Promise((r) => setTimeout(r, 1000 * attempt))
        }
    }
}

function mapOpenBetaAreaToPayload(area, overrides = {}) {
    const ancestors = Array.isArray(area.ancestors) ? area.ancestors : []
    const selfIndex = ancestors.indexOf(area.uuid)
    const defaultParentUuid =
        selfIndex > 0
            ? ancestors[selfIndex - 1]
            : ancestors.length >= 2
              ? ancestors[ancestors.length - 2]
              : ''

    return {
        openbetaUuid: area.uuid,
        openbetaId: area.id || area.metadata?.area_id || '',
        mpId: area.metadata?.mp_id || '',
        name: area.area_name || area.areaName || 'Unknown Area',
        shortCode: area.shortCode || '',
        parentUuid: overrides.parentUuid ?? defaultParentUuid,
        pathTokens: Array.isArray(area.pathTokens) ? area.pathTokens : [],
        ancestors,
        gradeContext: area.gradeContext || 'US',
        coordinates:
            typeof area.metadata?.lat === 'number' && typeof area.metadata?.lng === 'number'
                ? { lon: area.metadata.lng, lat: area.metadata.lat }
                : { lon: 0, lat: 0 },
        bbox: area.metadata?.bbox || null,
        leftRightIndex:
            typeof area.metadata?.leftRightIndex === 'number'
                ? area.metadata.leftRightIndex
                : -1,
        isDestination: Boolean(overrides.isDestination ?? area.metadata?.isDestination),
        isLeaf: Boolean(area.metadata?.leaf),
        isBoulder: Boolean(area.metadata?.isBoulder),
        totalClimbs: typeof area.totalClimbs === 'number' ? area.totalClimbs : 0,
        density: typeof area.density === 'number' ? area.density : 0,
        description: area.content?.description || '',
        areaLocation: area.content?.areaLocation || '',
        content: area.content || null,
        metadata: area.metadata || null,
        isDeleted: false,
        ...overrides,
    }
}

async function main() {
    await pb.collection('_superusers').authWithPassword(username, password)
    console.log(`Connected to PocketBase at ${url}`)

    // Load existing areas map by openbetaUuid -> record
    const existingRecords = await pb.collection('areas').getFullList()
    const uuidToRecord = new Map(existingRecords.map((r) => [r.openbetaUuid, r]))

    async function upsertAreaRecord(payload) {
        const existing = uuidToRecord.get(payload.openbetaUuid)
        if (existing) {
            const updated = await pb.collection('areas').update(existing.id, payload)
            uuidToRecord.set(payload.openbetaUuid, updated)
            return updated
        } else {
            const created = await pb.collection('areas').create(payload)
            uuidToRecord.set(payload.openbetaUuid, created)
            return created
        }
    }

    console.log('Fetching countries and regions from https://api.openbeta.io ...')
    const data = await gqlQuery(`{
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
            metadata {
                isDestination
                leaf
                isBoulder
                lat
                lng
                bbox
                leftRightIndex
                mp_id
                area_id
            }
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
                metadata {
                    isDestination
                    leaf
                    isBoulder
                    lat
                    lng
                    bbox
                    leftRightIndex
                    mp_id
                    area_id
                }
            }
        }
    }`)

    const activeCountries = (data?.countries || []).filter(
        (c) => c.totalClimbs > 0 && c.area_name !== 'Test Area 2014'
    )

    console.log(`Found ${activeCountries.length} active countries with climbs.`)

    // 1. Upsert all active countries (root areas: parentUuid = "")
    for (const country of activeCountries) {
        await upsertAreaRecord(
            mapOpenBetaAreaToPayload(country, {
                parentUuid: '',
                isDestination: false,
            })
        )
    }

    // 2. Upsert immediate children (US States + International top-level regions)
    for (const country of activeCountries) {
        const isUsa = country.area_name === 'USA' || country.shortCode === 'USA'
        const children = (country.children || []).filter(
            (ch) => ch.area_name !== 'Test Area 2014' && (isUsa || ch.totalClimbs > 0)
        )

        for (const child of children) {
            const childRecord = await upsertAreaRecord(
                mapOpenBetaAreaToPayload(child, {
                    parentUuid: country.uuid,
                    parent: uuidToRecord.get(country.uuid)?.id || null,
                    // For international countries outside Canada/Germany/South Africa,
                    // mark top climbing regions as destinations so they display under the country
                    isDestination:
                        !isUsa &&
                        !['CAN', 'DEU', 'ZAF'].includes(country.shortCode) &&
                        child.totalClimbs > 0,
                })
            )
            uuidToRecord.set(child.uuid, childRecord)
        }
    }

    // 3. Fetch & upsert all featured OpenBeta homepage destinations in batches
    console.log(`Fetching ${FEATURED_DESTINATION_UUIDS.length} featured climbing destinations...`)
    const batchSize = 10
    for (let i = 0; i < FEATURED_DESTINATION_UUIDS.length; i += batchSize) {
        const batch = FEATURED_DESTINATION_UUIDS.slice(i, i + batchSize)
        const aliasQueries = batch
            .map(
                (uuid, idx) => `
            dest_${idx}: area(uuid: "${uuid}") {
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
                metadata {
                    isDestination
                    leaf
                    isBoulder
                    lat
                    lng
                    bbox
                    leftRightIndex
                    mp_id
                    area_id
                }
            }`
            )
            .join('\n')

        try {
            const destData = await gqlQuery(`{ ${aliasQueries} }`)
            for (const key of Object.keys(destData || {})) {
                const area = destData[key]
                if (!area || !area.uuid) continue

                const ancestors = Array.isArray(area.ancestors) ? area.ancestors : []
                // For USA destinations: ancestors[0] is USA, ancestors[1] is the US State
                // For International destinations: ancestors[0] is the Country
                const isUsaDest = area.pathTokens?.[0] === 'USA'
                const logicalParentUuid = isUsaDest
                    ? ancestors[1] || ancestors[0] || ''
                    : ancestors[0] || ''
                const parentRecord = uuidToRecord.get(logicalParentUuid)

                await upsertAreaRecord(
                    mapOpenBetaAreaToPayload(area, {
                        parentUuid: logicalParentUuid,
                        parent: parentRecord?.id || null,
                        isDestination: true,
                    })
                )
            }
        } catch (err) {
            console.warn(`Warning fetching batch starting at ${i}:`, err.message)
        }
    }

    console.log(`Seeded ${uuidToRecord.size} total areas into PocketBase!`)
}

main().catch((err) => {
    console.error('Failed to seed OpenBeta locations:', err)
    process.exit(1)
})
