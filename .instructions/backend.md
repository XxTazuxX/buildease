# Backend

Load for Java/Spring behavior, API, application logic, or backend integration.

## Stack and boundaries
Target Java 21, Spring Boot, Maven, Spring Web, Spring Data JPA, Hibernate, Spring Validation, Spring Security, HikariCP, PostgreSQL JDBC, and Flyway. Do not introduce another backend framework or language without a specific requirement. Dependency changes follow [java-dependencies.md](java-dependencies.md).

Dependency direction: Controller → Service/Application → Repository → PostgreSQL. DTOs, mappers, validation, security, exceptions, configuration, and domain logic support those boundaries.
- Significant workflows must go through services.
- Repositories must not depend on controllers or contain business rules.
- Persistence entities must not automatically become REST contracts.
- Put important business rules in application/domain logic.
- For money, lifecycle, or state-transition changes, load the domain invariants in [architecture.md](architecture.md).
- For persistence changes, load [database-neon.md](database-neon.md); for access control, load [security.md](security.md).

Package placement belongs to [folder-structure.md](folder-structure.md); add layers only when complexity justifies them.

## API
Use `/api/**`, appropriate HTTP status codes, validated inputs, and consistent errors. Add pagination, sorting, filtering, and search where appropriate. Inspect existing DTO, mapper, error, and response conventions before introducing a pattern.

Examples: `GET/POST /api/buildings`, `GET /api/buildings/{id}`, `GET /api/buildings/{buildingId}/rooms`, `GET /api/tenants`, `POST /api/maintenance-requests`.

Domain operations may be explicit endpoints, such as `POST /api/rooms/{id}/assign`, `/api/tenants/{id}/vacate`, or `/api/invoices/{id}/payments`. Design them around validated business operations.
