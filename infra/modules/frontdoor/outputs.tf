output "endpoint_host_name" {
  description = "Host name of the Front Door endpoint."
  value       = azurerm_cdn_frontdoor_endpoint.endpoint.host_name
}
