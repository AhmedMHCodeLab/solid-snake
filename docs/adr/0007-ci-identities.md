# 0007 One OIDC CI identity with no role-assignment rights

**Context.**
- The reference project gave CI Contributor on the whole subscription.
- The platform needs two role assignments for the app: AcrPull on the registry, and Key Vault Secrets User.
- If CI created those, it would need role-assignment rights. Those are the most dangerous rights CI can hold, and limiting them needs a long condition expression.

**Decision.**
- The app's user-assigned identity and both of its role assignments are created once in bootstrap. Key Vault Secrets User is granted at the environment resource group scope, so it covers the vault each deployment creates.
- CI uses one user-assigned identity, federated with GitHub OIDC for the main branch and for each GitHub environment. Its rights:
  - Contributor on the environment groups;
  - Reader on the core group;
  - AcrPush on the registry;
  - Storage Blob Data Contributor on the state container.
- Production applies require reviewers through GitHub environments.

**Consequences.**
- No client secret exists anywhere.
- CI cannot grant access to anything.
- The app identity outlives each deployment, which is harmless because it has no other rights.

**Revisit when** the platform needs a role assignment that cannot be granted at group scope in bootstrap.
