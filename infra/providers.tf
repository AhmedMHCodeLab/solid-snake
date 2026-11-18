provider "azurerm" {
  resource_provider_registrations = "none"
  resource_providers_to_register = [
    "Microsoft.App",
    "Microsoft.Cdn",
    "Microsoft.KeyVault",
    "Microsoft.Network",
    "Microsoft.OperationalInsights",
    "Microsoft.Storage",
  ]

  features {
    key_vault {
      purge_soft_delete_on_destroy = true
    }
    storage {
      # The storage account has no public endpoint, so skip data plane reads.
      data_plane_available = false
    }
  }
}

provider "azapi" {}
