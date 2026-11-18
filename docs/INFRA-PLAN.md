# SOLID SNAKE: Azure infrastructure plan

> Superseded in part, 2026-11-17. The service choices, costs and owner decisions below still stand. The build design (modules, versions, environment strategy, layers, CI identities) is now in [infra/DESIGN.md](infra/DESIGN.md) and the decisions in [adr/](adr/README.md). Revision 2's "flat files, no modules", azurerm 4.x, Terraform 1.11 and the base/app split are replaced.

Status: revision 2, 2026-11-17, rebuilt on the owner's decisions below. Nothing is provisioned.
Evidence labels: DOCUMENTED (Microsoft Learn or pricing page, listed in section 11), FEED (Microsoft's public retail price feed, queried 2026-11-17), JUDGMENT (the lead's inference), UNVERIFIED (proven in a spike before it is relied on).

## 1. Owner decisions (2026-11-17)

| Topic | Decision |
|---|---|
| Lifespan | Up for about a day per demo, created and destroyed from CI/CD, reproducible like an enterprise app. |
| Posture | Internal, private-first, highly secure platform. |
| Address | No custom domain. The public link Azure provides is enough. |
| Persistence | Cases survive restarts and releases for the life of a demo. |
| Access | Fully open. No sign-in gate. |
| Region | Qatar Central first; UAE North if Qatar Central cannot host every piece. |

**Region outcome: UAE North.** Front Door's Private Link, which the private-first posture needs, is not offered in Qatar Central (DOCUMENTED), and Container Apps in Qatar Central could not be confirmed against the subscription. By the owner's rule the whole stack goes to UAE North, which has three availability zones. Region is one Terraform variable. The data is synthetic, so there is no residency constraint.

One line on posture: with access fully open and a public link, "internal" is not enforced by anything. Anyone who has the link can act as analyst and supervisor. The link is hard to guess, and the WAF rate limits, but neither is access control.

## 2. Architecture

```
Visitor
  |  HTTPS  https://solidsnake-<hash>.z01.azurefd.net   (free managed certificate, no DNS to own)
  v
Azure Front Door Premium + WAF       managed rule set and bot rules, Prevention mode, rate limit on /api
  |  Private Link (UAE North)        the origin has no public address
  v
Container Apps environment           UAE North, workload profiles (Consumption), public network access disabled,
  |                                  in a virtual network
  |-- solid-snake container          1 replica, 0.5 vCPU, 1 GiB, HTTP probes on /healthz
        |-- /data           <- Azure Files share (SMB, ZRS, 1 GiB quota) through a private endpoint
        |-- AUDIT_HMAC_KEY  <- Key Vault secret, read by the app's managed identity through a private endpoint
        |-- image           <- Container Registry, pulled by the same identity
Logs and metrics -> Log Analytics -> two alert rules -> email
```

| Service | SKU and settings | Why | AWS / GCP | USD per day |
|---|---|---|---|---|
| Front Door | Premium, default endpoint, HTTPS only, no caching on `/api` | Public link, TLS, WAF, private origin | CloudFront + WAF + VPC origin / Cloud CDN + Armor + PSC | 11 (330 a month, billed per hour used, DOCUMENTED) |
| WAF policy | Default rule set and bot manager, Prevention; custom rule: rate limit per client on `/api/*` | The only abuse control on an open app | AWS WAF / Cloud Armor | included |
| Container Apps environment | Workload profiles, Consumption only, public access off, zone redundancy off | Runs the container | Fargate / Cloud Run | 3.4 environment private endpoint + 2.4 plan management (FEED; DOCUMENTED that private endpoints bring a plan management charge) |
| Container app | min = max = 1 replica, 0.5 vCPU, 1 GiB, user-assigned identity | The app | Fargate task / Cloud Run service | about 1.8 if busy all day (FEED); much of it covered by the monthly free grant |
| Virtual network | /24: Container Apps subnet /27 (delegated, the documented minimum), endpoints /28; a network security group on each | Private paths | VPC | 0 |
| Storage account, file share | StorageV2, Hot, ZRS, SMB, public access off, private endpoint, 1 GiB quota | Persistent cases | EFS / Filestore | under 0.1 |
| Key Vault | Standard, RBAC, public access off, private endpoint, name with random suffix | Signing key | Secrets Manager | under 0.1 |
| Private endpoints and private DNS | Files and Key Vault, two private DNS zones linked to the network | No public data plane | Interface endpoints | 0.5 (JUDGMENT, standard hourly rate) |
| Container Registry | Basic, admin user off, pull by managed identity | Image for this deployment | ECR / Artifact Registry | 0.2 |
| Log Analytics and alerts | 1 GB daily cap, diagnostic settings on every resource | Failure visibility during the demo | CloudWatch | about 0 (first 5 GB a month free, DOCUMENTED) |
| **Total** | | | | **about 20 per day up, about 0 down** |

Cheaper alternative, if wanted: Front Door Standard with custom WAF rules only and a public origin limited to Front Door's service tag. About $4 a day. It gives up the managed rule set and the private origin, which is what "private-first, highly secure" asks for, so it is not recommended here.

## 3. How it works

- **Request.** The visitor uses the Front Door link. The WAF inspects and rate-limits. Front Door reaches the environment over Private Link. The environment's public access is disabled, so the `*.azurecontainerapps.io` address cannot be used to go around the WAF (DOCUMENTED).
- **Identity.** One user-assigned managed identity per deployment, with AcrPull on the registry and Key Vault Secrets User on the vault. No passwords anywhere.
- **Signing key.** The `up` workflow generates a fresh 64-character key, masks it in the logs, and writes it to Key Vault. It never passes through Terraform, so it is never in state. The app reads it through a Key Vault reference. The key lives and dies with the deployment, as the cases do.
- **Storage.** The share mounts at `/data` with `uid=65532,gid=65532,dir_mode=0750,file_mode=0640,nobrl` (UNVERIFIED, spike S1). The mount authenticates with the storage account key held by the environment, because identity-based SMB mounts are in preview and outside the azurerm provider (DOCUMENTED). The account allows no public network access, so the key is only usable from inside the network.
- **Releases during a demo: stop, then start.** Container Apps starts a new revision before stopping the old one, even with one replica (DOCUMENTED). That means two writers on one log. A mid-demo release therefore stops the running revision first, then applies the new image, then smoke-tests. Expect about a minute of downtime. A fresh `up` is unaffected.

## 4. Lifecycle from CI/CD

Three layers, so a day's deployment is fully created and fully destroyed by pipelines while the few things that must outlive it stay put.

| Layer | Contents | Who runs it | Lives |
|---|---|---|---|
| `bootstrap` | Terraform state storage (Entra auth, versioning, soft delete); an empty resource group for the platform; two GitHub OIDC identities with role assignments on that group; a subscription budget with alerts | Owner, once, from a laptop | Permanent, about $0 |
| `base` | Network and security groups, registry, Key Vault, storage and share, private endpoints and DNS, Log Analytics, app identity, role assignments | `up` workflow | One demo |
| `app` | Container Apps environment, container app, Front Door profile, endpoint, origin with Private Link, WAF, alerts | `up` workflow | One demo |

**`up` (manual, `prod` environment approval).**
1. `terraform apply` for `base`.
2. Build the image on the runner, run unit tests, scan with Trivy (fail on HIGH or CRITICAL), and push by digest.
3. Generate the signing key and write it to Key Vault.
4. `terraform apply` for `app`, with the image digest as a variable.
5. Approve the Private Link connection on the environment (spike S3), wait for Front Door to propagate, then smoke-test `/healthz` and `/api/session` through the public link.
6. Tag the resources with an expiry time and print the link in the run summary.

Expect 15 to 25 minutes, mostly Front Door propagation (JUDGMENT).

**`down` (manual, typed confirmation).** Destroy `app`, then `base`. The Key Vault uses a random name and is purged on destroy, so the next `up` never collides with a soft-deleted vault. Purge protection is deliberately off for this ephemeral vault. It would block purging for up to 90 days and protects nothing once the logs it signs are destroyed.

**`expire` (scheduled, hourly).** If the expiry tag has passed, it runs `down`. This is a guard against a forgotten demo burning $20 a day.

**Pull requests.** Format, validate, lint, configuration scan and `terraform plan` for `base` and `app` against an empty state. Plus the app's tests and an image build with a scan. No apply.

**CI identities, no client secrets.**
- `plan`: Reader on the platform group and read access to state, federated to pull requests.
- `deploy`: on the platform group only, federated to the `prod` environment. It holds three roles:
  - Contributor;
  - Key Vault Secrets Officer, to write the key;
  - Role Based Access Control Administrator, restricted by condition to granting AcrPull and Key Vault Secrets User.

  It has nothing at subscription scope, because the resource group itself comes from `bootstrap`.

**Repository layout.** `infra/bootstrap`, `infra/base`, `infra/app`, flat files, no modules (one app, so modules would be indirection without reuse). Workflows go in `.github/workflows/` (`pr.yml`, `up.yml`, `down.yml`, `expire.yml`), with every action pinned by commit SHA. Terraform 1.11 or later, `azurerm` 4.x, plus `azapi` only where azurerm has no resource (S3).

## 5. Well-Architected position

**Primary pillar: Security**, as the owner asked (private-first, highly secure), within a one-day cost of about $20.

| Pillar | Position | Given up |
|---|---|---|
| Security | WAF with managed rules and rate limiting, private origin, private data plane, managed identity, per-deployment key outside state, scoped CI identities | No access control by owner decision; one shared storage key inside the network |
| Reliability | One replica, one region, zone-redundant share; recovery is `down` then `up` | No high availability; a mid-demo release costs about a minute |
| Cost | About $20 a day up, about $0 down, an expiry guard and a budget | Premium's private origin costs about $16 a day more than Standard |
| Performance | Front Door edge near the audience, origin in UAE North | No caching of dynamic paths |
| Operations | Everything from pipelines, plan on pull request, approved apply, smoke test, alerts | 15 to 25 minutes to stand up |

## 6. Against the aca-middleware standard

| | |
|---|---|
| **Matched** | Front Door Premium with WAF in Prevention and Private Link origin; private endpoints with private DNS; managed identity for registry and Key Vault; GitHub OIDC; approved apply; pinned actions; scan before deploy; diagnostics everywhere |
| **Improved** | CI identity scoped to one resource group with a constrained role-assignment right, instead of Contributor on the subscription; Key Vault public access off; no DNS provider keys at all; plan on pull request; alerts; network security groups; key kept out of state; automatic expiry |
| **Different on purpose** | Ephemeral by design; Registry Basic; no database, cache or jobs; one app with stop-then-start; flat Terraform; no domain |

## 7. Spikes before relying on the design

| # | Question | Fallback |
|---|---|---|
| S1 | Do append and write-then-rename behave on the SMB share for uid 65532, through a kill mid-write? | NFS on a premium share, private network only |
| S2 | Does the WAF managed rule set block the app's JSON calls? Run in Detection for the first deployment and read the logs | Targeted rule exclusions |
| S3 | Can the Private Link approval be done in the pipeline (azapi or one CLI call), and how long until the endpoint serves? | Manual approval step in the workflow |
| S4 | Is every service available to this subscription in UAE North? Run `az login`, then `az provider show` per type | None expected; UAE North is a mature region |

## 8. Not included, deliberately

A sign-in gate (owner decision); a custom domain and DNS zone; a second region or staging environment; a database or cache; DDoS Network Protection; Registry Premium; image signing; Azure Policy. Keeping cases between demos would mean moving the storage account and Key Vault into `bootstrap`; that is a small change if wanted later.

## 9. Sequence

1. `az login`, then S4. Run `bootstrap` from a laptop.
2. Write `base`, `app` and the workflows. Use the first `up` to prove S3, then S1 and S2 with the WAF in Detection.
3. Switch the WAF to Prevention. Write ADRs for region, edge, ephemeral lifecycle, audit storage and single writer, secrets, CI identities.
4. Rehearse: `up`, a full case to referral, `down`, `up` again.

## 10. Notes for implementation

- Container Apps ignores the Dockerfile `HEALTHCHECK`. Set startup, readiness and liveness probes on `/healthz` in Terraform.
- The image tag is a Terraform variable set to the digest from the build step. Never use `az containerapp update` outside Terraform, or state drifts.
- Container app settings: `HOST=0.0.0.0`, `PORT=8080`, `RUNTIME_DIR=/data`, `DATA_DIR` and `STATIC_DIR` as baked into the image, `AUDIT_HMAC_KEY` from the Key Vault reference. The container stays read-only.

## 11. Sources

- Front Door billing (hourly base fee, no Private Link surcharge): https://learn.microsoft.com/en-us/azure/frontdoor/billing and https://azure.microsoft.com/en-us/pricing/details/frontdoor/
- Front Door to Container Apps over Private Link: https://learn.microsoft.com/en-us/azure/container-apps/how-to-integrate-with-azure-front-door
- Front Door Private Link regions: https://learn.microsoft.com/en-us/azure/frontdoor/private-link
- Front Door tiers and WAF rule sets: https://learn.microsoft.com/en-us/azure/frontdoor/front-door-cdn-comparison
- Container Apps billing (plan management with private endpoints): https://learn.microsoft.com/en-us/azure/container-apps/billing
- Container Apps networking and subnet sizes: https://learn.microsoft.com/en-us/azure/container-apps/networking and https://learn.microsoft.com/en-us/azure/container-apps/custom-virtual-networks
- Container Apps revisions: https://learn.microsoft.com/en-us/azure/container-apps/revisions
- Container Apps storage mounts: https://learn.microsoft.com/en-us/azure/container-apps/storage-mounts
- Container Apps secrets and Key Vault references: https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets
- Container Apps image pull with managed identity: https://learn.microsoft.com/en-us/azure/container-apps/managed-identity-image-pull
- Container Apps health probes: https://learn.microsoft.com/en-us/azure/container-apps/health-probes
- Container Apps logs and metrics: https://learn.microsoft.com/en-us/azure/container-apps/log-monitoring and https://learn.microsoft.com/en-us/azure/container-apps/metrics
- Region list and zones: https://learn.microsoft.com/en-us/azure/reliability/regions-list
- GitHub OIDC to Azure: https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect
- Log Analytics daily cap: https://learn.microsoft.com/en-us/azure/azure-monitor/logs/daily-cap
- Retail price feed: https://prices.azure.com/api/retail/prices
