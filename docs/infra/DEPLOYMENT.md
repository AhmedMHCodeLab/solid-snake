# Deployment

Four workflows: `ci` (pull request), `build` (push to main), `infra-up` and `infra-down` (manual).

## 1. Bootstrap once

Local, with your own `az login`. This creates:
- the state storage;
- the registry;
- the environment resource groups;
- the app and CI identities;
- the budgets.

Its own state stays local: this layer is created once by hand.

```powershell
az login
terraform -chdir=infra/bootstrap init
# -parallelism=1: Azure rejects concurrent federated credential writes on one identity
terraform -chdir=infra/bootstrap apply -parallelism=1 -var="github_repository=<owner>/<repo>" -var="budget_email=<you@example.com>"
terraform -chdir=infra/bootstrap output
```

Set the five repository variables (Settings, Secrets and variables, Actions, Variables):

| Variable | Source |
|---|---|
| AZURE_CLIENT_ID | output `azure_client_id` |
| AZURE_TENANT_ID | `az account show --query tenantId -o tsv` |
| AZURE_SUBSCRIPTION_ID | `az account show --query id -o tsv` |
| ACR_NAME | output `acr_name` |
| TFSTATE_STORAGE_ACCOUNT | output `tfstate_storage_account` |

Put the same ACR name in `acr_name` in `infra/env/*.tfvars`.

Create the GitHub environments `dev`, `staging` and `prod` (Settings, Environments). Add required reviewers to `prod`.

## 2. Build an image

Actions, Build, Run workflow (or push to main). Copy the digest (`sha256:...`) from the job summary.

## 3. Infra up

Actions, Infrastructure Up, Run workflow. Pick `environment`, paste `image_digest`. Approve the apply job if the environment has reviewers.

The job approves the Front Door private link and writes the URL to the summary.

## 4. Verify

```bash
URL=https://<url from the summary>
curl -i "$URL/healthz"
```

Expect 200.

The Container Apps default domain must not answer:

```bash
az containerapp env show -g <resource group> -n <environment name> --query properties.defaultDomain -o tsv
curl -m 10 -i https://<default domain>/
```

Expect a timeout or an error.

WAF blocks a script payload in Prevention (staging, prod). In Detection (dev) it is logged, not blocked.

```bash
curl -i "$URL/?q=<script>"
```

Expect 403 in Prevention.

The environment has no public network access:

```bash
az resource show --ids <container_app_environment_id> --query properties.publicNetworkAccess -o tsv
```

Expect `Disabled`.

## 5. Infra down

Actions, Infrastructure Down, Run workflow. Pick `environment`, type `DESTROY` in `confirm`.

Bootstrap resources (state, registry, identities) stay. When the project is finished, remove `prevent_destroy` from the state account in `infra/bootstrap/main.tf`, then run `terraform -chdir=infra/bootstrap destroy`.
