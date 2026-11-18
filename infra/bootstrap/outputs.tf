output "azure_client_id" {
  description = "Set as the AZURE_CLIENT_ID repository variable."
  value       = azurerm_user_assigned_identity.ci.client_id
}

output "acr_name" {
  description = "Set as the ACR_NAME repository variable and acr_name in env/*.tfvars."
  value       = azurerm_container_registry.acr.name
}

output "tfstate_storage_account" {
  description = "Set as the TFSTATE_STORAGE_ACCOUNT repository variable."
  value       = azurerm_storage_account.tfstate.name
}
