# Recorder DB MCP

Stellt die Recorder-Datenbank von Home Assistant (PostgreSQL, z. B. die TimescaleDB-App) als
**nur lesenden** MCP-Server bereit. Ein KI-Assistent mit MCP-Unterstützung kann damit Verlauf,
Langzeitstatistiken und Ereignisse direkt per SQL abfragen.

## Sicherheit

- Die App verbindet sich mit einer eigenen PostgreSQL-Rolle, die nur `SELECT` darf.
- Jede Abfrage läuft zusätzlich in einer `READ ONLY`-Transaktion mit Zeitlimit und Zeilenobergrenze.
- Der Endpunkt liegt unter einem zufälligen, geheimen Pfad (`/<geheim>/mcp`). Der Pfad wird beim
  ersten Start erzeugt, in `/data` gespeichert und im App-Protokoll angezeigt. Wer den Pfad kennt,
  kann lesen – nur über einen vertrauenswürdigen Tunnel (z. B. Cloudflare) veröffentlichen.
- Neuer geheimer Pfad: in den Optionen bei „Geheimen Pfad erneuern“ (`rotate_secret`) einen beliebigen
  neuen Text eintragen und die App neu starten. Der neue Pfad steht im Protokoll, der Connector muss
  danach ersetzt werden.
- Das Protokoll zeigt den geheimen Pfad in den Zeilen der Aufrufe – Protokolle nicht weitergeben.
- Tipp: Im Tunnel (z. B. Cloudflare) nur den Pfad `/<geheim>/*` durchlassen, dann erreichen automatische
  Scanner die App gar nicht. 404-Zeilen werden im Protokoll standardmäßig ausgeblendet (`hide_404_log`).

## Einrichtung

1. Nur-lesende Rolle anlegen (als Datenbank-Admin), Beispiel:

   ```sql
   CREATE ROLE leser LOGIN PASSWORD 'zufaelliges-passwort';
   ALTER ROLE leser SET default_transaction_read_only = on;
   GRANT CONNECT ON DATABASE homeassistant TO leser;
   GRANT USAGE ON SCHEMA public TO leser;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO leser;
   ALTER DEFAULT PRIVILEGES FOR ROLE homeassistant IN SCHEMA public GRANT SELECT ON TABLES TO leser;
   ```

2. In `secrets.yaml` eintragen:

   ```yaml
   recorder_readonly_db_url: postgresql://leser:zufaelliges-passwort@77b2833f-timescaledb/homeassistant
   ```

3. App starten und im Protokoll den Pfad `/<geheim>/mcp` ablesen.
4. Port 9584 (oder den in der Konfiguration gewählten) über einen Tunnel veröffentlichen und die
   URL `https://<deine-domain>/<geheim>/mcp` als MCP-Connector eintragen.

## Werkzeuge

| Werkzeug | Zweck |
|---|---|
| `list_tables` | Tabellen mit geschätzter Zeilenzahl und Größe |
| `describe_table` | Spalten einer Tabelle |
| `find_series` | Sensoren nach ID oder Anzeigename suchen – mit Quelle, Einheit, erstem/letztem Tag und Punktzahl |
| `daily` | Ein Wert pro lokalem Tag (Europe/Berlin): `mean`, `min`, `max`, `last` oder `change` (Zähler) |
| `compare` | Bis zu 8 Sensoren nebeneinander, eine Zeile pro Tag |
| `gaps` | Fehlende Stunden oder Tage einer Reihe (Auflösung `auto`, `hour` oder `day`) |
| `summary` | Überblick über einen Sensor der letzten N Tage: letzter Tag, Mittel, Min, Max, Vergleich zur Vorperiode |
| `latest` | Letzter aufgezeichneter Wert mehrerer Entitäten in einem Aufruf (IDs oder `%`-Muster) |
| `find_entities` | Entitäten/Statistiken nach Namensteil suchen |
| `entity_history` | Zustandsverlauf einer Entität, optional mit Attributen |
| `statistics` | Langzeit- (`hour`) oder Kurzzeitstatistik (`5minute`) eines Sensors |
| `run_query` | Beliebige lesende SQL-Abfrage |
