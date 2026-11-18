# 0005 Signing key generated ephemerally and written through a write-only management-plane body

**Context.**
- The app refuses to start without `AUDIT_HMAC_KEY`, and the key must never be regenerated mid-life or leak.
- Terraform 1.10 added ephemeral values and 1.11 added write-only arguments.
- azurerm's `azurerm_key_vault_secret` has `value_wo`, but it writes through the Key Vault data plane. With public network access disabled, a CI runner outside the network cannot reach the data plane.
- azapi 2.14.0 documents `sensitive_body` as write-only (docs/resources/resource.md at v2.14.0). The random provider 3.9.1 has an ephemeral `random_password`.

**Decision.** `ephemeral "random_password"` feeds an `azapi_resource` of type `Microsoft.KeyVault/vaults/secrets`. The value appears only in `sensitive_body` and is written through the management plane. The app reads it through a versionless Key Vault reference with its user-assigned identity.

**Consequences.**
- The key is never in state, plan, variables, outputs or pipeline logs (R2).
- Plan-time policy and a post-deploy state search prove this.
- Each `up` gets a fresh key, matching the per-demo lifecycle of the cases it signs.
- There is no rotation within a demo. A rotation would invalidate the audit log it signs, and the next deployment gets a fresh key anyway.

**Revisit when** azurerm can write Key Vault secrets through the management plane with a write-only argument.
