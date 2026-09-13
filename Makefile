SHELL := /bin/bash
.PHONY: verify backend frontend e2e dev-backend dev-frontend bootstrap
verify: backend frontend e2e
backend:
	cd backend && ./mvnw verify
frontend:
	cd frontend && npm ci && npm run quality
e2e:
	cd frontend && npm run test:e2e
dev-backend:
	cd backend && ./mvnw spring-boot:run
dev-frontend:
	cd frontend && npm run dev
bootstrap:
	cd backend && ./mvnw spring-boot:run -Dspring-boot.run.arguments="--app.bootstrap=true --spring.main.web-application-type=none"
