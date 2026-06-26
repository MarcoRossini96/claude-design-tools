---
description: Massimo effort — porta il progetto a compliance massima (converge i fix, genera i design token, report di ship-readiness).
argument-hint: "[file-o-cartella]"
allowed-tools: Bash(node:*), Bash(bash:*), Read, Edit, Glob
---

Obiettivo: **chiudere il progetto dell'utente** portandolo alla massima compliance possibile. Dai il massimo effort.

## 1. (Opzionale) apri Claude Design
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/open-design.sh"
```

## 2. Target
Argomenti: `$ARGUMENTS` — se vuoto usa `.`.

## 3. ANTEPRIMA (non scrive nulla)
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/compliance-check.mjs" <TARGET> --close --dry-run
```
Mostra: **punteggio compliance**, iterazioni fino a convergenza, correzioni che verrebbero applicate (inclusi i fix
⚠️ rischiosi), il file `design-tokens.css` che verrebbe generato, e la lista **"Da chiudere a mano"**.

## 4. Conferma
Riassumi cosa verra' cambiato, evidenzia i fix ⚠️ rischiosi (cambiano l'intento di design) e chiedi conferma esplicita.

## 5. APPLICA (scrive i file + design-tokens.css)
Solo dopo conferma:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/compliance-check.mjs" <TARGET> --close
```
Ricorda all'utente di importare i token una volta sola (es. CSS `@import "./design-tokens.css";`) cosi' i `var(--color-…)` risolvono.

## 6. Chiudi le decisioni umane
Per ogni voce "Da chiudere a mano" proponi la correzione concreta e applicala con `Edit` dopo conferma:
- **brand-font** → scegli Poppins (heading) o Lora (body) in base al contesto dell'elemento.
- **icon-button-label** → deduci un `aria-label` dal nome dell'icona/azione.
- **heading-order** → correggi il livello per non saltare la gerarchia.
- **!important / inline-style** → sposta lo stile su classe/token.
- **tap-target / contrasto fuori-brand** → proponi la dimensione/lo sfondo di brand adeguati.

Punta a portare gli **errori a 0** e ridurre i warning al minimo. Non scrivere mai senza conferma.
