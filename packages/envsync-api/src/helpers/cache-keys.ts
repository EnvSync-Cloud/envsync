/** Centralized cache key patterns and TTL constants for EnvSync */

export const CacheTTL = {
	SHORT: 300, // 5 min — users, api keys, apps, env types, teams, webhooks
	LONG: 600, // 10 min — orgs, roles (change less frequently)
} as const;

export const CacheKeys = {
	// User
	user: (id: string) => `es:user:${id}`,
	userByIdp: (authServiceId: string) => `es:user:idp:${authServiceId}`,
	usersByOrg: (orgId: string) => `es:org:${orgId}:users`,

	// API Key
	apiKeyByCreds: (key: string) => `es:apikey:creds:${key}`,
	apiKeysByOrg: (orgId: string) => `es:org:${orgId}:apikeys`,
	apiKeysByUser: (userId: string) => `es:user:${userId}:apikeys`,

	// Org
	org: (id: string) => `es:org:${id}`,

	// Role
	role: (id: string) => `es:role:${id}`,
	rolesByOrg: (orgId: string) => `es:org:${orgId}:roles`,

	// App
	app: (id: string) => `es:app:${id}`,
	appsByOrg: (orgId: string) => `es:org:${orgId}:apps`,

	// EnvType
	envType: (id: string) => `es:envtype:${id}`,
	envTypesByOrg: (orgId: string) => `es:org:${orgId}:envtypes`,

	// Team
	team: (id: string) => `es:team:${id}`,
	teamsByOrg: (orgId: string) => `es:org:${orgId}:teams`,
	teamMembers: (teamId: string) => `es:team:${teamId}:members`,

	// Webhook
	webhook: (id: string) => `es:webhook:${id}`,
	webhooksByOrg: (orgId: string) => `es:org:${orgId}:webhooks`,

	// Certificate
	certsByOrg: (orgId: string) => `es:org:${orgId}:certs`,

	// Glob patterns for cascade invalidation
	allForUser: (userId: string) => `es:user:${userId}*`,
	allForOrg: (orgId: string) => `es:org:${orgId}:*`,
} as const;
