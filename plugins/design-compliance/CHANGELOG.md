# Changelog

Tutte le modifiche rilevanti del plugin `design-compliance`. Formato basato su [Keep a Changelog](https://keepachangelog.com), versioning [SemVer](https://semver.org).

## [1.3.0] - 2026-06-26
### Added
- Comando `/design-compliance:connect`: apre **Claude Design** nel browser e lo **collega automaticamente a questo progetto**
  via il suo repo GitHub (estensione Claude-in-Chrome), per usarne la capacita' di design sul tuo codice; poi si valida con `check`/`close`.
  Nota: il browser e' guidato da Claude a runtime (serve estensione connessa + login). Alternativa ufficiale piu' robusta: comando `/design`.

## [1.2.1] - 2026-06-26
### Changed
- Descrizione in **inglese** e ottimizzata per la scoperta in `plugin.json` e `marketplace.json` (è ciò che appare in `/plugin Discover` e nel catalogo del marketplace).

## [1.2.0] - 2026-06-26
### Added
- **Modalità `--close` (massimo effort per chiudere il progetto)** e comando `/design-compliance:close`:
  converge i fix (anche rischiosi) iterando fino a stabilità, genera i design token e produce un **report di ship-readiness**
  con punteggio compliance (0-100), conteggio iniziale→residuo e la lista esatta delle decisioni umane rimaste.
- **Fix iterativo fino a convergenza** per `--fix` (un colore fuori-brand diventa brand → poi viene tokenizzato in un secondo giro). Risolve anche contrasti che un singolo passaggio non chiudeva (es. testo → `dark` su arancione, 5.90:1).
- **Generazione design token** `--emit-tokens [FILE]`: scrive `:root { --color-…; --font-… }` dai brand-tokens, nella directory del progetto. Rende reali i `var(--color-…)` inseriti dai fix.
### Fixed
- Idempotenza: gli hex nelle definizioni di custom property (`--x: #hex`) non vengono più ri-flaggati né avvolti in `var()` (niente riferimenti circolari nel file dei token).
- Il file dei token viene scritto nella directory del progetto analizzato, non nella cwd.

## [1.1.0] - 2026-06-26
### Added
- **Auto-fix che modifica i file**: flag `--fix` (fix sicuri), `--unsafe` (anche fix rischiosi) e `--dry-run` (anteprima).
  - Sicuri: `alt=""` mancante, snap spaziature/raggi alla scala, colore brand hardcoded → `var(--color-..., #hex)` (con fallback), `font-size` px → rem.
  - Rischiosi: colore fuori-brand → più vicino di brand; correzione contrasto (testo → colore brand leggibile).
- Risoluzione conflitti di overlap per severità (il fix di contrasto batte la tokenizzazione sullo stesso colore).
- Fix **idempotenti**: i colori dentro `var(...)` non vengono ri-flaggati né ri-avvolti.
- Marker 🔧 nel report per le violazioni auto-fixabili; il comando `/design-compliance:check` esegue anteprima → conferma → applica.
### Changed
- Regola custom `px-font-size` sostituita dal check integrato `font-size-rem` (auto-fixabile).
- Numero di riga del contrasto ora puntato alla dichiarazione `color:` effettiva.

## [1.0.0] - 2026-06-26
### Added
- Comando slash on-demand `/design-compliance:check [path|diff]` che apre la **Claude Design ufficiale** (`claude.ai/design`) e valida il codice.
- Scanner deterministico `compliance-check.mjs` (zero dipendenze) su 4 dimensioni: brand Anthropic, design-system/token, accessibilita' WCAG, regole custom.
- Libreria contrasto WCAG 2.1 (`lib/contrast.mjs`) con luminanza relativa, rapporto di contrasto e colore di brand piu' vicino.
- Token di brand ufficiali Anthropic in `config/brand-tokens.json` (dalla skill `brand-guidelines`).
- Policy configurabile in `config/rules.json` (soglie WCAG, scale spaziatura/raggi, regole custom).
- Skill `design-audit` per l'invocazione automatica e l'interpretazione dei risultati.
- Output `markdown` e `json`, flag `--diff`, `--severity`, `--report`; exit code 1 su violazioni `error` (CI-ready).
