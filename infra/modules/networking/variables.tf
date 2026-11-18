variable "name" {
  description = "Name used in resource names, e.g. solidsnake-dev."
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

variable "vnet_address_space" {
  description = "Address space of the virtual network."
  type        = string
}

variable "snet_aca_cidr" {
  description = "Container Apps subnet."
  type        = string
}

variable "snet_pe_cidr" {
  description = "Private endpoints subnet."
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources."
  type        = map(string)
}
