variable "name" {
  description = "Storage account name, globally unique, lowercase, max 24 characters."
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
  description = "ID of the privatelink.file.core.windows.net zone."
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources."
  type        = map(string)
}
