# Home Assistant Add-ons (Janhsen)

Home Assistant add-on repository. Add it in Home Assistant under
Settings → Add-ons → Add-on Store → ⋮ → Repositories:

```
https://github.com/Janhsen/ha-addons
```

[![Add repository to Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FJanhsen%2Fha-addons)

## Add-ons

- **Garmin inReach Relay** (`garmin-relay`): receive and send Garmin Messenger (inReach) messages in Home Assistant.
- **Recorder DB MCP** (`recorder-db-mcp`): read-only MCP server for the recorder database (PostgreSQL). Built locally by Home Assistant from the files in `recorder-db-mcp/`.

This repository only holds the add-on metadata (`config.yaml`, icons, documentation). Home Assistant
downloads the prebuilt image from the GitHub Container Registry. The files under `garmin-relay/` are
written by the release workflow of the add-on's source repository; do not edit them here.
