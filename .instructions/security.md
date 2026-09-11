# Security and secrets

Load for authentication, authorization, credentials, sensitive operations, or security configuration.

## Credentials
Use Codespaces secrets, GitHub Actions secrets, and deployment environment variables. Never store real Neon passwords, credential-bearing connection strings, API keys, authentication tokens, private keys, or real-secret `.env` files in version control. Check environment-variable presence without printing values, including in debugging and reports.

## Access control
Backend authorization is authoritative; frontend visibility is only presentation. Model authentication, RBAC, resource authorization, building boundaries, and auditing for sensitive operations. Never assume authentication grants access to every building.

Potential roles: System Administrator, Building Owner, Property Manager, Accountant, Maintenance Staff, Security/Operations Staff, and Tenant. Treat this as intended domain direction, not proof these roles exist.

Identify the actor and resource for every sensitive workflow, enforce appropriate access boundaries, and test allowed and denied operations using [testing-tdd.md](testing-tdd.md).

Security library compatibility and vulnerability upgrades are owned by [java-dependencies.md](java-dependencies.md); load it when dependencies change.
