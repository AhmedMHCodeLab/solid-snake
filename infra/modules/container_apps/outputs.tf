output "environment_id" {
  description = "ID of the Container Apps environment."
  value       = azurerm_container_app_environment.env.id
}

output "app_name" {
  description = "Name of the container app."
  value       = azurerm_container_app.app.name
}

output "app_fqdn" {
  description = "Ingress FQDN of the app, used as the Front Door origin."
  value       = azurerm_container_app.app.ingress[0].fqdn
}
