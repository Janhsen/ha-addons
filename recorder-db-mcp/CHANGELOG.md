# Changelog

## 0.5.0

- Schneller: Die Datenbankverbindung bleibt nach einer Abfrage kurz offen (Option „Verbindung offen halten“, Standard 60 s, 0 = aus) und wird für Folgeabfragen wiederverwendet. Auf dem Testsystem sinkt der Overhead je Abfrage von 4,5 auf 0,7 ms.
- Sicherheit bleibt gleich: Nach jeder Abfrage wird die Sitzung vollständig zurückgesetzt (Rollback, `DISCARD ALL`: Einstellungen, Sperren, temporäre Objekte). Nach einem Fehler oder Abbruch wird die Verbindung geschlossen statt wiederverwendet; höchstens zwei Verbindungen, maximal 10 Minuten alt. Tote Verbindungen werden einmal automatisch ersetzt.

## 0.4.0 (Sicherheits-Update, empfohlen)

- Sicherheit: `run_query` akzeptiert nur noch ein einzelnes Statement. Vorher konnte eine Mehrfach-Abfrage mit `COMMIT` und `SET` die Read-only-Transaktion und das Zeitlimit aushebeln.
- Sicherheit: Ergebnisse werden zeilenweise gelesen und auf Zeilenzahl und Größe (ca. 2 MB) begrenzt, statt komplett in den Speicher geladen zu werden. Höchstens zwei gleichzeitige Abfragen, Watchdog gegen hängende Abfragen.
- Sicherheit: Der geheime Pfad steht nur noch bei Neuerzeugung im Klartext im Protokoll, in Zugriffszeilen ist er maskiert.
- Sicherheit: Fehlermeldungen zeigen weder Host, Rolle noch Passwort; ungültige URLs werden nicht mehr ins Protokoll geschrieben.
- Sicherheit: Kein Zugriff mehr auf das Home-Assistant-Konfigurationsverzeichnis. Die Datenbank-URL steht in der neuen Option „Datenbank-URL“ (Typ Passwort). **Beim Update einmal eintragen**; `secrets.yaml` wird nicht mehr gelesen.
- Neu: Aufruf-Protokoll (Option `audit_log`), `/health` prüft die Datenbank, geheime Dateien liegen nicht im Backup, AppArmor an.
- Server blockiert bei langen Abfragen nicht mehr alle anderen Anfragen.
- Der Assistent wird angewiesen, Datenbanktexte nur als Daten zu behandeln.
- Korrekturen: Datum ohne Zeitzone gilt jetzt als Berliner Zeit, `days` zählt volle lokale Tage, Eingaben werden geprüft (`days` 1–3650, `period`, `agg`), NaN/Infinity ergeben `null`, Suchtext wird wörtlich genommen (`_` und `%`), `entity_history` ohne Zeitraum liefert die neuesten Zustände, `daily`/`summary` mit Lücken bei Zählern und leeren Stundenwerten korrigiert, `gaps` erkennt Stunden- und Tagesreihen über den Median der Abstände.
- Das Image wird jetzt auf GitHub gebaut und von dort geladen (nur amd64), Updates gehen schneller und der Bau ist nachvollziehbar.
- Optionsgrenzen: `max_rows` höchstens 20000, `statement_timeout_s` höchstens 300.

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
