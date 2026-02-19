FROM n8nio/n8n:latest

USER root
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client dnsutils && rm -rf /var/lib/apt/lists/*
USER node

EXPOSE 5678

COPY docker-entrypoint.sh /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
