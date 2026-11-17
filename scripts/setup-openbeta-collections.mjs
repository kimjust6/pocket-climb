import 'dotenv/config'
import PocketBase from 'pocketbase'

const defaultUrl = process.env.PB_TYPEGEN_URL || 'http://127.0.0.1:8090'
const defaultUsername = process.env.PB_TYPEGEN_USERNAME || process.env.PB_TYPEGEN_EMAIL
const defaultPassword = process.env.PB_TYPEGEN_PASSWORD

const DISCIPLINE_VALUES = [
    'trad',
    'sport',
    'bouldering',
    'deepwatersolo',
    'alpine',
    'snow',
    'ice',
    'mixed',
    'aid',
    'tr',
]

const SAFETY_VALUES = [
    'UNSPECIFIED',
    'PG',
    'PG13',
    'runout',
    'terrain',
    'R',
    'X',
]

const TICK_STYLE_VALUES = [
    'Lead',
    'Solo',
    'TR',
    'Follow',
    'Aid',
    'Boulder',
]

const TICK_ATTEMPT_VALUES = [
    'Onsight',
    'Flash',
    'Pinkpoint',
    'Frenchfree',
    'Attempt',
    'Send',
    'Redpoint',
    'Repeat',
]

const TICK_SOURCE_VALUES = ['OB', 'MP', 'Local']

const AUTODATE_FIELDS = [
    {
        name: 'created',
        type: 'autodate',
        onCreate: true,
        onUpdate: false,
    },
    {
        name: 'updated',
        type: 'autodate',
        onCreate: true,
        onUpdate: true,
    },
]

export async function setupCollections({
    url = defaultUrl,
    username = defaultUsername,
    password = defaultPassword,
} = {}) {
    if (!username || !password) {
        throw new Error('Missing PB_TYPEGEN_USERNAME or PB_TYPEGEN_PASSWORD')
    }

    const pb = new PocketBase(url)

    async function upsertCollection(name, schemaConfig) {
        let existing = null
        try {
            existing = await pb.collections.getOne(name)
        } catch (_) {
            existing = null
        }

        if (existing) {
            console.log(`  * Updating existing collection: ${name} (${existing.id})`)
            return await pb.collections.update(existing.id, schemaConfig)
        } else {
            console.log(`  * Creating new collection: ${name}`)
            return await pb.collections.create({
                name,
                type: 'base',
                listRule: '',
                viewRule: '',
                createRule: null,
                updateRule: null,
                deleteRule: null,
                ...schemaConfig,
            })
        }
    }

    await pb.collection('_superusers').authWithPassword(username, password)
    console.log(`Connected to PocketBase at ${url}`)

    // Remove legacy Zendesk collections if present
    const legacyZendeskCollections = [
        'zendesk_tickets',
        'zendeskuser_discorduser',
        'zendesk_organizations',
    ]
    for (const colName of legacyZendeskCollections) {
        try {
            const col = await pb.collections.getOne(colName)
            await pb.collections.delete(col.id)
            console.log(`  * Deleted legacy Zendesk collection: ${colName}`)
        } catch (_) {
            // Already removed
        }
    }

    const usersCol = await pb.collections.getOne('users')

    // 1. Create/Update `areas`
    const baseAreasFields = [
        { name: 'openbetaUuid', type: 'text', required: true },
        { name: 'openbetaId', type: 'text', required: false },
        { name: 'mpId', type: 'text', required: false },
        { name: 'name', type: 'text', required: true, presentable: true },
        { name: 'shortCode', type: 'text', required: false },
        { name: 'parentUuid', type: 'text', required: false },
        { name: 'pathTokens', type: 'json', required: false },
        { name: 'ancestors', type: 'json', required: false },
        { name: 'pathHash', type: 'text', required: false },
        { name: 'gradeContext', type: 'text', required: false },
        { name: 'coordinates', type: 'geoPoint', required: false },
        { name: 'bbox', type: 'json', required: false },
        { name: 'polygon', type: 'json', required: false },
        { name: 'leftRightIndex', type: 'number', onlyInt: true, required: false },
        { name: 'isDestination', type: 'bool', required: false },
        { name: 'isLeaf', type: 'bool', required: false },
        { name: 'isBoulder', type: 'bool', required: false },
        { name: 'totalClimbs', type: 'number', onlyInt: true, required: false },
        { name: 'density', type: 'number', required: false },
        { name: 'description', type: 'text', required: false },
        { name: 'areaLocation', type: 'text', required: false },
        { name: 'aggregate', type: 'json', required: false },
        { name: 'content', type: 'json', required: false },
        { name: 'metadata', type: 'json', required: false },
        { name: 'authorMetadata', type: 'json', required: false },
        { name: 'createdByUser', type: 'text', required: false },
        { name: 'updatedByUser', type: 'text', required: false },
        { name: 'isDeleted', type: 'bool', required: false },
        ...AUTODATE_FIELDS,
    ]

    let existingAreas = null
    try {
        existingAreas = await pb.collections.getOne('areas')
    } catch (_) {
        existingAreas = null
    }

    let areasColId = existingAreas?.id

    if (!existingAreas) {
        // Create initial areas collection without self-relation
        const createdAreas = await pb.collections.create({
            name: 'areas',
            type: 'base',
            listRule: '',
            viewRule: '',
            createRule: null,
            updateRule: null,
            deleteRule: null,
            fields: baseAreasFields,
            indexes: [
                'CREATE UNIQUE INDEX `idx_areas_openbetaUuid` ON `areas` (`openbetaUuid`)',
                'CREATE INDEX `idx_areas_name` ON `areas` (`name`)',
                'CREATE INDEX `idx_areas_isDestination` ON `areas` (`isDestination`)',
            ],
        })
        areasColId = createdAreas.id
        console.log(`  * Created initial areas collection (${areasColId})`)
    }

    // Configure self-referential `parent` relation on `areas` without dropping it if it already exists
    const areasWithParentFields = [
        ...baseAreasFields.slice(0, 5),
        {
            name: 'parent',
            type: 'relation',
            collectionId: areasColId,
            cascadeDelete: false,
            minSelect: 0,
            maxSelect: 1,
            required: false,
        },
        ...baseAreasFields.slice(5),
    ]

    const areasCol = await pb.collections.update(areasColId, {
        fields: areasWithParentFields,
        indexes: [
            'CREATE UNIQUE INDEX `idx_areas_openbetaUuid` ON `areas` (`openbetaUuid`)',
            'CREATE INDEX `idx_areas_name` ON `areas` (`name`)',
            'CREATE INDEX `idx_areas_parent` ON `areas` (`parent`)',
            'CREATE INDEX `idx_areas_isDestination` ON `areas` (`isDestination`)',
        ],
    })
    console.log(`  * Configured areas with parent relation (${areasCol.id})`)

    // 2. Create/Update `climbs`
    const climbsFields = [
        { name: 'openbetaUuid', type: 'text', required: true },
        { name: 'openbetaId', type: 'text', required: false },
        { name: 'mpId', type: 'text', required: false },
        { name: 'name', type: 'text', required: true, presentable: true },
        {
            name: 'area',
            type: 'relation',
            collectionId: areasCol.id,
            cascadeDelete: false,
            minSelect: 0,
            maxSelect: 1,
            required: false,
        },
        { name: 'areaUuid', type: 'text', required: false },
        { name: 'fa', type: 'text', required: false },
        { name: 'length', type: 'number', onlyInt: true, required: false },
        { name: 'boltsCount', type: 'number', onlyInt: true, required: false },
        { name: 'pitchesCount', type: 'number', onlyInt: true, required: false },
        {
            name: 'safety',
            type: 'select',
            maxSelect: 1,
            values: SAFETY_VALUES,
            required: false,
        },
        { name: 'gradeContext', type: 'text', required: false },
        { name: 'gradeYds', type: 'text', required: false },
        { name: 'gradeVscale', type: 'text', required: false },
        { name: 'gradeFont', type: 'text', required: false },
        { name: 'gradeFrench', type: 'text', required: false },
        { name: 'gradeEwbank', type: 'text', required: false },
        { name: 'gradeBrazilianCrux', type: 'text', required: false },
        { name: 'gradeUiaa', type: 'text', required: false },
        { name: 'gradeWi', type: 'text', required: false },
        {
            name: 'disciplines',
            type: 'select',
            maxSelect: DISCIPLINE_VALUES.length,
            values: DISCIPLINE_VALUES,
            required: false,
        },
        { name: 'isTrad', type: 'bool', required: false },
        { name: 'isSport', type: 'bool', required: false },
        { name: 'isBouldering', type: 'bool', required: false },
        { name: 'isTr', type: 'bool', required: false },
        { name: 'isAlpine', type: 'bool', required: false },
        { name: 'isIce', type: 'bool', required: false },
        { name: 'isMixed', type: 'bool', required: false },
        { name: 'isAid', type: 'bool', required: false },
        { name: 'isDeepwatersolo', type: 'bool', required: false },
        { name: 'isSnow', type: 'bool', required: false },
        { name: 'coordinates', type: 'geoPoint', required: false },
        { name: 'leftRightIndex', type: 'number', onlyInt: true, required: false },
        { name: 'description', type: 'text', required: false },
        { name: 'location', type: 'text', required: false },
        { name: 'protection', type: 'text', required: false },
        { name: 'pathTokens', type: 'json', required: false },
        { name: 'ancestors', type: 'json', required: false },
        { name: 'grades', type: 'json', required: false },
        { name: 'type', type: 'json', required: false },
        { name: 'content', type: 'json', required: false },
        { name: 'metadata', type: 'json', required: false },
        { name: 'authorMetadata', type: 'json', required: false },
        { name: 'createdByUser', type: 'text', required: false },
        { name: 'updatedByUser', type: 'text', required: false },
        { name: 'isDeleted', type: 'bool', required: false },
        ...AUTODATE_FIELDS,
    ]

    const climbsCol = await upsertCollection('climbs', {
        fields: climbsFields,
        indexes: [
            'CREATE UNIQUE INDEX `idx_climbs_openbetaUuid` ON `climbs` (`openbetaUuid`)',
            'CREATE INDEX `idx_climbs_name` ON `climbs` (`name`)',
            'CREATE INDEX `idx_climbs_area` ON `climbs` (`area`)',
            'CREATE INDEX `idx_climbs_gradeYds` ON `climbs` (`gradeYds`)',
            'CREATE INDEX `idx_climbs_gradeVscale` ON `climbs` (`gradeVscale`)',
        ],
    })

    // 3. Create/Update `pitches`
    const pitchesFields = [
        { name: 'openbetaId', type: 'text', required: false },
        {
            name: 'climb',
            type: 'relation',
            collectionId: climbsCol.id,
            cascadeDelete: true,
            minSelect: 0,
            maxSelect: 1,
            required: true,
        },
        { name: 'parentUuid', type: 'text', required: false },
        { name: 'pitchNumber', type: 'number', onlyInt: true, required: true, presentable: true },
        { name: 'length', type: 'number', onlyInt: true, required: false },
        { name: 'boltsCount', type: 'number', onlyInt: true, required: false },
        { name: 'gradeYds', type: 'text', required: false },
        { name: 'gradeVscale', type: 'text', required: false },
        { name: 'gradeFont', type: 'text', required: false },
        { name: 'gradeFrench', type: 'text', required: false },
        { name: 'gradeEwbank', type: 'text', required: false },
        { name: 'gradeBrazilianCrux', type: 'text', required: false },
        { name: 'gradeUiaa', type: 'text', required: false },
        { name: 'gradeWi', type: 'text', required: false },
        {
            name: 'disciplines',
            type: 'select',
            maxSelect: DISCIPLINE_VALUES.length,
            values: DISCIPLINE_VALUES,
            required: false,
        },
        { name: 'description', type: 'text', required: false },
        { name: 'grades', type: 'json', required: false },
        { name: 'type', type: 'json', required: false },
        { name: 'isDeleted', type: 'bool', required: false },
        ...AUTODATE_FIELDS,
    ]

    await upsertCollection('pitches', {
        fields: pitchesFields,
        indexes: [
            'CREATE UNIQUE INDEX `idx_pitches_openbetaId` ON `pitches` (`openbetaId`) WHERE `openbetaId` != ""',
            'CREATE INDEX `idx_pitches_climb_number` ON `pitches` (`climb`, `pitchNumber`)',
        ],
    })

    // 4. Create/Update `ticks`
    const ticksFields = [
        { name: 'openbetaId', type: 'text', required: false },
        {
            name: 'user',
            type: 'relation',
            collectionId: usersCol.id,
            cascadeDelete: false,
            minSelect: 0,
            maxSelect: 1,
            required: false,
        },
        { name: 'openbetaUserId', type: 'text', required: false },
        {
            name: 'climb',
            type: 'relation',
            collectionId: climbsCol.id,
            cascadeDelete: false,
            minSelect: 0,
            maxSelect: 1,
            required: false,
        },
        { name: 'climbUuid', type: 'text', required: false },
        { name: 'name', type: 'text', required: false, presentable: true },
        { name: 'dateClimbed', type: 'date', required: true },
        {
            name: 'style',
            type: 'select',
            maxSelect: 1,
            values: TICK_STYLE_VALUES,
            required: false,
        },
        {
            name: 'attemptType',
            type: 'select',
            maxSelect: 1,
            values: TICK_ATTEMPT_VALUES,
            required: false,
        },
        { name: 'grade', type: 'text', required: false },
        { name: 'notes', type: 'text', required: false },
        {
            name: 'source',
            type: 'select',
            maxSelect: 1,
            values: TICK_SOURCE_VALUES,
            required: false,
        },
        { name: 'userProfile', type: 'json', required: false },
        { name: 'isDeleted', type: 'bool', required: false },
        ...AUTODATE_FIELDS,
    ]

    await upsertCollection('ticks', {
        fields: ticksFields,
        indexes: [
            'CREATE UNIQUE INDEX `idx_ticks_openbetaId` ON `ticks` (`openbetaId`) WHERE `openbetaId` != ""',
            'CREATE INDEX `idx_ticks_user` ON `ticks` (`user`)',
            'CREATE INDEX `idx_ticks_climb` ON `ticks` (`climb`)',
            'CREATE INDEX `idx_ticks_dateClimbed` ON `ticks` (`dateClimbed`)',
        ],
    })

    // 5. Create/Update `organizations`
    const organizationsFields = [
        { name: 'openbetaId', type: 'text', required: false },
        { name: 'orgId', type: 'text', required: true },
        { name: 'displayName', type: 'text', required: true, presentable: true },
        { name: 'orgType', type: 'text', required: false },
        {
            name: 'areas',
            type: 'relation',
            collectionId: areasCol.id,
            cascadeDelete: false,
            minSelect: 0,
            maxSelect: 999,
            required: false,
        },
        { name: 'associatedAreaIds', type: 'json', required: false },
        { name: 'excludedAreaIds', type: 'json', required: false },
        { name: 'website', type: 'url', required: false },
        { name: 'email', type: 'email', required: false },
        { name: 'donationLink', type: 'url', required: false },
        { name: 'instagramLink', type: 'url', required: false },
        { name: 'facebookLink', type: 'url', required: false },
        { name: 'hardwareReportLink', type: 'url', required: false },
        { name: 'description', type: 'text', required: false },
        { name: 'content', type: 'json', required: false },
        { name: 'authorMetadata', type: 'json', required: false },
        { name: 'isDeleted', type: 'bool', required: false },
        ...AUTODATE_FIELDS,
    ]

    await upsertCollection('organizations', {
        fields: organizationsFields,
        indexes: [
            'CREATE UNIQUE INDEX `idx_organizations_orgId` ON `organizations` (`orgId`)',
            'CREATE INDEX `idx_organizations_displayName` ON `organizations` (`displayName`)',
        ],
    })

    // 6. Create/Update `climb_media`
    const climbMediaFields = [
        { name: 'openbetaId', type: 'text', required: false },
        { name: 'mediaUrl', type: 'text', required: true, presentable: true },
        { name: 'originalUrl', type: 'text', required: false },
        {
            name: 'file',
            type: 'file',
            maxSelect: 1,
            maxSize: 52428800,
            mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            thumbs: ['100x100', '350x0', '800x0', '1000x0'],
            required: false,
        },
        {
            name: 'climb',
            type: 'relation',
            collectionId: climbsCol.id,
            cascadeDelete: false,
            minSelect: 0,
            maxSelect: 1,
            required: false,
        },
        {
            name: 'area',
            type: 'relation',
            collectionId: areasCol.id,
            cascadeDelete: false,
            minSelect: 0,
            maxSelect: 1,
            required: false,
        },
        {
            name: 'user',
            type: 'relation',
            collectionId: usersCol.id,
            cascadeDelete: false,
            minSelect: 0,
            maxSelect: 1,
            required: false,
        },
        { name: 'username', type: 'text', required: false },
        { name: 'userUuid', type: 'text', required: false },
        { name: 'width', type: 'number', onlyInt: true, required: false },
        { name: 'height', type: 'number', onlyInt: true, required: false },
        { name: 'format', type: 'text', required: false },
        { name: 'size', type: 'number', onlyInt: true, required: false },
        { name: 'uploadTime', type: 'date', required: false },
        { name: 'entityTags', type: 'json', required: false },
        { name: 'userProfile', type: 'json', required: false },
        { name: 'isDeleted', type: 'bool', required: false },
        ...AUTODATE_FIELDS,
    ]

    await upsertCollection('climb_media', {
        fields: climbMediaFields,
        indexes: [
            'CREATE UNIQUE INDEX `idx_climb_media_openbetaId` ON `climb_media` (`openbetaId`) WHERE `openbetaId` != ""',
            'CREATE INDEX `idx_climb_media_climb` ON `climb_media` (`climb`)',
            'CREATE INDEX `idx_climb_media_area` ON `climb_media` (`area`)',
        ],
    })

    // 7. Create/Update `sync_logs`
    const syncLogsFields = [
        { name: 'status', type: 'text', required: true, presentable: true },
        { name: 'syncType', type: 'text', required: false },
        { name: 'mode', type: 'text', required: false },
        { name: 'durationSeconds', type: 'number', required: false },
        { name: 'startedAt', type: 'text', required: false },
        { name: 'completedAt', type: 'text', required: false },
        { name: 'areasProcessed', type: 'number', onlyInt: true, required: false },
        { name: 'climbsUpdated', type: 'number', onlyInt: true, required: false },
        { name: 'pitchesUpdated', type: 'number', onlyInt: true, required: false },
        { name: 'mediaUploaded', type: 'number', onlyInt: true, required: false },
        { name: 'mediaRemaining', type: 'number', onlyInt: true, required: false },
        { name: 'requestsMade', type: 'number', onlyInt: true, required: false },
        { name: 'errorMessage', type: 'text', required: false },
        { name: 'details', type: 'json', required: false },
        { name: 'triggeredBy', type: 'text', required: false },
        { name: 'isDeleted', type: 'bool', required: false },
        ...AUTODATE_FIELDS,
    ]

    await upsertCollection('sync_logs', {
        fields: syncLogsFields,
        indexes: [
            'CREATE INDEX `idx_sync_logs_created` ON `sync_logs` (`created`)',
            'CREATE INDEX `idx_sync_logs_status` ON `sync_logs` (`status`)',
            'CREATE INDEX `idx_sync_logs_syncType` ON `sync_logs` (`syncType`)',
        ],
    })

    console.log('Successfully created/updated all 7 OpenBeta & Sync collections!')
}

const isMain = process.argv[1] && process.argv[1].endsWith('setup-openbeta-collections.mjs')
if (isMain) {
    setupCollections().catch((err) => {
        console.error('Error setting up OpenBeta collections:', err?.response || err)
        process.exit(1)
    })
}

