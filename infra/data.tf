# Created once by infra/bootstrap and kept between demos.
data "azurerm_resource_group" "env" {
  name = "rg-${var.project_name}-${var.environment}"
}

data "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = "rg-${var.project_name}-core"
}

data "azurerm_user_assigned_identity" "app" {
  name                = "id-${var.project_name}-app"
  resource_group_name = "rg-${var.project_name}-core"
}
