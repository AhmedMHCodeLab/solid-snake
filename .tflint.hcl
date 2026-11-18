config {
  call_module_type = "local"
}

plugin "terraform" {
  enabled = true
  preset  = "recommended"
}

plugin "azurerm" {
  enabled = true
  version = "0.33.0"
  source  = "github.com/terraform-linters/tflint-ruleset-azurerm"
}

# The platform is destroyed after every demo; bootstrap sets prevent_destroy on the state account itself.
rule "azurerm_resources_missing_prevent_destroy" {
  enabled = false
}
