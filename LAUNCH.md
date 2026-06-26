# Launch kit — design-compliance

Copy-paste material to give the project its best **organic** shot. Post these yourself, in your own voice.
Repo: `https://github.com/MarcoRossini96/claude-design-tools`

> Honest note: virality can't be manufactured. What moves the needle is posting where this exact audience
> already is (Claude Code users), with a clear demo. Lead with the `--close` ship-readiness output — it's the hook.

---

## 1. X / Twitter (thread)

**Tweet 1**
I built a Claude Code plugin that audits UI code for Claude Design and *closes the project for you*.

One command → opens Claude Design, checks brand + design tokens + WCAG a11y, auto-fixes what's mechanical,
and gives a ship-readiness score.

Open source, zero deps 👇

**Tweet 2**
`/design-compliance:close` iterates fixes to convergence, generates your design-tokens.css, and prints:

Compliance score: 81/100 ✅ Ship-ready
Violations 21 → 7 · 16 auto-fixed

It even fixes contrast a single pass can't (light text on orange → dark, 5.90:1).

**Tweet 3**
Install:
/plugin marketplace add MarcoRossini96/claude-design-tools
/plugin install design-compliance@claude-design-tools

MIT. Built with Claude Code. ⭐ if useful:
https://github.com/MarcoRossini96/claude-design-tools

---

## 2. Show HN

**Title:** Show HN: A Claude Code plugin that audits and auto-fixes Claude Design UI for compliance

**Body:**
I had beta access to Claude Design and wanted a gate before shipping its output: on-brand, tokenized, accessible.

design-compliance is a Claude Code plugin (zero dependencies) that checks four dimensions deterministically —
Anthropic brand, design-system tokens, WCAG accessibility, custom team rules — and can auto-fix them.

The part I'm most happy with is `--close`: it iterates fixes to convergence, generates a real design-tokens.css,
and prints a ship-readiness score with the exact list of remaining human decisions. Every finding has file, line,
rule and a concrete fix; fixes are idempotent and gated behind a dry-run preview.

Repo (MIT): https://github.com/MarcoRossini96/claude-design-tools
Feedback welcome — especially on the rule set and the contrast resolution heuristic.

---

## 3. Reddit — r/ClaudeAI (and r/Anthropic)

**Title:** I made a Claude Code plugin that checks + auto-fixes Claude Design output for brand/a11y compliance

**Body:**
Quick share: `design-compliance` opens Claude Design and audits your UI code against the Anthropic brand,
your design tokens, and WCAG accessibility — then auto-fixes and gives a "ship-ready" score.

Install:
```
/plugin marketplace add MarcoRossini96/claude-design-tools
/plugin install design-compliance@claude-design-tools
```
Then `/design-compliance:close`. Open source, MIT, no dependencies. Would love feedback on what rules to add.
GitHub: https://github.com/MarcoRossini96/claude-design-tools

---

## 4. Anthropic Discord (#claude-code / #show-and-tell)

Built a small Claude Code plugin for folks using Claude Design: `design-compliance`.
`/design-compliance:close` checks brand + tokens + WCAG, auto-fixes, generates design-tokens.css and prints a
ship-readiness score. Zero deps, MIT. Repo: https://github.com/MarcoRossini96/claude-design-tools — feedback very welcome 🙏

---

## 5. dev.to / blog (outline)

- Title: "Closing the loop on Claude Design: an auto-fixing compliance gate for Claude Code"
- The problem: fast UI still needs brand + tokens + a11y before prod
- The 4 dimensions + why deterministic beats "vibes"
- Deep dive on `--close`: convergence, token generation, ship score
- The honest limits (canvas is closed; human-only decisions)
- Call to action: install one-liner + repo link

---

## 6. Get it into Anthropic's marketplace (the real process — NOT a PR)

Anthropic has two marketplaces:
- **`claude-plugins-official`** — curated by Anthropic at its discretion. No application process; the form does NOT add to it.
- **`claude-community`** (`anthropics/claude-plugins-community`) — where third-party submissions land after review. Users add it
  with `/plugin marketplace add anthropics/claude-plugins-community`.

**Submit to the community marketplace via the in-app form** (run `claude plugin validate` first — it passes):
- Individual authors: **Console → https://platform.claude.com/plugins/submit**
- Team/Enterprise orgs: claude.ai → https://claude.ai/admin-settings/directory/submissions/plugins/new

### Submission packet (paste into the form)
- **Plugin name:** `design-compliance`
- **Marketplace / repo:** `https://github.com/MarcoRossini96/claude-design-tools`
- **Install id:** `design-compliance@claude-design-tools`
- **Description:** Opens Claude Design and audits UI code against the Anthropic brand, design-system tokens, WCAG accessibility and custom rules; auto-fixes and reports ship-readiness. Zero dependencies.
- **Category:** Development / Code quality
- **Author:** Marco Rossini (github.com/MarcoRossini96)
- **License:** MIT

After approval, the plugin is pinned to a commit SHA in the community catalog; the public catalog syncs nightly.

## 7. Also worth doing
- **Claude Code Discussion** → `anthropics/claude-code` Discussions, "Show and tell".
- Community directories (e.g. claudepluginhub).
