variable "name" {
  description = "Name used in resource names, e.g. solidsnake-dev."
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group."
  type        = string
}

variable "origin_host_name" {
  description = "Ingress FQDN of the container app."
  type        = string
}

variable "aca_environment_id" {
  description = "Container Apps environment that Front Door reaches over Private Link."
  type        = string
}

variable "aca_location" {
  description = "Region of the Container Apps environment."
  type        = string
}

variable "waf_mode" {
  description = "WAF mode: Detection or Prevention."
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
