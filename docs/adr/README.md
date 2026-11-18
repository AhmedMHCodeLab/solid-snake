# Architecture decision records: infrastructure

Format: context, decision, consequences, revisit when. Status of all: accepted 2026-11-17 unless marked.

| # | Decision |
|---|---|
| [0001](0001-region.md) | Host in UAE North; region is one variable |
| [0002](0002-edge.md) | Front Door Premium with WAF and Private Link on the default endpoint; open access |
| [0003](0003-lifecycle-and-state.md) | Permanent bootstrap plus an ephemeral platform; one state per environment |
| [0004](0004-own-modules-over-avm.md) | Own modules on azurerm 5.14; Azure Verified Modules evaluated and not used |
| [0005](0005-signing-key-out-of-state.md) | Signing key generated ephemerally and written through a write-only management-plane body |
| [0006](0006-audit-storage.md) | Audit log on an SMB share mounted with the account key; single writer by design |
| [0007](0007-ci-identities.md) | One OIDC CI identity with no role-assignment rights |
| [0008](0008-private-link-approval.md) | Approve the Front Door Private Link connection in the infra-up workflow |
| [0009](0009-build-once-deploy-by-digest.md) | Build the image once, scan it, deploy it by digest |
