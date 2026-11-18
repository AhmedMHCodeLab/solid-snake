output "signing_key_secret_id" {
  description = "Versionless URI of the audit signing key, for the container app's Key Vault reference."
  value       = "${azurerm_key_vault.kv.vault_uri}secrets/${azapi_resource.signing_key.name}"
}
