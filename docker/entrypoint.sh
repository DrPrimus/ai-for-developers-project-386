#!/bin/sh
# Runs both processes in one container: Spring Boot in the background, nginx
# in the foreground. The shell stays alive to forward SIGTERM/SIGINT to both
# (tini is PID 1 and forwards the signal to this script).
set -eu

# Fits a small 512 MB / low-CPU instance together with nginx: a heap
# capped at 70% of the cgroup limit, SerialGC to keep overhead low, small
# thread stacks and a fast exit on OOM so the platform can restart the service.
JAVA_OPTS="${JAVA_OPTS:--XX:MaxRAMPercentage=70 -XX:+UseSerialGC -Xss512k -XX:+ExitOnOutOfMemoryError}"

# BACKEND_PORT is the single source of truth (set by the Dockerfile): Spring
# Boot binds loopback only, leaving the public port to nginx.
export SERVER_PORT="${BACKEND_PORT}"
export SERVER_ADDRESS=127.0.0.1

is_running() {
  kill -0 "$1" 2>/dev/null
}

echo "entrypoint: starting Spring Boot on 127.0.0.1:${BACKEND_PORT}"
# Word splitting is intended: JAVA_OPTS is a flag list.
# shellcheck disable=SC2086
java $JAVA_OPTS -jar /app/app.jar &
JAVA_PID=$!

echo "entrypoint: starting nginx on 0.0.0.0:${PORT}"
# The official image entrypoint renders /etc/nginx/templates via envsubst and
# then execs nginx. `-g "daemon off;"` keeps the nginx master in the foreground;
# the nginx:1.29 image passes it in CMD, not in the entrypoint itself.
/docker-entrypoint.sh nginx -g 'daemon off;' &
NGINX_PID=$!

shutdown() {
  trap - TERM INT QUIT
  echo "entrypoint: shutdown requested, stopping nginx and Spring Boot"
  kill -TERM "$NGINX_PID" 2>/dev/null || true
  kill -TERM "$JAVA_PID" 2>/dev/null || true
  wait "$NGINX_PID" 2>/dev/null || true
  wait "$JAVA_PID" 2>/dev/null || true
  echo "entrypoint: stopped"
  exit 0
}

trap shutdown TERM INT QUIT

# If either process dies, stop the other one and fail the container.
while is_running "$JAVA_PID" && is_running "$NGINX_PID"; do
  sleep 1
done

if is_running "$JAVA_PID"; then
  echo "entrypoint: nginx exited, stopping Spring Boot" >&2
  kill -TERM "$JAVA_PID" 2>/dev/null || true
else
  echo "entrypoint: Spring Boot exited, stopping nginx" >&2
  kill -TERM "$NGINX_PID" 2>/dev/null || true
fi

wait "$JAVA_PID" 2>/dev/null || true
wait "$NGINX_PID" 2>/dev/null || true
exit 1
