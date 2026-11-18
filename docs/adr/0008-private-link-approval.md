# 0008 Approve the Front Door Private Link connection in the infra-up workflow

**Context.**
- Front Door creates a pending private endpoint connection on the Container Apps environment.
- azurerm 5.14 has no resource to approve it, and Azure generates the connection name only after the origin exists.
- Microsoft's own sample approves it as a separate step.

**Decision.** After `terraform apply`, infra-up lists the environment's pending private endpoint connections and approves them with the Azure CLI. This is a four-line inline step.

**Consequences.**
- Terraform never manages the connection, so it never drifts.
- The site serves once the step finishes.

**Revisit when** azurerm adds an approval resource.
