# One CI identity for GitHub Actions, federated through OIDC: no client secret anywhere.
resource "azurerm_user_assigned_identity" "ci" {
  name                = "id-${var.project_name}-ci"
  resource_group_name = azurerm_resource_group.core.name
  location            = azurerm_resource_group.core.location
  tags                = local.tags
}

# build.yml and the plan job run on main; apply and destroy run in a GitHub environment.
resource "azurerm_federated_identity_credential" "main" {
  name                      = "github-main"
  user_assigned_identity_id = azurerm_user_assigned_identity.ci.id
  issuer                    = "https://token.actions.githubusercontent.com"
  audience                  = ["api://AzureADTokenExchange"]
  subject                   = "repo:${var.github_repository}:ref:refs/heads/main"
}

resource "azurerm_federated_identity_credential" "env" {
  for_each = var.environments

  name                      = "github-${each.key}"
  user_assigned_identity_id = azurerm_user_assigned_identity.ci.id
  issuer                    = "https://token.actions.githubusercontent.com"
  audience                  = ["api://AzureADTokenExchange"]
  subject                   = "repo:${var.github_repository}:environment:${each.key}"
}

resource "azurerm_role_assignment" "ci_env_contributor" {
  for_each = azurerm_resource_group.env

  scope                = each.value.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_user_assigned_identity.ci.principal_id
}

# Read the registry and the app identity from the platform root.
resource "azurerm_role_assignment" "ci_core_reader" {
  scope                = azurerm_resource_group.core.id
  role_definition_name = "Reader"
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
