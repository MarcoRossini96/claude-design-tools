---
description: Apre Claude Design nel browser GIA' collegato a questo progetto (via il suo repo GitHub), per usarne la capacita' di design sul tuo codice.
argument-hint: "[prompt di design opzionale]"
allowed-tools: Bash(git:*)
---

Obiettivo: usare la bravura di **Claude Design** da qui, col browser collegato automaticamente a QUESTO progetto.

> Nota onesta: i passi 2-4 li esegue Claude pilotando il browser via l'estensione **Claude-in-Chrome**
> (tool `mcp__Claude_in_Chrome__*`). Servono: estensione connessa + login su claude.ai. Se non c'e', il meccanismo
> ufficiale alternativo e' il comando `/design` (sync Claude Code <-> Claude Design), piu' robusto.

## 1. Ricava il repo del progetto
```bash
git remote get-url origin
```
- Se c'e' un remote GitHub → usalo per il collegamento automatico (passo 3).
- Se NON c'e' → dillo all'utente: Claude Design collega il codice via **URL GitHub** (automatizzabile) o via **cartella locale**
  (richiede il file-picker nativo, che Claude non puo' pilotare → l'utente la trascina a mano). Suggerisci `git`/push, oppure il comando `/design`.

## 2. Verifica l'estensione
Chiama `mcp__Claude_in_Chrome__list_connected_browsers`. Se vuota, chiedi all'utente di aprire Chrome con l'estensione connessa, poi riprova.

## 3. Apri Claude Design e collega il progetto (automatico)
Con i tool Claude-in-Chrome:
1. `navigate` → `https://claude.ai/design`
2. Apri il flusso di collegamento codice: scheda **Design systems** → apri/crea un design system → campo **"Link code from GitHub"**
   (oppure il pulsante **+** del composer del progetto).
3. `find` il campo GitHub, `form_input` con l'URL del repo del passo 1, poi clicca **Add**.
4. (Opzionale) scrivi il prompt `$ARGUMENTS` nel campo principale di Claude Design.
5. `screenshot` per confermare il collegamento.

## 4. Conferma e limiti
Conferma all'utente: "Claude Design e' ora collegato a <repo>". **Non** avviare generazioni costose senza conferma esplicita.

## 5. Riporta indietro (compliance)
Quando Claude Design produce/sincronizza codice nel progetto, valida con `/design-compliance:check` o chiudi con `/design-compliance:close`.
