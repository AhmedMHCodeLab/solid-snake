variable "name" {
  description = "Key Vault name, globally unique, max 24 characters."
  type        = string
}

variable "location" {
  description = "Azure region."
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group."
  type        = string
}

variable "subnet_id" {
  description = "ID of the private endpoints subnet."
  type        = string
}

variable "private_dns_zone_id" {
  description = "ID of the privatelink.vaultcore.azure.net zone."
  type        = string
}

variable "log_analytics_workspace_id" {
  description = "Log Analytics workspace for diagnostics."
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources."
  type        = map(string)
}
