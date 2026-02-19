FROM n8nio/n8n:latest

EXPOSE 5678

# Override ENTRYPOINT because base image uses ["tini", "--", "n8n"]
# which passes CMD as arguments to n8n (not as a shell command).
# Railway private networking needs ~3s to initialize for Alpine containers.
ENTRYPOINT ["tini", "--"]
CMD ["/bin/sh", "-c", "sleep 3 && n8n"]
