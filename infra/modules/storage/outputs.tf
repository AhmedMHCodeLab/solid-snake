output "storage_account_name" {
  description = "Name of the storage account."
  value       = azurerm_storage_account.st.name
}

output "primary_access_key" {
  description = "Account key for the Container Apps SMB mount."
  value       = azurerm_storage_account.st.primary_access_key
  sensitive   = true
}

output "share_name" {
  description = "Name of the audit file share."
  value       = azurerm_storage_share.audit.name
}
