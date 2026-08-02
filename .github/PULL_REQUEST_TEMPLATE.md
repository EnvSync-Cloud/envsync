## Summary

<!-- What does this PR change and why? -->

## Program / phase

<!-- e.g. feat/the-big-update-p1 — or N/A -->

-

## No-piggyback checklist

See [docs/plans/2026-08-no-piggyback-program.md](../docs/plans/2026-08-no-piggyback-program.md) and [ADR 0001](../docs/adr/0001-no-piggyback-program.md).

- [ ] Does **not** make product A depend on product B via spawn, re-export, or rename-only API
- [ ] Shared code is a **library** (kernel/domain/ui), not a second entrypoint of another product
- [ ] If this creates or provisions an **organization**, it matches the **channel matrix** (§1.1a):

  | Channel | Hosted | Self-host OSS | Self-host EE |
  |---------| |--------|---------------|--------------|
  | Public onboarding org* | OK | Deny | Deny |
  | Web create-workspace / create-org | OK | Deny | Deny |
  | Deploy CLI / bootstrap | N/A | First org only | CLI only + max_orgs |

- [ ] Self-host **web session** never gains a new org-create path
- [ ] New **enterprise** API/UI modules are registered for the enterprise package path (not only silently inside core forever) — note follow-up phase if interim
- [ ] OSS deploy changes do **not** call into `deploy-cli` / enterprise deploy sources

## Tests

- [ ] Mock / unit (if API)
- [ ] E2E or pack smoke (if behavior/deploy)
- [ ] N/A docs-only

## Risk / rollout

<!-- Breaking changes, feature flags, migration notes -->
