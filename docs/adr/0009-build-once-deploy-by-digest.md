# 0009 Build the image once, scan it, deploy it by digest

**Context.**
- The platform is destroyed between demos, so rebuilding the image on every deployment would ship something other than what was scanned.
- The trivy-action tags were compromised in March 2026 (GHSA-69fq-xp46-6x23).
- GitHub artifact attestations on private repositories need Enterprise Cloud.

**Decision.**
- The registry (Basic, admin off) lives in bootstrap.
- build.yml builds on merge, fails on HIGH or CRITICAL findings, pushes, and prints the digest.
- infra-up deploys that digest. The root rejects anything that is not `sha256:` plus 64 hex characters.
- Every action is pinned by full commit SHA.

**Consequences.** What runs is exactly what was scanned. There is no signature or attestation check at deploy time.

**Revisit when** the repository can use attestations, or Container Apps can enforce signatures.
