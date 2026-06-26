#!/usr/bin/env bash
# Apre il browser di default sulla Claude Design UFFICIALE.
# Se non sei loggato, claude.ai reindirizza al login e poi a /design.
set -euo pipefail

URL="${CLAUDE_DESIGN_URL:-https://claude.ai/design}"

open_url() {
  case "$(uname -s)" in
    Darwin*)  open "$URL" ;;
    Linux*)   if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
              elif command -v gio >/dev/null 2>&1; then gio open "$URL"
              else echo "Apri manualmente: $URL"; return 0; fi ;;
    MINGW*|MSYS*|CYGWIN*) start "" "$URL" ;;
    *)        echo "Piattaforma non riconosciuta. Apri manualmente: $URL" ;;
  esac
}

echo "Apro Claude Design ufficiale: $URL"
open_url || echo "Non sono riuscito ad aprire il browser. Apri manualmente: $URL"
