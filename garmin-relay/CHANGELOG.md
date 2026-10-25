# Changelog

## 0.110.3

- LiveTrack: Ist eine beendete Aufzeichnung nur teilweise gespeichert (gemessen an Garmins Gesamtzeit und -distanz), liest die App die Session nach 2 Minuten, 10 Minuten und einer Stunde noch einmal komplett bei Garmin und übernimmt die vollständige Strecke, sobald Garmin mehr Punkte liefert.

## 0.110.2

- LiveTrack: Wenn von einer Aufzeichnung nur ein kleiner Teil gespeichert ist (z. B. nur die letzte Minute eines 10-km-Laufs), zeigt die Karte keine übereinander gestapelten km-Marker und keine Splits mehr, das Profil läuft über die Zeit, und ein Hinweis nennt Garmins Gesamtwerte.

## 0.110.1

- Einstellungen: Das Höchstalter der Positions-Tracker lässt sich jetzt unter Einstellungen → Darstellung und Daten → Standorte → Höchstalter ändern (Minuten, 0 = aus, Standard 60).

## 0.110.0

- Positions-Tracker: Eine Position, die älter als 60 Minuten ist, wird vom Tracker genommen (Zustand „unbekannt“, bis die nächste Position kommt). So springt eine Person nach einem Neustart von Home Assistant oder der App nicht mehr auf einen alten Ort, etwa von gestern. Eine schon zu alte Position wird gar nicht erst mit Koordinaten gesendet. Einstellbar mit der Option `tracker_max_age_min` (Minuten, 0 = aus); die Karte in der App zeigt weiter den letzten Ort.

## 0.109.0

- LiveTrack: Eigene Sitzungen (zum Beispiel von deiner Uhr) bekommen jetzt auch den Sensor „LiveTrack <Name>“ mit deinem Namen. Er ist an, sobald die Sitzung gefunden wird, auch bevor der erste Trackpunkt da ist.

## 0.108.3

- Positions-Tracker: Sie werden bei einem Neustart der App nicht mehr kurz „nicht verfügbar“. Bisher bekam danach auch eine alte Position einen neuen Zeitstempel, und eine Person sprang auf sie statt auf die aktuelle Handy-Position.

## 0.108.2

- Build: Neue Versionen werden jetzt automatisch gebaut und veröffentlicht, sobald sie auf main landen. Keine Änderung an der App.

## 0.108.1

- Positions-Tracker: Nach einem erneuten Verbinden oder geänderten Kontakten schickt die App eine bereits gezeigte Position nicht mehr aus dem Verlauf neu. Bisher änderten sich dabei die Attribute, Home Assistant hielt die alte Position (z. B. von gestern) für neu, und eine Person sprang auf sie statt auf die aktuelle Handy-Position.

## 0.108.0

- LiveTrack: Der Tracker einer Person folgt einer laufenden Sitzung jetzt Punkt für Punkt (höchstens einer alle 5 s), jeder Punkt mit `heart_rate`, `cadence`, `power`, `speed_kmh`, `altitude_m`, `distance_m`, `duration_s` und `activity_type`, soweit Garmin sie schickt – der Recorder speichert so die ganze Strecke mit Puls. Nach dem Ende bleibt nur die Position.

## 0.107.5

- Garmin-Protokoll: Einträge älterer Versionen mit konkreter Chat-ID (z. B. `GET /Conversation/Members/<id>`) werden beim Start entfernt und erscheinen nicht mehr als „Garmin hat etwas geändert“.
- LiveTrack mit Puls, Tempo und Höhenprofil: Die Detailansicht einer Sitzung zeigt kompakt Distanz, Zeit, Ø-Pace (Laufen/Gehen/Wandern) bzw. Ø-Tempo, Anstieg/Abstieg, Höhe min/max und Puls Ø/max, darunter ein Diagramm Höhe / Puls / Tempo über die Distanz (ohne Distanz über die Zeit); Tippen oder Ziehen im Diagramm markiert den Punkt auf der Karte. Werte, die Garmin nicht schickt (oder als 0), werden weggelassen statt als 0 gezeigt. Der Sensor „LiveTrack <Name>“ hat während der Sitzung die Attribute `heart_rate`, `speed_kmh`, `altitude_m` und `activity_type`. Gespeicherte Spuren älterer Versionen werden weiter gelesen; die Karte passt den Ausschnitt jetzt an die Höhe des Panels an, und Tippen auf „Mehr“/den Griff klappt das Panel wieder auf.

## 0.107.4

- LiveTrack: Eine eigene Sitzung, die du mit mehreren Kontakten teilst, steht in allen Listen nur noch einmal („geteilt mit Alex, Sam, Robin“) und meldet `garmin_inreach_livetrack` nur einmal je Sitzung (neues Feld `shared_with`).
- Eigene Geräte (inReach, Messenger-Handy) laufen in der App unter „ich“ (Karte, Personenliste, Orte; das Gerät steht dabei); in Home Assistant bekommt dein Positions-Tracker auch die Gerätepositionen (neueste gewinnt), die Geräte-Tracker bleiben.

## 0.107.3

- Blasen im Chat: Mehrere Nachrichten hintereinander stehen jetzt bündig untereinander (bisher ragten alle außer der letzten bis unter den Zipfel).
- Nachricht an die eigene inReach-Adresse wird nur noch einmal gemeldet: Garmin liefert sie zweimal mit verschiedenen IDs (Sender- und Empfängerseite, auch erst beim Nachholen nach einem Neustart); die zweite Kopie löst kein Event, keinen zweiten Verlaufseintrag und keine zweite Position mehr aus, ebenso die Rückspiegelung einer Antwort der App an die eigene Adresse.

## 0.107.2

- Fehler behoben: Jede Nachricht über MQTT (`garmin_inreach/send`, auch Empfängerwahl und Benachrichtigungen pro Kontakt) wurde doppelt an Garmin geschickt, weil das Thema doppelt abonniert war. Antworten aus Home Assistant kommen jetzt nur noch einmal an.

## 0.107.1

- LiveTrack-PIN: eigene LiveTrack-Nachrichten von inReach/Uhr (von Garmin mit deiner User-ID statt Nummer gemeldet) liefern jetzt deine PIN; fehlt eine PIN, sucht die App einmal (höchstens täglich, max. 10 Seiten) in älteren Nachrichten bei Garmin; der Start-Backfill ersetzt keine gespeicherte PIN mehr.
- Du bist auf Karte, in LiveTrack und bei den Orten eine Person (Nummer + inReach-Adresse + eigene LiveTracks); in HA bewegt das alles deinen einen Tracker (Entity-ID bleibt). Kontaktinfo zeigt nur die LiveTrack-Sitzungen dieser Person.
- Chatliste: bei „Neueste“ steht Heute wieder vor Gestern (auch mit deinem eigenen Chat); die Tab-Leiste auf dem iPhone klappt nicht mehr ein (nur bei offener Tastatur ausgeblendet); Doku-Screenshots ohne Mail-Chat neu.

## 0.107.0

- Mail-Funktion ab hier entfernt (Mail-Eingang der App und Mail-Relay der Vorlage); letzter Stand mit Mail: Branch mail-feature-archiv. Dazu LiveTrack-PIN pro Person, neue Karte, UI-Korrekturen vom 17.10. und Code-Umbau Etappe 6b/6c
- Wartbarkeit (Etappe 6b, ohne sichtbare Änderung): Web- und API-Server aufgeräumt (eine Funktion je Adresse, gemeinsame Prüfung von Token, JSON und Garmin-Verbindung, Status als fester Typ mit unveränderter Antwort), Start der App in Aufbau, Daten laden und Starten getrennt, Empfang von Nachrichten, Öffnen von `state.json` und Prüfen der Anzeige-Einstellungen in kleine Schritte zerlegt.
- Neue Tests halten die Antworten aller Web-Adressen, den Status bytegenau und alle Wege einer empfangenen Nachricht (Verlauf, Home-Assistant-Aufrufe, Log) fest.
- Wartbarkeit (Etappe 6c, ohne sichtbare Änderung): Verlauf, MQTT-Client und LiveTrack-Modell als eigene Go-Pakete (`internal/store`, `internal/mqtt`, `internal/livetrack`), weitere Teilzustände der App (Tracker-Positionen, LiveTrack-Verfolger, Gespräche, Mail-Echos) mit eigener Sperre, Test-Schalter als Felder statt globaler Variablen.
- Beim Beenden wartet die App jetzt auch auf einen Home-Assistant-Auftrag, der gerade aus der Warteschlange genommen wurde; Tests schreiben nur noch in temporäre Ordner, nie nach `/data`.
- LiveTrack-PIN wird pro Kontakt bzw. für dich dauerhaft gespeichert (aus Garmins PIN-Feld und aus dem Text neben einem LiveTrack-Link, auch eigene inReach-Adressen zählen als „du“), unabhängig vom Verlauf; beim Start wird der gespeicherte Verlauf einmal nach PINs durchsucht. Geteilte LiveTracks probieren zuerst die PIN des Teilenden (max. 5 Versuche), Links ohne PIN nehmen die gespeicherte des Absenders.
- Neue Zeile „LiveTrack-PIN“ in der Kontaktinfo und unter Einstellungen → Garmin-Konto (maskiert, antippen zum Zeigen, von Hand setzen/löschen); eine neue PIN lädt wartende LiveTracks der letzten 24 h nach.
- Karte: Personen im unteren Blatt als senkrechte Liste wie in „Wo ist?“ (Name, Ort, Zeit der letzten Position, neueste zuerst; Blatt mit drei Rastpunkten). Antippen fliegt zur Person und hebt ihre Spur hervor, die anderen treten zurück; Karte antippen oder „Alle anzeigen“ zeigt wieder alle.
- Karte: eine Markierung je Person an der neuesten Position; nahe Personen werden zu einem Kreis mit Zahl gebündelt, Antippen zoomt hinein bzw. listet die Personen am selben Ort.
- Mail-Funktion entfernt (inReach-Mails lesen und über Garmins Antwort-Link beantworten, Mail-Relay der Vorlage samt CLI und IMAP/SMTP-Bibliotheken). Beim Update werden Mail-Chats samt zugehöriger Medien und Positionen, die Mail-Einstellungen mit dem gespeicherten Postfach-Passwort, `mailseen.json` und die Option `inreach_reply_action` gelöscht und die Mail-Entitäten aus Home Assistant abgemeldet (u. a. `notify.inreach_mail_reply`, `text.inreach_mail_reply`, `button.inreach_test_reply`, Mail-/Antwortschnittstellen-Sensoren, Positions-Tracker der Mail-Chats). Senden über Garmin Messenger an inReach-Adressen (`…@inreach.garmin.com`) bleibt. Letzter Stand mit Mail: Branch `mail-feature-archiv`.
- Große Schrift (iOS-Textgröße bis zur größten Bedienungshilfen-Stufe): Kopfzeilen, Tab-Leiste und Initialen in Avataren wachsen wie in iOS nur begrenzt mit; Einstellungszeilen, Blatt-Titel, Kontonummer und lange Adressen werden umbrochen statt abgeschnitten, das Kartenblatt zeigt unten wieder eine ganze Person. Bei normaler Schrift bleibt alles gleich.
- Doku: toter Link „Safety limits“ in der Home-Assistant-Anleitung korrigiert.
- Langes Drücken auf eine Nachricht wie in iMessage: der Chat wird unscharf, die Nachricht bleibt scharf zwischen Reaktionsleiste und Menü (rückt auf kleinen Bildschirmen passend), die iOS-Textauswahl („Kopieren | Nachschlagen | Übersetzen“) startet nicht mehr; LiveTrack-Karten im Chat: eigene rechts, fremde links.
- Mehr Platz unten: „Gesendet.“ und Fehler schweben kurz über dem Eingabefeld statt als eigene Zeile, in der HA-App übernimmt die App den Rand am Home-Balken selbst (kein grauer Streifen, kein doppelter Abstand); Details und Blätter enden am sichtbaren Rand und scrollen innen.
- Einstellungen aufgeräumt: Garmin Locate, SMS, Anrufe, alter REST-Sensor, „Heimposition mitsenden“ und der Schalter „Mit eigenem Namen abrufen“ werden nicht mehr angezeigt (Funktion, MQTT, Events und gespeicherte Werte bleiben).

## 0.106.1

- Wartbarkeit (Etappe 6a, ohne sichtbare Änderung): strengere Code-Prüfung (golangci-lint mit unused, errorlint, errcheck, staticcheck) in CI und Release, ungenutzter Code aus der App entfernt, Fehler einheitlich mit errors.Is/As und %w, Logzeile nach der Anmeldung auf Englisch („Login successful, starting the relay“).
- Neue Tests halten das Verhalten der Verbindungsschleife, die Form von `/api/status` und das Stundenlimit bei fehlgeschlagenen Sends fest.

## 0.106.0

- Etappe 4 und 5 aus dem Gutachten: neues Design „Ruhig & kompakt“, LiveTrack in Home Assistant, neue Sensoren und Blueprints
- Blueprints überarbeitet: „Antwort aus der Benachrichtigung“ sendet mit `key` (doppelt ankommende Antwort wird nur einmal gesendet) und meldet einen Sendefehler (`garmin_inreach_send_failed`) als zweite Benachrichtigung aufs Handy; Telefonnummern mit „+“ bleiben dabei Text. „Nachrichten weiterleiten“ zeigt den Kontaktnamen (`from_name`) und kann stumme Chats auslassen und nach Quelle (Messenger/Mail) filtern.
- Neue Blueprints: „Befehl per Nachricht“ (sicheres Muster: exaktes Befehlswort, exakte Absenderliste, nur Garmin Messenger, keine Gruppen, Höchstalter, jede `message_id` nur einmal, Quittung an den Absender), „Wetter auf Anfrage“ (Tagesvorhersage, auf 160 Bytes gekürzt, also immer ein Satellitenteil) und „Auf Uhr/inReach angekommen“ (Push bei `garmin_inreach_device_delivery`).
- HA-Hinweis: Blueprint „Alarm, wenn nichts kam“ löst jetzt direkt über den Sensor „Last received“ aus (statt alle 15 min zu prüfen) und kann auf bestimmte Absender beschränkt werden. Er braucht den Sensor „Last received“ statt „Last message“ und eine Dauer statt Stunden: neu importieren und die Automation einmal öffnen.
- Neu: notify-Entität je erlaubtem Kontakt (`notify.inreach_<name>`, z. B. `notify.inreach_anna`); sendet immer an diese Person, mit `key`, `max_parts` und `reference_point` als JSON; verschwindet, wenn der Kontakt nicht mehr erlaubt ist (F20).
- Neu: Referenzpunkt (Wegpunkt) senden über `POST /send`, MQTT `garmin_inreach/send` und die Kontakt-notify mit `reference_point: {latitude, longitude, elevation_m?, name?}` (F6).
- Neu: Fotos und Sprachnachrichten aus Home Assistant senden: `POST /send/media` auf Port 8765 (Token, multipart), gleiche Umwandlung wie in der Web-Oberfläche (F7).
- Neu: Sensor „Satellite messages this period“ (`sensor.inreach_satellite_messages`): gesendete Nachrichten, geschätzte Teile, Medien, tatsächlich per Satellit übertragene Teile (mtmsn) und Nachrichten vom inReach; Stichtag `billing_day` (Standard 1.) in state.json (Idee 1).
- Neu: je inReach ein Sensor „Satellitenabo“ und Binärsensoren „Abo pausiert“ und „Nur SOS“ (Idee 10).
- Neu: Bild-Entität „Last received image“ mit dem zuletzt empfangenen Foto, per MQTT als Bytes (Idee 12).
- Doku: alle Felder des Events `garmin_inreach_message` gegen den Code geprüft und vollständig beschrieben (F22); DOCS sagte fälschlich, Medien ließen sich aus HA nicht senden.
- Intern: MQTT-Discovery als eine Tabelle statt einer langen Funktion mit zwei ID-Listen, abgesichert durch einen Golden-Test (Payloads byte-gleich) (A15).
- HA-Hinweis: Alle bestehenden Entitäten, unique_ids, Topics und Payload-Felder bleiben unverändert (`garmin_inreach/send` mit `{"to","text"}`, `notify.inreach_mail_reply`, `sensor.garmin_inreach_relay_last_send_status`, Event `garmin_inreach_message`); es kommen nur Entitäten und Felder dazu.
- HA-Hinweis: Der REST-Sensor `sensor.garmin_inreach_last_message` ist abgekündigt (neues Attribut `deprecated`, Hinweis einmal im Log). Er wird weiter geschrieben; ersetzen durch `sensor.garmin_inreach_relay_last_message` (MQTT). Abschalten mit der Option `rest_sensor` (F21/R4).
- HA-Hinweis: Positions-Tracker von inReach-Mail-Absendern sind jetzt an die Chat-Adresse gebunden (unique_id `…_contact_mail_<name>` statt `…_contact_<name>`); der alte Tracker wird beim Start entfernt. Die Entitäts-ID bleibt meist gleich, sonst bekommt sie `_2` – dann in HA umbenennen (F23).
- LiveTrack eines Kontakts bewegt dessen Positions-Tracker mit (neuester Punkt, Attribut `source: livetrack`); ältere Punkte setzen den Tracker nie zurück. Eigene Sitzungen bewegen keinen Kontakt-Tracker (F11).
- Geteilte und verlinkte Sitzung werden nur einmal gespeichert (Verweis statt Kopie); `/data/livetrack` wird nach Größe begrenzt (50 MB, älteste zuerst) statt auf 60 Dateien (F14).
- Lehnt Garmin eine Sitzung trotz PIN in der Nachricht dreimal hintereinander ab, endet die Verfolgung mit Zustand `pin` statt einen Tag weiter zu fragen (F16).
- Gibt es im selben Chat ein Ereignis „LiveTrack gestartet“ mit Sitzungs-ID, wird für einen persönlichen LiveTrack-Link genau diese Sitzung genommen statt nach Startzeit zu raten (F17).
- GPX-Export: `/api/livetrack/<id>.gpx` (GPX 1.1 mit Zeit, Höhe, Puls/Trittfrequenz) in der Web-Oberfläche und mit Token auf Port 8765 (F18).
- HA-Hinweis: Neu: `binary_sensor` „LiveTrack <Name>“ je Person mit LiveTrack (an, solange eine Sitzung live ist; Attribute `status`, `session_name`, `distance_m`, `duration_s`, `last_update`, `url` …), retained, Topic `garmin_inreach/contact/<Nummer>/livetrack` (F13).
- HA-Hinweis: `garmin_inreach_livetrack`: leere Textfelder fehlen jetzt statt `""`; neues Feld `from` (Nummer der Person, fehlt bei eigenen Sitzungen); `direction` ist `in`, `out` oder `event` (dokumentiert, F15).
- HA-Hinweis: Positions-Tracker eines Kontakts kann jetzt `source: livetrack` und `livetrack_session` tragen.
- Ein Problem – eine Stelle (H1, H2): alle Probleme kommen aus einer Liste. Der Balken oben erscheint nur noch, wenn etwas nicht funktioniert – ein kurzer übersetzter Satz und genau eine Aktion, ohne farbigen Randstreifen, als Live-Region für VoiceOver. Was nur einschränkt (MQTT, Postfach, zu kurzer API-Token, beschädigte Datei), färbt den Punkt an „Einstellungen“ und die Kontokarte orange; „Status und Diagnose → Braucht Aufmerksamkeit“ zeigt jedes Problem einmal mit dem Originaltext des Servers und der passenden Aktion, „Zustand“ nur noch, was läuft.
- Zu kurzer `api_token` und andere Hinweise des Servers zu App-Optionen werden jetzt in der Oberfläche angezeigt (S13).
- Eine Suche (H9): Das Suchfeld über der Chatliste erscheint erst mit dem Suchknopf, beim Herunterziehen der Liste oder mit Strg+K, mit „Abbrechen“ daneben; der zweite Löschknopf des Browsers ist weg.
- Chatliste wie Entwurf C: „Bearbeiten“ als Textknopf, Sortierung als Text („Neueste“), Abschnitte Angeheftet/Heute/Gestern/Älter; Einstellungen mit Abschnittsüberschriften.
- Nachrichtenfeld wie Messages (H13): leer = Mikrofon, mit Text = Senden-Pfeil.
- Check-in-Vorlagen (Idee 8): Der Listen-Knopf im leeren Nachrichtenfeld bietet eigene Kurztexte an („Bin unterwegs.“, „Gut angekommen.“ …); sie werden nur eingefügt, nie selbst gesendet. Verwaltung unter Einstellungen → Darstellung und Daten → Vorlagen, gespeichert in der App (gleich auf allen Geräten).
- Entschlackt (H10): Anrufliste als eigene Seite unter „Garmin-Konto“ (dort nur noch eine Zeile mit verpassten Anrufen), Nummer nur noch einmal; Protokoll-Aufzeichnung und Passphrase auf der Unterseite „Erweitert“; in der Kontaktinfo kein Anheften-Schalter mehr (Anheften im Menü der Chatliste) und LiveTrack-Sitzungen in der Gruppe „Chat“.
- Kontakte (H11): Jede Zeile öffnet die Kontaktinfo; „darf empfangen“ steht nicht mehr überall, nur „nur lesen“ als Ausnahme.
- Leerzustände für Datenverkehr und Garmin-Schnittstelle (H12).
- Knopf-Regeln (H15): eine Hauptaktion je Ansicht – in der Einrichtung „Warte auf die Anmeldung …“ als Zeile mit Drehrad statt grauem Knopf, „Neue Konversation“ mit „Abbrechen“ oben und „Starten“ über die ganze Breite, Kontakt-Formular ebenso.
- iPad (H16): Die Kontaktinfo öffnet als Formblatt über Liste und Chat statt als Vollseite.
- Karte (H17): acht klar verschiedene Personenfarben (Tokens), vergeben in der Reihenfolge, in der Personen auftauchen – keine zwei Personen in derselben Farbe, auf allen Geräten gleich; Initiale am Punkt; Zoom-Knöpfe verschwinden, wenn das Blatt ganz aufgezogen ist; Personen als einzeilige Karten.
- Ort statt Koordinaten (H22): Chat-Kopf, Kartenzeilen und Karten im Chat zeigen den Ortsnamen oder „Position“ mit Uhrzeit; Koordinaten nur noch in den Details einer Nachricht.
- LiveTrack (F12): Unter der Karte im Chat steht, worauf ein LiveTrack wartet – „Wartet auf Start“, „PIN fehlt“/„PIN falsch“, „Garmin lehnt ab“, „Nicht gefunden“. In der Track-Ansicht neu: „Als GPX exportieren“ (`api/livetrack/<id>.gpx`).
- Aufgeräumt (H26): ungenutzte `Wizard.tsx` und `Login.tsx` entfernt.
- Doku: Abschnitt „Web UI“ in DOCS.md auf den heutigen Stand (keine Emoji-Symbole und ✓-Statuszeile mehr).
- Neues Standard-Design „Ruhig & kompakt“ (Entwurf C): eine weiße Fläche mit Haarlinien statt Kästen, kompakte Chatliste (kleine Avatare, eine Vorschauzeile, Filter als Text-Chips), schlankere Blasen, ruhige Datumszeilen, Einstellungen als schlichte Liste mit Linien-Symbolen, getönte Seitenleiste auf iPad und Laptop.
- Bessere Lesbarkeit: Schalter „aus“ mit sichtbarem Rand, helleres Blau für Text im Dunkelmodus, rote Schrift kräftiger, Zweitknöpfe auf heller Fläche mit Linie, Detailblatt und Menüs fast deckend; bei „Kontrast erhöhen“ die kontrastreichen iOS-Farben.
- Große Schrift (Dynamic Type, Textgröße „Sehr groß“): Namen im Chatkopf werden gekürzt statt zu überlappen, Beschriftungen stehen über dem Eingabefeld, Werte rutschen unter die Beschriftung, Auswahlknöpfe stehen untereinander statt abgeschnitten; Fließtext folgt jetzt überall der Textgröße.
- Tippflächen mindestens 44 px auch für Filter-Chips, Senden/Mikrofon, „Zur neuesten Nachricht“, Zeitraum-Regler und den Griff im LiveTrack-Blatt.
- Einheitlich: eine Art Erklärtext, eine Auswahl-Darstellung (hellblaue Fläche statt Ring), mit Maus keine Ziehgriffe und kein „Nach oben ziehen“.
- Intern: Stylesheets nach Bereich neu geordnet (9 statt 11 Dateien, keine gestapelten Überschreibungen, `!important` nur noch an 4 begründeten Stellen), tote CSS-Klassen entfernt, Radien und Schriftgrößen nur noch als Tokens (Lint prüft beides), DESIGN.md auf einem Stand.
- Deutsche Oberfläche vollständig (H3): Rückfragen, Postfach-Hilfe der Anbieter (Gmail, GMX, iCloud …), Statuszeilen wie „sofort (IMAP IDLE), 12 Mails gelesen“ und alle Fehlermeldungen der App (Senden, Antworten, Import, Vorlagen …) sind übersetzt. Neue Prüfung `dev/i18n.mjs` (läuft in `unit.mjs`, `quick.sh`, CI) findet jeden englischen Text im UI-Code und jeden Go-Text, den die Oberfläche direkt zeigt.
- Rohe Serverfehler (z. B. IMAP `AUTHENTICATIONFAILED`, Zeitüberschreitung, Zertifikat, Garmin HTTP 429/5xx) erscheinen als verständlicher Satz („Der Mailserver hat die Anmeldung abgelehnt …“); der Originaltext steht klein darunter.
- Barrierefreiheit (H18): Statuspunkte haben einen gesprochenen Namen („braucht Aufmerksamkeit“, „Problem“), Segmente sind Auswahlgruppen (Pfeiltasten), die Chat-Filter Umschalter statt Reiter, das Banner meldet sich als Hinweis/Warnung; jeder Symbol-Knopf hat eine Beschriftung (wird geprüft).
- Sicherheit: LiveTrack- und MapShare-Links werden nur gespeichert und angezeigt, wenn sie per https auf Garmin zeigen (S4, auch beim Import des Verlaufs); die Seite erlaubt nur noch ihr eigenes Skript per Hash statt `unsafe-inline` (S5); Ortsnamen-Abfragen an OpenStreetMap senden keinen Referrer mehr (S11, Karte bleibt standardmäßig an).
- DOCS: Abschnitt „Web UI“ beschreibt die heutige Bedienung (Tabs Chats/Karte/Einstellungen, Einstellungsseiten, Probleme, Tastatur und Screenreader) ohne Emoji-Symbole.
- Einstellungen → Darstellung und Daten: neue Gruppe „Zähler und Sensoren“ mit Abrechnungstag des Satelliten-Zählers und Schalter für den alten REST-Sensor (vorher nur über die API).
- Textgröße wird über ein Menü gewählt statt über vier enge Segmente.
- LiveTrack am Laptop/Maus: Knopf „Mehr/Weniger“ mit Pfeil statt Ziehgriff; Griff des Kartenblatts mit 44-px-Trefferfläche.
- Kleinigkeiten: Hinweis „Garmin lehnt die Anfragen ab“ ohne doppelten Satz; Beschriftung „Ereignis“ statt „Event-Name“ (kein Umbruch am Handy)

## 0.105.0

- Etappe 2 und 3 aus dem Gutachten: kein Flackern, schneller, schonender gegenüber Garmin
- Weniger Datenverkehr und ruhigere Oberfläche: Der Status (alle 5 s) enthält die Nachrichten nicht mehr, die Oberfläche holt nur neue oder geänderte Nachrichten (bei 500 Nachrichten ca. 2 KB statt 84 KB je Abfrage); im Hintergrund wird gar nicht mehr abgefragt.
- Nur der sichtbare Tab zeichnet sich bei Änderungen neu; Chatliste und Karte rechnen nur noch bei neuen Daten.
- Die Oberfläche wird komprimiert und mit ETag ausgeliefert (beim erneuten Öffnen nichts erneut laden, nach einem Update sofort die neue Version); CSS ist verkleinert.
- Kein Flackern mehr beim Tab- und Chatwechsel: nur neu eingetroffene Nachrichten blenden ein, Chatliste und Seiten gleiten nur beim echten Vor- und Zurückgehen, die große Karte bleibt nach dem ersten Besuch erhalten.
- Kartenvorschauen im Chat werden zwischengespeichert (kein Neuzeichnen beim erneuten Öffnen) und folgen dem Wechsel in den Dunkelmodus; die Scrollposition bleibt je Chat erhalten.
- Garmin-Client: alle Anfragen an Garmin (Hermes, LiveTrack, Anrufliste, Gerätebilder, Medien) laufen über eine gemeinsame Funktion – Kopfzeilen, Protokoll, Fehler und Token-Erneuerung an einer Stelle.
- Schonender bei Überlastung: Antwortet Garmin mit 429, pausieren alle Abfragen an diesen Server bis zum verlangten Zeitpunkt (höchstens 15 min), statt dass jeder Ablauf weiterfragt.
- Antworten von Garmin sind begrenzt (8 MB, Medien 64 MB); zu große oder abgebrochene Antworten gelten als Fehler statt halb gelesen zu werden.
- Abgleich fragt `AfterDate` jetzt in UTC ab (wie die Garmin-App).
- Aufgeräumt: alte Firebase-Reste (`proto`, protobuf) und der ungenutzte Push-Token-Aufruf mit abweichendem Gerätenamen entfernt.
- Modelle ergänzt (`userWhoTrustsMe` bei Standort-Updates, `uuid` bei Medien); Protokolltest prüft jetzt auch SignalR-Methoden und Garmin-Hosts gegen die Doku.
- Abhängigkeiten: signalr 0.11.0 mit quic-go 0.61.0 und webtransport-go 0.12.0 (behebt die govulncheck-Meldungen); Go-Modul auf 1.25.
- Garmin-Webseiten (LiveTrack-Ansicht live.garmin.com, Antwortseite messenger.garmin.com) werden standardmäßig mit dem eigenen Namen `garmin-inreach-ha-relay/<Version>` und ohne Browser-Kopfzeilen (`Sec-Fetch-*`) abgerufen (N1, N2, Entscheidung E3). Neuer Schalter Einstellungen → Darstellung und Daten → Garmin-Webseiten → „Mit eigenem Namen abrufen“; aus = Verhalten wie bis 0.105.
- Lehnt eine Garmin-Webseite die App ab (Cloudflare 403/Challenge), wird nichts umgangen: Hinweis in den Einstellungen, einmalige Warnung im Log und HA-Benachrichtigung. LiveTrack mit bekannter Sitzungs-ID läuft dann über die Garmin-Anmeldung (Gateway), persönliche LiveTrack-Seiten enden als „abgelehnt“.
- Antwortseiten-Prüfung: täglich nur noch ein Abruf der Seite; der Prüfaufruf mit erfundener ID nur, wenn Garmin die Seite neu gebaut hat. Die Suche nach einer neuen Action-ID höchstens 1×/Tag und nur nach echtem „Server action not found“. Zeitpunkte bleiben über Neustarts erhalten.
- LiveTrack-Abruf alle 2 min, 1 min nur solange die Web-Oberfläche offen ist; nach 45 min ohne neuen Punkt endet die Sitzung (meldet Garmin sie weiter live: alle 10 min) (N3, Entscheidung E4).
- Alle wiederkehrenden Abrufe schwanken um ±15 % (N4); nach einer (Neu-)Verbindung startet jeder Hintergrundjob nach zufälligen 1–10 min, Anmeldung, Live-Verbindung und Nachholen sofort (N5).
- Nachholen alle 30 min bei stabiler Live-Verbindung, sonst 10 min; nach einer kurzen Unterbrechung (< 60 s) kein eigenes Nachholen (N6). Geräte-Positionen und Garmin Locate stündlich (vorher 15/30 min), Anrufliste alle 30 min (vorher 10 min).
- Selbsttest höchstens 1×/24 h, auch über Neustarts; das letzte Ergebnis bleibt nach einem Neustart sichtbar (N7). Medien-IDs älterer Fotos werden nur einmal je Installation nachgeschlagen, mit 1–2 s Pause zwischen den Seiten (N5).
- Intern: ein gemeinsamer HTTP-Client-Bauer mit eigenem User-Agent (A8), Hintergrundaufrufe hängen am Lauf-Kontext statt an `context.Background()` (A12).
- HA-Hinweis: `garmin_inreach_livetrack` `update` kommt seltener (2 min statt 1 min, 1 min bei offener Web-Oberfläche); `ended` kann nach 45 min ohne Position kommen.
- HA-Hinweis: Geräte-`device_tracker` stündlich statt alle 15 min, `garmin_inreach_missed_call` mit bis zu 30 min Verzögerung.
- HA-Hinweis: Neue Benachrichtigung „Garmin inReach: Garmin web page refuses“, falls eine Garmin-Webseite die App ablehnt.
- Watchdog: `/health` meldet jetzt `live_age_s`, `catch_up_age_s`, `last_catch_up`, `garmin_reachable`, `garmin_rejecting` und `stalled`; HTTP 503 nur bei echtem Stillstand (angemeldet, Garmin antwortet, keine Störung, 30 min weder Live-Verbindung noch Abgleich), nie bei fehlender Anmeldung, Netzproblem oder Garmin-Störung. Nach einem 503 zwei Stunden Neustart-Bremse (`/data/health_restart.json`).
- Neuer Status „Garmin lehnt die Anfragen der App ab“: lehnt Garmin drei verschiedene Abfragen nacheinander ab (4xx außer 401/403/408/429) oder antwortet 426, erscheint das in der Problemliste und einmal als HA-Benachrichtigung (`garmin_inreach_interface_rejected`), die von selbst verschwindet, sobald wieder eine Anfrage klappt.
- intern: `a.garminRejecting()` / `a.garminPollEvery(d)` für periodische Worker (Drosselung auf 1×/h, Einbau in den zentralen Takt durch Etappe 3b).
- Nachholen nach langem Ausfall: liegt der letzte vollständige Abgleich über 1 h zurück, bekommt der Abgleich 10 statt 2 Minuten, damit der Startpunkt vorrückt.
- Empfangene Fotos und Sprachnachrichten werden nach Größe begrenzt (200 MB gesamt, älteste zuerst gelöscht) statt nach Anzahl (80).
- HA-Backups ohne `media/*`, `protocol.jsonl*`, `*.corrupt-*` und `*.tmp` (`backup_exclude`); nach einer Wiederherstellung fehlen daher ältere Fotos im Chat.
- Mail: sind `mailseen.json` und `.prev` beide beschädigt, wird eine Mail vor dem Event gegen den Verlauf (Zeit + Text) geprüft und nicht doppelt gemeldet.
- Lehnt Garmin die Schnittstelle ab, fragen alle regelmäßigen Abfragen (Anrufliste/SMS-Infos, geteilte Positionen, Gerätepositionen, Stummschaltungen/Messenger-Nutzer, LiveTrack-Verfolgung, regelmäßiger Abgleich) nur noch einmal pro Stunde; das einmalige Nachschlagen älterer Medien-IDs wartet auf den nächsten Start.
- Chat: die Scrollposition bleibt beim Tabwechsel auch dann erhalten, wenn der Browser sie beim Wiedereinblenden zurücksetzt.

## 0.104.1

- Hotfix
- Senden über MQTT: Eine Telefonnummer als Zahl (`"to": 4915…` statt `"+4915…"`) wird jetzt angenommen. Home Assistant macht aus `+49…` in Skript-Variablen eine Zahl; deshalb scheiterten Antworten an die eigene Nummer mit „invalid JSON“.
- Bei ungültigem JSON nennt die Fehlermeldung jetzt den Grund, und das Log zeigt eine Warnung.

## 0.104.0

- Etappe 1 aus dem Gutachten vom 17.10.: Sicherheit und nichts verlieren
- intern: CI und release.sh testen jetzt alle Go-Pakete (auch den Garmin-Client), Go 1.26 im Image, govulncheck und Dependabot; release.sh prüft Version, Branch und sauberen Stand und setzt Git-Tags
- intern: UI-Tests ohne feste Wartezeiten, neue Unit-Tests für Links und Store, Testabdeckung der Garmin-Endpunkte sichtbar
- Mail-Prüfung: mehrere `Authentication-Results`-Header desselben Anbieters werden zusammen ausgewertet (iCloud setzt oben `bimi=none`, Outlook, Gmail); eine Mail, die die Prüfung nicht besteht, erscheint jetzt im Chat (ohne HA-Event, Warnung im Log) statt verworfen zu werden.
- Nach beschädigter `sync_state.json` ohne gespeicherten Verlauf werden die nachgeholten Nachrichten der letzten 24 h nur im Chat angezeigt, ohne erneutes HA-Event.
- intern: beschädigte `state.json` ohne `.prev` nutzt die alten `*.bak-0.94` als letzten Rückfall und löscht sie nicht; liegengebliebene Temp-Dateien werden beim Start entfernt, Zähler beim Beenden sicher geschrieben; `drainHA` ohne Datenrennen; `release.sh` verlangt `CLAUDE_SESSION_URL` und übernimmt HA-Hinweise.
- HA-Events zentral (Event-Register): alle Events werden bei HA-Neustart bis 10 min wiederholt; wartende Nachrichten-Events überstehen auch einen App-Neustart (`/data/ha_pending.json`, dann mit `redelivered: true`). Volle HA-Warteschlange verwirft nur Status-Updates, nie Nachrichten.
- Senden: MQTT-Senden beachtet `key` (kein Doppelversand), Antworten nennen `bytes`/`parts` (Satellitenteile), optional `max_parts` lehnt mehrteilige Texte ab; sicher fehlgeschlagene Sends zählen nicht mehr gegen das 20/h-Limit.
- Sicherheit: Chat-Zuordnung über Mitglieder nur bei genau einem Gegenüber; Telefonnummern/Mail-Adressen im Add-on-Log maskiert; `api_token` unter 24 Zeichen wird gewarnt (Log + Einrichtungsprüfung, `problems` im Status).
- HA-Hinweis: neue Felder `send_failed`: `key`, `message_id`, `pending`, `bytes`, `parts`; `send_result` (MQTT): `key`, `to`, `message_id`, `pending`, `bytes`, `parts`; Message-Event: `redelivered`. Bestehende Felder unverändert. Automationen, die auf Nachrichten reagieren, über `message_id` entprellen (Wiederholung kann doppelt ankommen).
- Mail-Absender streng geprüft: nur DKIM- oder DMARC-Bestätigung für garmin.com zählt (SPF allein nicht). Mail ohne Prüfergebnis des Mailservers erscheint im Chat, löst aber kein HA-Event mehr aus (Warnung im Log).
- Bei Mail-Nachrichten ist `from` im HA-Event jetzt immer der Chat-Schlüssel `mail:<name>` (wie `reply_to`), nie mehr der Name aus der Mail; der Name steht in `from_name`.
- Antworten über den Garmin-Antwortlink: die Messenger-Kopie (Echo) wird jetzt bis zu 1 h lang erkannt statt 3 min, auch nach einem Neustart, und wird kein HA-Event.
- Unbekannter Zeichensatz in einer Mail wird einmal im Log gemeldet.
- HA-Hinweis: Automationen, die bei `source: mail` auf `trigger.event.data.from` == Name (z. B. „Max Mustermann“) prüfen, greifen nicht mehr: dort steht jetzt `mail:max_mustermann`. Stattdessen `from_name` (Anzeige) oder besser `reply_to`/`from` exakt mit `mail:…` vergleichen. Messenger-Nachrichten sind unverändert.
- HA-Hinweis: Der Sensor „Last message“ (Attribut `from`) zeigt bei Mail weiter den Namen (Anzeige, unverändert).
- HA-Hinweis: Mailbox-Anbieter ohne `Authentication-Results`-Header liefern keine Mail-Events mehr (nur Chat).
- Datenschutz für /data: alle Dateien werden einheitlich atomar geschrieben; eine beschädigte Datei wird als `*.corrupt-<Zeit>` beiseitegelegt und im Log gemeldet statt still neu angelegt.
- Einstellungen (`state.json`), Garmin-Anmeldung, Outbox sowie die Listen gesehener Nachrichten, Mails und Anrufe behalten ihre letzte gute Fassung als `*.prev` und greifen bei Beschädigung darauf zurück; die veralteten `*.bak-0.94` dienen nur noch als letzter Rückfall (beschädigte `state.json` ohne `.prev`, mit Hinweis in der Problemliste) und werden gelöscht, sobald eine gültige `state.json` gelesen wurde.
- Beschädigte Listen gelten nicht mehr als Erststart: Nachrichten und verpasste Anrufe der letzten 24 Stunden werden nachgeholt statt übersprungen; wiederhergestellte Einstellungen erscheinen als Hinweis in der Problemliste.
- Die Passphrase für verschlüsselte Aufzeichnungen wird nicht mehr an die Oberfläche zurückgegeben; fehlgeschlagene Speichervorgänge werden geloggt und in der Diagnose gezählt.

## 0.103.0

- Garmin Locate: Positionen von Personen, die mit dir teilen, bewegen ihren Positions-Tracker (alle 30 min); „Nächste Position anfordern“ in der Kontaktinfo und per POST /locate (nur von Hand)
- Garmin-Konto zeigt die Zustimmungen (Garmin Locate, Teilen, Standort in Nachrichten) und wie viele mit dir teilen
- Blockieren gilt auch bei Garmin; Schalter „Stumm bei Garmin“ in der Kontaktinfo (Ereignisse laufen weiter, Feld muted)

## 0.102.0

- Rückfrage-Blatt für alle gefährlichen Aktionen (Blockieren, Chat leeren, Nachricht löschen, Postfach entfernen); Aktionszeilen blau, Chevron nur zum Öffnen; Statushaken als Icons
- Zurück-Geste schließt Chat, Info, Einstellungsseite und Blätter; iPad behält die Kapsel oben; Zähler zeigt Teile bei Umlauten/Emoji
- Satellitenfoto immer ≤ 90 KB; Mail-Antwort meldet unerlaubte Zeichen statt still zu kürzen; CSRF-Schutz für die UI; Tests für kaputte Dateien und HA-Warteschlange

## 0.101.0

- Eine Karte statt drei: Die alte Positionsseite in den Einstellungen ist weg; „Auf der Karte zeigen“ in der Kontaktinfo öffnet den Karten-Tab mit dieser Person. Jede Person hat überall dieselbe Farbe (Karte, Kontaktinfo, LiveTrack), und ein LiveTrack gehört zu dem Chat, in dem er kam – keine doppelten Personen mehr. Der Zeitraum gilt jetzt auch für Strecken und die Sitzungsliste; Zoom und „alles zeigen“ gibt es auch auf der großen Karte.
- LiveTrack-Ansicht: Strecke und Marker in der Farbe der Person, pulsierender Punkt bei laufendem Track, X zum Schließen, Splits als Liste aller Kilometer. Die Sitzungsliste zeigt schlanke Zeilen statt Vorschaukarten. Bei ausgeschalteten Karten werden keine Kacheln mehr geladen; Zeiten ohne Sekunden.

## 0.100.0

- Nachholen vollständig: Eine einzelne unlesbare Nachricht von Garmin lässt nicht mehr die ganze Seite scheitern; ein Chat, dessen Mitglieder gerade nicht lesbar sind, wird trotzdem nachgeholt; LiveTrack-Ereignisse werden seitenweise nachgeholt; eine früh datierte Gerätenachricht beendet das Nachblättern nicht mehr.
- Fotos und Sprachnachrichten, deren Datei nach der Nachricht ankommt, werden jetzt nachgeladen; dasselbe „OK“ von zwei Personen gilt nicht mehr als Duplikat; eine Gruppennachricht landet auch dann im Gruppenchat, wenn Garmin die Mitgliederliste gerade nicht liefert.

## 0.99.0

- Verbindung wirklich überwacht: Eine eingeschlafene Live-Verbindung (z. B. nach einem Router-Neustart) wird nach 45 Sekunden erkannt und neu aufgebaut statt erst nach einer Viertelstunde; ein hängender Verbindungsaufbau wird nach 30 Sekunden abgebrochen; schließt Garmin die Verbindung, wird nur sie neu geöffnet, nicht die ganze App neu gestartet.
- MQTT: Nach einem Broker-Neustart werden nur die Zustände nachgesendet, die dem Broker fehlen – keine doppelten, keine verlorenen. Ein belegter Port wird gemeldet statt still geschluckt; „Verbunden“ erscheint erst, wenn die Live-Verbindung wirklich steht; interne Fehler in Hintergrundaufgaben beenden die App nicht mehr.

## 0.98.0

- Nichts geht mehr verloren: Startet Home Assistant gerade neu, wiederholt die App das Nachrichten-Ereignis bis zu 10 Minuten lang (Automationen, die auf Nachrichten reagieren, laufen dann trotzdem); Nachrichten-Ereignisse gehen vor Statusmeldungen.
- Wird die Anmeldung der App bei Garmin im Betrieb entfernt (vom Handy oder von Garmin), zeigt die App jetzt „Anmeldung nötig“ statt endlos neu zu verbinden.
- Positions-Tracker springen nach einem MQTT-Neustart nicht mehr auf eine ältere Position zurück; Verlauf, Outbox und Abgleichstand werden stromausfallsicher geschrieben, ein kaputter Verlauf wird aufgehoben statt überschrieben; LiveTrack-Dateien werden nur noch bei Änderungen geschrieben.

## 0.97.1

- Kein doppeltes Senden mehr: Bleibt Garmins Antwort aus, zeigt der Chat die Nachricht als „wird geprüft“ und bietet kein „Erneut senden“ an; ein Wiederholen aus der Oberfläche oder per API (neues Feld key) sendet nie ein zweites Mal. Antworten per inReach-Mail ohne Bestätigung gelten als „in Prüfung“, bis das Echo kommt.
- Zustellstatus stimmt: Quittungen deiner eigenen Uhr oder inReach zählen nicht mehr als „Zugestellt“, das Add-on bestätigt eigene Nachrichten nicht mehr selbst, und ein späteres „Zugestellt“ ersetzt ein früheres „Unzustellbar“.

## 0.97.0

- Neu in den Nachrichtendetails: Bei Nachrichten an ein inReach steht, wie sie über Satellit ankamen – in wie vielen Teilen und mit welchem Text; bei Fotos und Sprachnachrichten, dass dort nur Garmins Hinweistext ankommt.

## 0.96.2

- Korrekturen aus dem Protokoll: Gerätebilder unter Garmin-Konto erscheinen jetzt (Garmin liefert die Kennung anders als erwartet); ein LiveTrack, der zugleich als Link und als geteilte Sitzung kommt, wird nur noch einmal abgefragt; in den Zustelldetails steht „SMS oder E-Mail“ bzw. „Garmin-Server“ statt External/Unknown.

## 0.96.1

- Antwortlink: Die Suche nach Garmins neuer Kennung liest die Skripte jetzt unter dem richtigen Pfad (/web/_next) und schreibt ins Log, was sie auf der Seite findet.

## 0.96.0

- Antworten auf inReach-Mails: Garmin hat seine Antwortseite umgebaut („Server action not found“). Die App findet die neue Kennung jetzt selbst auf Garmins Seite und merkt sie sich – ohne Einstellung, auch bei künftigen Umbauten.
- Robuster: Ist Garmin überlastet (429/503), wartet die App so lange, wie Garmin vorgibt, und fragt einmal nach; Senden wird nach einem Serverfehler nicht wiederholt (keine doppelten Nachrichten).

## 0.95.0

- Neu in der Oberfläche: Gruppenchats erscheinen als eigener Chat mit Absendernamen (nur lesen, die App schreibt nicht in Gruppen); Schalter „Lesebestätigungen senden“ (Standard aus); LiveTrack-Hinweise je Kontakt ein-/ausschalten (gilt auch für die Garmin-App); unter Garmin-Konto SMS-Status und die letzten Anrufe.
- Verpasste Anrufe werden über die Telefonnummer dem Kontakt zugeordnet; im Nachrichten-Ereignis stehen bei Gruppen group_id, group_name und group_members.

## 0.94.0

- Robuster: MQTT blockiert die Statusseite nicht mehr und holt Zustände nach, die während einer Broker-Pause verloren gingen; Home-Assistant-Ereignisse laufen über eine begrenzte Warteschlange in richtiger Reihenfolge; ein LiveTrack-Link wird nur noch einmal verfolgt.
- Aufgeräumt: Einstellungen liegen jetzt in einer Datei /data/state.json (alte Dateien werden übernommen und als *.bak-0.94 behalten); Protokoll-Aufzeichnung und Journal sind ein Rekorder.
- Neu für Home Assistant: Ereignis garmin_inreach_missed_call für verpasste Anrufe aus der Garmin-App. Fotos, die wegen eines inReach klein verschickt wurden, werden für App-Empfänger in besserer Qualität nachgeladen.
- Wie die Garmin-App: Sprache, Anfrage-Kennung und ehrliche Kennung bei jeder Anfrage, SignalR-Verbindung nach Version 1.

## 0.93.0

- Neu in der Oberfläche: Gerätebilder unter Garmin-Konto, Kennzeichen „nutzt die App“/„bekommt SMS“ in der Kontaktinfo, Wegpunkt-Karte im Chat, Glocke für in der Garmin-App stummgeschaltete Chats, Schalter „Heimposition mitsenden“ (Standard aus).

## 0.92.0

- Fotos wie die Garmin-App: max. 1080 px, zusätzlich eine kleine Satelliten-Version (≤ 90 KB), die hochgeladen wird, wenn Garmin sie verlangt.
- Neu für Home Assistant: Sensor „inReach plan problem“ (Abo pausiert/fehlt), Wegpunkte vom inReach im Nachrichten-Ereignis (reference_point), Feld muted für in der Garmin-App stummgeschaltete Chats.
- Vorbereitet (Anzeige folgt nach dem Mockup): Gerätebilder von Garmin, Kennzeichen Messenger/SMS je Kontakt, eigene Position mitsenden (Standard aus).

## 0.91.1

- LiveTrack ohne Link: Strecken werden jetzt gezeichnet (Garmin liefert die Positionen dort in einer internen Einheit statt in Grad; bereits gespeicherte Strecken werden beim Öffnen repariert).
- Eigene geteilte LiveTracks erscheinen unter deinem Namen statt unter dem Chat-Partner.

## 0.91.0

- Robuster: ein Fehler in einer einzelnen Nachricht oder einem Hintergrundjob beendet das Add-on nicht mehr (wird geloggt), der Verlauf wird gebündelt und in richtiger Reihenfolge gespeichert (schont die SD-Karte), das Sende-Limit übersteht einen Neustart.
- Nachholen liest jetzt auch LiveTrack- und Kontakt-Ereignisse aus Ausfallzeiten (ohne doppelte Home-Assistant-Events); geschützte geteilte LiveTracks probieren als letzten Versuch alle bekannten PINs (max. 5).
- Aufgeräumt: nach einer neuen SMS-Anmeldung wird die alte Garmin-Anmeldung des Add-ons gelöscht (nur die eigene); Funktion zum Abmelden aller Geräte des Kontos entfernt; der Mitschnitt (Journal) läuft nur noch bei Protokoll-Rekorder oder Debug-Log.

## 0.90.1

- LiveTrack ohne Link: Ist der LiveTrack der Person mit einer PIN geschützt, nimmt das Add-on die PIN aus ihren früheren LiveTrack-Nachrichten im Chat (bleibt nur im Speicher); keine unnötige Token-Erneuerung mehr bei PIN-Ablehnung.
- Sensor „verbunden“ flackert nicht mehr: Garmin trennt die Live-Verbindung alle paar Minuten kurz, gemeldet wird ein Ausfall erst nach 60 Sekunden.

## 0.90.0

- Nachholen nach Ausfällen vollständig: liest wie die Garmin-App in Seiten zu 100 (bisher gingen ab 30 Nachrichten pro Chat welche verloren), ein Fehler in einem Chat bricht das Nachholen nicht mehr ab, Datumswerte ohne Zeitzone stören nicht mehr.
- Sprachnachrichten: eine Transkription, die Garmin erst später schickt, erscheint jetzt nachträglich an der Nachricht.
- Zustellung: Bestätigung an Garmin mit Antwort und Ersatzweg über REST; Status je Gerät wie in der App (Gesendet wird nicht mehr zu Unzustellbar).
- Aufgeräumt: alte LiveTrack-Probe entfernt.

## 0.89.0

- Live-Verbindung zu Garmin gibt nicht mehr nach 15 Minuten Ausfall auf: verbindet endlos neu wie die Garmin-App (2–64 s), meldet Abbruch und Rückkehr (Sensor „verbunden“), startet bei endgültigem Abbruch neu.
- Anmeldung sicherer: Zugangsdatei wird stromausfallsicher geschrieben, Token-Erneuerung kann nicht mehr verloren gehen, nur noch eine Erneuerung bei mehreren gleichzeitigen Ablehnungen (auch 403), Login-Seite nur noch, wenn Garmin die Anmeldung wirklich ablehnt.
- LiveTrack ohne Link: Teilt jemand LiveTrack aus der Messenger-App (nur Meldung „LiveTrack gestartet“), liest das Add-on die Sitzung jetzt mit der eigenen Messenger-Anmeldung und zeigt die Karte unter der Meldung, in der Kontaktinfo und in der Karte; auch für frühere Meldungen des letzten Tages.

## 0.88.0

- Neu: Einstellungen → Garmin-Konto mit Nummer, „angemeldet seit“ und allen Geräten des Kontos (nur Anzeige).
- Neu: Abmelden meldet nur diese App bei Garmin ab – Handy, Uhr und inReach bleiben angemeldet; Verlauf, Kontakte und Einstellungen bleiben.
- Neu: Nummer ändern (gilt ab der nächsten Anmeldung) und Neu anmelden direkt auf der Kontoseite.

## 0.87.0

- Neuer Aufbau im iOS-26-Stil: Leiste mit Chats, Karte und Einstellungen – am Handy unten (schrumpft beim Scrollen), am iPad oben, am Laptop als Seitenleiste; Suche als eigener runder Knopf.
- Karte wie „Wo ist?“: alle Positionen und LiveTracks auf einer Vektorkarte, je Person eine Farbe, nahe Punkte gebündelt, laufende Tracks pulsieren; Blatt mit Personen, Zeitraum und Sitzungen.
- LiveTracks gehören automatisch zu der Person, die Garmin nennt; Korrektur im Detail-Blatt unter „Gehört zu“.
- Geführte Einrichtung beim ersten Start; Probleme oben mit genau einer Aktion und in „Status und Diagnose“ mit „Beheben“; Senden-Hinweis statt totem Eingabefeld.
- Einstellungen mit Kontokarte und neuer Reihenfolge, Vektorkarte immer, iOS-26-Maße (Titel, Gruppen, Schalter, Blätter), fehlende deutsche Texte ergänzt.

## 0.86.0

- Kontakte werden nie mehr nach Garmins interner User-ID benannt: kein doppelter Positions-Tracker („Position 74ee25fd…“) mehr; ein vorhandener alter wird beim Start automatisch entfernt.
- Nachrichten, bei denen Garmin den Absender nur als User-ID nennt, landen im Chat der passenden Telefonnummer.

## 0.85.0

- Garmin-Dienstmeldungen kommen als Home-Assistant-Ereignis garmin_inreach_server_notification und – mit Titel und Text – als Benachrichtigung „Garmin: …“.
- Geräte-Tracker zeigen zusätzlich, ob das Satelliten-Abo pausiert ist (suspended) und ob das Gerät nur SOS kann (sos_only); LiveTrack-Ereignisse nennen den Namen der Person.
- SMS-Anmeldung: verständliche Meldung, wenn Garmin ablehnt (zu viele Versuche, Nummer gesperrt, Netz nicht unterstützt, Code falsch).
- Intern: Garmin-Datenmodelle an die App 3.1.0 angeglichen.

## 0.84.0

- LiveTrack: das Blatt folgt dem Finger und rastet wie in iOS oben oder unten ein (Diagramme und Splits sofort da, kein Ruckeln mehr); im geöffneten Blatt oben nach unten ziehen klappt es wieder zu.
- Positionskarte und „Letzte Position“ in der Kontaktinfo nutzen jetzt die Vektorkarte im Apple-Look (flüssiges Verschieben und Zoomen, Punkt antippen zeigt Ort, Zeit und Absender).

## 0.83.0

- Vektorkarte: Symbole und Beschriftungen werden nicht mehr blockiert.
- Zustell-Details zeigen den Weg: über inReach-Satellit, Handy-Satellit, SMS oder Internet (kommt bis zu 10 min nach dem Status).
- LiveTrack-Start und -Ende erscheinen als graue Zeile im Chat; das Ereignis garmin_inreach_chat_event hat zusätzlich livetrack_customer_id.
- LiveTrack: Links ohne PIN werden nach einem Neustart nicht erneut abgefragt, die Oberfläche fragt bei fehlenden Daten seltener nach.
- Log: der Schnittstellen-Katalog erscheint nur noch bei neuen oder geänderten Feldern.
- Einmaliger lesender Test beim nächsten LiveTrack-Ereignis (Log „LiveTrack probe“).

## 0.82.1

- Vektorkarte im Apple-Look ist jetzt Standard (abschaltbar unter Einstellungen → Allgemein → „Vektorkarte“).

## 0.82.0

- Bewegung wie in iOS: Seitenwechsel laufen mit einer weichen Feder aus, Blätter, Menüs, Schalter und Segmente federn leicht nach (ältere Browser behalten die bisherige Kurve).

## 0.81.2

- Zurück wischen wie in iOS: In Einstellungen, Unterseiten und Kontaktinfo von überall nach rechts wischen, im Chat vom linken Rand – die Seite folgt dem Finger und geht eine Ebene zurück.

## 0.81.1

- Lange drücken wie in iOS: Die Nachricht hebt sich animiert an, der Chat dahinter wird unscharf, Emoji-Leiste darüber, Menü darunter – auch bei den untersten Nachrichten; keine iOS-Textauswahl („Kopieren | Nachschlagen“) mehr.
- Das Datum steht wieder fest zwischen den Nachrichten statt über ihnen zu schweben.
- LiveTrack wird pro Nachricht nur noch einmal abgefragt.

## 0.81.0

- iOS-26-Look: Kopfzeile (Zurück, Name, Info) und Eingabe (Kamera, Textfeld) als einzelne Glasstücke, Glas-Datumspillen je Tag (keine übereinanderliegenden Daten mehr), eingerückte Glas-Blätter auf dem iPhone.
- Gesten wie in iOS-Nachrichten: Doppeltipp = Reaktion, lange drücken = Emoji-Leiste und Menü, einmal tippen auf ein Foto öffnet es.
- Reaktion zurücknehmen: das eigene Emoji in der Leiste noch einmal antippen.

## 0.80.1

- LiveTrack: Ein Link, der vom iPhone ohne laufende Aktivität geteilt wird, bekommt nicht mehr den gerade beendeten alten Track; die App wartet bis zu 6 Stunden auf den Start einer neuen Sitzung. Falsch zugeordnete Tracks werden neu gesucht.

## 0.80.0

- LiveTrack-Detailansicht im iOS-26-Look: Karte über den ganzen Bildschirm, runde Glasknöpfe, Glas-Blatt mit Distanz, Zeit, Pace und Höhenmetern; hochziehen zeigt Diagramm und Splits.
- Ältere Fotos und Sprachnachrichten (vor 0.73.0): Die App holt deren Garmin-Kennung einmal nach dem Start aus Garmins Verlauf (nur lesend), danach kann man auch auf sie reagieren.

## 0.79.1

- Reagieren auf Fotos und Sprachnachrichten: lange drücken öffnet das Menü mit „Reagieren“ (auch auf dem Foto selbst).
- LiveTrack-Karte ohne PIN-Knopf (kein versehentliches „PIN kopiert“ mehr); die PIN steht in der Detailansicht neben „Bei Garmin öffnen“.
- Vektorkarte: Probleme werden ins Add-on-Log geschrieben, damit man sie findet.

## 0.79.0

- LiveTrack: Sobald der Track da ist, ersetzt die Karte den Text „Ich mache mich jetzt auf den Weg …“; nach dem Ende zeigt sie Distanz, Zeit und maximale Höhe wie die Garmin-App.
- Kontaktinfo: neue Zeile „LiveTrack-Sitzungen“ mit allen Tracks dieses Chats, neueste zuerst; Antippen öffnet Karte, Diagramme und Splits.

## 0.78.3

- Reaktionen auf ältere Fotos und Sprachnachrichten (vor 0.73.0) erscheinen jetzt als Emoji am Foto statt als Text „❤️ für 📷(…)“.
- Hinweis zu Reaktionen in den Starthinweisen und in der Doku.

## 0.78.2

- LiveTrack: Links auf eine einzelne Sitzung werden auch ohne PIN versucht; das Log nennt die Art des Links.

## 0.78.1

- LiveTrack: genauere Meldung im Log, wenn Garmin die PIN nicht annimmt; ein PIN-Fehler wird nach einem Neustart noch einmal versucht.

## 0.78.0

- LiveTrack im Chat: Track, Distanz, Zeit und Status als Karte; Antippen zeigt Karte mit Kilometermarken, Diagramme (Pace, Höhe, Puls, Trittfrequenz, Leistung) und Kilometer-Splits. Gelesen über Garmins öffentliche LiveTrack-Seite mit Link und PIN aus der Nachricht – ohne Garmin-Konto, es wird nichts gesendet.
- Neues Home-Assistant-Event garmin_inreach_livetrack mit Puls, Tempo, Höhe, Distanz usw. während ein LiveTrack läuft (bestehende Entitäten unverändert).
- Test-Schalter Vektorkarte (Einstellungen → Allgemein): ruhigerer Kartenlook wie Apple Karten (OpenFreeMap, MapLibre im Add-on eingebaut).

## 0.77.0

- Under the hood: every Garmin call is defined in one place and checked against the Garmin Messenger app 3.1.0; real (anonymised) Garmin answers are kept as tests, so a change by Garmin shows up in the tests first.
- Removed unused code (Firebase push) and aligned muting a chat with the Garmin app.
- Device trackers get readable names ("Garmin Messenger phone", "Garmin watch"); their entity ids stay the same.

## 0.76.0

- New event garmin_inreach_device_delivery: fires once when a sent message really reached the inReach or the watch (with the time it took).
- New event garmin_inreach_chat_event for LiveTrack sessions (start, update, end) and trusted contacts, as Garmin Messenger 3.x sends them.
- Positions of your own Garmin devices appear as device trackers (checked every 15 minutes, only if Garmin offers it for your account); positions others share with you move their contact tracker.
- Existing entities and events are unchanged.

## 0.75.0

- Reactions exactly as the Garmin app handles them: recognised by their invisible markers in every language, also when a reaction is taken back ("Removed … from", "… von … entfernt"): the emoji then disappears from the message instead of showing up as a chat text.
- Quotes of long messages are cut like the Garmin app does it (by bytes, so umlauts and emoji count right).
- Removed the old, never working "Reaction" message type from the code.

## 0.74.0

- New "Garmin self-test": two minutes after each connection and then daily the add-on checks, read only, that Garmin answers, that the live connection is up and that the add-on is still registered on your account. If Garmin no longer lists it (for example removed in the Garmin app), a Home Assistant notification asks you to log in again. The sensor also lists the devices on your account (phones, watches, inReach).
- If Garmin should refuse the usual token header, the add-on switches to the header the Garmin app uses and logs it.
- The list of registrations is read with Api-Version 2.0, as the Garmin app does since 3.x. Existing entities are unchanged.

## 0.73.0

- Reactions on photos and voice messages: the emoji bar opens on a tap on the photo or the bubble, and the reaction quotes the media id the way the Garmin app does (decoded from the app, protocol.md section 7). Only photos and voice messages that arrived or were sent from this version on can be reacted to. Opening a photo in full size moved to the long-press menu.
- Liquid Glass look (iOS 26): stronger blur and colour from behind, bright upper edge, soft lower edge on bars, menus, the emoji bar and sheets; the send button has a glass highlight.

## 0.72.0

- Delivery statuses (delivered, read) that arrived while the connection to Garmin was down are now fetched afterwards, together with the missed messages (after every reconnect and every 10 minutes). A status already known causes no second event.

## 0.71.1

- Photo and voice message: the local preview stays in the chat until the stored file has loaded, so the bubble no longer flashes; a voice message shows its player at once.
- iPhone in the Home Assistant app: the extra bottom space only applies to the settings pages, not to the chat (no white bar under the message field).

## 0.71.0

- New sensors for Garmin's own service state: "Garmin service status" (operational, degraded, partial or major outage, maintenance) and "Garmin service problem", read from Garmin's public status page every 15 minutes (the same entry the Garmin Messenger app watches). So a failure can be told apart: Garmin is down, or the add-on has a problem. Existing entities are unchanged.

## 0.70.0

- Photos are sent at once: the picture shows in the chat right away and is converted in the background (no more question first).
- Voice messages: live spectrum while recording, a cancel button, no question first; if the browser may not record (Home Assistant app on iPhone), the phone's own recorder opens instead.
- Text templates are gone from the app.
- Camera button sits where the plus button was.
- On an iPhone inside the Home Assistant app the last lines are no longer cut off at the bottom.

## 0.69.0

- No more double sends by mistake: when Garmin gives no clear answer (timeout, broken connection, server error), the add-on no longer says "nothing was sent". It looks the message up at Garmin by its id instead, and only reports a failure (event garmin_inreach_send_failed, "not sent: …") if it really did not arrive. Such a message shows as "processing" in the chat until it is settled; the HTTP API answers 504 ("do not send again").
- Every message keeps its ids over all tries; unclear sends wait in /data/outbox.json and are checked for up to an hour, also after a restart. Nothing is ever sent again automatically.
- Photos and voice messages: if the upload fails after Garmin created the message, the upload is tried once more and then reported, instead of sending a second message.

## 0.68.1

- Fix: the Garmin interface list no longer reports every running satellite number (mtmsns) as a "new field"; old entries of that kind are cleaned up.

## 0.68.0

- Photos and voice messages can be sent: camera button and microphone in the message field, with a confirmation before sending. Photos are converted to small AVIF files and recordings to OGG/Opus (ffmpeg is now part of the app, so the image is larger). The converted file appears in the chat.
- On an inReach only a short notice about a photo or voice message arrives, and it counts as one message.

## 0.67.2

- Opened message: the leftover white notch of the bubble tail is gone (tail hidden while the emoji bar, menu or details are open).

## 0.67.1

- Reactions sit at the top right of the message bubble. Old reaction texts in the chat are folded into emoji at their messages. The hint about sending as a normal message is gone from the emoji bar, which is more transparent.
- Details card: back button on top; copy and delete only in the long-press / right-click menu. The white tail artifact behind an opened message is gone.

## 0.67.0

- Reactions work now in Garmin's own way: a reaction is an ordinary text (emoji, 'für', quoted start of the message). Received reactions (yours from other devices and from the other person) appear as an emoji under the message instead of a chat text; sending a reaction sends that text. The unusable Reaction message type is gone.
- Tap a message for a large emoji bar (six quick ones and a button for more, like iMessage). Swipe a message sideways for its details, long press or right click still opens the menu.
- Login and token traffic is recorded too, with tokens, codes and passwords sealed by a passphrase you set under Status (or a placeholder without one); dev/decrypt_secrets.py reads them back.
- Tests with a stand-in for Garmin: token refresh after a 401, sending, refusal of the old reaction type, replay of a real reaction message.

## 0.66.0

- Back button on the sub pages of Settings (Garmin interface, Traffic, Log) in the wide layout.
- Delivery receipts are read completely (instance, delivery path such as Iris/Skylo, info), the all-zero media id of the chat history no longer counts as an attachment, voice transcripts of your own voice messages are kept.
- Satellite message numbers (mtmsn) of the inReach are followed; a skipped number is counted and logged.
- A 401 answer from Garmin now triggers one token refresh and a repeat instead of an error.
- Garmin changes are noticed: new fields, values, types, answers or message types are listed under Garmin interface (with a dot in Settings) and logged as warnings.

## 0.65.0

- Log: verbose logging for 30 min, 4 h, 24 h or always; the choice survives restarts. The log view keeps 5000 lines instead of 1000.
- Protocol: new switch 'Include message contents' keeps texts, names, numbers and exact positions in the protocol, journal and log (tokens and passwords stay hidden); every different answer is kept, not only one sample per kind.
- Reactions: sending is switched off, Garmin rejects the reaction type (400 Bad Request). Nothing is sent any more; received reactions still show.

## 0.64.0

- LiveTrack: the access code (PIN) that some LiveTrack links need is now kept and shown on the LiveTrack card, with a copy button.
- Reactions: emoji reactions to messages are received and shown under the message; long-press a message to react (Garmin Messenger chats). The exact wire format of reactions is not confirmed yet - please test and send the journal.

## 0.63.0

- Zustellung pro Gerät: In den Details einer gesendeten Nachricht steht, wann sie auf der inReach, der Uhr und der Messenger-App ankam und mit welcher Verzögerung; unter Datenverkehr steht die durchschnittliche Zeit bis zur Zustellung pro Geräteart
- Neu: Datenverkehr-Journal – ein kompakter, maskierter Verlauf aller Antworten und Ereignisse von Garmin (höchstens etwa 10 MB), zum Herunterladen unter Einstellungen > Status > Log und Diagnose und lesbar im Protokoll der App
- Home-Assistant-Ereignis und Positions-Sensor enthalten jetzt auch Geschwindigkeit (speed_ms) und Kurs (course_deg), wenn Garmin sie mitschickt
- Der Katalog führt gleiche Abfragen verschiedener Chats zusammen und zählt zusätzlich die Werte von sentVia, statusSource und messageUpdateEventType

## 0.62.3

- Der Katalog der Garmin-Felder (Felder, Häufigkeit, Werte) wird alle 10 Minuten als Zeilen „Catalog“ in das Protokoll der App geschrieben, damit er auch in Home Assistant gelesen werden kann
- Beim Nachholen werden nur noch Nachrichten gezählt, die wirklich neu waren (vorher auch schon bekannte)

## 0.62.2

- Ist Garmin wegen Netzproblemen nicht erreichbar, zeigt die App nicht mehr „Nicht angemeldet“ und die Anmeldemaske, sondern versucht es automatisch erneut (Abstand wächst von 5 Sekunden bis 5 Minuten); die Warnmail „Sitzung abgelaufen“ kommt nur noch bei echten Anmeldefehlern
- Senden: Konnte keine Verbindung zu Garmin aufgebaut werden, wird einmal nach 3 Sekunden wiederholt (nur dann, damit nie eine Nachricht doppelt gesendet wird); sonst kommt die klare Meldung, dass nichts gesendet wurde

## 0.62.1

- Fix: Nachträglich geholte Nachrichten erscheinen nicht mehr als zweiter Chat (statt der Telefonnummer stand eine Kennung): die Kennungen werden jetzt in Telefonnummern übersetzt
- Eine Nachricht mit gleichem Text und gleicher Sendezeit, die schon im Verlauf steht, wird nicht noch einmal angelegt

## 0.62.0

- Neue Seite Einstellungen > Status > Datenverkehr: wie viele Nachrichten pro Tag kommen und gehen, mit Position oder Medien, zugestellt, gelesen, Fehler, Wiederverbindungen, nachgeholte und doppelte Nachrichten; nach Geräten, Nachrichtenarten und Garmin-Ereignissen (nur Zähler, kein Inhalt)
- Neue Seite Einstellungen > Status > Garmin-Schnittstelle: Katalog aller Antworten und Ereignisse von Garmin mit ihren Feldern, wie oft jedes Feld vorkommt und welche Werte Nachrichtenart, Gerät und Status annehmen; neue Felder werden markiert, damit Änderungen von Garmin auffallen

## 0.61.1

- Das aufgezeichnete Garmin-Protokoll steht zusätzlich als Zeile "Protocol sample" im Protokoll der App, damit es auch in Home Assistant gelesen werden kann

## 0.61.0

- Verpasste Nachrichten werden nachgeholt: nach jedem Wiederverbinden und alle 10 Minuten wird bei Garmin nachgesehen
- Eine Nachricht, die doppelt ankommt, wird nur einmal verarbeitet (auch nach einem Neustart)
- Neu unter Einstellungen > Status > Protokoll: Garmin-Protokoll aufzeichnen. Speichert maskierte Beispiele der Garmin-Antworten und -Ereignisse (Texte, Links, Namen ersetzt, Nummern gekürzt, Positionen gerundet), zum Herunterladen
- Beim Aufzeichnen fragt die App zusätzlich nur lesend ab: Fähigkeiten, Netzwerk, stumme und blockierte Chats, Statusänderungen

## 0.60.0

- Fehlermeldungen verständlich: sagen jetzt, was los ist und was zu tun ist (App läuft nicht, keine Berechtigung, Server nicht erreichbar)
- Leistungsprüfung mit festen Grenzen läuft bei jeder Version mit; mehr Go-Tests (Schnittstellen, Relay)
- Nach dem Neuladen bleiben gewählter Chat und Entwurf erhalten
- Bedienung per Tastatur und VoiceOver verbessert (Fokus, Dialoge)
- Interner Umbau: große Oberflächen-Dateien und Styles in kleinere Teile aufgeteilt; Changelog vor 0.50 ins Archiv; Doku-Bilder neu

## 0.59.1

- Die „/“-Vorschläge im Eingabefeld sind wieder entfernt; Vorlagen gibt es weiter über die Plus-Taste und in den Einstellungen

## 0.59.0

- Nachrichtenvorlagen: Plus-Taste neben dem Textfeld öffnet eine Liste, ein Tipp setzt den Text ein; auf Laptop und iPad zeigt / mit dem Namen Vorschläge (Pfeiltasten, Enter)
- Vorlagen verwalten unter Einstellungen > App (neu, ändern, löschen), gemeinsam für alle Geräte gespeichert; vier Startvorlagen

## 0.58.3

- Behoben: Die Laufzeit im Status änderte sich bei jeder Abfrage, deshalb zeichnete sich die ganze App alle 5 Sekunden neu (ruckelte). Jetzt nur noch bei echten Änderungen
- Status-Abfrage mit ETag/304: unveränderte Antworten kosten fast nichts
- Eigene Bestätigungsfenster und Hinweiszeile statt Browser-Dialogen (Chat per Wischen leeren, Verlauf löschen, Fehlermeldungen)
- Aufgeräumt: Favoriten-Rest und Italienisch entfernt, Go-Dateien nach Aufgaben geteilt, UI-Logiktests (dev/unit.mjs), index.html als generiert markiert

## 0.58.2

- Lange Chats deutlich schneller: nur die neuesten 60 Nachrichten werden gezeichnet (Button für frühere), Nachrichten werden nur bei Änderung neu gezeichnet, Datumsformatierung ohne Neuaufbau (Tippen im Eingabefeld ca. 4x schneller, Chat öffnen ca. 3x schneller)

## 0.58.1

- Klicks auf dem iPhone flüssiger: Seitenwechsel zu den Kontaktinfos ohne die schwere Übergangsanimation (brauchte auf Handys Sekunden), leichtere Glas-Effekte, schnelleres Tipp-Feedback in der Chatliste

## 0.58.0

- Klicks auf dem iPhone zuverlässiger: Hover nur mit Maus, Pull-to-refresh ignoriert Fingerzittern, kein Doppeltipp-Verzögern, Seitenwechsel blockiert keine Eingaben mehr
- Zeichenzähler im Eingabefeld, Text auswählen im Nachrichtenmenü, weicher Rand über dem Eingabefeld
- Abschnittstitel in normaler Schreibweise, Bedienungshilfen (weniger Transparenz, mehr Kontrast), Bestätigung am Auslöser auf Desktop, Starthilfe beim ersten Öffnen

## 0.57.0

- Chat list: long press (or right click) on a chat opens a menu with a preview of the last messages and the quick actions Pin, Mark as read, Select and Clear chat.
- Swiping a chat past the threshold makes the action icon pop (and vibrates where the device allows it).
- Phone: the avatar glides from the chat header into the contact page and back (view transition, where the browser supports it).
- The time line on the position map can be folded away by tapping or dragging its handle (phone).
- Messages fade softly under the chat header; the glass look is the same everywhere.

## 0.56.1

- Fix: in the selection mode of the chat list the names were squeezed out by the check circle; the rows are laid out properly again.
- The filter chips (All, Unread, inReach, Mail) scroll with a soft fade at the edge, the sort button stays fixed next to them.

## 0.56.0

- Motion: new messages fade in, sheets spring up, the info and settings pages slide in on the phone, swipe from the left edge goes back, pull down on the chat list reloads it.
- Large title: "Chats" shrinks into a glass bar when you scroll the list; date separators stay at the top of the chat while you scroll.
- Empty states with an icon (no chats, no unread, no search result, no positions); map tiles fade in.
- Sheets and menus use the same glass look as the map controls.
- Phone: the page follows the on-screen keyboard so the message field stays visible.
- Desktop: hover highlights; Ctrl/Cmd+K or / searches, arrow keys move through the chat list, Enter opens the first hit, Ctrl/Cmd+N starts a new chat, right-click on a chat starts the selection.
- Less flicker: the status is only redrawn when it really changed.
- A style guard (dev/lint.py, also in CI) fails on loose colours, font sizes outside the scale and symbols or emoji in the UI.

## 0.55.0

- Position map redone in the style of Apple Maps: the map fills the page and the controls float on it as glass: chat picker (top left), zoom (right) and a time line at the bottom. The time line shows the positions per day, the period is set by dragging two handles (no more date fields); 24 h / 7 days / 30 days / All for quick choices.
- Fix: the message details card is no longer cut off.

## 0.54.0

- Position map: a legend shows which person has which colour, older positions are fainter than newer ones, and the hint under the map says so.
- iPhone: the date filter is compact (two small fields side by side) and the details card of a message no longer gets cut off at the bottom.
- Settings are shorter and in a clearer order: Status, Contacts, Mailbox (set-up), Positions (view), App (Display, Home Assistant, Data, Backup). The separate pages Appearance and General are merged into App; the texts are shorter.
- Contact info: the Channel row is gone (it is shown under the name), "Allow sending" replaces the long label, and Pin is a switch. Favourite is merged into Pin (the star in the contact list pins the chat).

## 0.53.1

- Settings → General: no Save button any more. The switches apply at once, the event name is saved when you leave the field or press Enter, and a "Saved." note confirms it. (The mailbox keeps its "Test and save" button because it checks the login.)

## 0.53.0

- Position map uses the space on wide screens: a large map with the filters in a column beside it.
- "Connect the dots" is removed.
- Type scale checked against the Apple text styles (Title 1, Body, Callout, Subheadline 15, Caption): the secondary text size is now 15 px like Subheadline. On a desktop with a mouse the whole interface is about 12 % smaller (body text 15 px, like macOS and web apps); iPhone and iPad keep following the system text size.

## 0.52.5

- Position map redesigned: map and filters have the same width, the map sits in a card with the place as a title and time and count below it, the zoom buttons are one glass pill with a separate locate button, and the newest position has a soft halo.

## 0.52.4

- Fix: the zoom buttons on the position map were blank white circles (their icons were stretched over the whole map); they show plus, minus and the locate icon again.
- The hint under the map is fully German (newest in orange).

## 0.52.3

- Faster work behind the scenes (parallel checks and CI); no change in the app.

## 0.52.2

- Position map: drag to move it, pinch zooms smoothly (the map scales with your fingers and snaps to the zoom level when you let go), the mouse wheel zooms, tiles around the edge are loaded in advance so no grey gaps show while moving. Zoom buttons and the full-view button use icons.

## 0.52.1

- Icons everywhere in the iOS line style, no text symbols any more: message ticks, the check marks in the selection and in the set-up list, the open-link arrow, the locate button and the own-account avatar.

## 0.52.0

- Login in two clear steps with a progress bar, one big button and a code field made for the SMS code.
- Links and map cards in the chat are one compact row (small map, place, open-link button); a tap shows the big card.
- The status bar has a yellow edge when limited and a red one when something does not work, with the fix on the right (Try again, Log in, Retry).
- Chat list: Select / Done, circles on the left and a bottom bar with Pin, Read and Clear (Clear asks first).
- iPad in landscape (and the HA app with its sidebar) shows three columns like the laptop; portrait stays two columns.
- Contrast: darker blue behind white text (light #0071e3, dark #0a6fe0) and a darker orange for the e-mail badge.
- The set-up checklist shows a progress bar.

## 0.51.0

- Contact info: the "Message" tile is gone (the chat is next to it, or one step back). Pin and Favourite share the width.
- Contacts without any message are no longer listed under Chats. They stay in Settings → Contacts and block (there marked "Start chat"); a chat appears again with the first message or a draft.
- Removing a contact asks in a sheet that says what happens (name and permission go, the history stays); the red button is apart from Cancel. The sheet can be dragged down on the phone.

## 0.50.0

- Fix: drop-down lists in the settings (e.g. Positions → Chat) showed a big grey bar; they look like the other fields again.
- inReach chats carry the blue badge, e-mail chats the orange one.
- Message card on the phone: opaque, above the input field (which fades while the card is open).
- Deleting a message (card and long-press menu) asks a second time ("Sure?").
- Text size: all sizes are relative now. The system text size is followed (iPhone/iPad Dynamic Type, browser setting) and Settings → Appearance has "Small / Default / Large / Extra large". Secondary text is a bit darker (contrast).
- Long help texts in the settings are one short line with "More".
- Delivery word ("delivered", "read" …) next to the ticks of the latest message you sent; character counter from 80 % of the limit; the status bar counts messages that were not sent.
- Positions: one colour per person with a legend, a "newest position" button on the map page.
- Opening a chat from the search jumps to the matching message and flashes it.
- Long press → "Reply" starts the message with a short quote.
- Test: every icon-only button must have a name (VoiceOver).

Ältere Einträge (vor 0.50): [docs/CHANGELOG-archive.md](docs/CHANGELOG-archive.md)
