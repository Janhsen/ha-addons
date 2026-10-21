# Garmin inReach Relay

Connects Garmin inReach devices to Home Assistant through a Garmin Messenger account:

- **Ready-made entities (MQTT):** a "Send message" text box, a "Message received" event, a "Last message" sensor and a connectivity sensor appear automatically. No YAML, no token, no restart.
- **Receive:** every incoming message also fires a plain Home Assistant event and updates a sensor.
- **Send:** from the text entity, from any automation, from the sidebar UI, or through a token-protected HTTP endpoint.
- **Log in:** one-time SMS login directly in the web UI, no terminal needed.

> **Not an official Garmin integration.** The add-on talks to Garmin's Messenger backend using a reverse-engineered protocol. Garmin can change or block it at any time. Do not rely on it for safety-critical communication.

## The way in and out

- **Garmin Messenger:** messages to and from your Garmin Messenger account. Needs the SMS login once. A message you send from your Fenix or inReach to your own number does reach the app (checked 2026-10-14, see [Messages from your own watch](docs/home-assistant.md#messages-from-your-own-watch)).
- **Sending to an inReach address:** besides phone numbers, the app sends over Garmin Messenger to an inReach address such as `name@inreach.garmin.com` once it is a contact with *Allowed recipient* (web UI, MQTT `garmin_inreach/send` with `"to": "name@inreach.garmin.com"`, the notify entity of that contact, or `POST /send`).
- The inReach e-mail inbox of 0.106 and older (reading inReach mails from a mailbox and answering through Garmin's reply link) was removed in 0.107. Updating deletes its chats, sensors and the stored mailbox password.

## The first 10 minutes

1. Set the option `phone`, start the app, open **Garmin inReach** in the sidebar.
2. Log in with the SMS code (once).
3. Start a chat with the pencil (**New conversation**) for yourself or someone else, send a test message.

## Contents

1. [How it works](#how-it-works)
2. [Setup](#setup)
3. [Options](#options)
4. [Web UI](#web-ui)
5. [Home Assistant](#home-assistant)
6. [Sending (HTTP API)](#sending-http-api)
7. [Safety limits](#safety-limits)
   - [How often the add-on asks Garmin](#how-often-the-add-on-asks-garmin)
8. [Security notes](#security-notes)
9. [Secure commands (e.g. opening a door)](#secure-commands-eg-opening-a-door)
10. [Data stored](#data-stored)
11. [Troubleshooting](#troubleshooting)
12. [Limitations](#limitations)
13. [Health check and watchdog](#health-check-and-watchdog)
14. [Prebuilt images](#prebuilt-images)
15. [Updating](#updating)
16. [Backup, restore and downgrade](#backup-restore-and-downgrade)
17. [Status, export and silence sensor](#status-export-and-silence-sensor)
18. [Credits and license](#credits-and-license)

## How it works

```
Garmin Messenger backend  <--SignalR/HTTPS-->  Garmin inReach Relay add-on  <--REST/MQTT-->  Home Assistant
                                                        |
                                                Ingress web UI (sidebar), send API (:8765)
```

- The add-on registers with Garmin as an additional Messenger device (like installing the app on another phone) using an SMS code. The session is stored in the add-on's `/data` folder and refreshed automatically.
- It keeps a live connection to Garmin. Incoming messages are acknowledged as delivered to Garmin and published to Home Assistant through the Supervisor's Core API proxy (no long-lived token needed).
- Sending uses the same session. Outgoing messages appear to the recipient as coming from your Garmin Messenger number.
- The app neither reads nor sends e-mail. A message to an inReach address (`…@inreach.garmin.com`) goes over Garmin Messenger like one to a phone number.

## Setup

1. Install the add-on from the repository `https://github.com/Janhsen/ha-addons`. Home Assistant downloads the prebuilt image (amd64).
2. Open the **Configuration** tab and set (screenshots of every screen are in [Web UI](#web-ui)):
   - `phone`: the phone number registered with Garmin Messenger, in international format, e.g. `+49123456789`
   - `api_token`: a long random string, only needed if you want to send from automations
3. Start the add-on and open **Garmin inReach** in the sidebar.
4. Click **Request SMS code**, wait for the SMS from Garmin, enter the 6-digit code and confirm.
5. Use **New conversation** (pencil in the chat list) to add the people you want to write to; they are allowed as recipient (see [Safety limits](#safety-limits)).
6. The status changes to **Connected to Garmin**. You only have to log in once, unless Garmin invalidates the session.

Tip for the token: generate one with `openssl rand -hex 32` or any password manager.

## Options

Only what must exist before the app starts is an option. Everything else is set in the web UI (**Settings**, contact info) and stays stored across restarts and updates.

| Option | Required | Description |
| --- | --- | --- |
| `phone` | yes | Your Garmin Messenger number in international format (`+` and digits). The SMS login code goes here. |
| `api_token` | no | Secret for the HTTP send API on port 8765. Empty = API off (web UI and MQTT still work). Use at least 24 random characters: a shorter token still works, but the log and the setup check warn about it. |
| `log_level` | no | `info` (default) logs sender and length, never texts. Use `debug` for troubleshooting; `debug`/`trace` can contain message contents. |

Set in the web UI instead of options: who may receive messages (contact info → "Can receive messages"), the Home Assistant event name and the history (Settings).

## Web UI

![Chat on a phone, dark theme](https://raw.githubusercontent.com/Janhsen/garmin-inreach-ha-addon/main/docs/screenshots/chats-dark-phone.png)

The interface works like iOS Messages and is in three sections: **Chats**, **Map** and **Settings** (phone: a floating bar at the bottom; iPad: a capsule at the top; laptop: a slim sidebar), plus a round **search** button. Open **Garmin inReach** in the sidebar. The language follows the browser (English or German; it can be changed under Settings → Display and data), the colour theme follows the system or can be set to light or dark. All symbols are line icons; every icon button has a name for VoiceOver and other screen readers.

![Chat view](https://raw.githubusercontent.com/Janhsen/garmin-inreach-ha-addon/main/docs/screenshots/chats.png)

- **First start:** a full-screen setup (welcome, number, SMS code, first contact, Home Assistant) with one main button per step. **Log in again** opens only the login step.
- **Problems:** one list, shown in one place each. A slim bar at the top appears only while something does not work (no Garmin login, no connection, Garmin rejects the app, messages not sent): one short sentence and the one action that fixes it. Things that only limit the app (MQTT missing, API token too short, a damaged data file) colour the dot on **Settings** orange. **Settings → Status and diagnostics → Needs attention** lists every problem with the server's own error text and the fix.
- **Chats:** one list, newest first, grouped by *Pinned*, *Today*, *Yesterday* and *Earlier*. The chips above the list filter *All* and *Unread*, the menu next to them sorts (*Newest*, *Name*, *Unread first*). **Edit** selects several chats (pin, mark read, clear), the pencil starts a **New conversation** (a phone number with country code or an inReach address). Swipe a chat right to pin it, left to clear it; press and hold (or right-click) for the menu with a preview.
- **Search:** the search button (or pulling the chat list down, Ctrl+K, `/`) shows the search field above the list; **Cancel** hides it again. It finds names, numbers and message texts and jumps to the first hit.
- **Conversation:** day separators, a "New messages" marker, delivery ticks (sent, delivered, read, failed; the name of the state is shown on hover and read out by screen readers) and per-device delivery in the message details. A small icon next to the time tells where a message was written (watch, phone app, inReach device). The header shows the name and, after a message with a position, the place name (or *Position*) and the time; the coordinates are in the details of the message. The message field shows the **microphone** while it is empty and the **send arrow** once there is text, like iOS Messages; the camera sends a photo. The state of a send (*Sending …*, *Sent.*, an error) floats briefly above the message field instead of taking a line below it; errors stay until the next action. The counter warns when a text gets long (Garmin counts bytes: umlauts and emoji count double and the text may arrive in parts).
- **Templates:** the list button in the empty message field offers your own short texts for check-ins ("On my way", "Arrived safely" …). A template is only inserted, never sent by itself. Edit the list under **Settings → Display and data → Templates**; it is stored with the app and the same on every device.
- **Contact info:** tap the name in a chat (phone: a page; iPad: a sheet over the chats; laptop: a third column). Give the number a name (shown in the chats and as `from_name` in the Home Assistant event), switch **Allow sending** (otherwise the chat stays read-only), see the last position and the LiveTrack sessions of that person (a LiveTrack you shared in their chat is yours and counts under you; the row is hidden when there are none), mute the chat at Garmin, block it, remove the contact or clear the chat. Pinning is in the chat list's menu. At most 50 contacts.
- **Settings:** the account card at the top (number and overall state), then *Contacts and blocking*, *Display and data* (colours, text size, language, Home Assistant event name, billing day of the satellite counter, read receipts, history, maps, templates, backup) and *Status and diagnostics*. Changes apply immediately and are stored in the app.
- **Contacts and blocking:** every contact is a row that opens its contact info; only contacts that may **not** receive messages say so (*read-only*). Blocked senders can be unblocked here.
- **Garmin account** (Settings → the account card): the number, since when the app is logged in and all devices of your Garmin Messenger account (display only). Garmin Locate consents, SMS settings and the call log are still read from Garmin (missed calls reach Home Assistant as `garmin_inreach_missed_call`) but are not shown in the web UI. **Log in again** requests a new SMS code. **Change number** sets the number for the next login (it then replaces the number from the app options). **Log out** removes only this app's registration at Garmin (`DELETE Registration/App/{own instance}`) and its stored login; your phone, watch and inReach stay logged in, history, contacts and settings are kept. A deliberate logout creates no "login required" notification; the state is kept in `/data/state.json` (section `account`).
- **Map:** every position and LiveTrack on one map, one colour per person (eight different colours, handed out in the order people first appear, so they are the same on every device) with the person's initial on the dot. Phone: a sheet with three stops (people · period · sessions); iPad and laptop: a panel on the left. Maps and place names come from OpenStreetMap (place names through Nominatim, without sending the address of your Home Assistant); switch them off under Settings → Display and data.
- **Messages you write on your watch to somebody else** appear in that person's chat as sent messages. Only messages to your own number count as input for Home Assistant automations.
- **Delete history:** Settings → Display and data; removes all stored messages (asks first).
- **Keyboard and screen readers:** every control can be reached with the keyboard and shows a visible focus ring; segmented choices work with the arrow keys; sheets keep the focus inside and close with Escape. Status dots carry a spoken label ("needs attention", "problem"), so colour is never the only hint.

![Contact info with name, permission, chat history and positions](https://raw.githubusercontent.com/Janhsen/garmin-inreach-ha-addon/main/docs/screenshots/contact-info.png)

![Positions of all chats on one map](https://raw.githubusercontent.com/Janhsen/garmin-inreach-ha-addon/main/docs/screenshots/positions.png)

![Login](https://raw.githubusercontent.com/Janhsen/garmin-inreach-ha-addon/main/docs/screenshots/login.png)

### Logs and diagnostics

Settings → Status and diagnostics → **Log and diagnostics** helps to find out what is wrong without opening the Home Assistant log:

![Logs](https://raw.githubusercontent.com/Janhsen/garmin-inreach-ha-addon/main/docs/screenshots/logs.png)

- **Needs attention** and **Health:** what does not work, with the server's error text and the fix, and below it what works (Garmin, MQTT, Home Assistant API).
- **Log and diagnostics:** the log, verbose logging and the diagnostics download; the rarely needed protocol recording and the passphrase for sealed secrets are on its sub-page **Advanced**.
- **Log:** the last 1000 log lines, filtered by level. **Copy** puts them on the clipboard.
- **Verbose logging:** switches on debug logging (every HTTP request, MQTT message and Garmin call) for 30 minutes, 4 hours, 24 hours or until you switch it off (*Always*), then returns to the level from the options. The choice survives restarts and updates. At debug level the log view can contain phone numbers and, from the underlying Garmin client, raw message contents. The log view keeps the last 5000 lines; the full log is in the app log of Home Assistant, where phone numbers and e-mail addresses are masked (`+49…57`, `a…@example.com`) since 0.104.
- **Record Garmin protocol:** while on, every answer and event from Garmin is one masked line in `/data/protocol.jsonl` (up to 2 × 5 MB; the first line of each kind is marked as a sample and also goes to the log). Since 0.94 this one file replaces the former protocol samples and the traffic journal; with verbose logging on, the lines also go to the debug log.
- **Include message contents** (Advanced, under *Record Garmin protocol*): the protocol and the protocol samples in the log keep every answer unmasked (texts, names, numbers, links, exact positions). Tokens, passwords and LiveTrack codes stay hidden. Off by default; the setting survives restarts.
- **Download diagnostics:** a JSON file with the version, the state of all connections, counters, a configuration summary and the recent log. Phone numbers are masked (`+49…57`), tokens are never included and raw payloads are cut out. Attach this file to a bug report.

### Reactions

Double-tap a message, a photo or a voice message to react with an emoji (the bar with six emoji, *+* for more); press and hold shows the emoji bar together with the menu (reply, copy, select text, details, delete), as in iOS Messages: everything else blurs, the message itself stays sharp between the bar and the menu (on a small screen it moves so all three fit), and the system's own text selection does not start – use *Select text* in the menu for that. A single tap on a photo opens it; tapping your own emoji in the bar again takes the reaction back. The reaction goes out the way the Garmin Messenger app sends it – as a short text with invisible markers – so it shows up as an emoji in the Garmin app too, and costs a message on a satellite plan like any text. Reactions of the other person (and yours from the phone app) appear as an emoji under the message instead of as a chat text. Photos and voice messages from before 0.73.0 get their Garmin id once after a start from Garmin's history, so they can be reacted to as well.

### LiveTrack in the chat

When a message carries a Garmin LiveTrack link (the "Follow me on my LiveTrack website" message from the inReach, a watch or the Messenger app), the add-on reads the track from Garmin's public LiveTrack page – with the link and the PIN from the message; no Garmin account is needed and nothing is sent. While the session runs it checks every 2 minutes (every minute while the web UI is open) and stops when it ends, after 45 minutes without a new position (unless Garmin still reports the session live; then it checks every 10 minutes), and at the latest after a day. The chat then shows a card with the track, distance and time; tapping it opens the map with kilometre marks, pace, height, heart rate, cadence and power charts and the kilometre splits. Heart rate, cadence and power only exist when a watch or bike computer sends them. **Export as GPX** in the track view saves the track as a GPX file (also for Garmin Connect, Strava or komoot). While the track cannot be shown yet, a line under the card says why: *waiting for the start*, *PIN missing* (or wrong), *Garmin refuses* or *not found*. The data is stored in `/data/livetrack/` (oldest tracks are removed when the folder exceeds 50 MB; a session that comes both as a link and shared in the chat is stored once; a session you share with several contacts – Garmin puts it into each chat – is read from Garmin once and shown as one entry, "shared with Alex, Sam, Robin") and Home Assistant gets the event `garmin_inreach_livetrack` (see the Home Assistant documentation). The PIN and Garmin's session codes are never written to these files or the log.

**You are one person** on the map, in the LiveTrack lists and in the places of the contact info: your number, your own inReach addresses and your own LiveTracks show up as one entry with one marker (your name from your own contact, else the name Garmin shows on your LiveTracks, else "You"). The chats stay separate – each is a real Garmin conversation.

In Home Assistant a contact's running LiveTrack moves that person's position tracker along point by point (at most one point per 5 seconds; attribute `source: livetrack`), each point with `heart_rate`, `cadence`, `power`, `speed_kmh`, `altitude_m`, `distance_m`, `duration_s` and `activity_type` when Garmin sends them, so the recorder keeps the route with these values; when the session ends only the position stays. In addition a sensor **LiveTrack <name>** is on while the session runs, with session name, distance, time, last update and link as attributes – while it runs also the current `heart_rate`, `speed_kmh`, `altitude_m` and `activity_type` when Garmin sends them. In the web UI the detail of a session shows distance, time, average pace (running, walking, hiking) or speed, ascent and descent, lowest and highest point and average and maximum heart rate, with a small chart of height, heart rate or pace over the distance; touching the chart marks that point on the map. Each track can be downloaded as a **GPX** file for Garmin Connect, Strava or komoot: `/api/livetrack/<id>.gpx` in the web UI, or the same path on port 8765 with the API token (see the HTTP API documentation).

If the PIN in the message is missing, the track cannot be read (the card says so). If Garmin keeps refusing the session although the message has a PIN, the add-on gives up after three tries and marks the PIN as wrong instead of trying for a day.

**LiveTrack PINs are remembered per person.** A LiveTrack PIN belongs to the person who shares the LiveTrack and is the same for all their sessions. The add-on keeps the PINs it sees – Garmin's PIN field of every message (received and sent, group chats too) and a PIN written next to a LiveTrack link in the text ("PIN 4711", "Kennwort: 4711"; only in messages about LiveTrack or MapShare, 4–8 letters or digits with at least one digit) – for each contact and for you – only the newest one each – in `state.json`, independent of the chat history. A PIN that opened a session is kept for its owner too. Your own PIN ("you") comes from messages you send and from your own number, devices and inReach addresses (an address your own number has written to, such as the one Home Assistant sends to). A shared LiveTrack first gets the PINs of the person who shares it, then the other known ones (at most five tries); a link without PIN gets the sender's stored PIN. At every start the stored history is searched once for PINs of people who have none stored yet (a stored PIN is never replaced by an older one). If after that no PIN is known for you, or for the person of a LiveTrack of the last day that waits for a PIN, the app looks once through the older messages at Garmin (read only, at most 10 pages of 100 messages, a pause between the pages, stops as soon as it finds one; at most once a day, also across restarts). Messages found there are not added to the chat and fire nothing. Your own messages also count when Garmin names you by your Garmin user id instead of your number (messages from your inReach or watch). **Contact info → LiveTrack → LiveTrack PIN** (your own: **Settings → Garmin account → LiveTrack PIN**) shows the stored PIN masked; the sheet shows it on a tap, sets a PIN by hand or deletes the stored one. A new PIN tries the sessions of the last day that wait for a PIN again. PINs are never logged and are hidden in protocol recordings.

When someone shares a LiveTrack from the Messenger app, Garmin sends no link, only the notice "LiveTrack started". The add-on then reads that session from Garmin's LiveTrack service with its own Messenger login (the same way the Garmin app does on a phone-number account) and shows the same card under the notice. If Garmin refuses that, the log says so and only the notice stays. The same way is used for a link to one session (`…/session/<id>/token/…`) when the public LiveTrack page refuses the add-on (see [Garmin's web pages](#garmins-web-pages)).

**Vector map:** maps are drawn in a calmer look like Apple Maps (OpenStreetMap data from OpenFreeMap, drawn with MapLibre, which is built into the add-on). Settings → Display and data → *Maps and place names* switches maps and place-name lookups off in this browser.

### Message history and privacy

The history is stored in `/data/history.json` inside the add-on (last 500 messages, with text, number and time) and survives restarts and updates. It is part of Home Assistant backups. Switch off *Keep the message history on disk* under Settings if you do not want message texts on disk (the file is deleted); the chat then only holds messages in memory since the last start. Everything else the app stores is listed in [Data stored](#data-stored).

## Home Assistant

Everything is available without YAML through MQTT (Mosquitto + MQTT integration): send box, "message received" event, last message/sender/delivery status, connectivity and login sensors, position trackers, notify entities (one per allowed contact since 0.106, e.g. `notify.inreach_anna`), a counter of satellite messages per billing period, status sensors per inReach, the last received photo as an image entity and ready-made blueprints. Plain events (`garmin_inreach_message`, with `reply_to`) work without MQTT.

Full reference with all entities, topics, event fields, automation examples, blueprints and the dashboard card: **[docs/home-assistant.md](https://github.com/Janhsen/garmin-inreach-ha-addon/blob/main/garmin-relay/docs/home-assistant.md)**.

## Sending (HTTP API)

Only needed for systems that cannot use MQTT or `notify`. `POST /send` with a bearer token for scripts outside MQTT; every send obeys the allow-list, 160 characters and 20 per hour (a send that certainly failed does not count). The answer (and the MQTT `send_result`) names `bytes` and `parts`: Garmin counts bytes, so umlauts and emoji can split a text into several billed parts; the optional request field `max_parts` refuses such a text. Both `/send` and the MQTT send topic accept a `key` so a repeated request never sends twice. Since 0.106 a send can carry a `reference_point` (a waypoint, shown on the inReach), and `POST /send/media` sends a photo or a voice message from Home Assistant (multipart form, converted like in the web UI). `POST /locate` asks Garmin for the next position of a person who shares their position with you (Garmin Locate). Details and examples: **[docs/api.md](https://github.com/Janhsen/garmin-inreach-ha-addon/blob/main/garmin-relay/docs/api.md)**.

## Safety limits

Whether a message is billed depends on your Garmin plan (check it when you set up the app), and a faulty automation could send many of them. The add-on therefore enforces these limits itself:

- **Allow-list:** sending is only possible to contacts marked "Allowed recipient". Without such a contact all sending is blocked.
- **Length:** at most 160 characters per message (counted as characters, so umlauts count once). Longer texts are rejected, not cut.
- **Rate:** at most 20 messages per hour. The counter is rebuilt from the stored history after a restart, so restarting does not reset it (with *Keep the message history on disk* switched off it starts at zero).
- **Token:** the send API requires the bearer token.
- **No confirmation dialog:** the web UI does not ask before every send, the limits above protect against mistakes. The setup checklist reminds you once that billing depends on your Garmin plan.

The limits are constants in the code (`maxTextLen`, `maxSendsPerHour` in `src/internal/addon/app.go`). Change them there if you need different values.

### How often the add-on asks Garmin

The add-on wants to be a quiet guest at Garmin: little load, no fixed grid of requests, nothing that looks like getting around a protection. It names itself in every request (`User-Agent: garmin-inreach-ha-relay/<version>`). While connected it asks:

| What | How often |
|---|---|
| live connection (SignalR) | always on, like the app |
| catch-up of missed messages | at the start and after a drop of more than a minute; otherwise every 30 min (10 min after a drop) |
| device positions (FindMyDevices) | every hour (6 h when there is nothing) |
| Garmin Locate (who shares positions) | every hour (6 h when nobody shares) |
| call log | every 30 min (6 h without calling) |
| muted chats, SMS settings, LiveTrack notices | every 6 h |
| self-test | at most once a day, also across restarts |
| Garmin's status page | every 15 min |
| LiveTrack, per running session | every 2 min, every minute while the web UI is open; ends after 45 min without a new position |

Every interval varies by ±15 %. After a (re)connection the jobs above start one by one, each after a random 1–10 minutes; login, live connection and catch-up start at once. Photos and voice messages from before 0.73.0 get their Garmin id once per installation, with a pause between the pages. The full budget with the Garmin calls is in [docs/protocol/errors-limits.md](https://github.com/Janhsen/garmin-inreach-ha-addon/blob/main/garmin-relay/docs/protocol/errors-limits.md#polling-budget).

### Garmin's web pages

One thing is read from a web page made for browsers, not from Garmin's app interface: the LiveTrack page (`live.garmin.com`, behind Cloudflare; until 0.106 also the reply page for inReach e-mails). Since 0.106 the add-on asks it with its own name, like everywhere else, and without browser headers. The stored setting `web_browser_like` (in `/data/state.json`, `POST /api/web-identity {"honest": false}`) brings back the old way of asking like a browser (Chrome User-Agent and the browser's `Sec-Fetch` headers); it is no longer shown in the web UI and keeps its stored value.

If a page refuses the add-on (Cloudflare block or challenge), the add-on does not try to get around it. Settings → Display and data then shows *Garmin web pages* with *LiveTrack viewer refuses the add-on*, the log warns once and Home Assistant gets a notification. LiveTrack then uses the Garmin login (as for sessions shared in a chat) when the session id is known – a link to one session, or a session that is also shared in the chat; a personal LiveTrack page (`live.garmin.com/<name>`) cannot be read then.

## Security notes

- The web UI only accepts requests from the Home Assistant ingress gateway, and changes only with the UI's own request header (protection against other web pages sending requests in your name). Access is controlled by Home Assistant's own login.
- Blocking a contact also blocks it at Garmin (the Garmin app on your phone shows the same); the mute switch in the contact info is Garmin's own mute and applies to the Garmin app too. Muted chats still reach Home Assistant (event field `muted`).
- The send API listens on port 8765 inside the Docker network. Do not publish that port to your network or the internet unless you know what you are doing, and use a long random token.
- The Garmin session in `/data/sessions` gives access to your Garmin Messenger account. Home Assistant backups include add-on data, so treat backups as sensitive.
- Incoming message texts are untrusted input. Do not pass them unchecked into services that execute commands, and be careful with automations that act on message content.
- To revoke access, remove the add-on's device in the Garmin Messenger app or stop and uninstall the add-on.

## Secure commands (e.g. opening a door)

The app only relays messages; whether a message may switch something is decided by your automation. For anything that acts on the real world (a door, an alarm, a gate) assume this threat model:

- **Garmin Messenger messages** come over your logged-in Garmin session; the sender is the Garmin account that wrote them. Someone who has your phone, watch or inReach can still write them.
- **Messages can arrive late or twice.** Satellite messages can take minutes to hours, and a message can be delivered again after a reconnect.
- **Anyone can write to your number.** Only the sender check in your automation separates you from a stranger.

Recommendations:

1. Accept only Garmin Messenger messages (`source: garmin`, the only value since 0.107; until 0.106 `source: mail` marked inReach mails, which were never safe for commands).
2. Compare the sender **exactly** (`==`) with the number as it appears in the event (check once in Developer Tools → Events), never with "contains" or a part of the number. Ignore group messages (`group_id` set).
3. Use a fixed command word, compared exactly, not a word somewhere in the text.
4. De-duplicate with `message_id`: store the last handled id in a helper and ignore the same id again.
5. A time window with `sent_at` uses Garmin's send time.
6. Send the confirmation back to `reply_to`, so you see on the device what happened.
7. Keep the Home Assistant login (and MFA) strong: the web UI and the automations are only as safe as Home Assistant itself.

The blueprint **Command by message** (`blueprints/automation/garmin_inreach/command_from_message.yaml`, import link in [docs/home-assistant.md](https://github.com/Janhsen/garmin-inreach-ha-addon/blob/main/garmin-relay/docs/home-assistant.md#blueprints)) implements all of these points without YAML: exact command word, exact sender list, Garmin Messenger only, no groups, maximum age, `message_id` once (text helper), and a confirmation to `reply_to` that the app sends at most once per message (`key`).

Keep phone numbers as text: Home Assistant turns a value like `+49…` that is rendered on its own (a variable, an input, a field with only a template) into a number and drops the `+`. Compare inside one template as below, and build the send payload in one template with `to_json`.

Example (trigger and conditions only; replace the number, the command word, the helper and the action with your own):

```yaml
triggers:
  - trigger: event
    event_type: garmin_inreach_message
conditions:
  - condition: template
    value_template: "{{ trigger.event.data.source == 'garmin' }}"
  - condition: template
    value_template: "{{ trigger.event.data.from == '+49100000000' }}"   # exact, not a substring
  - condition: template
    value_template: "{{ trigger.event.data.group_id is not defined }}"
  - condition: template
    value_template: "{{ trigger.event.data.text | trim | lower == 'open gate' }}"
  - condition: template   # not handled before
    value_template: "{{ trigger.event.data.message_id != states('input_text.inreach_last_command_id') }}"
  - condition: template   # sent within the last 10 minutes (Messenger only)
    value_template: "{{ (as_timestamp(now()) - as_timestamp(trigger.event.data.sent_at)) < 600 }}"
actions:
  - action: input_text.set_value
    target:
      entity_id: input_text.inreach_last_command_id
    data:
      value: "{{ trigger.event.data.message_id }}"
  # … your action here …
  - action: mqtt.publish
    data:
      topic: garmin_inreach/send
      payload: '{{ {"to": trigger.event.data.reply_to, "text": "Done", "key": "cmd:" ~ trigger.event.data.message_id} | to_json }}'
mode: single
```

The `input_text` helper needs a maximum length of at least 40 characters (`message_id` is a UUID). The reply counts against the send limits.

## Data stored

Everything is stored in the add-on's `/data` folder on your Home Assistant host and is part of Home Assistant backups, except received media, the protocol recording, damaged files set aside (`*.corrupt-*`) and leftover temporary files (`*.tmp`), which are excluded (`backup_exclude`). Nothing is sent to the developer.

| What | Where | How long |
| --- | --- | --- |
| Messages (text, sender, time, position if any, reactions) | `history.json` | last 500 messages; only while *Keep the message history on disk* is on |
| Photos and voice messages you received | `media/` | up to 200 MB in total (oldest deleted first), 10 MB each; not in backups |
| LiveTrack sessions (track, times, sensor data; no PIN) | `livetrack/` | up to 50 MB, oldest first |
| Last position per contact or device (for the trackers) | `tracker_positions.json` | one per tracker, replaced by newer ones |
| Contacts, blocked senders, settings | `state.json` | until you change them |
| LiveTrack PIN per person (only the newest) and your own inReach addresses | `state.json` | until you delete them (Contact info → LiveTrack PIN) |
| Garmin login | `sessions/` | until you log out or Garmin ends the session |
| Protocol recording (masked unless *Include message contents* is on) | `protocol.jsonl` | only while switched on; 2 × 5 MB; not in backups |
| Traffic counters and interface field catalog (no contents) | `traffic.json`, `protocol_catalog.json` | 60 days (counters) |
| Log (at level `info`: senders and lengths, no message texts) | memory of the app (last 5000 lines) and the Home Assistant app log | until restart (app); Home Assistant keeps its own log |

Positions and messages of your contacts are personal data of those people: keep backups private.

**Sent to third parties:** messages go to Garmin (that is the purpose). Maps load tiles and fonts from **OpenFreeMap** (`tiles.openfreemap.org`) and place names from **Nominatim** (`nominatim.openstreetmap.org`); these services see the map area or the coordinates and the address of the page. Switch off *Maps and place names* under Settings (it applies to that browser) to stop that. LiveTrack tracks are read from Garmin's LiveTrack page, and the device pictures in the Garmin account card are loaded from Garmin's servers.

**Deleting:** **Delete history** (Settings) empties `history.json`; **Clear chat** and the delete action in a chat remove single chats or messages. Switching off *Keep the message history on disk* deletes the file. Photos, voice messages and LiveTrack files are removed only when newer ones replace them, and when the add-on is uninstalled (uninstalling deletes `/data`). Remember that older Home Assistant backups still contain the data.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Add-on stops right after start, log says to set the phone number | Set `phone` in the options in international format (`+49...`). |
| Status shows "Not connected" | Log in via the web UI. If you were logged in before, Garmin may have invalidated the session; log in again. The last error is shown in the status box. |
| No SMS code arrives | Check the number in `phone` and that it is registered with Garmin Messenger. Wait a minute before requesting again. |
| No events in Home Assistant | Check that the status is connected, then listen to the event in Developer Tools → Events. Set `log_level` to `debug` and look for "Message received" lines in the log. Verify that the event name under Settings matches your automation trigger. |
| No entities appear | Install the Mosquitto broker app and set up the MQTT integration, then restart the add-on. The log says "MQTT connected" when it worked, or why it could not connect. |
| `rest_command` fails | Check the hostname on the add-on's Info page, the port `8765`, that `api_token` is set and identical to the secret, and the HTTP status in the Home Assistant log (see the status table above). |
| HTTP 403 when sending | The number must be an allowed contact. Compare the format; spaces and dashes are ignored, the `+` and country code are not. |
| HTTP 503 | Not connected to Garmin. Open the web UI and log in. |
| Build fails on first install | Open the add-on's log or the Supervisor log and check the Docker build output. The Go modules are included in the repository; the build needs internet access only for the base images and the `ffmpeg` package. If it fails, open an issue with the log. |

## Limitations

- Received photos (AVIF) and voice messages (OGG) are downloaded (up to 10 MB each, 200 MB in total; the oldest are deleted first), shown in the chat, and announced in the event with `media_type` and `media_file`. Photos and voice messages can be sent from the web UI and, since 0.106, from Home Assistant with `POST /send/media` on port 8765 (token, multipart form; see docs/api.md); both are converted with `ffmpeg`. MQTT and notify send text only.
- Group chats are shown read-only: the app never sends to a group (answer a member directly) and does not manage groups.
- Messages missed while the add-on was stopped or disconnected are fetched from Garmin after the next connection and handled like live ones. Messages from before the very first start are not imported from Garmin; an exported history file can be imported under Settings.
- The chat history keeps the last 500 messages. The sensor entity created through the REST API (`sensor.garmin_inreach_last_message`) is **deprecated since 0.106** and will be removed in a later version: it has no unique id and disappears after every Home Assistant restart. Use the MQTT sensor `sensor.garmin_inreach_relay_last_message` (same text, the fields as attributes) or the event. It can be switched off with the option `rest_sensor` (stored in `state.json`, set through the web UI's API `POST /api/ha-options {"rest_sensor": false}`).
- Position trackers drop a position that is older than 60 minutes: the tracker shows `unknown` until the next position arrives, so a `person` never jumps to an old place after a restart. Change it under **Settings → Display and data → Position trackers → Maximum age** in the web UI (option `tracker_max_age_min`, minutes, 0 = off, at most 1440; also `POST /api/ha-options {"tracker_max_age_min": 30}`), and keep it above your inReach's tracking interval.
- The protocol is unofficial and may break without notice.
- Delivery to a recipient depends on Garmin. A successful API response means Garmin accepted the message, not that the recipient's device has received it.

## Health check and watchdog

The app serves `GET /health` on port 8765 and registers it as the Supervisor watchdog URL. If you enable **Watchdog** on the Info page, Home Assistant restarts the app when the endpoint stops answering or answers with an error. The endpoint is always on, also when `api_token` is empty, and needs no token.

Since 0.106 the answer says how the connection is doing, for example:

```json
{"ok": true, "connected": false, "logged_in": true, "live_age_s": 420, "catch_up_age_s": 380,
 "last_catch_up": "2026-10-17T10:02:00Z", "garmin_reachable": true, "garmin_problem": false,
 "garmin_rejecting": false, "stalled": false}
```

`live_age_s` is the time since the live connection last worked (0 while it is up), `catch_up_age_s` the time since the last complete catch-up of missed messages. The endpoint answers **503** only for a real standstill: logged in, Garmin answers other requests, Garmin reports no outage, and for **30 minutes** neither the live connection nor a catch-up made progress. Then a restart can help. It stays 200 when the login is needed, when Garmin cannot be reached (network) and during a Garmin outage or while Garmin rejects the app (see below), because a restart does not fix those and would only repeat. After a 503 the next one is held back for **two hours** (`stalled: true` with `restart_brake_until`), so the watchdog cannot restart the app in a loop.

**Garmin rejects the app.** When several different Garmin requests are refused in a row (HTTP 4xx other than 401, 403, 408 and 429), or Garmin answers 426 *Upgrade Required*, Garmin has probably changed its interface. The app then shows this in the status problem list, creates one Home Assistant notification ("Garmin inReach Relay: Garmin rejects the app"), and slows its regular checks to once an hour. As soon as a request works again the problem and the notification disappear. An app update is usually needed.

The options have names and descriptions in English and German in the Configuration tab (`translations/`).

## Prebuilt images

Yes, for amd64: the release workflow builds the image after all tests passed and publishes it as `ghcr.io/janhsen/amd64-addon-garmin-relay`. Home Assistant downloads it on installation and on every update; nothing is built on your device, so updates are quick and leave no build cache behind.

## Updating

Home Assistant shows an update when a new version reaches the store repository `Janhsen/ha-addons`. The update downloads the new image. The Garmin session is kept in `/data` and survives updates.

## Backup, restore and downgrade

**Backup:** a Home Assistant backup (full, or partial with only this add-on) contains `/data`: settings, contacts, history, LiveTrack files and the Garmin login. Received photos and voice messages (`media/`), the protocol recording (`protocol.jsonl*`), damaged files set aside (`*.corrupt-*`) and temporary files (`*.tmp`) are excluded to keep backups small; after a restore older photos show as missing in the chat. Treat it as sensitive. Restoring it brings the add-on back as it was, including the login (no new SMS code needed, unless Garmin ended the session in the meantime).

**Restore:** Settings → System → Backups → choose the backup → restore only this add-on. The add-on version of the backup is installed with its data.

**Downgrade:** since 0.94 the settings are in one file, `/data/state.json`. Versions before 0.94 do not read it; they read the old files (`settings.json`, `contacts.json`, …), which 0.94 renamed to `*.bak-0.94` after the migration. Going back to a version before 0.94 therefore starts with default settings and no contacts. Safest way back: restore a backup made with the old version. If you start an old version anyway and change settings there, a later update to 0.94 or newer imports those old files again when they are newer than `state.json`. Within 0.94 and newer, downgrades keep the settings (unknown parts of `state.json` from a newer version are kept, not deleted).

## Status, export and silence sensor

- **Status:** the account card at the top of Settings shows the overall state with a dot (green: everything runs, orange: runs with limits, red: needs attention); *Status and diagnostics* shows when the last message arrived.
- **Export / import settings:** under Settings, **Export settings** saves contacts and the event name as a JSON file; **Import** restores contacts and the event name from such a file, or merges an exported history file into the chats (no duplicates; messages of the removed mail chats are skipped).
- **Silence sensor:** the Home Assistant sensor **Last received** (timestamp) shows when the last message arrived. An automation can warn you if it is older than a few hours; the blueprint **Alert when nothing was heard** does this with a time trigger on this sensor.
- **Writing to your own inReach address:** a message that your watch or inReach sends to your own inReach address (for example a contact named HomeAssistant) is shown in that chat, and `reply_to` in the event is that address, so replies from Home Assistant land in the same chat. The address must be an allowed contact for the reply (it is added automatically the first time).
- **Map and history export:** Tap the name, the avatar or the info button in a chat for the contact info: name, "Can receive messages", Block, Clear and a map of this chat's positions. **Show on the map** opens the **Map** tab with that person chosen: all positions and LiveTracks on one map, one colour per person (the same colour everywhere), a period filter that applies to dots, tracks and the session list, and zoom/"show all" buttons. Under Settings, **Export history** and **Export settings** save JSON files. Name and permission are saved as soon as you change them.

## Credits and license

Based on [palchrb/garmin-messenger-relay](https://github.com/palchrb/garmin-messenger-relay) (MIT license, see `src/LICENSE`), which in turn builds on work by the slush-dev/garmin-messenger project. The Hermes protocol client in `src/internal/hermes` and the relay in `src/internal/relay` come from the upstream project and were **modified** for this add-on (protocol profile, contract tests, Locate, robustness and catch-up fixes; see the [changelog](CHANGELOG.md)). New in this add-on is the `internal/addon` package (Home Assistant integration, web UI, send API). Third-party components and their licences: [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

This project is not affiliated with or endorsed by Garmin. Garmin, inReach and Garmin Messenger are trademarks of Garmin Ltd. or its subsidiaries.
