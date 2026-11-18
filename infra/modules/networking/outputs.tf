output "aca_subnet_id" {
  description = "ID of the Container Apps subnet."
  value       = azurerm_subnet.aca.id
}

output "pe_subnet_id" {
  description = "ID of the private endpoints subnet."
  value       = azurerm_subnet.pe.id
}

output "private_dns_zone_ids" {
  description = "Private DNS zone IDs, keyed by keyvault and file."
  value       = { for k, z in azurerm_private_dns_zone.zones : k => z.id }
}
