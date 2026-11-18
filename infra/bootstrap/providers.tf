provider "azurerm" {
  resource_provider_registrations = "none"
  resource_providers_to_register = [
    "Microsoft.App",
    "Microsoft.Cdn",
    "Microsoft.Consumption",
    "Microsoft.ContainerRegistry",
    "Microsoft.KeyVault",
    "Microsoft.ManagedIdentity",
    "Microsoft.Network",
    "Microsoft.OperationalInsights",
    "Microsoft.Storage",
  ]
  storage_use_azuread = true

  features {}
}

# Token comes from the GITHUB_TOKEN environment variable.
provider "github" {
  owner = split("/", var.github_repository)[0]
}
