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

variable "subnet_id" {
  description = "ID of the delegated Container Apps subnet."
  type        = string
}

variable "log_analytics_workspace_id" {
  description = "Log Analytics workspace for container logs."
  type        = string
}

variable "identity_id" {
  description = "User-assigned identity that pulls the image and reads the signing key."
  type        = string
}

variable "public_network_access" {
  description = "Enabled serves the app on its Container Apps address; Disabled leaves only Front Door Private Link."
  type        = string
}

variable "acr_login_server" {
  description = "Login server of the container registry."
  type        = string
}

variable "image" {
  description = "Full image reference pinned by digest."
  type        = string
}

variable "signing_key_secret_id" {
  description = "Key Vault URI of the audit signing key."
  type        = string
}

variable "storage_account_name" {
  description = "Storage account holding the audit share."
  type        = string
}

variable "storage_account_key" {
  description = "Storage account key for the SMB mount."
  type        = string
  sensitive   = true
}

variable "share_name" {
  description = "Name of the audit file share."
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources."
  type        = map(string)
}
