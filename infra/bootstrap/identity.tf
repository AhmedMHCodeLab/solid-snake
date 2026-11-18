# One CI identity for GitHub Actions, federated through OIDC: no client secret anywhere.
resource "azurerm_user_assigned_identity" "ci" {
  name                = "id-${var.project_name}-ci"
  resource_group_name = azurerm_resource_group.core.name
  location            = azurerm_resource_group.core.location
  tags                = local.tags
}

data "github_user" "owner" {
  username = split("/", var.github_repository)[0]
}

# GitHub now puts the owner and repository IDs in the OIDC subject (immutable subject), so names alone never match.
locals {
  oidc_subject = "repo:${data.github_user.owner.login}@${data.github_user.owner.id}/${github_repository.repo.name}@${github_repository.repo.repo_id}"
}

# build.yml and the plan job run on main; apply and destroy run in a GitHub environment.
resource "azurerm_federated_identity_credential" "main" {
  name                      = "github-main"
  user_assigned_identity_id = azurerm_user_assigned_identity.ci.id
  issuer                    = "https://token.actions.githubusercontent.com"
  audience                  = ["api://AzureADTokenExchange"]
  subject                   = "${local.oidc_subject}:ref:refs/heads/main"
}

resource "azurerm_federated_identity_credential" "env" {
  for_each = var.environments

  name                      = "github-${each.key}"
  user_assigned_identity_id = azurerm_user_assigned_identity.ci.id
  issuer                    = "https://token.actions.githubusercontent.com"
  audience                  = ["api://AzureADTokenExchange"]
  subject                   = "${local.oidc_subject}:environment:${each.key}"
}

resource "azurerm_role_assignment" "ci_env_contributor" {
  for_each = var.environments

  scope                = azurerm_resource_group.env[each.key].id
  role_definition_name = "Contributor"
  principal_id         = azurerm_user_assigned_identity.ci.principal_id
}

# Read the registry and the app identity from the platform root.
resource "azurerm_role_assignment" "ci_core_reader" {
  scope                = azurerm_resource_group.core.id
  role_definition_name = "Reader"
  principal_id         = azurerm_user_assigned_identity.ci.principal_id
}

# Attaching the app identity to a Container App needs assign/action on that identity.
resource "azurerm_role_assignment" "ci_assign_app_identity" {
  scope                = azurerm_user_assigned_identity.app.id
  role_definition_name = "Managed Identity Operator"
  principal_id         = azurerm_user_assigned_identity.ci.principal_id
}

# infra-down purges the soft-deleted vault; the purge action only exists at subscription scope.
resource "azurerm_role_assignment" "ci_kv_purge" {
  scope                = "/subscriptions/${data.azurerm_client_config.current.subscription_id}"
  role_definition_name = "Key Vault Purge Operator"
  principal_id         = azurerm_user_assigned_identity.ci.principal_id
}

resource "azurerm_role_assignment" "ci_acr_push" {
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPush"
  principal_id         = azurerm_user_assigned_identity.ci.principal_id
}

resource "azurerm_role_assignment" "ci_tfstate" {
  scope                = azurerm_storage_container.tfstate.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.ci.principal_id
}
