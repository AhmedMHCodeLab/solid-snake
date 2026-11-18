locals {
  tags = merge(var.tags, { project = var.project_name, managed_by = "terraform" })
}

resource "random_string" "suffix" {
  length  = 4
  special = false
  upper   = false
}

resource "azurerm_resource_group" "core" {
  name     = "rg-${var.project_name}-core"
  location = var.location
  tags     = local.tags
}

# Permanent groups, so the platform can be created and destroyed inside them without subscription-level rights.
resource "azurerm_resource_group" "env" {
  for_each = var.environments

  name     = "rg-${var.project_name}-${each.key}"
  location = var.location
  tags     = merge(local.tags, { environment = each.key })
}

resource "azurerm_storage_account" "tfstate" {
  name                            = "st${var.project_name}tf${random_string.suffix.result}"
  resource_group_name             = azurerm_resource_group.core.name
  location                        = azurerm_resource_group.core.location
  account_tier                    = "Standard"
  account_replication_type        = "ZRS"
  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = false
  allow_nested_items_to_be_public = false

  blob_properties {
    versioning_enabled = true

    delete_retention_policy {
      days = 7
    }
  }

  tags = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_storage_container" "tfstate" {
  name               = "tfstate"
  storage_account_id = azurerm_storage_account.tfstate.id

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_container_registry" "acr" {
  name                = "acr${var.project_name}${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.core.name
  location            = azurerm_resource_group.core.location
  sku                 = "Basic"
  admin_enabled       = false
  tags                = local.tags
}

# The app's identity lives here so its access is granted once and CI never needs role-assignment rights.
resource "azurerm_user_assigned_identity" "app" {
  name                = "id-${var.project_name}-app"
  resource_group_name = azurerm_resource_group.core.name
  location            = azurerm_resource_group.core.location
  tags                = local.tags
}

resource "azurerm_role_assignment" "app_acr_pull" {
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

resource "azurerm_role_assignment" "app_kv_secrets" {
  for_each = var.environments

  scope                = azurerm_resource_group.env[each.key].id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

resource "azurerm_consumption_budget_resource_group" "env" {
  for_each = var.environments

  name              = "budget-${each.key}"
  resource_group_id = azurerm_resource_group.env[each.key].id
  amount            = var.budget_amount

  time_period {
    start_date = "2026-11-01T00:00:00Z"
  }

  notification {
    threshold      = 80
    operator       = "GreaterThan"
    contact_emails = [var.budget_email]
  }
}
