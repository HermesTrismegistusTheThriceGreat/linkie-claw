FROM node:20-slim

# Install n8n globally on a Debian-based image to avoid Alpine networking
# issues with Railway's private networking (musl DNS resolution problems)
RUN npm install -g n8n

EXPOSE 5678

CMD ["sh", "-c", "sleep 3 && n8n"]
