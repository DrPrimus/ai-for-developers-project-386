# syntax=docker/dockerfile:1

# --- Frontend: Vite build ---------------------------------------------------
FROM node:24-alpine AS fe-build
WORKDIR /app/FE

COPY FE/package.json FE/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY FE/ ./
RUN npm run build

# --- Backend: executable Spring Boot jar ------------------------------------
FROM maven:3.9-eclipse-temurin-25 AS be-build
WORKDIR /app

COPY BE/pom.xml BE/pom.xml
RUN mvn -B -ntp -f BE/pom.xml dependency:go-offline

COPY BE/src BE/src
# Spotless runs on compile, so formatting problems fail the image build too.
# -print -quit stops at the first match; repackage leaves exactly one jar
# besides the .original backup.
RUN mvn -B -ntp -f BE/pom.xml -DskipTests package \
    && cp "$(find BE/target -maxdepth 1 -name '*.jar' ! -name '*.original' -print -quit)" /app/app.jar

# --- Runtime: nginx + JRE ---------------------------------------------------
FROM nginx:1.29-alpine AS runtime

# tini is PID 1: it reaps children and forwards signals to the entrypoint.
RUN apk add --no-cache tini

# The JRE comes straight from the Temurin image; no intermediate stage needed.
COPY --from=eclipse-temurin:25-jre-alpine /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk \
    PATH=/opt/java/openjdk/bin:$PATH

# Hexlet runs the container with only `PORT=8080`; Railway provides PORT too.
# Spring Boot listens on an internal loopback port so the public port stays free
# for nginx. BACKEND_PORT is the single source of truth: docker/entrypoint.sh
# derives SERVER_PORT/SERVER_ADDRESS from it.
# NGINX_ENVSUBST_FILTER keeps envsubst from touching $uri/$host in the template.
ENV PORT=10000 \
    BACKEND_PORT=8081 \
    NGINX_ENVSUBST_FILTER=^(PORT|BACKEND_PORT)$

WORKDIR /app

COPY --from=be-build /app/app.jar /app/app.jar

# nginx serves the SPA and proxies /api and /actuator to Spring Boot.
COPY --from=fe-build /app/FE/dist /usr/share/nginx/html
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 10000

# nginx:alpine sets SIGQUIT; the entrypoint coordinates a TERM shutdown of both
# processes, which is what Railway and Docker send by default.
STOPSIGNAL SIGTERM

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
