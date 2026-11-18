resource "azurerm_container_app_environment" "env" {
  name                       = "cae-${var.name}"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  infrastructure_subnet_id   = var.subnet_id
  logs_destination           = "log-analytics"
  log_analytics_workspace_id = var.log_analytics_workspace_id
  public_network_access      = var.public_network_access

  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }

  tags = var.tags
}

resource "azurerm_container_app_environment_storage" "audit" {
  name                         = "audit"
  container_app_environment_id = azurerm_container_app_environment.env.id
  account_name                 = var.storage_account_name
  access_key                   = var.storage_account_key
  share_name                   = var.share_name
  access_mode                  = "ReadWrite"
}

# One replica, one revision: the audit log allows a single writer (ADR 0006).
resource "azurerm_container_app" "app" {
  name                         = "ca-${var.name}"
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.env.id
  revision_mode                = "Single"
  tags                         = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [var.identity_id]
  }

  registry {
    server   = var.acr_login_server
    identity = var.identity_id
  }

  secret {
    name                = "audit-hmac-key"
    key_vault_secret_id = var.signing_key_secret_id
    identity            = var.identity_id
  }

  ingress {
    external_enabled = true
    target_port      = 8080

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 1
    max_replicas = 1

    volume {
      name          = "audit"
      storage_type  = "AzureFile"
      storage_name  = azurerm_container_app_environment_storage.audit.name
      mount_options = "uid=65532,gid=65532,dir_mode=0750,file_mode=0640,nobrl"
    }

    container {
      name   = "solidsnake"
      image  = var.image
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "HOST"
        value = "0.0.0.0"
      }

      env {
        name  = "PORT"
        value = "8080"
      }

      env {
        name  = "RUNTIME_DIR"
        value = "/data"
      }

      env {
        name        = "AUDIT_HMAC_KEY"
        secret_name = "audit-hmac-key"
      }

      volume_mounts {
        name = "audit"
        path = "/data"
      }

      startup_probe {
        transport               = "HTTP"
        port                    = 8080
        path                    = "/healthz"
        interval_seconds        = 5
        failure_count_threshold = 24
      }

      liveness_probe {
        transport = "HTTP"
        port      = 8080
        path      = "/healthz"
      }
    }
  }

  lifecycle {
    # Azure returns the resolved secret value; without this every plan shows a diff.
    ignore_changes = [secret]
  }
}
