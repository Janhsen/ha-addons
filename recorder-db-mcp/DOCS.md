# Recorder DB MCP

Stellt die Recorder-Datenbank von Home Assistant (PostgreSQL, z. B. die TimescaleDB-App) als
**nur lesenden** MCP-Server bereit. Ein KI-Assistent mit MCP-Unterstützung kann damit Verlauf,
Langzeitstatistiken und Ereignisse direkt per SQL abfragen.

## Sicherheit

Schutzschichten, von außen nach innen:

1. **Geheimer Pfad** (`/<geheim>/mcp`): Wer ihn kennt, kann lesen. Der Pfad wird beim ersten Start erzeugt
   und nur dann im Protokoll im Klartext angezeigt. Danach zeigt das Protokoll nur den Anfang, und in den
   Zugriffszeilen ist er durch `***` ersetzt. Nur über einen vertrauenswürdigen Tunnel (z. B. Cloudflare)
   veröffentlichen und dort nur `/<geheim>/*` durchlassen.
2. **Ein Statement pro Abfrage**: Der Server lehnt mehrere Statements in einer Abfrage ab, damit weder
   `COMMIT` noch `SET` die Schreibsperre oder das Zeitlimit aushebeln können.
3. **Read-only-Transaktion, Zeitlimit, Zeilen- und Größenlimit** (Ergebnis höchstens ca. 2 MB), höchstens vier
   gleichzeitige Datenbankabfragen.
   Die Verbindung bleibt nach einer Abfrage kurz offen (Option „Verbindung offen halten“, 0 = aus) und wird
   nach jeder Nutzung zurückgesetzt (Rollback, `DISCARD ALL`); nach Fehlern wird sie geschlossen.
4. **Datenbank-Rolle mit minimalen Rechten**: Das ist die eigentliche Sperre. Die App-Schichten ersetzen
   keine saubere Rolle (siehe Einrichtung).
5. **Keine Zugriffe auf Home-Assistant-Dateien**: Die Datenbank-URL steht in den App-Optionen (Typ Passwort),
   die App bindet kein `/config` mehr ein.

Bekannte Grenzen:

- Wer den Pfad kennt, liest alles, was die Rolle sehen darf, auch Standort-, Mail- und Gesundheitsdaten des
  Recorders. Pfad wie ein Passwort behandeln, bei Verdacht `rotate_secret` ändern.
- Der Port 9584 ist im lokalen Netz ohne Verschlüsselung erreichbar. Nur über einen Tunnel mit HTTPS nutzen,
  den Port nicht ins Internet weiterleiten.
- Texte aus der Datenbank (Namen, Benachrichtigungen, Kalendertitel) stammen teils von Dritten. Der Server
  weist den Assistenten darauf hin, dass sie nur Daten sind; ein Restrisiko bleibt.
- Neuer geheimer Pfad: in den Optionen bei „Geheimen Pfad erneuern“ (`rotate_secret`) einen beliebigen neuen
  Text eintragen und die App neu starten. Der neue Pfad steht einmalig im Protokoll, der Connector muss
  danach ersetzt werden.
- Das Protokoll hält jeden Aufruf fest (Werkzeug, Dauer, gekürzte Parameter inkl. SQL; abschaltbar mit
  `audit_log`). Protokolle trotzdem nicht weitergeben. 404-Zeilen automatischer Scanner werden
  standardmäßig ausgeblendet (`hide_404_log`).

## Einrichtung

1. Nur-lesende Rolle anlegen (als Datenbank-Admin), Beispiel mit zusätzlicher Härtung:

   ```sql
   CREATE ROLE leser LOGIN PASSWORD 'zufaelliges-passwort' CONNECTION LIMIT 3;
   ALTER ROLE leser SET default_transaction_read_only = on;
   ALTER ROLE leser SET statement_timeout = '30s';
   ALTER ROLE leser SET idle_in_transaction_session_timeout = '60s';
   ALTER ROLE leser SET temp_file_limit = '256MB';
   GRANT CONNECT ON DATABASE homeassistant TO leser;
   REVOKE TEMPORARY ON DATABASE homeassistant FROM PUBLIC, leser;
   GRANT USAGE ON SCHEMA public TO leser;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO leser;
   ALTER DEFAULT PRIVILEGES FOR ROLE homeassistant IN SCHEMA public GRANT SELECT ON TABLES TO leser;
   ```

   Wer bestimmte Daten gar nicht freigeben will (z. B. `state_attributes` mit Standort), vergibt statt
   `SELECT ON ALL TABLES` nur `SELECT` auf die benötigten Tabellen oder Spalten.

2. In den App-Optionen bei „Datenbank-URL“ eintragen:

   ```
   postgresql://leser:zufaelliges-passwort@77b2833f-timescaledb/homeassistant
   ```

3. App starten und im Protokoll den Pfad `/<geheim>/mcp` ablesen (nur beim ersten Start sichtbar).
4. Port 9584 (oder den in der Konfiguration gewählten) über einen Tunnel veröffentlichen und die
   URL `https://<deine-domain>/<geheim>/mcp` als MCP-Connector eintragen.

Update von 0.3.x: Der Schlüssel in `secrets.yaml` wird nicht mehr gelesen. Die URL einmal in die Option
„Datenbank-URL“ eintragen; der bisherige geheime Pfad bleibt gültig.

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
| `state_durations` | Wie lange war eine Entität in welchem Zustand (z. B. Licht an/aus/nicht verfügbar) im Zeitraum |
| `state_periods` | Zeiträume (von–bis), in denen eine Entität durchgehend in einem Zustand war, z. B. Ausfälle |
| `state_changes` | Welche Entitäten am häufigsten in einen Zustand wechselten (echte Wechsel, ohne Attribut-Updates und ohne Wechsel aus „nicht verfügbar“) |
| `find_entities` | Entitäten/Statistiken nach Namensteil suchen |
| `entity_history` | Zustandsverlauf einer Entität, optional mit Attributen |
| `statistics` | Langzeit- (`hour`) oder Kurzzeitstatistik (`5minute`) eines Sensors |
| `run_query` | Beliebige lesende SQL-Abfrage |

## Hinweise in den Ergebnissen

Die Statistik-Werkzeuge warnen jetzt im Ergebnis (`warnings` und strukturierte Felder), damit Zahlen nicht falsch gelesen werden:
unvollständiger heutiger Tag (`partial_days`), Tage mit wenigen Stundenwerten (`low_coverage_days`, Spalte `hours` bei `daily`),
Tage mit 23 oder 25 Stunden (`dst_days`), negative Zählerwerte (`negative_change_days`), unterschiedlicher Reihenbeginn bei
`compare` (`series_first_day`) sowie „nicht verfügbar“/„unbekannt“ bei `latest` (Spalte `valid`) und `entity_history`
(`unavailable_rows`). Zeiten tragen den UTC-Versatz (`+0100`/`+0200`). Alles bleibt rein lesend.
