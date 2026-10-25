# Changelog

## 0.3.0

- Neu: `summary` – Überblick über einen Sensor der letzten N Tage in einem Aufruf (letzter Tag, Mittel, Minimum, Maximum, Vergleich zur Vorperiode, Tage mit Daten, letzter Punkt).
- Neu: `latest` – letzter aufgezeichneter Wert mehrerer Entitäten in einem Aufruf (IDs oder `%`-Muster); Reihen ohne Zustände fallen auf ihren neuesten Statistikpunkt zurück.
- Neu: Option `rotate_secret` – beliebigen neuen Text eintragen und die App neu starten, um den geheimen Pfad zu erneuern (ohne Deinstallation).
- Neu: Option `hide_404_log` (Standard an) – blendet 404-Zeilen automatischer Scanner im Protokoll aus.
- Die bisherigen Werkzeuge bleiben unverändert.

## 0.2.0

- Neu: `find_series` – Sensoren nach ID **oder Anzeigename** suchen, mit Quelle, Einheit, erstem/letztem Tag und Anzahl der Punkte.
- Neu: `daily` – ein Wert pro lokalem Tag (Europe/Berlin): Mittel, Minimum, Maximum, letzter Wert oder Tagesänderung bei Zählern.
- Neu: `compare` – bis zu 8 Sensoren nebeneinander, eine Zeile pro Tag, Spalten mit Anzeigenamen.
- Neu: `gaps` – fehlende Stunden oder Tage einer Reihe finden (Auflösung automatisch).
- Die bisherigen Werkzeuge bleiben unverändert.
- `tzdata` ergänzt, damit die Zeitzone Europe/Berlin im Container sicher verfügbar ist.

## 0.1.0

- Erste Version: nur-lesender MCP-Server für die Recorder-Datenbank (PostgreSQL) mit den Werkzeugen list_tables, describe_table, find_entities, entity_history, statistics und run_query.
