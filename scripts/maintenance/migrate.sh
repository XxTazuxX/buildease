#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../backend"
./mvnw spring-boot:run -Dspring-boot.run.arguments="--app.migrate-only=true --spring.main.web-application-type=none"
