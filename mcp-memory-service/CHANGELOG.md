# Änderungen

## 12.7.0-3

- Dashboard ist in Home Assistant sichtbar: Upstream verbietet das Einbetten (`frame-ancestors 'none'`), der Ingress-Proxy erlaubt es jetzt für Home Assistant selbst (`'self'`). Der Proxy setzt nur noch `<base href>` und schreibt sonst nichts um.
- Plug and play: In der Konfiguration stehen nur noch API-Schlüssel und öffentliche Adresse. Alle anderen Einstellungen sind optional (unter „Nicht verwendete optionale Konfigurationsoptionen anzeigen“) und haben Standardwerte.

## 12.7.0-2

- Dashboard von mcp-memory-service in der Home-Assistant-Seitenleiste (Ingress, Eintrag „Memory“). Es läuft nur intern auf `127.0.0.1:8000`; ein kleiner Proxy passt die Pfade an und meldet sich mit dem API-Schlüssel an. Abschaltbar mit der Option `dashboard`.
- Neue Optionen: `consolidation` (automatische Konsolidierung), `nli` (Widerspruchserkennung), `bootstrap` (Bootstrap-Profile für Agenten) und `agent_id`. Alle sind standardmäßig aus bzw. leer.
- mDNS ist abgeschaltet, weil es im Container nichts bringt.

## 12.7.0-1

- Erste Version: mcp-memory-service 12.7.0 als Home-Assistant-App.
- OAuth ist Pflicht, anonymer Zugriff ist abgeschaltet, der Start bricht ohne ausreichend langen API-Schlüssel ab.
- OAuth-Signaturschlüssel, Erinnerungen und OAuth-Datenbank liegen in `/data` und sind Teil der Sicherung.
- Mehrsprachiges Embedding-Modell als Standard (Deutsch und Englisch).
