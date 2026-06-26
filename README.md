# design-compliance — a Claude Code plugin for Claude Design

> **Stop shipping off-brand, inaccessible UI.** One command opens [Claude Design](https://claude.ai/design),
> audits your UI code against the Anthropic brand, your design-system tokens and WCAG accessibility —
> then **fixes it and closes the project for you.**

[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-d97757)](https://code.claude.com/docs/en/plugins)
[![version](https://img.shields.io/badge/version-1.2.0-141413)](plugins/design-compliance/CHANGELOG.md)
[![license](https://img.shields.io/badge/license-MIT-788c5d)](LICENSE)
[![zero deps](https://img.shields.io/badge/dependencies-0-6a9bcc)](plugins/design-compliance/scripts/compliance-check.mjs)

---

## Why

Claude Design ships UI fast. But "fast" still needs to be **on-brand, tokenized and accessible** before it
goes to production. `design-compliance` is the gate: it checks **four dimensions** deterministically and
auto-fixes everything that's mechanically fixable — leaving you only the genuine design decisions.

| Dimension | What it enforces |
|---|---|
| 🎨 **Brand (Anthropic)** | Only the official palette & fonts (Poppins / Lora) |
| 🧩 **Design system / tokens** | Hardcoded colors → `var(--color-…)`, spacing/radius on-scale |
| ♿ **Accessibility (WCAG)** | Contrast ≥ AA, `alt`, `aria-label`, heading order, tap targets |
| 📏 **Custom team rules** | Your own regex rules in `rules.json` |

Source of truth for brand values: the official **`brand-guidelines`** skill — no invented colors.

## Install

```shell
/plugin marketplace add MarcoRossini96/claude-design-tools
/plugin install design-compliance@claude-design-tools
```

## Use

```shell
/design-compliance:check          # opens Claude Design + audits your code
/design-compliance:close          # MAX EFFORT: fixes + generates tokens + ship-readiness report
```

The scanner also runs standalone (CI-friendly, exit code 1 on errors):

```shell
node scripts/compliance-check.mjs . --close --dry-run
```

## What `--close` does (the magic)

It iterates fixes **to convergence**, generates a real `design-tokens.css`, and prints a ship score:

```
# Project close — Compliance
## Compliance score: 81/100
✅ Ship-ready: no blocking errors. Only design decisions remain.
- Iterations to convergence: 3
- Auto-applied fixes: 16
- Violations 21 → 7 (❌ 0 · ⚠️ 6 · ℹ️ 1)
- Design tokens generated: design-tokens.css

## Left to decide (human calls)
- ⚠️ brand-font ×2 — use Poppins (heading) or Lora (body)
- ⚠️ heading-order ×1 — use h2 instead of skipping
- ℹ️ tap-target ×1 — raise height to ≥ 44px
```

Iteration even resolves contrast a single pass can't (e.g. light text on orange → `dark`, **5.90:1**).
Fixes are **idempotent** and gated behind a `--dry-run` preview + your confirmation.

## How it works

- **Zero dependencies** — a single Node script ([`compliance-check.mjs`](plugins/design-compliance/scripts/compliance-check.mjs)) + a tiny WCAG contrast lib.
- **Deterministic** — no "vibes", every finding has file, line, rule and a concrete fix.
- **Honest** — it never claims to read Claude Design's canvas; it opens the official app and validates the code it syncs to you.

See the plugin docs in [`plugins/design-compliance/`](plugins/design-compliance/README.md).

## Contributing

Issues and PRs welcome. New rules go in [`config/rules.json`](plugins/design-compliance/config/rules.json);
fixtures with intentional violations live in [`fixtures/`](fixtures).

## License

[MIT](LICENSE) © Marco Rossini
