# The upstream version is pinned on purpose. The update workflow changes this line.
FROM doobidoo/mcp-memory-service:12.7.0-slim

COPY run.sh /usr/local/bin/ha-run.sh
RUN chmod +x /usr/local/bin/ha-run.sh

EXPOSE 8765

# hadolint ignore=DL3002,DL3066
USER root
ENTRYPOINT ["/usr/local/bin/ha-run.sh"]
