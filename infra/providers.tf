provider "azurerm" {
  # Bootstrap registers the providers once; the CI identity has no subscription-level rights.
  resource_provider_registrations = "none"

  features {
    key_vault {
      purge_soft_delete_on_destroy = true
    }
    log_analytics_workspace {
      # Soft-deleted workspaces keep their name for 14 days and block the next deploy.
      permanently_delete_on_destroy = true
    }
    storage {
      # The storage account has no public endpoint, so skip data plane reads.
      data_plane_available = false
    }
  }
}

provider "azapi" {}
