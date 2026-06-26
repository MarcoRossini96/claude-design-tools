# Design Compliance

Plugin Claude Code che fa da **tool di compliance integrato con [Claude Design](https://claude.ai/design)**.
Quando lo chiami apre l'app Claude Design ufficiale nel browser **e** valida il codice UI del progetto contro
quattro dimensioni, con un motore deterministico (niente "a sensazione").

## Uso

```
/design-compliance:check            # apre Claude Design + analizza l'intero progetto
/design-compliance:check src/ui     # analizza un path specifico
/design-compliance:check diff        # analizza solo i file modificati in git
/design-compliance:close            # MASSIMO EFFORT: chiude il progetto (fix + token + ship-report)
```

Lo scanner si può anche eseguire a mano (e in CI):

```bash
node scripts/compliance-check.mjs . --format markdown
node scripts/compliance-check.mjs --diff --format json --report compliance.json
```

Esce con **codice 1** se trova almeno una violazione di severità `error`, altrimenti `0`.

## Auto-fix (modifica i file)

Oltre a controllare, il tool **corregge**. Flusso sempre **anteprima → conferma → applica**:

```bash
node scripts/compliance-check.mjs <target> --fix --unsafe --dry-run   # anteprima, non scrive
node scripts/compliance-check.mjs <target> --fix --unsafe             # applica (scrive i file)
```

| Flag | Cosa applica |
|---|---|
| `--fix` | **Fix sicuri**: `alt=""` mancante; snap spaziature/raggi alla scala; colore brand hardcoded → `var(--color-…, #hex)` (fallback, non rompe il rendering); `font-size` px → rem |
| `--fix --unsafe` | Anche i **fix rischiosi** (⚠️): colore fuori-brand → più vicino di brand; correzione contrasto |
| `--dry-run` | Anteprima senza scrivere |

I fix sono **idempotenti** e, a parità di posizione, vince la severità più alta. Non auto-fixabili (richiedono una
scelta umana): heading order, `aria-label`, tap target, `!important`, contrasto fra due colori fuori-brand.

## Chiudere il progetto (massimo effort)

```bash
node scripts/compliance-check.mjs <target> --close --dry-run   # anteprima
node scripts/compliance-check.mjs <target> --close             # applica
```

`--close` itera i fix (anche rischiosi) **fino a convergenza**, **genera `design-tokens.css`** (`:root { --color-…; --font-… }`
dai brand-tokens) nella directory del progetto, e stampa un **report di ship-readiness**: punteggio compliance (0-100),
violazioni iniziali → residue, e la lista esatta delle decisioni umane rimaste. L'iterazione chiude anche casi che un
singolo passaggio non risolve (es. testo chiaro su arancione → `dark`, 5.90:1). Importa i token una volta:
`@import "./design-tokens.css";`.

Genera solo i token: `node scripts/compliance-check.mjs --emit-tokens [FILE]`.

## Le 4 dimensioni

| Dimensione | Cosa controlla |
|---|---|
| **Brand (Anthropic)** | Colori fuori dalla palette ufficiale; font non ammessi (Poppins, Lora, Arial, Georgia) |
| **Design system / token** | Colori di brand hardcoded invece che via token; spaziature/raggi fuori scala |
| **Accessibilità (WCAG)** | Contrasto < AA; `<img>` senza `alt`; bottoni-icona senza `aria-label`; salti di heading; tap target < 44px |
| **Regole custom** | Pattern definiti dal team in `config/rules.json` |

## Fonte di verità

- [`config/brand-tokens.json`](config/brand-tokens.json) — colori e tipografia **ufficiali Anthropic**, estratti dalla skill `brand-guidelines`. Non modificare a mano.
- [`config/rules.json`](config/rules.json) — soglie WCAG, scale di spaziatura/raggi e regole custom. **Modificabile dal team.**

## Struttura

```
design-compliance/
├── .claude-plugin/plugin.json     # manifest
├── commands/check.md              # slash command on-demand
├── skills/design-audit/           # skill design-audit (auto-invoke)
├── scripts/
│   ├── compliance-check.mjs       # scanner
│   ├── open-design.sh             # apre claude.ai/design
│   └── lib/contrast.mjs           # math WCAG
└── config/                        # brand-tokens.json + rules.json
```

## Estensioni predisposte (post-v1)

Lo scanner espone già `--format json` ed exit code per CI; da qui è immediato aggiungere un hook `PostToolUse`
o un MCP server. Vedi il `CHANGELOG.md`.
