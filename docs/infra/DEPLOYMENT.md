# Deployment

Four workflows: `ci` (pull request), `build` (push to main), `infra-up` and `infra-down` (manual).

## 1. Bootstrap once

Local, with your own `az login` and a GitHub token (`gh auth login` first). This creates:
- the GitHub repository itself, with its environments `dev`, `staging` and `prod` and the five variables the workflows use;
- the state storage;
- the registry;
- the environment resource groups;
- the app and CI identities;
- the budgets.

Its own state stays local: this layer is created once by hand. If the repository already exists, import it before the first apply:
`terraform -chdir=infra/bootstrap import -var="github_repository=<owner>/<repo>" -var="budget_email=<you@example.com>" github_repository.repo <repo>`

```bash
az login
az account set --subscription <subscription id>
export GITHUB_TOKEN=$(gh auth token)
terraform -chdir=infra/bootstrap init
# -parallelism=1: Azure rejects concurrent federated credential writes on one identity
terraform -chdir=infra/bootstrap apply -parallelism=1 -var="github_repository=<owner>/<repo>" -var="budget_email=<you@example.com>"
```

Then add required reviewers to the `prod` environment (Settings, Environments).

## 2. Build an image

Actions, Build, Run workflow (or push to main). Copy the digest (`sha256:...`) from the job summary.

## 3. Infra up

Actions, Infrastructure Up, Run workflow. Pick `environment`, paste `image_digest`. Approve the apply job if the environment has reviewers.

The job approves the Front Door private link and writes the URL to the summary.

Dev runs with `front_door_enabled = false` in `infra/env/dev.tfvars` while the subscription has no Front Door Premium quota. The app is then served on its Container Apps address (public ingress, no WAF) and the checks in step 4 for the default domain and WAF do not apply. Remove that line once the quota is granted.

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
