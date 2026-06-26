---
name: design-audit
description: Verifica la compliance di codice UI (CSS/SCSS/JSX/TSX/HTML/Vue/Svelte) verso il brand Anthropic, i token del design-system, l'accessibilita' WCAG e le regole custom del team. Usa quando l'utente chiede una review di design, brand o accessibilita', dopo aver generato o sincronizzato UI da Claude Design (claude.ai/design), o prima di consegnare componenti.
---

# Design compliance audit

Questo plugin valida il codice prodotto/sincronizzato da **Claude Design** contro 4 dimensioni, usando dati
deterministici (nessun giudizio "a sensazione").

## Fonte di verita'
- `${CLAUDE_PLUGIN_ROOT}/config/brand-tokens.json` — colori e tipografia **ufficiali Anthropic** (dalla skill `brand-guidelines`).
- `${CLAUDE_PLUGIN_ROOT}/config/rules.json` — soglie WCAG, scale di spaziatura/raggi e regole custom (modificabili dal team).

## Le 4 dimensioni
1. **Brand (Anthropic)** — colori fuori dalla palette ufficiale; `font-family` non ammessi (consentiti: Poppins, Lora, Arial, Georgia).
2. **Design system / token** — colori di brand hardcoded invece che via token (`var(--…)`); spaziature/raggi fuori scala.
3. **Accessibilita' (WCAG)** — contrasto testo/sfondo sotto soglia AA; `<img>` senza `alt`; bottoni-icona senza `aria-label`; salti di gerarchia heading; tap target < 44px.
4. **Regole custom** — pattern definiti dal team in `rules.json`.

## Come eseguire (report, read-only)
```bash
# intero progetto
node "${CLAUDE_PLUGIN_ROOT}/scripts/compliance-check.mjs" . --format markdown
# solo file modificati in git
node "${CLAUDE_PLUGIN_ROOT}/scripts/compliance-check.mjs" --diff --format markdown
# output JSON (per CI / automazioni)
node "${CLAUDE_PLUGIN_ROOT}/scripts/compliance-check.mjs" src --format json
```
Lo scanner esce con **codice 1** se trova almeno una violazione `error` (utile in CI), altrimenti 0.
Le violazioni con marker 🔧 sono auto-fixabili.

## Auto-fix (modifica i file)
Sempre **anteprima → conferma → applica**:
```bash
# 1. anteprima (NON scrive): include i fix rischiosi
node "${CLAUDE_PLUGIN_ROOT}/scripts/compliance-check.mjs" <target> --fix --unsafe --dry-run
# 2. applica (scrive i file) solo dopo conferma utente
node "${CLAUDE_PLUGIN_ROOT}/scripts/compliance-check.mjs" <target> --fix --unsafe
```
- `--fix` da solo applica i **fix sicuri**: `alt=""` mancante, snap spaziature/raggi alla scala, colore brand hardcoded -> `var(--color-..., #hex)` (con fallback, non rompe il rendering), `font-size` px -> rem.
- `--unsafe` aggiunge i **fix rischiosi** (⚠️): colore fuori-brand -> piu' vicino di brand, correzione contrasto.
- I fix sono **idempotenti**; a parita' di posizione vince la severita' piu' alta (es. il contrasto batte la tokenizzazione).
- Non auto-fixabili (scelta umana): heading order, `aria-label`, tap target, `!important`, contrasto fra due colori fuori-brand.

## Chiudere il progetto (massimo effort)
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/compliance-check.mjs" <target> --close --dry-run   # anteprima
node "${CLAUDE_PLUGIN_ROOT}/scripts/compliance-check.mjs" <target> --close             # applica
```
`--close` itera i fix (anche rischiosi) fino a convergenza, genera `design-tokens.css` (`:root` con `--color-…`/`--font-…`)
nella directory del progetto, e dà un **report di ship-readiness**: punteggio 0-100, iniziale→residuo e le decisioni umane rimaste.
Dopo, chiudi a mano le voci elencate (font heading/body, aria-label, heading order, !important) per portare gli errori a 0.
Entry point on-demand: comando `/design-compliance:close`.

## Regola d'oro
Non scrivere mai sui file senza mostrare prima l'anteprima (`--dry-run`) e ottenere conferma esplicita, evidenziando i fix ⚠️ rischiosi.

Per il flusso completo on-demand (apre anche Claude Design nel browser) usa il comando `/design-compliance:check`.
