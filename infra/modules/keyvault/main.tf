data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "kv" {
  name                = var.name
  location            = var.location
  resource_group_name = var.resource_group_name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"

  rbac_authorization_enabled    = true
  public_network_access_enabled = false
  # Off so destroy can purge the vault; the platform lives one demo.
  purge_protection_enabled   = false
  soft_delete_retention_days = 7

  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"
  }

  tags = var.tags
}

resource "azurerm_private_endpoint" "kv" {
  name                = "pe-${var.name}"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.subnet_id

  private_service_connection {
    name                           = "psc-${var.name}"
    private_connection_resource_id = azurerm_key_vault.kv.id
    subresource_names              = ["vault"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [var.private_dns_zone_id]
  }

  tags = var.tags
}

# The audit signing key never touches state: generated ephemerally, written through write-only sensitive_body (ADR 0005).
ephemeral "random_password" "signing_key" {
  length  = 64
  special = false
}

# ARM has no delete for vault secrets (405), so an action writes it: destroy makes no call and the vault delete removes it.
resource "azapi_resource_action" "signing_key" {
  type        = "Microsoft.KeyVault/vaults/secrets@2026-05-15"
  resource_id = "${azurerm_key_vault.kv.id}/secrets/audit-hmac-key"
  method      = "PUT"

  body = {
    properties = {}
  }

  sensitive_body = {
    properties = {
      value = ephemeral.random_password.signing_key.result
    }
  }

  sensitive_body_version = {
    "properties.value" = "1"
  }
}

resource "azurerm_monitor_diagnostic_setting" "kv" {
  name                       = "diag-keyvault"
  target_resource_id         = azurerm_key_vault.kv.id
  log_analytics_workspace_id = var.log_analytics_workspace_id

  enabled_log {
    category_group = "allLogs"
  }
}
