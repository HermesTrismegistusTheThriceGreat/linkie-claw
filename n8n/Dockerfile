FROM n8nio/n8n:latest

USER root
RUN apk add --no-cache postgresql16-client
USER node

EXPOSE 5678

COPY docker-entrypoint.sh /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
