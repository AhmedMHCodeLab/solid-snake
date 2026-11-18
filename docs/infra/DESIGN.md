# SOLID SNAKE infrastructure: overview

One container (web app and API on port 8080) on Azure Container Apps, behind Front Door Premium with a WAF, reached only over Private Link. UAE North. Synthetic data. Up for a demo, then destroyed. Decisions are in [docs/adr](../adr/README.md); how to run it is in [DEPLOYMENT.md](DEPLOYMENT.md).

```
Visitor -> Front Door Premium + WAF (default *.azurefd.net link)
             | Private Link
             v
           Container Apps environment (public access disabled, in a VNet)
             '-- container app (1 replica) -- /data  <- Azure Files share (private endpoint)
                                           -- AUDIT_HMAC_KEY <- Key Vault (private endpoint)
                                           -- image <- registry (pulled by the app identity)
           Logs -> Log Analytics
```

## Layout

```
infra/
  bootstrap/   run once by hand: state account, registry, one resource group per environment,
               the app identity and its access, the CI identity and its GitHub credentials, budgets,
               plus the GitHub environments and repository variables the workflows read
  main.tf      the platform: Log Analytics plus the five modules below
  env/         <env>.tfvars and <env>.backend.hcl (one state per environment)
  modules/
    networking/      VNet, two subnets, NSG, private DNS zones
    keyvault/        Key Vault, private endpoint, the audit signing key
    storage/         storage account, audit share, private endpoint
    container_apps/  environment, share registration, the app
    frontdoor/       profile, endpoint, Private Link origin, route, WAF
```

Each module owns one concern and is `main.tf`, `variables.tf`, `outputs.tf` and `versions.tf`.

## What keeps it secure

| Concern | Control |
|---|---|
| Bypassing the WAF | Environment public network access disabled; Front Door reaches it over Private Link only |
| Abuse of an open app | WAF default and bot rule sets, rate limit on `/api/`, 1 GiB share quota |
| Signing key exposure | Generated as an ephemeral value and written through a write-only body: never in state or plan (ADR 0005) |
| Data plane exposure | Key Vault and storage have no public network access; private endpoints and private DNS |
| CI privileges | One OIDC identity, Contributor on the environment groups only; no client secrets, no role-assignment rights (ADR 0007) |
| Two writers on the audit log | One replica, Single revision mode (ADR 0006) |
| Supply chain | Image scanned by Trivy and deployed by digest; actions pinned by SHA; provider lock file committed (ADR 0009) |

Accepted risk: the storage account key is in Terraform state, because the SMB mount needs it and azurerm has no write-only form (ADR 0006).

## Checks

- **Pull requests (`ci.yml`):** app tests, `terraform fmt`, `validate`, tflint and Checkov. Checkov skips are listed with reasons in `infra/.checkov.yaml`.
- **Builds (`build.yml`):** Trivy fails the build on HIGH or CRITICAL findings.
- **After deploying:** the checks in DEPLOYMENT.md prove what static checks cannot:
  - the origin is unreachable directly;
  - the WAF returns 403;
  - public access is disabled.
