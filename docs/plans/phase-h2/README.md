# H2 — Naming residual cleanup

**Branch:** `feat/the-big-update-h2`  
**Plan:** [../2026-08-post-program-hardening.md](../2026-08-post-program-hardening.md)

## Delivered

| ID | Change |
|----|--------|
| H2.1 | `OrganizationProvisioningService` in `organization-provisioning.service.ts` |
| H2.2 | Saga `createOrganizationForExistingIdentity`; input `organizationName` |
| H2.3 | E2E `organizations.spec.ts` (was `workspaces.spec.ts`) |
| H2.4 | Dialog `CreateOrganizationDialog`; Header import; form id `organization-name` |
| H2.4 | Go SDK `CreateOrganizationRequest` type; `CreateWorkspaceRequest` alias |

### Compat shims (remove later)

- `workspace-provisioning.service.ts` re-exports  
- `WorkspaceProvisioningService.createWorkspaceForExistingIdentity` deprecated wrapper  
- `CreateWorkspaceDialog` export alias  

## Acceptance

- [x] Primary code paths use Organization naming  
- [x] Auth mock tests pass  
- [x] No user-facing “Create workspace” / workspace form ids in primary UI  
