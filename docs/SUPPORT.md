# EnvSync support matrix

**Status:** Phase 6 product matrix (matches program plan §1.1).  
**Edition details:** [EDITIONING.md](../EDITIONING.md)

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
| Dashboard shell | `envsync-web` + EE modules | `envsync-web` OSS build | `envsync-web` EE build |
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
