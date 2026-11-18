variable "project_name" {
  description = "Project name used in resource names."
  type        = string
  default     = "solidsnake"
}

variable "environment" {
  description = "Deployment environment."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging or prod."
  }
}

variable "acr_name" {
  description = "Name of the container registry created by bootstrap."
  type        = string
}

variable "image_digest" {
  description = "Digest of the image to deploy, from the build workflow."
  type        = string

  validation {
    condition     = can(regex("^sha256:[a-f0-9]{64}$", var.image_digest))
    error_message = "Image digest must look like sha256:<64 hex characters>."
  }
}

variable "front_door_enabled" {
  description = "Serve through Front Door Premium with WAF over Private Link. When false the app is served on its own Container Apps address."
  type        = bool
  default     = true
}

variable "waf_mode" {
  description = "WAF mode: Detection or Prevention."
  type        = string
  default     = "Prevention"
}

variable "vnet_address_space" {
  description = "Address space of the virtual network."
  type        = string
  default     = "10.40.0.0/24"
}

variable "snet_aca_cidr" {
  description = "Container Apps subnet. /27 is the minimum for workload profiles."
  type        = string
  default     = "10.40.0.0/27"
}

variable "snet_pe_cidr" {
  description = "Private endpoints subnet."
  type        = string
  default     = "10.40.0.32/28"
}

variable "tags" {
  description = "Tags to apply to resources."
  type        = map(string)
  default     = {}
}
