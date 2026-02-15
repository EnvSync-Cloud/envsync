/**
 * OpenFGA Authorization Model for EnvSync.
 *
 * Exported as JSON (TypeDefinition format) because the @openfga/sdk
 * `WriteAuthorizationModel` API expects the JSON representation, not
 * the DSL string.
 */

import type { TypeDefinition } from "@openfga/sdk";

export const authorizationModelDef: { schema_version: string; type_definitions: TypeDefinition[] } = {
	schema_version: "1.1",
	type_definitions: [
		// ------------------------------------------------------------------
		// user – leaf type, no relations
		// ------------------------------------------------------------------
		{
			type: "user",
			relations: {},
		},

		// ------------------------------------------------------------------
		// team
		// ------------------------------------------------------------------
		{
			type: "team",
			relations: {
				org: {
					this: {},
				},
				member: {
					this: {},
				},
			},
			metadata: {
				relations: {
					org: { directly_related_user_types: [{ type: "org" }] },
					member: { directly_related_user_types: [{ type: "user" }] },
				},
			},
		},

		// ------------------------------------------------------------------
		// org
		// ------------------------------------------------------------------
		{
			type: "org",
			relations: {
				// Direct assignments
				master: { this: {} },
				admin: { this: {} },
				member: { this: {} },

				// Capability relations (can be directly assigned OR inherited from admin/master)
				can_view: {
					union: {
						child: [{ this: {} }, { computedUserset: { relation: "admin" } }, { computedUserset: { relation: "master" } }],
					},
				},
				can_edit: {
					union: {
						child: [{ this: {} }, { computedUserset: { relation: "admin" } }, { computedUserset: { relation: "master" } }],
					},
				},
				have_api_access: {
					union: {
						child: [{ this: {} }, { computedUserset: { relation: "admin" } }, { computedUserset: { relation: "master" } }],
					},
				},
				have_billing_options: {
					union: {
						child: [{ this: {} }, { computedUserset: { relation: "admin" } }, { computedUserset: { relation: "master" } }],
					},
				},
				have_webhook_access: {
					union: {
						child: [{ this: {} }, { computedUserset: { relation: "admin" } }, { computedUserset: { relation: "master" } }],
					},
				},

				// Computed management permissions
				can_manage_roles: {
					union: {
						child: [{ computedUserset: { relation: "admin" } }, { computedUserset: { relation: "master" } }],
					},
				},
				can_manage_users: {
					union: {
						child: [{ computedUserset: { relation: "admin" } }, { computedUserset: { relation: "master" } }],
					},
				},
				can_manage_apps: {
					union: {
						child: [{ computedUserset: { relation: "admin" } }, { computedUserset: { relation: "master" } }],
					},
				},
				can_manage_api_keys: {
					intersection: {
						child: [
							{ computedUserset: { relation: "have_api_access" } },
							{ computedUserset: { relation: "can_manage_users" } },
						],
					},
				},
				can_manage_webhooks: {
					intersection: {
						child: [
							{ computedUserset: { relation: "have_webhook_access" } },
							{ computedUserset: { relation: "can_manage_users" } },
						],
					},
				},
				can_view_audit_logs: {
					union: {
						child: [{ computedUserset: { relation: "admin" } }, { computedUserset: { relation: "master" } }],
					},
				},
				can_manage_org_settings: {
					computedUserset: { relation: "master" },
				},
				can_manage_invites: {
					union: {
						child: [{ computedUserset: { relation: "admin" } }, { computedUserset: { relation: "master" } }],
					},
				},
			},
			metadata: {
				relations: {
					master: { directly_related_user_types: [{ type: "user" }] },
					admin: {
						directly_related_user_types: [{ type: "user" }, { type: "team", relation: "member" }],
					},
					member: {
						directly_related_user_types: [{ type: "user" }, { type: "team", relation: "member" }],
					},
					can_view: {
						directly_related_user_types: [{ type: "user" }, { type: "team", relation: "member" }],
					},
					can_edit: {
						directly_related_user_types: [{ type: "user" }, { type: "team", relation: "member" }],
					},
					have_api_access: {
						directly_related_user_types: [{ type: "user" }, { type: "team", relation: "member" }],
					},
					have_billing_options: {
						directly_related_user_types: [{ type: "user" }, { type: "team", relation: "member" }],
					},
					have_webhook_access: {
						directly_related_user_types: [{ type: "user" }, { type: "team", relation: "member" }],
					},
					can_manage_roles: {},
					can_manage_users: {},
					can_manage_apps: {},
					can_manage_api_keys: {},
					can_manage_webhooks: {},
					can_view_audit_logs: {},
					can_manage_org_settings: {},
					can_manage_invites: {},
				},
			},
		},

		// ------------------------------------------------------------------
		// app
		// ------------------------------------------------------------------
		{
			type: "app",
			relations: {
				org: { this: {} },
				admin: { this: {} },
				editor: { this: {} },
				viewer: { this: {} },

				can_view: {
					union: {
						child: [
							{ computedUserset: { relation: "viewer" } },
							{ computedUserset: { relation: "editor" } },
							{ computedUserset: { relation: "admin" } },
							{ tupleToUserset: { tupleset: { relation: "org" }, computedUserset: { relation: "can_view" } } },
						],
					},
				},
				can_edit: {
					union: {
						child: [
							{ computedUserset: { relation: "editor" } },
							{ computedUserset: { relation: "admin" } },
							{ tupleToUserset: { tupleset: { relation: "org" }, computedUserset: { relation: "can_edit" } } },
						],
					},
				},
				can_manage: {
					union: {
						child: [
							{ computedUserset: { relation: "admin" } },
							{ tupleToUserset: { tupleset: { relation: "org" }, computedUserset: { relation: "can_manage_apps" } } },
						],
					},
				},
			},
			metadata: {
				relations: {
					org: { directly_related_user_types: [{ type: "org" }] },
					admin: {
						directly_related_user_types: [{ type: "user" }, { type: "team", relation: "member" }],
					},
					editor: {
						directly_related_user_types: [{ type: "user" }, { type: "team", relation: "member" }],
					},
					viewer: {
						directly_related_user_types: [{ type: "user" }, { type: "team", relation: "member" }],
					},
					can_view: {},
					can_edit: {},
					can_manage: {},
				},
			},
		},

		// ------------------------------------------------------------------
		// env_type
		// ------------------------------------------------------------------
		{
			type: "env_type",
			relations: {
				app: { this: {} },
				org: { this: {} },
				admin: { this: {} },
				editor: { this: {} },
				viewer: { this: {} },

				can_view: {
					union: {
						child: [
							{ computedUserset: { relation: "viewer" } },
							{ computedUserset: { relation: "editor" } },
							{ computedUserset: { relation: "admin" } },
							{ tupleToUserset: { tupleset: { relation: "app" }, computedUserset: { relation: "can_view" } } },
						],
					},
				},
				can_edit: {
					union: {
						child: [
							{ computedUserset: { relation: "editor" } },
							{ computedUserset: { relation: "admin" } },
							{ tupleToUserset: { tupleset: { relation: "app" }, computedUserset: { relation: "can_edit" } } },
						],
					},
				},
				can_manage_protected: {
					union: {
						child: [
							{ computedUserset: { relation: "admin" } },
							{ tupleToUserset: { tupleset: { relation: "org" }, computedUserset: { relation: "master" } } },
							{ tupleToUserset: { tupleset: { relation: "org" }, computedUserset: { relation: "admin" } } },
						],
					},
				},
			},
			metadata: {
				relations: {
					app: { directly_related_user_types: [{ type: "app" }] },
					org: { directly_related_user_types: [{ type: "org" }] },
					admin: {
						directly_related_user_types: [{ type: "user" }, { type: "team", relation: "member" }],
					},
					editor: {
						directly_related_user_types: [{ type: "user" }, { type: "team", relation: "member" }],
					},
					viewer: {
						directly_related_user_types: [{ type: "user" }, { type: "team", relation: "member" }],
					},
					can_view: {},
					can_edit: {},
					can_manage_protected: {},
				},
			},
		},
	],
};
