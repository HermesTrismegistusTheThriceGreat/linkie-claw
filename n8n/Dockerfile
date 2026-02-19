FROM n8nio/n8n:latest

EXPOSE 5678

# Railway private networking needs time to initialize for Alpine containers
CMD ["sh", "-c", "sleep 3 && n8n"]
