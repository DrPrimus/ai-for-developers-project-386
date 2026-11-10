#!/bin/bash
set -o pipefail
set -e

# Maven wrapper - use absolute path from project root
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo /)"
MWINW="$PROJECT_ROOT/BE/mvnw"

# Compile the project (type check) - use pom.xml in BE/ directory
# Check if compilation succeeds
COMPILE_OUTPUT=$("$MWINW" -f BE/pom.xml clean compile 2>&1)
COMPILE_EXIT=$?

if [ $COMPILE_EXIT -ne 0 ]; then
    echo "BUILD FAIL - compilation error, skip smoke test"
    exit 1
fi

# Start the application
"$MWINW" -f BE/pom.xml spring-boot:start 2>&1 > /dev/null &
START_PID=$!

# Wait for application to start
for i in $(seq 1 15); do
    if curl -sf http://127.0.0.1:8080/actuator/health > /dev/null 2>&1; then
        echo "SMOKE TEST: OK"
        "$MWINW" -f BE/pom.xml spring-boot:stop 2>&1 || true
        exit 0
    fi
    sleep 1
done

echo "SMOKE TEST: FAIL - app didn't start in time"
"$MWINW" -f BE/pom.xml spring-boot:stop 2>&1 || true
exit 1
