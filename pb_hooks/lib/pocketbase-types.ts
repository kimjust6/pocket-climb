/**
* This file was @generated using pocketbase-typegen
*/

import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export const Collections = {
	Authorigins: "_authOrigins",
	Externalauths: "_externalAuths",
	Mfas: "_mfas",
	Otps: "_otps",
	Superusers: "_superusers",
	AdminSettings: "admin_settings",
	Areas: "areas",
	BlogPosts: "blog_posts",
	ClimbMedia: "climb_media",
	ClimbingPosts: "climbing_posts",
	Climbs: "climbs",
	Huggies: "huggies",
	Organizations: "organizations",
	Pitches: "pitches",
	Ticks: "ticks",
	Users: "users",
} as const
export type Collections = typeof Collections[keyof typeof Collections]

// Alias types for improved usability
export type IsoDateString = string
export type IsoAutoDateString = string & { readonly autodate: unique symbol }
export type RecordIdString = string
export type FileNameString = string & { readonly filename: unique symbol }
export type HTMLString = string

type ExpandType<T> = unknown extends T
	? T extends unknown
		? { expand?: unknown }
		: { expand: T }
	: { expand: T }

// System fields
export type BaseSystemFields<T = unknown> = {
	id: RecordIdString
	collectionId: string
	collectionName: Collections
} & ExpandType<T>

export type AuthSystemFields<T = unknown> = {
	email: string
	emailVisibility: boolean
	username: string
	verified: boolean
} & BaseSystemFields<T>

// Record types for each collection

export type AuthoriginsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	fingerprint: string
	id: string
	recordRef: string
	updated: IsoAutoDateString
}

export type ExternalauthsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	provider: string
	providerId: string
	recordRef: string
	updated: IsoAutoDateString
}

export type MfasRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	method: string
	recordRef: string
	updated: IsoAutoDateString
}

export type OtpsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	password: string
	recordRef: string
	sentTo?: string
	updated: IsoAutoDateString
}

export type SuperusersRecord = {
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

export type AdminSettingsRecord = {
	category?: string
	created: IsoAutoDateString
	id: string
	key: string
	updated: IsoAutoDateString
	value?: string
}

export type AreasRecord<
	Taggregate = unknown,
	Tancestors = unknown,
	TauthorMetadata = unknown,
	Tbbox = unknown,
	Tcontent = unknown,
	Tmetadata = unknown,
	TpathTokens = unknown,
	Tpolygon = unknown
> = {
	aggregate?: null | Taggregate
	ancestors?: null | Tancestors
	areaLocation?: string
	authorMetadata?: null | TauthorMetadata
	bbox?: null | Tbbox
	content?: null | Tcontent
	created: IsoAutoDateString
	density?: number
	description?: string
	gradeContext?: string
	id: string
	isBoulder?: boolean
	isDeleted?: boolean
	isDestination?: boolean
	isLeaf?: boolean
	lat?: number
	leftRightIndex?: number
	lng?: number
	metadata?: null | Tmetadata
	mpId?: string
	name: string
	openbetaId?: string
	openbetaUuid: string
	parent?: RecordIdString
	parentUuid?: string
	pathHash?: string
	pathTokens?: null | TpathTokens
	polygon?: null | Tpolygon
	shortCode?: string
	totalClimbs?: number
	updated: IsoAutoDateString
}

export const ClimbDisciplinesOptions = {
	"trad": "trad",
	"sport": "sport",
	"bouldering": "bouldering",
	"deepwatersolo": "deepwatersolo",
	"alpine": "alpine",
	"snow": "snow",
	"ice": "ice",
	"mixed": "mixed",
	"aid": "aid",
	"tr": "tr",
} as const
export type ClimbDisciplinesOptions = typeof ClimbDisciplinesOptions[keyof typeof ClimbDisciplinesOptions]

export const ClimbsSafetyOptions = {
	"UNSPECIFIED": "UNSPECIFIED",
	"PG": "PG",
	"PG13": "PG13",
	"runout": "runout",
	"terrain": "terrain",
	"R": "R",
	"X": "X",
} as const
export type ClimbsSafetyOptions = typeof ClimbsSafetyOptions[keyof typeof ClimbsSafetyOptions]

export type ClimbsRecord<
	Tancestors = unknown,
	TauthorMetadata = unknown,
	Tcontent = unknown,
	Tgrades = unknown,
	Tmetadata = unknown,
	TpathTokens = unknown,
	Ttype = unknown
> = {
	ancestors?: null | Tancestors
	area?: RecordIdString
	areaUuid?: string
	authorMetadata?: null | TauthorMetadata
	boltsCount?: number
	content?: null | Tcontent
	created: IsoAutoDateString
	description?: string
	disciplines?: ClimbDisciplinesOptions[]
	fa?: string
	gradeContext?: string
	gradeEwbank?: string
	gradeFont?: string
	gradeFrench?: string
	gradeUiaa?: string
	gradeVscale?: string
	gradeWi?: string
	gradeYds?: string
	grades?: null | Tgrades
	id: string
	isAid?: boolean
	isAlpine?: boolean
	isBouldering?: boolean
	isDeepwatersolo?: boolean
	isDeleted?: boolean
	isIce?: boolean
	isMixed?: boolean
	isSnow?: boolean
	isSport?: boolean
	isTr?: boolean
	isTrad?: boolean
	lat?: number
	leftRightIndex?: number
	length?: number
	lng?: number
	location?: string
	metadata?: null | Tmetadata
	mpId?: string
	name: string
	openbetaId?: string
	openbetaUuid: string
	pathTokens?: null | TpathTokens
	protection?: string
	safety?: ClimbsSafetyOptions
	type?: null | Ttype
	updated: IsoAutoDateString
}

export type PitchesRecord<Tgrades = unknown, Ttype = unknown> = {
	boltsCount?: number
	climb: RecordIdString
	created: IsoAutoDateString
	description?: string
	disciplines?: ClimbDisciplinesOptions[]
	gradeFrench?: string
	gradeVscale?: string
	gradeYds?: string
	grades?: null | Tgrades
	id: string
	isDeleted?: boolean
	length?: number
	openbetaId?: string
	parentUuid?: string
	pitchNumber: number
	type?: null | Ttype
	updated: IsoAutoDateString
}

export const TicksStyleOptions = {
	"Lead": "Lead",
	"Solo": "Solo",
	"TR": "TR",
	"Follow": "Follow",
	"Aid": "Aid",
	"Boulder": "Boulder",
} as const
export type TicksStyleOptions = typeof TicksStyleOptions[keyof typeof TicksStyleOptions]

export const TicksAttemptTypeOptions = {
	"Onsight": "Onsight",
	"Flash": "Flash",
	"Pinkpoint": "Pinkpoint",
	"Frenchfree": "Frenchfree",
	"Attempt": "Attempt",
	"Send": "Send",
	"Redpoint": "Redpoint",
	"Repeat": "Repeat",
} as const
export type TicksAttemptTypeOptions = typeof TicksAttemptTypeOptions[keyof typeof TicksAttemptTypeOptions]

export const TicksSourceOptions = {
	"OB": "OB",
	"MP": "MP",
	"Local": "Local",
} as const
export type TicksSourceOptions = typeof TicksSourceOptions[keyof typeof TicksSourceOptions]

export type TicksRecord<TuserProfile = unknown> = {
	attemptType?: TicksAttemptTypeOptions
	climb?: RecordIdString
	climbUuid?: string
	climbingPost?: RecordIdString
	created: IsoAutoDateString
	dateClimbed: IsoDateString
	grade?: string
	id: string
	isDeleted?: boolean
	name?: string
	notes?: string
	openbetaId?: string
	openbetaUserId?: string
	source?: TicksSourceOptions
	style?: TicksStyleOptions
	updated: IsoAutoDateString
	user?: RecordIdString
	userProfile?: null | TuserProfile
}

export type OrganizationsRecord<
	TassociatedAreaIds = unknown,
	TauthorMetadata = unknown,
	Tcontent = unknown,
	TexcludedAreaIds = unknown
> = {
	areas?: RecordIdString[]
	associatedAreaIds?: null | TassociatedAreaIds
	authorMetadata?: null | TauthorMetadata
	content?: null | Tcontent
	created: IsoAutoDateString
	description?: string
	displayName: string
	donationLink?: string
	email?: string
	excludedAreaIds?: null | TexcludedAreaIds
	facebookLink?: string
	hardwareReportLink?: string
	id: string
	instagramLink?: string
	isDeleted?: boolean
	openbetaId?: string
	orgId: string
	orgType?: string
	updated: IsoAutoDateString
	website?: string
}

export type ClimbMediaRecord<TentityTags = unknown, TuserProfile = unknown> = {
	area?: RecordIdString
	climb?: RecordIdString
	created: IsoAutoDateString
	entityTags?: null | TentityTags
	file?: FileNameString
	format?: string
	height?: number
	id: string
	isDeleted?: boolean
	mediaUrl: string
	openbetaId?: string
	size?: number
	uploadTime?: IsoDateString
	updated: IsoAutoDateString
	user?: RecordIdString
	userProfile?: null | TuserProfile
	userUuid?: string
	username?: string
	width?: number
}

export type BlogPostsRecord = {
	content1?: HTMLString
	content2?: HTMLString
	coverImage?: FileNameString
	coverImageAlt?: string
	created: IsoAutoDateString
	id: string
	isDeleted?: boolean
	manualPublishDate?: IsoDateString
	tags?: string
	title?: string
	updated: IsoAutoDateString
	user?: RecordIdString
}

export const ClimbingPostsClimbTypeOptions = {
	"Bouldering": "Bouldering",
	"Sport": "Sport",
	"Top Rope": "Top Rope",
	"Trad": "Trad",
} as const
export type ClimbingPostsClimbTypeOptions = typeof ClimbingPostsClimbTypeOptions[keyof typeof ClimbingPostsClimbTypeOptions]

export const ClimbingPostsStyleOptions = {
	"Send": "Send",
	"Flash": "Flash",
	"Onsight": "Onsight",
	"Project": "Project",
	"Hangdog": "Hangdog",
} as const
export type ClimbingPostsStyleOptions = typeof ClimbingPostsStyleOptions[keyof typeof ClimbingPostsStyleOptions]
export type ClimbingPostsRecord = {
	climbType?: ClimbingPostsClimbTypeOptions
	content?: HTMLString
	coverImage?: FileNameString
	created: IsoAutoDateString
	date: IsoDateString
	grade?: string
	id: string
	isDeleted?: boolean
	location?: string
	style?: ClimbingPostsStyleOptions
	title: string
	updated: IsoAutoDateString
}

export type HuggiesRecord = {
	created: IsoAutoDateString
	description?: string
	hugOwer?: RecordIdString
	hugReceiver?: RecordIdString
	id: string
	numberOfHugs?: number
	updated: IsoAutoDateString
}

export type UsersRecord = {
	avatar?: FileNameString
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	name?: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

// Response types include system fields and match responses from the PocketBase API
export type AuthoriginsResponse<Texpand = unknown> = Required<AuthoriginsRecord> & BaseSystemFields<Texpand>
export type ExternalauthsResponse<Texpand = unknown> = Required<ExternalauthsRecord> & BaseSystemFields<Texpand>
export type MfasResponse<Texpand = unknown> = Required<MfasRecord> & BaseSystemFields<Texpand>
export type OtpsResponse<Texpand = unknown> = Required<OtpsRecord> & BaseSystemFields<Texpand>
export type SuperusersResponse<Texpand = unknown> = Required<SuperusersRecord> & AuthSystemFields<Texpand>
export type AdminSettingsResponse<Texpand = unknown> = Required<AdminSettingsRecord> & BaseSystemFields<Texpand>
export type AreasResponse<
	Taggregate = unknown,
	Tancestors = unknown,
	TauthorMetadata = unknown,
	Tbbox = unknown,
	Tcontent = unknown,
	Tmetadata = unknown,
	TpathTokens = unknown,
	Tpolygon = unknown,
	Texpand = unknown
> = Required<AreasRecord<Taggregate, Tancestors, TauthorMetadata, Tbbox, Tcontent, Tmetadata, TpathTokens, Tpolygon>> & BaseSystemFields<Texpand>
export type BlogPostsResponse<Texpand = unknown> = Required<BlogPostsRecord> & BaseSystemFields<Texpand>
export type ClimbMediaResponse<TentityTags = unknown, TuserProfile = unknown, Texpand = unknown> = Required<ClimbMediaRecord<TentityTags, TuserProfile>> & BaseSystemFields<Texpand>
export type ClimbingPostsResponse<Texpand = unknown> = Required<ClimbingPostsRecord> & BaseSystemFields<Texpand>
export type ClimbsResponse<
	Tancestors = unknown,
	TauthorMetadata = unknown,
	Tcontent = unknown,
	Tgrades = unknown,
	Tmetadata = unknown,
	TpathTokens = unknown,
	Ttype = unknown,
	Texpand = unknown
> = Required<ClimbsRecord<Tancestors, TauthorMetadata, Tcontent, Tgrades, Tmetadata, TpathTokens, Ttype>> & BaseSystemFields<Texpand>
export type HuggiesResponse<Texpand = unknown> = Required<HuggiesRecord> & BaseSystemFields<Texpand>
export type OrganizationsResponse<
	TassociatedAreaIds = unknown,
	TauthorMetadata = unknown,
	Tcontent = unknown,
	TexcludedAreaIds = unknown,
	Texpand = unknown
> = Required<OrganizationsRecord<TassociatedAreaIds, TauthorMetadata, Tcontent, TexcludedAreaIds>> & BaseSystemFields<Texpand>
export type PitchesResponse<Tgrades = unknown, Ttype = unknown, Texpand = unknown> = Required<PitchesRecord<Tgrades, Ttype>> & BaseSystemFields<Texpand>
export type TicksResponse<TuserProfile = unknown, Texpand = unknown> = Required<TicksRecord<TuserProfile>> & BaseSystemFields<Texpand>
export type UsersResponse<Texpand = unknown> = Required<UsersRecord> & AuthSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	_authOrigins: AuthoriginsRecord
	_externalAuths: ExternalauthsRecord
	_mfas: MfasRecord
	_otps: OtpsRecord
	_superusers: SuperusersRecord
	admin_settings: AdminSettingsRecord
	areas: AreasRecord
	blog_posts: BlogPostsRecord
	climb_media: ClimbMediaRecord
	climbing_posts: ClimbingPostsRecord
	climbs: ClimbsRecord
	huggies: HuggiesRecord
	organizations: OrganizationsRecord
	pitches: PitchesRecord
	ticks: TicksRecord
	users: UsersRecord
}

export type CollectionResponses = {
	_authOrigins: AuthoriginsResponse
	_externalAuths: ExternalauthsResponse
	_mfas: MfasResponse
	_otps: OtpsResponse
	_superusers: SuperusersResponse
	admin_settings: AdminSettingsResponse
	areas: AreasResponse
	blog_posts: BlogPostsResponse
	climb_media: ClimbMediaResponse
	climbing_posts: ClimbingPostsResponse
	climbs: ClimbsResponse
	huggies: HuggiesResponse
	organizations: OrganizationsResponse
	pitches: PitchesResponse
	ticks: TicksResponse
	users: UsersResponse
}

// Utility types for create/update operations

type ProcessCreateAndUpdateFields<T> = Omit<{
	// Omit AutoDate fields
	[K in keyof T as Extract<T[K], IsoAutoDateString> extends never ? K : never]: 
		// Convert FileNameString to File
		T[K] extends infer U ? 
			U extends (FileNameString | FileNameString[]) ? 
				U extends any[] ? File[] : File 
			: U
		: never
}, 'id'>

// Create type for Auth collections
export type CreateAuth<T> = {
	id?: RecordIdString
	email: string
	emailVisibility?: boolean
	password: string
	passwordConfirm: string
	verified?: boolean
} & ProcessCreateAndUpdateFields<T>

// Create type for Base collections
export type CreateBase<T> = {
	id?: RecordIdString
} & ProcessCreateAndUpdateFields<T>

// Update type for Auth collections
export type UpdateAuth<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof AuthSystemFields>
> & {
	email?: string
	emailVisibility?: boolean
	oldPassword?: string
	password?: string
	passwordConfirm?: string
	verified?: boolean
}

// Update type for Base collections
export type UpdateBase<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof BaseSystemFields>
>

// Get the correct create type for any collection
export type Create<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? CreateAuth<CollectionRecords[T]>
		: CreateBase<CollectionRecords[T]>

// Get the correct update type for any collection
export type Update<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? UpdateAuth<CollectionRecords[T]>
		: UpdateBase<CollectionRecords[T]>

// Type for usage with type asserted PocketBase instance
// https://github.com/pocketbase/js-sdk#specify-typescript-definitions

export type TypedPocketBase = {
	collection<T extends keyof CollectionResponses>(
		idOrName: T
	): RecordService<CollectionResponses[T]>
} & PocketBase
