locals {
  name     = "${var.project_name}-${var.environment}"
  location = data.azurerm_resource_group.env.location
  rg       = data.azurerm_resource_group.env.name
  tags     = merge(var.tags, { project = var.project_name, environment = var.environment, managed_by = "terraform" })
}

# Key Vault and storage names are global; a new suffix per deployment avoids clashes with soft-deleted vaults.
resource "random_string" "suffix" {
  length  = 4
  special = false
  upper   = false
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = "law-${local.name}"
  location            = local.location
  resource_group_name = local.rg
  sku                 = "PerGB2018"
  retention_in_days   = 30
  daily_quota_gb      = 1
  tags                = local.tags
}

module "networking" {
  source = "./modules/networking"

  name                = local.name
  location            = local.location
  resource_group_name = local.rg
  vnet_address_space  = var.vnet_address_space
  snet_aca_cidr       = var.snet_aca_cidr
  snet_pe_cidr        = var.snet_pe_cidr
  tags                = local.tags
}

module "keyvault" {
  source = "./modules/keyvault"

  name                       = "kv${var.project_name}${var.environment}${random_string.suffix.result}"
  location                   = local.location
  resource_group_name        = local.rg
  subnet_id                  = module.networking.pe_subnet_id
  private_dns_zone_id        = module.networking.private_dns_zone_ids["keyvault"]
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  tags                       = local.tags
}

module "storage" {
  source = "./modules/storage"

  name                = "st${var.project_name}${var.environment}${random_string.suffix.result}"
  location            = local.location
  resource_group_name = local.rg
  subnet_id           = module.networking.pe_subnet_id
  private_dns_zone_id = module.networking.private_dns_zone_ids["file"]
  tags                = local.tags
}

module "container_apps" {
  source = "./modules/container_apps"

  name                       = local.name
  location                   = local.location
  resource_group_name        = local.rg
  subnet_id                  = module.networking.aca_subnet_id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  identity_id                = data.azurerm_user_assigned_identity.app.id
  image                      = "${data.azurerm_container_registry.acr.login_server}/solidsnake@${var.image_digest}"
  acr_login_server           = data.azurerm_container_registry.acr.login_server
  signing_key_secret_id      = module.keyvault.signing_key_secret_id
  storage_account_name       = module.storage.storage_account_name
  storage_account_key        = module.storage.primary_access_key
  share_name                 = module.storage.share_name
  tags                       = local.tags
}

module "frontdoor" {
  source = "./modules/frontdoor"

  name                       = local.name
  resource_group_name        = local.rg
  origin_host_name           = module.container_apps.app_fqdn
  aca_environment_id         = module.container_apps.environment_id
  aca_location               = local.location
  waf_mode                   = var.waf_mode
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  tags                       = local.tags
}
