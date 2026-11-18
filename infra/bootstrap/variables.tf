variable "project_name" {
  description = "Project name used in resource names."
  type        = string
  default     = "solidsnake"
}

variable "location" {
  description = "Azure region."
  type        = string
  default     = "uaenorth"
}

variable "environments" {
  description = "Environments that get a resource group and a deploy credential."
  type        = set(string)
  default     = ["dev", "staging", "prod"]
}

variable "github_repository" {
  description = "GitHub repository allowed to deploy, as owner/name."
  type        = string
}

variable "budget_amount" {
  description = "Monthly budget per environment, in the billing currency."
  type        = number
  default     = 50
}

variable "budget_email" {
  description = "Email that receives budget alerts."
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources."
  type        = map(string)
  default     = {}
}
