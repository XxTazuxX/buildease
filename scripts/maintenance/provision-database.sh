#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
backend/mvnw -q -f backend/pom.xml dependency:copy-dependencies -DincludeArtifactIds=postgresql -DoutputDirectory=target/jdbc
java -cp 'backend/target/jdbc/*' scripts/maintenance/ProvisionDatabase.java
