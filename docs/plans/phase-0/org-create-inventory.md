# Phase 0.2 — Org-create path inventory

**Branch:** `feat/the-big-update-p0`  
**Source of truth for target:** [program plan §1.1a](../2026-08-no-piggyback-program.md)

| ID | Path | Auth today | Creates | Asserts single-org? | Target channel | Phase disposition |
|----|------|------------|---------|---------------------|----------------|-------------------|
| OC-01 | `POST /api/onboarding/org` → `OnboardingController.createOrgInvite` | **None** | Org **invite** (not org yet) | No | `hosted_signup` only | **P1:** deny unless `deployment_mode=hosted` |
| OC-02 | `PUT /api/onboarding/org/:code/accept` → `OrgProvisioningService.provisionOrganization` | **None** (invite token) | Full org + admin user + PKI | Yes (`assertProvisioningAllowed`) | `hosted_signup` only | **P1:** deny accept when public signup disabled |
| OC-03 | `GET /api/onboarding/org/:code` | None | Read invite | N/A | Hosted-only optional | **P1:** may stay public if invite exists; prefer hosted-only |
| OC-04 | `POST /api/auth/create-workspace` → `WorkspaceProvisioningService.createWorkspaceForExistingIdentity` | Cookie session + **enterprise edition** | Full org + membership (reuse IdP) + PKI | Yes | `hosted_dashboard` only | **P1:** deny all self-host; rename to createOrganization later |
| OC-05 | `OrgProvisioningService.provisionOrganization` (service) | Caller-dependent | Org + admin Keycloak user | Yes | Shared implementation | **P1:** require `source` + policy at entry |
| OC-06 | `WorkspaceProvisioningService.createWorkspaceForExistingIdentity` | Caller-dependent | Org + membership for existing IdP | Yes | Hosted dashboard **or** remove for self-host | **P1:** only via OC-04 hosted |
| OC-07 | `OrgService.createOrg` | Internal | `orgs` row only | **No** | Library | Callers must assert; **P1** audit all callers |
| OC-08 | `scripts/cli.ts bootstrap-org` | Operator CLI | `provisionOrganization` | Yes | `selfhost_cli` / `dev` | **P1b:** formalize as operator path |
| OC-09 | `scripts/cli.ts create-dev-user --seed` | Operator CLI | May create org as part of seed | Partial | `dev` only | Keep dev-only; document |
| OC-10 | `scripts/cli.ts bootstrap-ui-harness` | Operator / CI | Dedicated UI e2e org | Yes/partial | `dev` / hosted harness | CI only; not product self-host signup |
| OC-11 | Landing UI `Onboarding.tsx` → OC-01 | Public browser | Invite | N/A | Hosted only | **P2:** not shipped on self-host |
| OC-12 | Landing `AcceptOrgInvite` → OC-02 | Public browser | Org | Yes at provision | Hosted only | **P2:** self-host uses dashboard user-invite only |
| OC-13 | Web `CreateWorkspaceDialog` / Header → OC-04 | Session | Org | Yes | Hosted only | **P1:** hide on self-host |
| OC-14 | User invite accept (`/onboarding/user/*`) | Token / auth | **Membership**, not new org | N/A | All modes | Keep; move accept UI to dashboard (**P2**) |

## Shared helpers

| File | Role |
|------|------|
| `packages/envsync-api/src/services/edition-policy.service.ts` | `isSingleOrgMode`, `assertOrgProvisioningAllowed` |
| `packages/envsync-api/src/services/org-provisioning.service.ts` | Saga provision + assert |
| `packages/envsync-api/src/services/workspace-provisioning.service.ts` | Multi-org “workspace” = create org |

## Phase 1 checklist (from this inventory)

- [ ] OC-01, OC-02, OC-04 call central policy with `source`
- [ ] OC-07 callers reviewed
- [ ] OC-13 UI gated by `can_create_organization` / hosted only
