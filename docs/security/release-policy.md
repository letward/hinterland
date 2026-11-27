# Richtlinie für Ocrom-Horizon-Releases

## 1. Voraussetzungen für ein Release

Ein Release kann veröffentlicht werden, wenn:

1. Der Code in `main` gemergt wurde. Ein Merge durch einen Maintainer ist die Freigabe; ein separates Review ist empfohlen, aber für ein Release nicht zwingend.
2. Die erforderlichen CI-Prüfungen für den gemergten Stand erfolgreich sind (`PR Checks`, CodeQL und Tests).
3. Der Windows-Build auf einem GitHub-hosted `windows-latest`-Runner oder einem zugelassenen Runner erfolgreich abgeschlossen wurde.
4. Der Installer und das Update-Manifest `latest.yml` vorhanden sind. Die SHA-512-Prüfsumme im Manifest muss dem Installer entsprechen.
5. Der Tag zur Version in `package.json` passt und dafür noch kein Release existiert.

Build-Attestierungen und zusätzliche Prüfsummen sind erwünscht, aber für den Release nicht verpflichtend.

## 2. Release-Auslösung

- Maintainer können einen Release durch Push eines Versions-Tags (`v*`) oder durch den vorhandenen manuellen Release-Workflow auslösen.
- Ein Agent darf den vorhandenen Release-Workflow auslösen, wenn ein Maintainer dies in der aktuellen Unterhaltung ausdrücklich für die konkrete Version beauftragt hat.
- Diese Beauftragung ersetzt keine fehlgeschlagenen CI-Prüfungen und erlaubt weder einen abweichenden Tag noch Änderungen an Branch-Schutz oder Workflow-Berechtigungen.
- Releases sind idempotent: Existiert die Version bereits, wird kein zweites Release angelegt.

## 3. Update-Vertrauen und Prüfsummen

- `electron-updater` prüft die SHA-512-Prüfsumme des Installers gegen `latest.yml`.
- Eine kryptografische Signatur für `latest.yml` ist derzeit empfohlen, aber keine Voraussetzung für ein Release. Bis sie implementiert ist, beruht das Vertrauen in Manifest und Download auf HTTPS sowie dem offiziellen GitHub-Release des Projekts.
- Maintainer sollen den fehlenden Signaturschutz berücksichtigen, wenn sie einen Release freigeben. Der öffentliche Trust-Anchor muss vor einer späteren Signatur-Implementierung unabhängig im Client verankert werden.
- Private Signaturschlüssel dürfen nicht in den Quellcode oder allgemeine Repository-Secrets aufgenommen werden.

## 4. Branches und Änderungen an der Release-Konfiguration

- Änderungen an `main` laufen über Pull Requests; die erforderlichen Statusprüfungen bleiben aktiv.
- Änderungen an dieser Richtlinie oder am Release-Workflow laufen ebenfalls über Pull Requests.
- Agents dürfen die Richtlinie auf ausdrücklichen Auftrag eines Maintainers vorschlagen. Sie dürfen keine Branch-Schutzregeln, Statusprüfungen, Berechtigungsgrenzen oder GitHub-Einstellungen umgehen.
- Agents dürfen keine Pull Requests direkt auf geschützte Branches mergen und erhalten keine langlebigen Zugangsdaten oder Rechte auf privilegierte Runner.
