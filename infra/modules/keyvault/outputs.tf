output "signing_key_secret_id" {
  description = "Versionless URI of the audit signing key, for the container app's Key Vault reference."
  value       = "${azurerm_key_vault.kv.vault_uri}secrets/audit-hmac-key"
  depends_on  = [azapi_resource_action.signing_key]
}
