data "azurerm_client_config" "current" {}

locals {
  actions_variables = {
    AZURE_CLIENT_ID         = azurerm_user_assigned_identity.ci.client_id
    AZURE_TENANT_ID         = data.azurerm_client_config.current.tenant_id
    AZURE_SUBSCRIPTION_ID   = data.azurerm_client_config.current.subscription_id
    ACR_NAME                = azurerm_container_registry.acr.name
    TFSTATE_STORAGE_ACCOUNT = azurerm_storage_account.tfstate.name
  }
}

resource "github_repository" "repo" {
  name                   = split("/", var.github_repository)[1]
  description            = "Telecom fraud intelligence platform demo on synthetic data"
  visibility             = "public"
  has_issues             = true
  delete_branch_on_merge = true
}

resource "github_actions_variable" "azure" {
  for_each = local.actions_variables

  repository    = github_repository.repo.name
  variable_name = each.key
  value         = each.value
}

resource "github_repository_environment" "env" {
  for_each = var.environments

  repository  = github_repository.repo.name
  environment = each.key
}
