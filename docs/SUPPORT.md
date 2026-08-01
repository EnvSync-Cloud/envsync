# EnvSync support matrix

**Status:** Post–no-piggyback product matrix (program §1.1 + hardening H1–H6).  
**Edition details:** [EDITIONING.md](../EDITIONING.md)  
**Hardening plan:** [plans/2026-08-post-program-hardening.md](./plans/2026-08-post-program-hardening.md)

## Hosted vs self-host edition matrix (quick)

| Dimension | Hosted (SaaS) | Self-host OSS | Self-host Enterprise |
|-----------|---------------|---------------|----------------------|
| `ENVSYNC_DEPLOYMENT_MODE` | `hosted` | `selfhosted` | `selfhosted` |
| `ENVSYNC_EDITION` | `enterprise` | `oss` | `enterprise` |
| FE web build | **`build:hosted`** (= enterprise modules) | `build:oss` | `build:enterprise` |
| Org create (dashboard) | Yes — `POST /auth/create-organization` | Never | Never |
| Org create (operator) | Platform / landing | First-boot / OSS deploy CLI | EE deploy CLI + claims |
| License enforcement | Platform (entitlement bypass for multi-org) | N/A | Entitlement JWT verify |
| Management process | Platform-operated | Not included | Separate management API |

### Hosted dashboard build (do not regress)

Cloudflare Hosted web (`.github/workflows/deploy-fe.yaml`) **must** use **`bun run --filter envsync-web build:hosted`** (or `build:enterprise`) so Integrations, License, and Sync ops ship.  
Self-host OSS static images continue to use **`build:oss`** via the release image matrix — that path is intentional and separate.

CI enforces the Hosted job does not call `build:oss` (`bun run check:boundaries`).

See [plans/phase-h1/README.md](./plans/phase-h1/README.md) for cutover order.

## Products

| Capability | Hosted Enterprise | Self-host OSS | Self-host Enterprise |
|------------|-------------------|---------------|----------------------|
| Deployment mode | `hosted` | `selfhosted` | `selfhosted` |
| Edition | `enterprise` | `oss` | `enterprise` |
| Tenancy | Multi-org (SaaS) | Single-org | Default single-org; multi-org only with license claims |
| Public signup (landing) | Yes | No | No |
| Dashboard create org | Yes (**Organization**) | No | No |
| First org bootstrap | Landing / onboarding | First-boot / OSS deploy CLI | EE deploy CLI |
| Further orgs | Hosted dashboard / API | Never | EE deploy CLI + `max_orgs` claim |
| User invites | Yes | Yes (join only) | Yes (join only) |
| Landing site | Platform (Cloudflare) | Not deployed | Not deployed |
| Management API | Platform | Not included | Separate process |
| License | Platform billing | N/A | File / JWT under install + public key verify |
| Deploy CLI | N/A | `@envsync-cloud/deploy` | `@envsync-cloud/deploy-enterprise` |
| EE features (OIDC, SAML, rotation, dyn secrets, integrations, …) | Platform | Not available | Requires edition + (if enforced) entitlement features |
| Dashboard shell | `envsync-web` + EE modules (`build:hosted`) | `envsync-web` OSS build | `envsync-web` EE build |
| Separate management SPA | No | No | No |

## Support channels (indicative)

| Audience | Channel |
|----------|---------|
| Hosted customers | EnvSync Cloud support / status |
| Self-host OSS | GitHub issues / community |
| Self-host Enterprise | Contracted support + license server status |

## Explicit non-goals

- Hard DRM against determined source forks (open-core honesty).
- Nested “workspace” entity under organization.
- Landing or management SPA on self-host topologies.

## Related docs

- Program plan: [plans/2026-08-no-piggyback-program.md](./plans/2026-08-no-piggyback-program.md)
- ADR: [adr/0001-no-piggyback-program.md](./adr/0001-no-piggyback-program.md)
- Self-hosting: `SELFHOSTING.md` (repo root, if present)
