output "url" {
  description = "Public URL of the platform."
  value       = var.front_door_enabled ? "https://${module.frontdoor[0].endpoint_host_name}" : "https://${module.container_apps.app_fqdn}"
}

output "front_door_enabled" {
  description = "Whether Front Door fronts this environment; infra-up skips the private link approval when false."
  value       = var.front_door_enabled
}

output "container_app_environment_id" {
  description = "Container Apps environment ID, used to approve the Front Door private link."
  value       = module.container_apps.environment_id
}

output "container_app_name" {
  description = "Name of the container app."
  value       = module.container_apps.app_name
}

output "resource_group_name" {
  description = "Resource group of this environment."
  value       = local.rg
}
