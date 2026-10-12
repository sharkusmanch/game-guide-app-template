# renovate: datasource=docker depName=node
ARG NODE_VERSION=24.21.0
# renovate: datasource=docker depName=alpine
ARG ALPINE_VERSION=3.24
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html game.config.json vite.config.ts tsconfig.json ./
COPY src ./src
RUN npm run build

FROM alpine:${ALPINE_VERSION} AS runtime
ARG SOURCE_URL=https://github.com/sharkusmanch/game-guide-app-template
ARG SOURCE_REVISION=unknown
ARG APP_VERSION=0.1.0
LABEL org.opencontainers.image.source=$SOURCE_URL \
      org.opencontainers.image.revision=$SOURCE_REVISION \
      org.opencontainers.image.version=$APP_VERSION
RUN apk add --no-cache nginx python3 && addgroup -g 10000 guide && adduser -D -H -u 10000 -G guide guide
COPY --from=build /build/dist /srv/www
COPY hosting/entrypoint.py /opt/guide/entrypoint.py
ENV SAVE_FILE=/saves/unconfigured.bin PROGRESS_PREFIX=/companion PROGRESS_IDS="" PROGRESS_UPSTREAM="" PYTHONDONTWRITEBYTECODE=1
USER 10000:10000
EXPOSE 8080
STOPSIGNAL SIGTERM
ENTRYPOINT ["python3", "/opt/guide/entrypoint.py"]
