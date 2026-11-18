resource "azurerm_storage_account" "st" {
  name                     = var.name
  location                 = var.location
  resource_group_name      = var.resource_group_name
  account_kind             = "StorageV2"
  account_tier             = "Standard"
  account_replication_type = "ZRS"

  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  public_network_access           = "Disabled"
  allow_nested_items_to_be_public = false
  # The Container Apps SMB mount authenticates with the account key (ADR 0006).
  shared_access_key_enabled = true

  tags = var.tags
}

resource "azurerm_storage_share" "audit" {
  name               = "audit"
  storage_account_id = azurerm_storage_account.st.id
  quota              = 1
}

resource "azurerm_private_endpoint" "file" {
  name                = "pe-${var.name}"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.subnet_id

  private_service_connection {
    name                           = "psc-${var.name}"
    private_connection_resource_id = azurerm_storage_account.st.id
    subresource_names              = ["file"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [var.private_dns_zone_id]
  }

  tags = var.tags
}
