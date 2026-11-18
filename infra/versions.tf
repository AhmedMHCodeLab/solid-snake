terraform {
  required_version = ">= 1.11"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 5.14"
    }
    azapi = {
      source  = "Azure/azapi"
      version = "~> 2.14"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
    }
  }

  # Per environment: terraform init -backend-config=env/<env>.backend.hcl
  backend "azurerm" {}
}
