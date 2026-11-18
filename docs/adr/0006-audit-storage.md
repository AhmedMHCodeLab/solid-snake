# 0006 Audit log on an SMB share mounted with the account key; single writer by design

**Context.**
- The app keeps its audit log as append-only files on `/data`, with no file locking.
- Container Apps starts a new revision before stopping the old one, even with one replica (learn.microsoft.com/azure/container-apps/revisions).
- Identity-based SMB mounts are preview (Microsoft.App 2026-03-02-preview) and are not in azurerm 5.14. `azurerm_container_app_environment_storage` takes only an access key and has no write-only key (azurerm issue #33124), and `azurerm_storage_account` exports its keys to state.

**Decision.**
- The audit log lives on an Azure Files SMB share: ZRS, 1 GiB quota, public network access disabled, reached through a private endpoint, mounted with the account key and `uid=65532,gid=65532,dir_mode=0750,file_mode=0640,nobrl`.
- One replica in Single revision mode.
- A new image means a fresh deployment (infra-down, then infra-up), so two revisions never write together.

**Consequences.**
- Cases survive restarts and releases for the life of a demo.
- A release costs about a minute of downtime.
- The storage key is in Terraform state. This is an accepted risk: state is Entra-only and versioned, the account has no public path, and every `up` creates a new account and key.
- Append and rename behaviour on SMB for uid 65532 is unverified until the owner's first deployment runs `verify.sh`. If it fails, fall back to NFS on a premium share, which is private network only.

**Revisit when** identity-based mounts are generally available and in azurerm. That removes the key from state.
