# EnvSync Deploy Core

Shared deployment primitives for edition-aware packaging.

`@envsync-cloud/deploy` (OSS, `envsync-deploy`) and
`@envsync-cloud/deploy-enterprise` (thin wrapper over that engine) both
import this package for plan loading, topology checks, runtime env
generation, and release artifact planning.

Current exports:

- config file loading for YAML or JSON
- edition-aware topology validation
- runtime env generation
- frontend artifact planning for OSS vs Enterprise
- release artifact planning for npm, GitHub Packages, and container images

Enterprise topology uses a **single API** (manage under `/api/v1/manage` on the API service). No separate management-api service in the plan.
