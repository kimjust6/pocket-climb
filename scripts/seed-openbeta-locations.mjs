import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const OPENBETA_API = 'https://api.openbeta.io'
const DB_PATH = path.resolve(process.cwd(), 'pb_data/data.db')

const FEATURED_DESTINATION_UUIDS = [
    // Canada
    'a354b580-870b-5444-9f11-2c0e78995841', // Squamish
    '4624f40a-b644-5256-9287-aa19002ce00f', // Powell River
    'a33bf360-9bf1-5d0f-b082-9ef3a51aa231', // Skaha
    '26913742-ffc5-5c8f-834b-7f0cd1b58d81', // The Bugaboos
    'fa6ebe07-759f-5a35-b715-c39bbb8424d2', // Lake Louise
    'c63302da-5ca4-56f4-ac7f-cedda47a3b96', // Ontario South Bouldering and Rock
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

// Destinations to deeply crawl (3 levels of sub-areas + all climbs, pitches, media, and ticks)
const DEEP_CLIMB_SEED_UUIDS = [
    'c63302da-5ca4-56f4-ac7f-cedda47a3b96', // Ontario South Bouldering and Rock
    'a354b580-870b-5444-9f11-2c0e78995841', // Squamish
    'a33bf360-9bf1-5d0f-b082-9ef3a51aa231', // Skaha
    'fa6ebe07-759f-5a35-b715-c39bbb8424d2', // Lake Louise
    '4624f40a-b644-5256-9287-aa19002ce00f', // Powell River
    '26913742-ffc5-5c8f-834b-7f0cd1b58d81', // The Bugaboos
    'f67770f6-9aba-52da-a597-c8738ffa56e4', // Plankenstein (Germany)
    '4ed6c976-ee02-564a-801e-20ccc10e6e26', // Rocklands (South Africa)
    'f3c655b6-9c95-597f-aaa6-fd7d8a4865ec', // Smith Rock
    '78da26bc-cd94-5ac8-8e1c-815f7f30a28b', // Red River Gorge
    'fdf16fa4-e20a-5cda-8c1b-dad225df6dce', // Rumney
    '14cd0edf-22b5-5cfe-881d-c4a21245b333', // The Gunks
    '0dde3658-d0f7-5305-8f32-e15b35086518', // Owens River Gorge
    'ce6ec458-d8d0-5439-aa24-025a8a8ec2e4', // Tuolumne Meadows
    '7fea44a6-af9d-583e-9abc-274876289cd7', // Eldorado Canyon State Park
    '198facc2-f25b-5ee9-a386-df4e3c4c5ee2', // Shelf Road
    'f166e672-4a52-56d3-94f1-14c876feb670', // Indian Creek
    '1a4b9fe5-403c-5a9c-b802-1d0ab5e68e1d', // Icicle Creek
    '859a8442-3fbd-542b-98fd-0eb6b3d2d762', // New River Gorge Proper
    '9abad566-2113-587e-95a5-b3abcfaa28ac', // Ten Sleep Canyon
]

const DEEP_AREA_QUERY = `
fragment ClimbFields on Climb {
    id
    uuid
    name
    fa
    length
    boltsCount
    safety
    gradeContext
    grades { vscale yds ewbank french brazilianCrux font uiaa wi }
    type { trad sport bouldering deepwatersolo alpine snow ice mixed aid tr }
    metadata { lat lng leftRightIndex mp_id climb_id }
    content { description location protection }
    pathTokens
    ancestors
    authorMetadata { createdAt createdBy createdByUser updatedAt updatedBy updatedByUser }
    pitches {
        id
        parentId
        pitchNumber
        length
        boltsCount
        description
        grades { vscale yds ewbank french brazilianCrux font uiaa wi }
        type { trad sport bouldering deepwatersolo alpine snow ice mixed aid tr }
    }
    media {
        id
        username
        mediaUrl
        width
        height
        format
        uploadTime
        size
        user { userUuid username displayName bio website avatar }
        entityTags { id targetId climbName areaName ancestors type lng lat topoData }
    }
    ticks {
        _id
        userId
        name
        notes
        climbId
        style
        attemptType
        dateClimbed
        grade
        source
        user { userUuid username displayName bio website avatar }
    }
}

fragment AreaFields on Area {
    id
    uuid
    area_name
    shortCode
    totalClimbs
    density
    pathTokens
    ancestors
    pathHash
    gradeContext
    content { description areaLocation }
    metadata { isDestination leaf isBoulder lat lng bbox polygon leftRightIndex mp_id area_id }
    authorMetadata { createdAt createdBy createdByUser updatedAt updatedBy updatedByUser }
    aggregate {
        byGrade { count label }
        byGradeBand { unknown beginner intermediate advanced expert }
    }
}

query GetAreaDeep($uuid: ID!) {
    area(uuid: $uuid) {
        ...AreaFields
        climbs { ...ClimbFields }
        children {
            ...AreaFields
            climbs { ...ClimbFields }
            children {
                ...AreaFields
                climbs { ...ClimbFields }
                children {
                    ...AreaFields
                    climbs { ...ClimbFields }
                }
            }
        }
    }
}
`

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
            if (json.errors && !json.data) {
                throw new Error(json.errors[0]?.message || 'GraphQL error')
            }
            return json.data
        } catch (err) {
            if (attempt === retries) throw err
            await new Promise((r) => setTimeout(r, 1000 * attempt))
        }
    }
}

async function main() {
    const featuredSet = new Set(FEATURED_DESTINATION_UUIDS)
    const collectedAreas = new Map()
    const collectedClimbs = new Map()
    const collectedPitches = []
    const collectedMedia = new Map()
    const collectedTicks = new Map()
    let organizationsList = []

    function registerArea(area, parentUuidOverride = null, forceDestination = false) {
        if (!area || !area.uuid || area.area_name === 'Test Area 2014') return
        const existing = collectedAreas.get(area.uuid)
        const ancestors = Array.isArray(area.ancestors) ? area.ancestors : existing?.ancestors || []
        const selfIdx = ancestors.indexOf(area.uuid)
        const derivedParent =
            selfIdx > 0
                ? ancestors[selfIdx - 1]
                : ancestors.length >= 2
                  ? ancestors[ancestors.length - 2]
                  : ''
        const parentUuid =
            parentUuidOverride !== null
                ? parentUuidOverride
                : existing?.parentUuid || derivedParent

        collectedAreas.set(area.uuid, {
            uuid: area.uuid,
            id: area.id || area.metadata?.area_id || existing?.id || '',
            mpId: area.metadata?.mp_id || existing?.mpId || '',
            name: area.area_name || area.areaName || existing?.name || 'Unknown Area',
            shortCode: area.shortCode || existing?.shortCode || '',
            parentUuid,
            pathTokens: Array.isArray(area.pathTokens) ? area.pathTokens : existing?.pathTokens || [],
            ancestors,
            pathHash: area.pathHash || existing?.pathHash || '',
            gradeContext: area.gradeContext || existing?.gradeContext || 'US',
            lat: typeof area.metadata?.lat === 'number' ? area.metadata.lat : existing?.lat ?? 0,
            lng: typeof area.metadata?.lng === 'number' ? area.metadata.lng : existing?.lng ?? 0,
            bbox: area.metadata?.bbox || existing?.bbox || null,
            polygon: area.metadata?.polygon || existing?.polygon || null,
            leftRightIndex:
                typeof area.metadata?.leftRightIndex === 'number'
                    ? area.metadata.leftRightIndex
                    : existing?.leftRightIndex ?? -1,
            isDestination: Boolean(
                forceDestination ||
                    featuredSet.has(area.uuid) ||
                    existing?.isDestination ||
                    area.metadata?.isDestination
            ),
            isLeaf: Boolean(area.metadata?.leaf ?? existing?.isLeaf),
            isBoulder: Boolean(area.metadata?.isBoulder ?? existing?.isBoulder),
            totalClimbs:
                typeof area.totalClimbs === 'number'
                    ? area.totalClimbs
                    : existing?.totalClimbs ?? 0,
            density: typeof area.density === 'number' ? area.density : existing?.density ?? 0,
            description: area.content?.description || existing?.description || '',
            areaLocation: area.content?.areaLocation || existing?.areaLocation || '',
            aggregate: area.aggregate || existing?.aggregate || null,
            content: area.content || existing?.content || null,
            metadata: area.metadata || existing?.metadata || null,
            authorMetadata: area.authorMetadata || existing?.authorMetadata || null,
            createdByUser:
                area.authorMetadata?.createdByUser || existing?.createdByUser || '',
            updatedByUser:
                area.authorMetadata?.updatedByUser || existing?.updatedByUser || '',
        })
    }

    function walkAreaTree(node, parentUuid = null) {
        if (!node || !node.uuid) return
        registerArea(node, parentUuid)

        for (const climb of node.climbs || []) {
            if (!climb || !climb.uuid) continue
            collectedClimbs.set(climb.uuid, {
                ...climb,
                areaUuid: node.uuid,
            })

            for (const pitch of climb.pitches || []) {
                if (!pitch) continue
                collectedPitches.push({
                    ...pitch,
                    climbUuid: climb.uuid,
                })
            }

            for (const m of climb.media || []) {
                if (!m || !m.id) continue
                collectedMedia.set(m.id, {
                    ...m,
                    climbUuid: climb.uuid,
                    areaUuid: node.uuid,
                })
            }

            for (const t of climb.ticks || []) {
                if (!t || !t._id) continue
                collectedTicks.set(t._id, {
                    ...t,
                    climbUuid: climb.uuid,
                })
            }
        }

        for (const child of node.children || []) {
            walkAreaTree(child, node.uuid)
        }
    }

    // 1. Fetch Countries + US States + Top International Regions + Organizations
    console.log('1/4 Fetching countries, US states, and climbing organizations from OpenBeta...')
    const rootData = await gqlQuery(`{
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
                metadata { isDestination leaf isBoulder lat lng bbox leftRightIndex mp_id area_id }
            }
        }
        organizations {
            id
            orgId
            orgType
            displayName
            associatedAreaIds
            excludedAreaIds
            content {
                website
                email
                donationLink
                instagramLink
                facebookLink
                hardwareReportLink
                description
            }
            createdAt
            createdBy
            updatedAt
            updatedBy
        }
    }`)

    organizationsList = rootData?.organizations || []
    const activeCountries = (rootData?.countries || []).filter(
        (c) => c.totalClimbs > 0 && c.area_name !== 'Test Area 2014'
    )

    for (const country of activeCountries) {
        registerArea(country, '', false)
        const isUsa = country.area_name === 'USA' || country.shortCode === 'USA'
        for (const child of country.children || []) {
            if (child.area_name === 'Test Area 2014') continue
            if (!isUsa && (!child.totalClimbs || child.totalClimbs <= 0)) continue
            const isIntlDest =
                !isUsa && !['CAN', 'DEU', 'ZAF'].includes(country.shortCode) && child.totalClimbs > 0
            registerArea(child, country.uuid, isIntlDest)
        }
    }

    // 2. Fetch Featured Homepage Destinations
    console.log(`2/4 Fetching ${FEATURED_DESTINATION_UUIDS.length} featured destinations...`)
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
                pathHash
                gradeContext
                content { description areaLocation }
                metadata { isDestination leaf isBoulder lat lng bbox polygon leftRightIndex mp_id area_id }
                authorMetadata { createdAt createdBy createdByUser updatedAt updatedBy updatedByUser }
                aggregate {
                    byGrade { count label }
                    byGradeBand { unknown beginner intermediate advanced expert }
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
                const isUsaDest = area.pathTokens?.[0] === 'USA'
                const homepageParentUuid = isUsaDest
                    ? ancestors[1] || ancestors[0] || ''
                    : ancestors[0] || ''
                registerArea(area, homepageParentUuid, true)
            }
        } catch (err) {
            console.warn(`Warning on destination batch ${i}:`, err.message)
        }
    }

    // 3. Deep crawl sub-areas, crags, climbs, pitches, media, and ticks sequentially to avoid OpenBeta 504s
    console.log(`3/4 Deep crawling ${DEEP_CLIMB_SEED_UUIDS.length} climbing regions for climbs, pitches, media & ticks...`)
    for (let i = 0; i < DEEP_CLIMB_SEED_UUIDS.length; i++) {
        const uuid = DEEP_CLIMB_SEED_UUIDS[i]
        try {
            const deepData = await gqlQuery(DEEP_AREA_QUERY, { uuid })
            if (deepData?.area) {
                const rootArea = deepData.area
                const existing = collectedAreas.get(rootArea.uuid)
                walkAreaTree(rootArea, existing?.parentUuid ?? null)
                console.log(
                    `  [${i + 1}/${DEEP_CLIMB_SEED_UUIDS.length}] ${rootArea.area_name}: total areas=${collectedAreas.size}, climbs=${collectedClimbs.size}, pitches=${collectedPitches.length}, media=${collectedMedia.size}, ticks=${collectedTicks.size}`
                )
            }
        } catch (err) {
            console.warn(`  Warning crawling ${uuid}:`, err.message)
        }
    }

    // 4. Write everything to SQLite in a single fast transaction
    console.log('4/4 Persisting all records into pb_data/data.db...')
    const dumpPath = '/tmp/openbeta_seed_payload.json'
    fs.writeFileSync(
        dumpPath,
        JSON.stringify({
            areas: Array.from(collectedAreas.values()),
            climbs: Array.from(collectedClimbs.values()),
            pitches: collectedPitches,
            media: Array.from(collectedMedia.values()),
            ticks: Array.from(collectedTicks.values()),
            organizations: organizationsList,
        })
    )

    const pyRes = spawnSync(
        'python3',
        [
            '-c',
            `
import sqlite3, json, secrets, datetime

db_path = ${JSON.stringify(DB_PATH)}
with open('/tmp/openbeta_seed_payload.json', 'r') as f:
    payload = json.load(f)

conn = sqlite3.connect(db_path)
cur = conn.cursor()
now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S.000Z')

def gen_id():
    return 'r' + secrets.token_hex(7)

# Map existing openbetaUuid -> id
area_uuid_to_id = dict(cur.execute("SELECT openbetaUuid, id FROM areas").fetchall())
climb_uuid_to_id = dict(cur.execute("SELECT openbetaUuid, id FROM climbs").fetchall())
org_id_to_id = dict(cur.execute("SELECT orgId, id FROM organizations").fetchall())
media_ob_to_id = dict(cur.execute("SELECT openbetaId, id FROM climb_media WHERE openbetaId != ''").fetchall())
tick_ob_to_id = dict(cur.execute("SELECT openbetaId, id FROM ticks WHERE openbetaId != ''").fetchall())
pitch_ob_to_id = dict(cur.execute("SELECT openbetaId, id FROM pitches WHERE openbetaId != ''").fetchall())

# Pre-assign IDs for all areas so parent relations resolve in a single pass
for a in (payload.get('areas') or []):
    if not a or not a.get('uuid'):
        continue
    if a['uuid'] not in area_uuid_to_id:
        area_uuid_to_id[a['uuid']] = gen_id()

for a in (payload.get('areas') or []):
    if not a or not a.get('uuid'):
        continue
    rec_id = area_uuid_to_id[a['uuid']]
    parent_id = area_uuid_to_id.get(a.get('parentUuid') or '', '')
    coords = json.dumps({'lon': float(a.get('lng') or 0), 'lat': float(a.get('lat') or 0)})
    cur.execute("""
        INSERT INTO areas (
            id, openbetaUuid, openbetaId, mpId, name, shortCode, parent, parentUuid,
            pathTokens, ancestors, pathHash, gradeContext, coordinates, bbox, polygon,
            leftRightIndex, isDestination, isLeaf, isBoulder, totalClimbs, density,
            description, areaLocation, aggregate, content, metadata, authorMetadata,
            createdByUser, updatedByUser, isDeleted, created, updated
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, 0, ?, ?
        )
        ON CONFLICT(openbetaUuid) DO UPDATE SET
            openbetaId=excluded.openbetaId,
            mpId=excluded.mpId,
            name=excluded.name,
            shortCode=excluded.shortCode,
            parent=excluded.parent,
            parentUuid=excluded.parentUuid,
            pathTokens=excluded.pathTokens,
            ancestors=excluded.ancestors,
            pathHash=excluded.pathHash,
            gradeContext=excluded.gradeContext,
            coordinates=excluded.coordinates,
            bbox=excluded.bbox,
            polygon=excluded.polygon,
            leftRightIndex=excluded.leftRightIndex,
            isDestination=excluded.isDestination,
            isLeaf=excluded.isLeaf,
            isBoulder=excluded.isBoulder,
            totalClimbs=excluded.totalClimbs,
            density=excluded.density,
            description=CASE WHEN excluded.description != '' THEN excluded.description ELSE areas.description END,
            areaLocation=CASE WHEN excluded.areaLocation != '' THEN excluded.areaLocation ELSE areas.areaLocation END,
            aggregate=COALESCE(excluded.aggregate, areas.aggregate),
            content=COALESCE(excluded.content, areas.content),
            metadata=COALESCE(excluded.metadata, areas.metadata),
            authorMetadata=COALESCE(excluded.authorMetadata, areas.authorMetadata),
            createdByUser=CASE WHEN excluded.createdByUser != '' THEN excluded.createdByUser ELSE areas.createdByUser END,
            updatedByUser=CASE WHEN excluded.updatedByUser != '' THEN excluded.updatedByUser ELSE areas.updatedByUser END,
            updated=excluded.updated
    """, (
        rec_id,
        a['uuid'],
        str(a.get('id') or ''),
        str(a.get('mpId') or ''),
        str(a.get('name') or 'Unknown Area'),
        str(a.get('shortCode') or ''),
        parent_id,
        str(a.get('parentUuid') or ''),
        json.dumps(a.get('pathTokens') or []),
        json.dumps(a.get('ancestors') or []),
        str(a.get('pathHash') or ''),
        str(a.get('gradeContext') or 'US'),
        coords,
        json.dumps(a['bbox']) if a.get('bbox') is not None else None,
        json.dumps(a['polygon']) if a.get('polygon') is not None else None,
        int(a.get('leftRightIndex') if a.get('leftRightIndex') is not None else -1),
        1 if a.get('isDestination') else 0,
        1 if a.get('isLeaf') else 0,
        1 if a.get('isBoulder') else 0,
        int(a.get('totalClimbs') or 0),
        float(a.get('density') or 0),
        str(a.get('description') or ''),
        str(a.get('areaLocation') or ''),
        json.dumps(a['aggregate']) if a.get('aggregate') is not None else None,
        json.dumps(a['content']) if a.get('content') is not None else None,
        json.dumps(a['metadata']) if a.get('metadata') is not None else None,
        json.dumps(a['authorMetadata']) if a.get('authorMetadata') is not None else None,
        str(a.get('createdByUser') or ''),
        str(a.get('updatedByUser') or ''),
        now,
        now
    ))

# Upsert climbs
disc_keys = ['trad', 'sport', 'bouldering', 'deepwatersolo', 'alpine', 'snow', 'ice', 'mixed', 'aid', 'tr']
for c in (payload.get('climbs') or []):
    if not c or not c.get('uuid'):
        continue
    c_uuid = c['uuid']
    if c_uuid not in climb_uuid_to_id:
        climb_uuid_to_id[c_uuid] = gen_id()
    rec_id = climb_uuid_to_id[c_uuid]
    area_uuid = str(c.get('areaUuid') or '')
    area_id = area_uuid_to_id.get(area_uuid, '')
    meta = c.get('metadata') or {}
    grades = c.get('grades') or {}
    t_obj = c.get('type') or {}
    content = c.get('content') or {}
    author = c.get('authorMetadata') or {}
    active_discs = [k for k in disc_keys if t_obj.get(k)]
    coords = json.dumps({'lon': float(meta.get('lng') or 0), 'lat': float(meta.get('lat') or 0)})
    pitches_list = c.get('pitches') or []
    pitches_count = len(pitches_list) if len(pitches_list) > 0 else 1

    cur.execute("""
        INSERT INTO climbs (
            id, openbetaUuid, openbetaId, mpId, name, area, areaUuid,
            fa, length, boltsCount, pitchesCount, safety, gradeContext,
            gradeYds, gradeVscale, gradeFont, gradeFrench, gradeEwbank,
            gradeBrazilianCrux, gradeUiaa, gradeWi, disciplines,
            isTrad, isSport, isBouldering, isTr, isAlpine, isIce, isMixed, isAid, isDeepwatersolo, isSnow,
            coordinates, leftRightIndex, description, location, protection,
            pathTokens, ancestors, grades, type, content, metadata, authorMetadata,
            createdByUser, updatedByUser, isDeleted, created, updated
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, 0, ?, ?
        )
        ON CONFLICT(openbetaUuid) DO UPDATE SET
            name=excluded.name,
            area=excluded.area,
            areaUuid=excluded.areaUuid,
            fa=excluded.fa,
            length=excluded.length,
            boltsCount=excluded.boltsCount,
            pitchesCount=excluded.pitchesCount,
            safety=excluded.safety,
            gradeYds=excluded.gradeYds,
            gradeVscale=excluded.gradeVscale,
            gradeFont=excluded.gradeFont,
            gradeFrench=excluded.gradeFrench,
            gradeEwbank=excluded.gradeEwbank,
            gradeBrazilianCrux=excluded.gradeBrazilianCrux,
            gradeUiaa=excluded.gradeUiaa,
            gradeWi=excluded.gradeWi,
            disciplines=excluded.disciplines,
            isTrad=excluded.isTrad,
            isSport=excluded.isSport,
            isBouldering=excluded.isBouldering,
            isTr=excluded.isTr,
            isAlpine=excluded.isAlpine,
            isIce=excluded.isIce,
            isMixed=excluded.isMixed,
            isAid=excluded.isAid,
            isDeepwatersolo=excluded.isDeepwatersolo,
            isSnow=excluded.isSnow,
            coordinates=excluded.coordinates,
            leftRightIndex=excluded.leftRightIndex,
            description=excluded.description,
            location=excluded.location,
            protection=excluded.protection,
            grades=excluded.grades,
            type=excluded.type,
            content=excluded.content,
            metadata=excluded.metadata,
            authorMetadata=excluded.authorMetadata,
            createdByUser=excluded.createdByUser,
            updatedByUser=excluded.updatedByUser,
            updated=excluded.updated
    """, (
        rec_id,
        c_uuid,
        str(c.get('id') or meta.get('climb_id') or ''),
        str(meta.get('mp_id') or ''),
        str(c.get('name') or 'Unnamed Climb'),
        area_id,
        area_uuid,
        str(c.get('fa') or ''),
        int(c.get('length') or 0),
        int(c.get('boltsCount') or 0),
        pitches_count,
        str(c.get('safety') or 'UNSPECIFIED'),
        str(c.get('gradeContext') or 'US'),
        str(grades.get('yds') or ''),
        str(grades.get('vscale') or ''),
        str(grades.get('font') or ''),
        str(grades.get('french') or ''),
        str(grades.get('ewbank') or ''),
        str(grades.get('brazilianCrux') or ''),
        str(grades.get('uiaa') or ''),
        str(grades.get('wi') or ''),
        json.dumps(active_discs),
        1 if t_obj.get('trad') else 0,
        1 if t_obj.get('sport') else 0,
        1 if t_obj.get('bouldering') else 0,
        1 if t_obj.get('tr') else 0,
        1 if t_obj.get('alpine') else 0,
        1 if t_obj.get('ice') else 0,
        1 if t_obj.get('mixed') else 0,
        1 if t_obj.get('aid') else 0,
        1 if t_obj.get('deepwatersolo') else 0,
        1 if t_obj.get('snow') else 0,
        coords,
        int(meta.get('leftRightIndex') if meta.get('leftRightIndex') is not None else -1),
        str(content.get('description') or ''),
        str(content.get('location') or ''),
        str(content.get('protection') or ''),
        json.dumps(c.get('pathTokens') or []),
        json.dumps(c.get('ancestors') or []),
        json.dumps(grades),
        json.dumps(t_obj),
        json.dumps(content),
        json.dumps(meta),
        json.dumps(author) if author else None,
        str(author.get('createdByUser') or ''),
        str(author.get('updatedByUser') or ''),
        now,
        now
    ))

# Upsert pitches
for p in (payload.get('pitches') or []):
    if not p:
        continue
    ob_id = str(p.get('id') or '')
    if not ob_id:
        continue
    rec_id = pitch_ob_to_id.get(ob_id) or gen_id()
    pitch_ob_to_id[ob_id] = rec_id
    climb_uuid = str(p.get('climbUuid') or p.get('parentId') or '')
    climb_id = climb_uuid_to_id.get(climb_uuid, '')
    if not climb_id:
        continue
    grades = p.get('grades') or {}
    t_obj = p.get('type') or {}
    active_discs = [k for k in disc_keys if t_obj.get(k)]
    cur.execute("""
        INSERT OR REPLACE INTO pitches (
            id, openbetaId, climb, parentUuid, pitchNumber, length, boltsCount,
            gradeYds, gradeVscale, gradeFont, gradeFrench, gradeEwbank,
            gradeBrazilianCrux, gradeUiaa, gradeWi, disciplines,
            description, grades, type, isDeleted, created, updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    """, (
        rec_id,
        ob_id,
        climb_id,
        climb_uuid,
        int(p.get('pitchNumber') or 1),
        int(p.get('length') or 0),
        int(p.get('boltsCount') or 0),
        str(grades.get('yds') or ''),
        str(grades.get('vscale') or ''),
        str(grades.get('font') or ''),
        str(grades.get('french') or ''),
        str(grades.get('ewbank') or ''),
        str(grades.get('brazilianCrux') or ''),
        str(grades.get('uiaa') or ''),
        str(grades.get('wi') or ''),
        json.dumps(active_discs),
        str(p.get('description') or ''),
        json.dumps(grades),
        json.dumps(t_obj),
        now,
        now
    ))

# Upsert media
for m in (payload.get('media') or []):
    if not m:
        continue
    ob_id = str(m.get('id') or '')
    if not ob_id:
        continue
    rec_id = media_ob_to_id.get(ob_id) or gen_id()
    media_ob_to_id[ob_id] = rec_id
    climb_id = climb_uuid_to_id.get(str(m.get('climbUuid') or ''), '')
    area_id = area_uuid_to_id.get(str(m.get('areaUuid') or ''), '')
    user_prof = m.get('user') or {}
    cur.execute("""
        INSERT OR REPLACE INTO climb_media (
            id, openbetaId, mediaUrl, file, climb, area, user,
            username, userUuid, width, height, format, size, uploadTime,
            entityTags, userProfile, isDeleted, created, updated
        ) VALUES (?, ?, ?, '', ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    """, (
        rec_id,
        ob_id,
        str(m.get('mediaUrl') or ''),
        climb_id,
        area_id,
        str(m.get('username') or user_prof.get('username') or ''),
        str(user_prof.get('userUuid') or ''),
        int(m.get('width') or 0),
        int(m.get('height') or 0),
        str(m.get('format') or ''),
        int(m.get('size') or 0),
        str(m.get('uploadTime') or ''),
        json.dumps(m.get('entityTags') or []),
        json.dumps(user_prof) if user_prof else None,
        now,
        now
    ))

# Upsert ticks
for t in (payload.get('ticks') or []):
    if not t:
        continue
    ob_id = str(t.get('_id') or '')
    if not ob_id:
        continue
    rec_id = tick_ob_to_id.get(ob_id) or gen_id()
    tick_ob_to_id[ob_id] = rec_id
    climb_uuid = str(t.get('climbUuid') or t.get('climbId') or '')
    climb_id = climb_uuid_to_id.get(climb_uuid, '')
    user_prof = t.get('user') or {}
    cur.execute("""
        INSERT OR REPLACE INTO ticks (
            id, openbetaId, user, openbetaUserId, climb, climbUuid,
            name, dateClimbed, style, attemptType, grade, notes, source,
            userProfile, isDeleted, created, updated
        ) VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    """, (
        rec_id,
        ob_id,
        str(t.get('userId') or user_prof.get('userUuid') or ''),
        climb_id,
        climb_uuid,
        str(t.get('name') or ''),
        str(t.get('dateClimbed') or now),
        str(t.get('style') or ''),
        str(t.get('attemptType') or ''),
        str(t.get('grade') or ''),
        str(t.get('notes') or ''),
        str(t.get('source') or 'OB'),
        json.dumps(user_prof) if user_prof else None,
        now,
        now
    ))

# Upsert organizations
for org in (payload.get('organizations') or []):
    if not org:
        continue
    org_uuid = str(org.get('orgId') or '')
    if not org_uuid:
        continue
    rec_id = org_id_to_id.get(org_uuid) or gen_id()
    org_id_to_id[org_uuid] = rec_id
    assoc_uuids = org.get('associatedAreaIds') or []
    linked_area_ids = [area_uuid_to_id[u] for u in assoc_uuids if u in area_uuid_to_id]
    content = org.get('content') or {}
    author = {
        'createdAt': org.get('createdAt'),
        'createdBy': org.get('createdBy'),
        'updatedAt': org.get('updatedAt'),
        'updatedBy': org.get('updatedBy'),
    }
    cur.execute("""
        INSERT OR REPLACE INTO organizations (
            id, openbetaId, orgId, displayName, orgType, areas,
            associatedAreaIds, excludedAreaIds, website, email,
            donationLink, instagramLink, facebookLink, hardwareReportLink,
            description, content, authorMetadata, isDeleted, created, updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    """, (
        rec_id,
        str(org.get('id') or ''),
        org_uuid,
        str(org.get('displayName') or ''),
        str(org.get('orgType') or ''),
        json.dumps(linked_area_ids),
        json.dumps(assoc_uuids),
        json.dumps(org.get('excludedAreaIds') or []),
        str(content.get('website') or ''),
        str(content.get('email') or ''),
        str(content.get('donationLink') or ''),
        str(content.get('instagramLink') or ''),
        str(content.get('facebookLink') or ''),
        str(content.get('hardwareReportLink') or ''),
        str(content.get('description') or ''),
        json.dumps(content),
        json.dumps(author),
        now,
        now
    ))

conn.commit()
for tbl in ('areas', 'climbs', 'pitches', 'ticks', 'organizations', 'climb_media'):
    cnt = cur.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
    print(f"  {tbl}: {cnt} records")
`,
        ],
        { stdio: 'inherit' }
    )

    if (pyRes.status !== 0) {
        process.exit(pyRes.status ?? 1)
    }
    try {
        fs.unlinkSync(dumpPath)
    } catch (_) {}
    console.log('Successfully populated OpenBeta data!')
}

main().catch((err) => {
    console.error('Failed to populate OpenBeta data:', err)
    process.exit(1)
})
