# Edition Structure

EnvSync uses a shared-shell model for maintaining a public FOSS edition and a private superset edition.

## Public Repo

- `packages/envsync-api` remains the shared backend shell.
- `apps/envsync-web` remains the shared dashboard shell.
- Public SDKs remain public-only and must not reference private packages.

The public repo now contains registry-based extension seams for:

- API route modules
- frontend route and nav modules
- environment schema extensions
- additional migration directories
- background handler registration
- future DB type augmentation

## Private Superset Repo

The private repo should be created from the full public history and add enterprise-only packages such as:

- `packages/envsync-enterprise-api`
- `packages/envsync-enterprise-web`
- `packages/envsync-enterprise-shared`
- `sdks/envsync-enterprise-ts-sdk`

The private repo should replace:

- `packages/envsync-api/src/modules/external-modules.ts`
- `apps/envsync-web/src/modules/external-modules.ts`

with imports from those enterprise-only packages.

## Sync Workflow

Recommended git model:

1. Keep the public repo as the canonical upstream for shared code.
2. Add the public repo as a `public` remote in the private repo.
3. Open automated sync PRs in the private repo by merging `public/main`.
4. Upstream shared seams to the public repo before adding enterprise behavior.

## Guardrails

- Public code must not import enterprise-only packages.
- Shared shell changes should remain generic and additive.
- Provider-specific or proprietary behavior belongs in the private repo.
