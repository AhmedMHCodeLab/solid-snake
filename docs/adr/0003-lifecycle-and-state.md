# 0003 Permanent bootstrap plus an ephemeral platform; one state per environment

**Context.** The platform lives about a day per demo and is created and destroyed from CI. Usually one of dev, staging or prod is up at a time. HashiCorp's docs say workspaces are not an isolation mechanism.

**Decision.**
- `infra/bootstrap` is run once by hand and kept. It holds:
  - the state account;
  - the registry;
  - one resource group per environment;
  - the app identity and its access;
  - the CI identity;
  - budgets.
- `infra/` is the platform. It has one state per environment through `-backend-config=env/<env>.backend.hcl`, and the differences between environments live only in `env/<env>.tfvars`.

**Consequences.**
- One codebase serves every environment.
- The resource groups outlive the platform, so CI never needs subscription-level rights.
- Cases persist for one demo only.
- Key Vault and storage names carry a random suffix, and vaults are purged on destroy, so the next deployment never collides with a soft-deleted vault.

**Revisit when** environments must run side by side on different code, or cases must survive between demos.
