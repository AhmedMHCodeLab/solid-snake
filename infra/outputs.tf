output "url" {
  description = "Public URL of the platform."
  value       = "https://${module.frontdoor.endpoint_host_name}"
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
