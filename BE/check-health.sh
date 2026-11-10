#!/bin/bash
set -e

# Maven wrapper - use absolute path from project root
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo /)"
MWINW="$PROJECT_ROOT/BE/mvnw"

# Compile the project (type check) - use pom.xml in BE/ directory
"$MWINW" -f BE/pom.xml clean compile 2>&1 | tail -3 | head -1

# Start the application
"$MWINW" -f BE/pom.xml spring-boot:start 2>&1 > /dev/null &
START_PID=$!

# Wait for application to start
for i in $(seq 1 15); do
    if curl -sf http://localhost:8080/actuator/health > /dev/null 2>&1; then
        echo "SMOKE TEST: OK"
        "$MWINW" -f BE/pom.xml spring-boot:stop 2>&1 || true
        exit 0
    fi
    sleep 1
done

echo "SMOKE TEST: FAIL - app didn't start in time"
"$MWINW" -f BE/pom.xml spring-boot:stop 2>&1 || true
exit 1
