import { sql, type Kysely } from "kysely";

const providerTypes = [
	"github_actions",
	"gitlab_ci",
	"kubernetes",
	"vercel",
	"circleci",
	"buildkite",
	"bitbucket_pipelines",
	"azure_pipelines",
	"terraform_cloud",
	"spacelift",
	"pulumi",
	"generic",
];

function checkSql(types: string[]) {
	const list = types.map((type) => `'${type}'`).join(", ");
	return `CHECK (provider_type IN (${list}))`;
}

export async function up(db: Kysely<any>): Promise<void> {
	await sql`ALTER TABLE oidc_providers DROP CONSTRAINT IF EXISTS oidc_providers_provider_type_check`.execute(db);
	await sql.raw(
		`ALTER TABLE oidc_providers ADD CONSTRAINT oidc_providers_provider_type_check ${checkSql(providerTypes)}`,
	).execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`ALTER TABLE oidc_providers DROP CONSTRAINT IF EXISTS oidc_providers_provider_type_check`.execute(db);
	await sql.raw(
		`ALTER TABLE oidc_providers ADD CONSTRAINT oidc_providers_provider_type_check ${checkSql([
			"github_actions",
			"gitlab_ci",
			"kubernetes",
			"generic",
		])}`,
	).execute(db);
}
