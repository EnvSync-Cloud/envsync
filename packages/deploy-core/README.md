# EnvSync Deploy Core

Shared deployment primitives for edition-aware packaging.

This package is the extraction target for logic currently living in
`packages/deploy` (OSS engine) so both:

- `@envsync-cloud/deploy` for OSS (`envsync-deploy`)
- `@envsync-cloud/deploy-enterprise` for Enterprise (thin wrapper → OSS engine)

can share release rendering, topology defaults, and runtime-config generation.

Current exports:

- config file loading for YAML or JSON
- edition-aware topology validation
- runtime env generation
- frontend artifact planning for OSS vs Enterprise
- release artifact planning for npm, GitHub Packages, and container images

Enterprise topology uses a **single API** (manage under `/api/v1/manage` on the API service). No separate management-api service in the plan.
