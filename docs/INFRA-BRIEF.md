# SOLID SNAKE infrastructure: the brief

Approved by the owner 2026-11-17. Latest upstream releases on that date (GitHub API): Terraform 1.17.2, azurerm 5.14.0, azapi 2.14.0, azuread 3.10.0, tflint 0.66.0 with the azurerm ruleset 0.33.0, terraform-docs 0.25.1, Checkov 3.4.5, Trivy 0.76.2, Infracost 0.10.50, pre-commit-terraform 1.109.5, Conftest 0.71.1. INFRA-PLAN.md revision 2 assumed azurerm 4.x and Terraform 1.11; both are superseded.

Build the Azure infrastructure for SOLID SNAKE as an enterprise platform team would in November 2026, and prove it correct with evidence that does not depend on the author's word.

> Owner correction, 2026-11-17: the first build was rejected as overcomplicated. The infrastructure now follows the owner's own projects:
> - Modules are main/variables/outputs with one concern each, with few validations and one-line comments.
> - There are no module tests and no OPA. Quality comes from fmt, validate, tflint, Checkov and Trivy in CI.
> - There are four plain workflows with inline steps and no scripts.
>
> Where this brief says otherwise, the simpler form in docs/infra/DESIGN.md wins.

## Working arrangement (owner, 2026-11-17)
- The owner deploys manually after the build. No agent signs in to Azure or deploys. Checks that need a live subscription (region availability, quotas, policy, Resource Graph, the real `up` and `down`) are written as runnable scripts and runbook steps for the owner, not run by agents.
- Research is capped at what the build needs. No open-ended surveys.
- The quality bar below (sections 1 to 4: requirements as tests, raw sources, methods and tools, independent evidence) applies to every agent brief and every review.

## Fixed inputs (decided, do not reopen)
- App: one distroless image (non-root uid 65532, read-only root, port 8080, `/healthz`), audit log on `/data` with exactly one writer at any moment, signing key `AUDIT_HMAC_KEY` (or `_FILE`) that must never be regenerated mid-life and never enter state.
- Lifespan: up for about a day per demo, created and destroyed entirely by CI/CD, reproducible.
- Posture: private-first and highly secure, but access is fully open (no sign-in). Public link is the Front Door default endpoint, no custom domain.
- Edge: Front Door Premium + WAF, Private Link to a Container Apps workload-profiles environment with public access disabled.
- Region: Qatar Central only if every component (including Front Door Private Link) is available there; otherwise UAE North for everything. Region is a variable.
- Cases persist for the life of a demo (Azure Files), not between demos.
- Owner standard: the saved Terraform standard (modules mandatory, described and validated variables, described outputs, tags everywhere, pinned versions, remote state, no secrets in code, pre-commit with fmt, validate, docs, tflint). No `examples/` directory. One environment runs at a time (dev, staging or prod); weigh the environment strategy against that.
- Shell: PowerShell or WSL, never Git Bash. Do not stage or commit.

## 1. Start from requirements, not services
Write the non-functional requirements as testable statements before any HCL, each with the check that will prove it. At minimum:
- The origin is unreachable except through this Front Door profile.
- No secret appears in Terraform state, plan output, logs or the image.
- Exactly one writer to `/data` at every moment, including during a release.
- The data plane (storage, Key Vault) has no public network path.
- The CI identities can do exactly what the pipeline needs and nothing at subscription scope.
- A second `plan` after `apply` shows no changes (idempotence).
- `down` leaves zero billable resources, and a fresh `up` reproduces the same platform.
- Every resource is tagged and sends diagnostics to Log Analytics.

Do a short STRIDE pass over the four data flows (request, identity and secret, storage, release) and map each threat to a control and a check.

## 2. Raw sources only, dated, cited by version or commit
Research from primary material, not summaries or blog posts. Record the version, tag or commit of everything read.
- Provider source and changelogs: hashicorp/terraform-provider-azurerm (CHANGELOG.md, `internal/services/containerapps`, `internal/services/cdn`, `internal/services/storage`, `internal/services/keyvault`), Azure/terraform-provider-azapi, hashicorp/terraform-provider-azuread. Read the resource code for ForceNew fields, defaults and validation, and the open issues for known bugs on the exact resources used.
- Exact schemas: `terraform providers schema -json` for the pinned versions.
- Azure REST API specs (github.com/Azure/azure-rest-api-specs) for Microsoft.App, Microsoft.Cdn, Microsoft.Storage, Microsoft.KeyVault: the api-versions and properties azapi would use.
- Terraform core release notes (hashicorp/terraform CHANGELOG) for the current version: native tests and mocks, ephemeral resources and write-only arguments, `import`, `moved`, `removed` and `check` blocks.
- Azure Verified Modules: the AVM repositories (Azure/terraform-azurerm-avm-res-*, avm-ptn-*), their code, tests and release cadence. Decide per component whether a pinned AVM module beats a module of our own, and say why.
- Microsoft Learn Well-Architected service guides for Container Apps and Front Door; the Container Apps and Front Door product docs already cited in INFRA-PLAN.md.
- The live subscription: `az provider show` and Resource Graph for region availability, quotas and existing policy; the retail price API for cost.
- When the registry website will not render, read the provider repository instead.

## 3. Methods and tools
- Module design by lifecycle and blast radius, not one module per resource. Typed object inputs with `validation` and `nullable = false`; outputs as the contract between modules. No thin wrappers over a single resource.
- Environment strategy chosen explicitly (for example one root per lifecycle layer with a per-environment backend key and tfvars), justified against "one environment at a time".
- Secrets: ephemeral values and write-only arguments where the pinned provider supports them; otherwise generated outside Terraform. Prove it by searching the state file.
- Test pyramid:
  1. fmt, validate, tflint with the azurerm ruleset, terraform-docs.
  2. `terraform test` unit tests per module with `mock_provider`.
  3. Plan-time policy: Checkov and Trivy config, plus Conftest/OPA rules on `terraform show -json` for the project-specific requirements in section 1.
  4. Integration on a real `up` in the dev environment with `check` blocks and post-deploy probes.
  5. A destroy test proving zero resources remain.
- Supply chain: committed `.terraform.lock.hcl` with hashes for linux_amd64 and windows_amd64, providers and modules pinned, GitHub Actions pinned by SHA, image provenance with GitHub artifact attestations, an SBOM, and Dependabot or Renovate for bumps.
- Cost: Infracost on pull requests, the budget and expiry guard from INFRA-PLAN.md, and actual cost compared after the first day.
- Operations: a scheduled drift plan (`-detailed-exitcode`), runbooks for a failed `up` midway, the Private Link approval step, Key Vault purge on destroy, and a stop-then-start release. ADRs for every decision that has a credible alternative.

## 4. Evidence that does not depend on the author
- Azure itself: Resource Graph queries asserting the properties in section 1 (public network access disabled, TLS minimums, tags present, diagnostic settings present); Azure Policy compliance on the resource group; Defender for Cloud recommendations for the resource group.
- The internet: the default `*.azurecontainerapps.io` address must not answer; the Front Door link answers 200 on `/healthz`; an obvious attack payload returns 403 and appears in the WAF log; a TLS scan of the endpoint.
- Scanners and tests: Checkov and Trivy with zero high findings, tflint clean, `terraform test` passing, the second plan empty.
- The app's own oracles: `/api/audit/verify` returns ok after a forced restart and after a stop-then-start release; the Playwright suite passes against the deployed public link.
- Teardown: Resource Graph shows zero resources in the platform group after `down`, and Cost Management shows charges stop. A second `up` from a fresh runner reproduces the platform.

## Orchestration
- Lead (Opus, this session): requirements, threat model, module boundaries, environment strategy, contracts between modules, final verification. No module is accepted on a worker's report alone.
- Parallel research, Sonnet, primary sources only, each report under 400 words with versions, commits and URLs, and NOT CONFIRMED where unproven:
  - R-core: Terraform core release notes, the testing framework, ephemeral values and write-only arguments.
  - R-azurerm: Container Apps, Front Door and CDN, Storage and Key Vault resources in azurerm source code and open issues.
  - R-azapi-REST: what azurerm cannot do (Private Link approval, identity-based SMB mounts) via azapi and the REST specs.
  - R-AVM: AVM modules for each component, with maturity, pinning and fit.
  - R-CI: GitHub Actions OIDC, environments, artifact attestations, and the Checkov, Trivy, tflint, terraform-docs and Infracost versions current today.
- Parallel module builds, Sonnet, one worker per module once the contracts are fixed, each delivering code, README, `terraform test` with mocks, and the plan-time checks that apply. No worker edits another's module.
- Independent review, Opus, read-only, of the composed plan JSON against section 1 and the threat model, before the first `up`.
- A checklist audit (Haiku) of the standard against the code.
