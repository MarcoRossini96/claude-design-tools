---
description: Apre Claude Design ufficiale e valida il codice UI (brand, design-system, WCAG, regole custom).
argument-hint: "[file-o-cartella | diff]"
allowed-tools: Bash(node:*), Bash(bash:*), Read, Edit, Glob
---

Sei il tool **design-compliance**. Esegui i passi in ordine, senza saltarne nessuno.

## 1. Apri Claude Design ufficiale
Apri l'app nel browser dell'utente:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/open-design.sh"
```

## 2. Determina il target da analizzare
Argomenti dell'utente: `$ARGUMENTS`
- Vuoto → usa `.` (intero progetto).
- Esattamente `diff` → usa il flag `--diff` (solo i file modificati in git).
- Altrimenti → usa il valore come path o glob.

## 3. Esegui lo scanner deterministico
Con un path:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/compliance-check.mjs" <TARGET> --format markdown
```
Oppure, se il target e' `diff`:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/compliance-check.mjs" --diff --format markdown
```

## 4. Presenta il report
Mostra il report prodotto e riassumi lo stato in 1-2 righe (es. "6 errori bloccanti, 10 warning, 5 info").
Le 4 dimensioni: **Brand (Anthropic)**, **Design system / token**, **Accessibilita' (WCAG)**, **Regole custom**.

## 5. Offri l'auto-fix (modifica i file)
Le violazioni con marker 🔧 sono auto-fixabili. Procedi sempre **anteprima → conferma → applica**:

1. Mostra l'**anteprima** (non scrive nulla):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/compliance-check.mjs" <TARGET> --fix --unsafe --dry-run
   ```
   `--unsafe` include anche i fix rischiosi (es. colore fuori-brand -> piu' vicino di brand, correzione contrasto),
   marcati con ⚠️. Per i soli fix sicuri ometti `--unsafe`.
2. Chiedi conferma esplicita all'utente, evidenziando i fix ⚠️rischiosi (cambiano l'intento di design).
3. **Solo dopo conferma**, applica scrivendo i file:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/compliance-check.mjs" <TARGET> --fix --unsafe
   ```
4. Ri-esegui il report (passo 3) per mostrare cosa resta: alcune violazioni richiedono scelte umane
   (heading order, aria-label, contrasto fra due colori) e non sono auto-fixabili.

Non scrivere mai sui file senza la conferma dell'utente.
