ifeq ($(OS),Windows_NT)
SHELL := C:/Program Files/Git/bin/bash.exe
else
SHELL := /bin/bash
endif
.PHONY: verify backend frontend e2e dev-backend dev-frontend bootstrap package run
verify: backend frontend e2e
backend:
	cd backend && ./mvnw verify
frontend:
	cd frontend && npm ci && npm run quality
e2e:
	cd frontend && npm run test:e2e
package:
	cd backend && ./mvnw -Pbundle-ui clean package
run:
	set -a; source .env; set +a; java -jar backend/target/buildease-*.jar --server.port=4567
dev-backend:
	set -a; source .env; set +a; cd backend && ./mvnw spring-boot:run
dev-frontend:
	cd frontend && npm run dev
bootstrap:
	set -a; source .env; set +a; cd backend && ./mvnw spring-boot:run -Dspring-boot.run.arguments="--app.bootstrap=true --spring.main.web-application-type=none"
