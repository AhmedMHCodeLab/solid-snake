# 0004 Own modules on azurerm 5.14; Azure Verified Modules evaluated and not used

**Context.** Research on 2026-11-17, from each module repository and the AVM index, found:
- The Front Door, Front Door WAF, Key Vault and identity modules cap azurerm below 5.0. One provider version applies per configuration, so any of them blocks azurerm 5.14.
- The other modules are azapi-only and still 0.x.
- The Key Vault module is orphaned.

**Decision.** Five small modules of our own, one concern each: networking, keyvault, storage, container_apps and frontdoor. They use azurerm 5.14, with azapi only for the signing key.

**Consequences.**
- One provider style, plan-time schema checks, and code a new engineer can read top to bottom.
- We maintain about 600 lines of module code.

**Revisit when** the AVM Front Door and Key Vault modules support azurerm 5 and reach 1.0.
