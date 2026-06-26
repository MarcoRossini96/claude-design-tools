#!/usr/bin/env node
// design-compliance scanner + fixer + closer — deterministic, dependency-free.
// Controlla il codice UI su 4 dimensioni: brand, design-system/token, WCAG a11y, regole custom.
// Puo' APPLICARE correzioni e portare il progetto fino alla chiusura (compliance massima).
//
// Usage:
//   node compliance-check.mjs [path...] [--diff] [--format markdown|json]
//        [--severity error|warning|info] [--report FILE]
//        [--fix] [--unsafe] [--dry-run]
//        [--emit-tokens [FILE]] [--close]
//
// Modalita':
//   (default)            solo report, NON tocca i file.
//   --fix                applica i fix SICURI, iterando fino a convergenza.
//   --fix --unsafe       applica anche i fix RISCHIOSI (cambiano l'intento di design).
//   --fix --dry-run      ANTEPRIMA: mostra il risultato convergente senza scrivere.
//   --emit-tokens [FILE] genera il foglio dei design token (:root { --color-... }). Default design-tokens.css.
//   --close              MASSIMO EFFORT: converge i fix (+rischiosi) + genera i token + report di ship-readiness.
//
// Exit code: 1 se restano violazioni `error` (o errore interno), altrimenti 0.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, extname, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { contrastRatio, toHex, nearestBrandColor } from './lib/contrast.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = resolve(__dirname, '..', 'config');
const brand = JSON.parse(readFileSync(join(CONFIG_DIR, 'brand-tokens.json'), 'utf8'));
const rules = JSON.parse(readFileSync(join(CONFIG_DIR, 'rules.json'), 'utf8'));

// ---- derived brand data -----------------------------------------------------
const BRAND_PALETTE = [
  ...Object.entries(brand.colors.main).map(([name, v]) => ({ name, hex: v.hex })),
  ...Object.entries(brand.colors.accent).map(([name, v]) => ({ name, hex: v.hex })),
];
const ALLOWED_HEX = new Set(BRAND_PALETTE.map((c) => toHex(c.hex)));
const HEX_TO_NAME = new Map(BRAND_PALETTE.map((c) => [toHex(c.hex), c.name]));
const ALLOWED_FONTS = new Set(brand.typography.allowedFamilies.map((f) => f.toLowerCase()));
const GENERIC_FONTS = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif',
  'ui-sans-serif', 'ui-monospace', 'inherit', 'initial', 'unset', 'revert', 'var',
]);

// ---- CLI parsing ------------------------------------------------------------
const argv = process.argv.slice(2);
const opts = { paths: [], diff: false, format: 'markdown', minSeverity: 'info', report: null,
  fix: false, unsafe: false, dryRun: false, emitTokens: null, close: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--diff') opts.diff = true;
  else if (a === '--format') opts.format = argv[++i];
  else if (a === '--severity') opts.minSeverity = argv[++i];
  else if (a === '--report') opts.report = argv[++i];
  else if (a === '--fix') opts.fix = true;
  else if (a === '--unsafe' || a === '--aggressive') opts.unsafe = true;
  else if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--close') opts.close = true;
  else if (a === '--emit-tokens') { opts.emitTokens = (argv[i + 1] && !argv[i + 1].startsWith('-')) ? argv[++i] : true; }
  else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
  else opts.paths.push(a);
}
if (opts.paths.length === 0) opts.paths = ['.'];

const SEVERITY_RANK = { error: 3, warning: 2, info: 1 };
const SCAN_EXT = new Set(['.css', '.scss', '.less', '.js', '.jsx', '.ts', '.tsx', '.html', '.vue', '.svelte']);
const STYLE_EXT = new Set(['.css', '.scss', '.less']);
const MARKUP_EXT = new Set(['.html', '.jsx', '.tsx', '.vue', '.svelte']);
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', '.cache']);
const ICON = { error: '❌', warning: '⚠️', info: 'ℹ️' };
const DIM_LABEL = {
  brand: 'Brand (Anthropic)', 'design-system': 'Design system / token',
  wcag: 'Accessibilita\' (WCAG)', custom: 'Regole custom',
};

// ---- file collection --------------------------------------------------------
function collectFiles(paths) {
  if (opts.diff) return gitChangedFiles();
  const files = [];
  for (const p of paths) walk(p, files);
  return files;
}
function walk(p, out) {
  let st;
  try { st = statSync(p); } catch { return; }
  if (st.isDirectory()) {
    if (SKIP_DIR.has(p.split('/').pop())) return;
    for (const name of readdirSync(p)) {
      if (SKIP_DIR.has(name)) continue;
      walk(join(p, name), out);
    }
  } else if (st.isFile() && SCAN_EXT.has(extname(p))) {
    out.push(p);
  }
}
function gitChangedFiles() {
  try {
    const tracked = execSync('git diff --name-only HEAD', { encoding: 'utf8' });
    const untracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf8' });
    return [...tracked.split('\n'), ...untracked.split('\n')]
      .map((s) => s.trim())
      .filter((s) => s && SCAN_EXT.has(extname(s)));
  } catch {
    process.stderr.write('warn: --diff richiede un repo git; eseguo scansione completa.\n');
    return (() => { const f = []; for (const p of opts.paths) walk(p, f); return f; })();
  }
}

// ---- helpers ----------------------------------------------------------------
const lineOf = (content, index) => content.slice(0, index).split('\n').length;
const extKey = (file) => extname(file).slice(1).toLowerCase();

// stripComments PRESERVA la lunghezza (sostituisce con spazi): gli indici sul testo
// "pulito" restano validi sul testo grezzo.
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
          .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(Math.max(0, m.length - p1.length)));
}
const nearestScale = (n, scale) => scale.reduce((best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best), scale[0]);
function bestBrandColorFor(bgColor, min) {
  let best = null;
  for (const c of BRAND_PALETTE) {
    const r = contrastRatio(c.hex, bgColor);
    if (r != null && (!best || r > best.ratio)) best = { hex: c.hex, name: c.name, ratio: r };
  }
  return best && best.ratio >= min ? best : null;
}

// ---- per-file scan ----------------------------------------------------------
// Violazione: {file, line, dimension, severity, rule, message, suggestion, fix?}
//   fix = { index, length, replacement, risky }  (indici nel contenuto grezzo)
function scanFile(file, raw) {
  const out = [];
  const ext = extname(file);
  const isStyle = STYLE_EXT.has(ext);
  const isMarkup = MARKUP_EXT.has(ext);
  const clean = stripComments(raw);
  const add = (line, dimension, severity, rule, message, suggestion, fix) =>
    out.push({ file, line, dimension, severity, rule, message, suggestion: suggestion || null, fix: fix || null });

  // --- colori: brand + token ---
  {
    // I colori dentro var(...) sono gia' tokenizzati: mascherati (lunghezza preservata)
    // per non ri-flaggarli ne' ri-avvolgerli (fix idempotente).
    const colorText = clean.replace(/var\([^)]*\)/g, (s) => ' '.repeat(s.length));
    const re = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)/g;
    let m;
    while ((m = re.exec(colorText)) !== null) {
      const token = m[0];
      const hex = toHex(token);
      if (!hex) continue;
      const line = lineOf(clean, m.index);
      if (!ALLOWED_HEX.has(hex)) {
        const near = nearestBrandColor(token, BRAND_PALETTE);
        add(line, 'brand', 'error', 'brand-color',
          `Colore ${token} non fa parte della palette Anthropic.`,
          near ? `Colore di brand piu' vicino: ${near.name} ${near.hex}.` : null,
          near ? { index: m.index, length: token.length, replacement: near.hex, risky: true } : null);
      } else if (isStyle && rules.designSystem.enforceTokensForColor && !inCustomProp(clean, m.index)) {
        // Un hex nel valore di una custom property (--x: #hex) E' la definizione del
        // token: va lasciato grezzo, non ri-avvolto (evita il riferimento circolare).
        const name = HEX_TO_NAME.get(hex);
        add(line, 'design-system', 'warning', 'color-token',
          `Colore di brand ${token} hardcoded.`, rules.designSystem.tokenHint,
          name ? { index: m.index, length: token.length, replacement: `var(--color-${name}, ${token})`, risky: false } : null);
      }
    }
  }

  // --- font-family (no auto-fix: heading/body e' ambiguo) ---
  {
    const re = /font-family\s*:\s*([^;}{]+)|fontFamily\s*:\s*(['"][^'"]+['"])/g;
    let m;
    while ((m = re.exec(clean)) !== null) {
      const value = (m[1] || m[2] || '').replace(/['"]/g, '');
      const line = lineOf(clean, m.index);
      for (let fam of value.split(',')) {
        fam = fam.trim();
        if (!fam) continue;
        const low = fam.toLowerCase();
        if (GENERIC_FONTS.has(low) || low.startsWith('var(') || low.startsWith('-')) continue;
        if (!ALLOWED_FONTS.has(low)) {
          add(line, 'brand', 'warning', 'brand-font',
            `Font "${fam}" non ammesso dalle brand guidelines.`,
            `Usa ${brand.typography.headings.family} (heading) o ${brand.typography.body.family} (body).`);
        }
      }
    }
  }

  // --- design-system: scala spaziature, raggi, font-size px->rem ---
  if (isStyle) {
    const spacingScale = rules.designSystem.spacingScalePx;
    const radiiScale = rules.designSystem.radiiScalePx;
    if (rules.designSystem.enforceSpacingScale) {
      const spacingProp = /(margin|padding|gap|row-gap|column-gap|top|right|bottom|left|inset)(-[a-z]+)?\s*:\s*([^;}{]+)/gi;
      let m;
      while ((m = spacingProp.exec(clean)) !== null) {
        const valStart = m.index + m[0].indexOf(m[3]);
        const pxRe = /-?\d*\.?\d+px/g; let pm;
        while ((pm = pxRe.exec(m[3])) !== null) {
          const n = Math.abs(parseFloat(pm[0]));
          if (n !== 0 && !new Set(spacingScale).has(n)) {
            const near = nearestScale(n, spacingScale);
            add(lineOf(clean, valStart + pm.index), 'design-system', 'info', 'spacing-scale',
              `Spaziatura ${pm[0]} fuori dalla scala (griglia 8px).`, `Valore in scala piu' vicino: ${near}px.`,
              { index: valStart + pm.index, length: pm[0].length, replacement: `${near}px`, risky: false });
          }
        }
      }
      const radiusProp = /border-radius\s*:\s*([^;}{]+)/gi;
      while ((m = radiusProp.exec(clean)) !== null) {
        const valStart = m.index + m[0].indexOf(m[1]);
        const pxRe = /\d*\.?\d+px/g; let pm;
        while ((pm = pxRe.exec(m[1])) !== null) {
          const n = parseFloat(pm[0]);
          if (n !== 0 && !new Set(radiiScale).has(n)) {
            const near = nearestScale(n, radiiScale);
            add(lineOf(clean, valStart + pm.index), 'design-system', 'info', 'radius-scale',
              `border-radius ${pm[0]} fuori scala.`, `Raggio in scala piu' vicino: ${near}px.`,
              { index: valStart + pm.index, length: pm[0].length, replacement: `${near}px`, risky: false });
          }
        }
      }
    }
    const fsRe = /font-size\s*:\s*(\d*\.?\d+)px/gi;
    let fm;
    while ((fm = fsRe.exec(clean)) !== null) {
      const n = parseFloat(fm[1]);
      const rem = +(n / 16).toFixed(4);
      const numStart = fm.index + fm[0].indexOf(fm[1]);
      add(lineOf(clean, fm.index), 'design-system', 'info', 'font-size-rem',
        `font-size ${fm[1]}px: preferisci rem per l'accessibilita' (zoom utente).`, `${fm[1]}px = ${rem}rem.`,
        { index: numStart, length: fm[1].length + 2, replacement: `${rem}rem`, risky: false });
    }
  }

  // --- WCAG: contrasto (block-based) ---
  if (isStyle) {
    const blockRe = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = blockRe.exec(clean)) !== null) {
      const body = m[2];
      const bodyStart = m.index + m[1].length + 1;
      const fg = findDeclColor(body, bodyStart, /(?:^|[;{}\s])color\s*:\s*([^;]+)/);
      const bg = findDeclColor(body, bodyStart, /background(?:-color)?\s*:\s*([^;]+)/);
      if (!fg || !bg) continue;
      const ratio = contrastRatio(fg.token, bg.token);
      if (ratio == null) continue;
      const fontSize = parseFloat((body.match(/font-size\s*:\s*(\d*\.?\d+)px/) || [])[1] || '0');
      const isLarge = fontSize >= rules.wcag.largeTextMinPx;
      const min = isLarge ? rules.wcag.largeTextContrast : rules.wcag.normalTextContrast;
      if (ratio < min) {
        const better = bestBrandColorFor(bg.token, min);
        add(lineOf(clean, fg.index), 'wcag', 'error', 'contrast',
          `Contrasto ${ratio.toFixed(2)}:1 tra ${fg.token} e ${bg.token} < ${min}:1 (WCAG ${rules.wcag.level}${isLarge ? ', large text' : ''}).`,
          better ? `Imposta il testo a ${better.name} ${better.hex} (contrasto ${better.ratio.toFixed(2)}:1).`
                 : `Nessun colore di brand raggiunge ${min}:1 su ${bg.token}: scegli uno sfondo di brand piu' adatto (es. dark/light).`,
          better ? { index: fg.index, length: fg.length, replacement: better.hex, risky: true } : null);
      }
    }
  }

  // --- WCAG: img senza alt (fix sicuro) ---
  if (isMarkup) {
    const re = /<img\b[^>]*>/gi;
    let m;
    while ((m = re.exec(raw)) !== null) {
      if (!/\balt\s*=/i.test(m[0])) {
        const tag = m[0];
        const replacement = /\/>$/.test(tag) ? tag.replace(/\s*\/>$/, ' alt="" />') : tag.replace(/>$/, ' alt="">');
        add(lineOf(raw, m.index), 'wcag', 'error', 'img-alt',
          '<img> senza attributo alt.', 'Aggiungi alt="" (decorativa) o un testo descrittivo.',
          { index: m.index, length: tag.length, replacement, risky: false });
      }
    }
  }

  // --- WCAG: bottone-icona senza aria-label (no auto-fix) ---
  if (isMarkup) {
    const re = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
    let m;
    while ((m = re.exec(raw)) !== null) {
      const hasLabel = /\baria-label\s*=|\baria-labelledby\s*=/i.test(m[1]);
      const innerText = m[2].replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
      const iconOnly = /<svg|<i\b|className=["'][^"']*icon|Icon\b/.test(m[2]);
      if (!hasLabel && innerText.length === 0 && iconOnly) {
        add(lineOf(raw, m.index), 'wcag', 'warning', 'icon-button-label',
          'Bottone con sola icona senza aria-label.', 'Aggiungi aria-label descrittivo per gli screen reader.');
      }
    }
  }

  // --- WCAG: gerarchia heading (no auto-fix) ---
  if (isMarkup) {
    const re = /<h([1-6])\b/gi;
    let m, prev = 0;
    while ((m = re.exec(raw)) !== null) {
      const level = parseInt(m[1], 10);
      if (prev !== 0 && level > prev + 1) {
        add(lineOf(raw, m.index), 'wcag', 'warning', 'heading-order',
          `Salto di gerarchia: h${level} dopo h${prev}.`, `Usa h${prev + 1} oppure correggi la struttura.`);
      }
      prev = level;
    }
  }

  // --- WCAG: tap target (no auto-fix) ---
  if (isStyle) {
    const min = rules.wcag.minTapTargetPx;
    const blockRe = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = blockRe.exec(clean)) !== null) {
      if (!/(\bbutton\b|\ba\b|\.btn|\[role=["']?button)/i.test(m[1])) continue;
      const h = parseFloat((m[2].match(/(?:^|[;{\s])(?:min-)?height\s*:\s*(\d*\.?\d+)px/) || [])[1] || '0');
      if (h > 0 && h < min) {
        add(lineOf(clean, m.index), 'wcag', 'info', 'tap-target',
          `Target interattivo alto ${h}px < ${min}px consigliati.`, `Porta l'altezza a >= ${min}px.`);
      }
    }
  }

  // --- regole custom (no auto-fix generico) ---
  for (const rule of rules.custom) {
    if (rule.appliesTo && !rule.appliesTo.includes('*') && !rule.appliesTo.includes(extKey(file))) continue;
    const re = new RegExp(rule.pattern, rule.flags || 'g');
    let m;
    while ((m = re.exec(raw)) !== null) {
      add(lineOf(raw, m.index), 'custom', rule.severity || 'warning', rule.id, rule.message, null);
      if (!re.global) break;
    }
  }

  return out;
}

// True se l'indice cade nel valore di una custom property (--name: ... ).
function inCustomProp(clean, index) {
  const start = Math.max(clean.lastIndexOf('{', index), clean.lastIndexOf(';', index), clean.lastIndexOf('}', index)) + 1;
  return /^\s*--[\w-]+\s*:/.test(clean.slice(start, index));
}

function findDeclColor(body, bodyStart, declRe) {
  const m = declRe.exec(body);
  if (!m) return null;
  const valStart = bodyStart + m.index + m[0].indexOf(m[1]);
  const cm = m[1].match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/);
  if (!cm) return null;
  return { token: cm[0], index: valStart + cm.index, length: cm[0].length };
}

// ---- fix application --------------------------------------------------------
function applyFixes(raw, violations, includeRisky) {
  const fixes = violations
    .filter((v) => v.fix && (includeRisky || !v.fix.risky))
    .map((v) => ({ ...v.fix, rule: v.rule, severity: v.severity, line: v.line, before: raw.slice(v.fix.index, v.fix.index + v.fix.length) }))
    // applico dal fondo; a parita' di posizione vince la severita' piu' alta
    // (es. il fix di contrasto, error, batte il color-token, warning, sullo stesso colore).
    .sort((a, b) => b.index - a.index || SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  let out = raw;
  let minStart = Infinity;
  const applied = [];
  for (const f of fixes) {
    if (f.index + f.length > minStart) continue; // overlap con un fix gia' applicato
    out = out.slice(0, f.index) + f.replacement + out.slice(f.index + f.length);
    minStart = f.index;
    applied.push(f);
  }
  applied.reverse();
  return { out, applied };
}

// Itera i fix file per file fino a convergenza (o MAX iterazioni). Idempotente => termina.
function iterativeFix(files, includeRisky, write) {
  const MAX = 12;
  const content = new Map();
  for (const f of files) { try { content.set(f, readFileSync(f, 'utf8')); } catch {} }
  const changesByFile = new Map();
  let iterations = 0;
  for (; iterations < MAX; iterations++) {
    let any = false;
    for (const [file, raw] of content) {
      const { out, applied } = applyFixes(raw, scanFile(file, raw), includeRisky);
      if (applied.length) {
        any = true;
        content.set(file, out);
        const arr = changesByFile.get(file) || [];
        arr.push(...applied.map((a) => ({ ...a, iteration: iterations + 1 })));
        changesByFile.set(file, arr);
      }
    }
    if (!any) break;
  }
  if (write) for (const [file, out] of content) {
    if (changesByFile.has(file)) writeFileSync(file, out);
  }
  return { content, changesByFile, iterations };
}

// ---- design tokens ----------------------------------------------------------
// Path di default per i token: nella directory del progetto analizzato, non nella cwd.
function defaultTokenPath() {
  const p = opts.paths[0] || '.';
  try { const st = statSync(p); if (st.isDirectory()) return join(p, 'design-tokens.css'); if (st.isFile()) return join(dirname(p), 'design-tokens.css'); } catch {}
  return 'design-tokens.css';
}
const resolveTokenPath = () => (typeof opts.emitTokens === 'string' ? opts.emitTokens : defaultTokenPath());

function emitTokensCss() {
  const L = [':root {', '  /* Anthropic brand tokens — generato da design-compliance. Non modificare a mano. */'];
  for (const c of BRAND_PALETTE) L.push(`  --color-${c.name}: ${c.hex};`);
  L.push(`  --font-heading: "${brand.typography.headings.family}", ${brand.typography.headings.fallback};`);
  L.push(`  --font-body: "${brand.typography.body.family}", ${brand.typography.body.fallback};`);
  L.push('}');
  return L.join('\n') + '\n';
}

// ---- run --------------------------------------------------------------------
const files = collectFiles(opts.paths);
if (opts.close) runCloseMode();
else if (opts.fix) runFixMode();
else if (opts.emitTokens) runEmitTokensOnly();
else runReportMode();

// ---- modes ------------------------------------------------------------------
function scanAllFromDisk() {
  const per = new Map();
  for (const file of files) { try { per.set(file, { raw: readFileSync(file, 'utf8'), }); } catch {} }
  const all = [];
  for (const [file, { raw }] of per) all.push(...scanFile(file, raw));
  return all;
}

function runReportMode() {
  const all = scanAllFromDisk();
  const minRank = SEVERITY_RANK[opts.minSeverity] || 1;
  const filtered = all
    .filter((v) => SEVERITY_RANK[v.severity] >= minRank)
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  const summary = { error: 0, warning: 0, info: 0 };
  for (const v of filtered) summary[v.severity]++;
  const result = {
    scannedFiles: files.length, total: filtered.length, summary,
    byDimension: tally(filtered, 'dimension'),
    violations: filtered.map((v) => ({ file: relativeSafe(v.file), line: v.line, dimension: v.dimension, severity: v.severity, rule: v.rule, message: v.message, suggestion: v.suggestion, fixable: !!v.fix })),
  };
  emit(opts.format === 'json' ? JSON.stringify(result, null, 2) : renderMarkdown(result));
  process.exit(summary.error > 0 ? 1 : 0);
}

function runFixMode() {
  const includeRisky = opts.unsafe;
  if (opts.dryRun) {
    // simula in memoria, converge, mostra l'aggregato
    const sim = simulateConverge(includeRisky);
    emit(renderFixMarkdown(sim.changesByFile, sim.totalApplied, includeRisky, sim.notFixable, sim.iterations));
    process.exit(0);
  }
  const { changesByFile, iterations } = iterativeFix(files, includeRisky, true);
  const totalApplied = [...changesByFile.values()].reduce((s, a) => s + a.length, 0);
  const notFixable = scanAllFromDisk().filter((v) => !v.fix || (!includeRisky && v.fix.risky)).length;
  emit(renderFixMarkdown(changesByFile, totalApplied, includeRisky, notFixable, iterations));
  process.exit(0);
}

function runEmitTokensOnly() {
  const css = emitTokensCss();
  const tokenPath = resolveTokenPath();
  if (opts.dryRun) { emit('# design-tokens.css (anteprima)\n\n```css\n' + css + '```'); process.exit(0); }
  writeFileSync(tokenPath, css);
  emit(`✅ Design token scritti in \`${relativeSafe(resolve(tokenPath))}\` (${BRAND_PALETTE.length} colori + 2 font).`);
  process.exit(0);
}

function runCloseMode() {
  const includeRisky = true; // close = massimo effort
  const initial = scanAllFromDisk();
  const initialSummary = countBy(initial);

  const sim = simulateConverge(includeRisky);              // anteprima sempre calcolata
  const tokenPath = resolveTokenPath();

  let remaining;
  if (opts.dryRun) {
    remaining = sim.remaining;                              // dal contenuto simulato
  } else {
    iterativeFix(files, includeRisky, true);                // scrive i fix
    writeFileSync(tokenPath, emitTokensCss());              // scrive i token
    remaining = scanAllFromDisk();                          // ri-scansione reale
  }
  const remSummary = countBy(remaining);
  const score = complianceScore(remaining);
  const out = opts.format === 'json'
    ? JSON.stringify({ mode: opts.dryRun ? 'dry-run' : 'apply', score, iterations: sim.iterations,
        applied: sim.totalApplied, initial: initialSummary, remaining: remSummary,
        tokensFile: relativeSafe(resolve(tokenPath)),
        humanDecisions: groupHuman(remaining) }, null, 2)
    : renderCloseMarkdown({ score, sim, initialSummary, remaining, remSummary, tokenPath });
  emit(out);
  process.exit(remSummary.error > 0 ? 1 : 0);
}

// Simula la convergenza in memoria (nessuna scrittura) e calcola il residuo.
function simulateConverge(includeRisky) {
  const MAX = 12;
  const content = new Map();
  for (const f of files) { try { content.set(f, readFileSync(f, 'utf8')); } catch {} }
  const changesByFile = new Map();
  let iterations = 0;
  for (; iterations < MAX; iterations++) {
    let any = false;
    for (const [file, raw] of content) {
      const { out, applied } = applyFixes(raw, scanFile(file, raw), includeRisky);
      if (applied.length) {
        any = true; content.set(file, out);
        const arr = changesByFile.get(file) || [];
        arr.push(...applied.map((a) => ({ ...a, iteration: iterations + 1 })));
        changesByFile.set(file, arr);
      }
    }
    if (!any) break;
  }
  const remaining = [];
  for (const [file, raw] of content) remaining.push(...scanFile(file, raw));
  const totalApplied = [...changesByFile.values()].reduce((s, a) => s + a.length, 0);
  const notFixable = remaining.filter((v) => !v.fix || (!includeRisky && v.fix.risky)).length;
  return { changesByFile, iterations, totalApplied, remaining, notFixable };
}

// ---- scoring & grouping -----------------------------------------------------
function countBy(list) { const s = { error: 0, warning: 0, info: 0 }; for (const v of list) s[v.severity]++; return s; }
function complianceScore(remaining) {
  const w = { error: 8, warning: 3, info: 1 };
  const penalty = remaining.reduce((s, v) => s + (w[v.severity] || 1), 0);
  return Math.max(0, 100 - Math.min(100, penalty));
}
function groupHuman(remaining) {
  const g = {};
  for (const v of remaining) {
    g[v.rule] = g[v.rule] || { rule: v.rule, dimension: v.dimension, severity: v.severity, count: 0, hint: v.suggestion || v.message };
    g[v.rule].count++;
  }
  return Object.values(g).sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}

// ---- output -----------------------------------------------------------------
function emit(out) {
  if (opts.report) { writeFileSync(opts.report, out); process.stderr.write(`Report scritto in ${opts.report}\n`); }
  process.stdout.write(out + '\n');
}
function relativeSafe(f) { try { return relative(process.cwd(), f) || f; } catch { return f; } }
function tally(list, key) { const t = {}; for (const v of list) t[v[key]] = (t[v[key]] || 0) + 1; return t; }

function renderMarkdown(r) {
  const L = [];
  L.push('# Report compliance — Claude Design', '');
  L.push(`File analizzati: **${r.scannedFiles}** · Violazioni: **${r.total}** (❌ ${r.summary.error} · ⚠️ ${r.summary.warning} · ℹ️ ${r.summary.info})`, '');
  if (r.total === 0) { L.push('✅ Nessuna violazione rilevata. Compliance OK.'); return L.join('\n'); }
  L.push('### Per dimensione');
  for (const [dim, n] of Object.entries(r.byDimension)) L.push(`- ${DIM_LABEL[dim] || dim}: ${n}`);
  L.push('');
  let cur = null;
  for (const v of r.violations) {
    if (v.file !== cur) { cur = v.file; L.push(`\n### \`${v.file}\``); }
    const tag = v.fixable ? ' 🔧' : '';
    const sugg = v.suggestion ? ` — _${v.suggestion}_` : '';
    L.push(`- ${ICON[v.severity]} **L${v.line}** [${DIM_LABEL[v.dimension] || v.dimension} · ${v.rule}]${tag} ${v.message}${sugg}`);
  }
  L.push('', '> 🔧 = auto-fixabile. `--fix` (sicuri) · `--fix --unsafe` (anche rischiosi) · `--close` (chiudi il progetto). Anteprima: `--dry-run`.');
  return L.join('\n');
}

function renderFixMarkdown(changesByFile, applied, includeRisky, notFixable, iterations) {
  const L = [];
  const mode = opts.dryRun ? 'ANTEPRIMA (dry-run, nessun file scritto)' : 'APPLICATO (file modificati)';
  L.push(`# Auto-fix compliance — ${mode}`, '');
  L.push(`Modalita': **${includeRisky ? 'sicuri + rischiosi' : 'solo sicuri'}** · Iterazioni: **${iterations}** · Correzioni: **${applied}** · Non auto-fixabili: **${notFixable}**`);
  if (applied === 0) { L.push('\nNessuna correzione applicabile con questa modalita\'.'); return L.join('\n'); }
  for (const [file, list] of changesByFile) {
    L.push(`\n### \`${relativeSafe(file)}\``);
    for (const f of list) L.push(`- **L${f.line}** [${f.rule}]${f.risky ? ' ⚠️rischioso' : ''}  \`${f.before}\` → \`${f.replacement}\``);
  }
  if (notFixable > 0) L.push(`\n> ${notFixable} violazioni restano da gestire a mano (heading order, aria-label, !important, contrasto fra colori fuori-brand).`);
  if (opts.dryRun) L.push('\n> Anteprima: rilancia senza `--dry-run` per scrivere le modifiche.');
  return L.join('\n');
}

function renderCloseMarkdown({ score, sim, initialSummary, remaining, remSummary, tokenPath }) {
  const L = [];
  const mode = opts.dryRun ? 'ANTEPRIMA (dry-run)' : 'ESEGUITO';
  const initTot = initialSummary.error + initialSummary.warning + initialSummary.info;
  L.push(`# Chiusura progetto — Compliance ${mode}`, '');
  const verdict = remSummary.error === 0
    ? '✅ **Ship-ready**: nessun errore bloccante. Restano solo rifiniture/decisioni di design.'
    : `⚠️ **Non ancora ship-ready**: ${remSummary.error} errori richiedono una decisione umana.`;
  L.push(`## Punteggio compliance: ${score}/100`, '', verdict, '');
  L.push(`- Iterazioni fino a convergenza: **${sim.iterations}**`);
  L.push(`- Correzioni applicate automaticamente: **${sim.totalApplied}**`);
  L.push(`- Violazioni iniziali: **${initTot}** → residue: **${remaining.length}** (❌ ${remSummary.error} · ⚠️ ${remSummary.warning} · ℹ️ ${remSummary.info})`);
  L.push(`- Design token generati: \`${relativeSafe(resolve(tokenPath))}\`${opts.dryRun ? ' _(verrebbe scritto)_' : ''}`);
  L.push('');
  L.push('> Importa i token una volta sola, es. in CSS: `@import "./design-tokens.css";` — così tutti i `var(--color-…)` risolvono.');

  const human = groupHuman(remaining);
  if (human.length === 0) {
    L.push('', '## 🎉 Niente da decidere a mano: progetto pienamente compliant.');
  } else {
    L.push('', '## Da chiudere a mano (decisioni umane)');
    for (const h of human) {
      L.push(`- ${ICON[h.severity]} **${h.rule}** ×${h.count} [${DIM_LABEL[h.dimension] || h.dimension}] — ${h.hint}`);
    }
  }
  if (opts.dryRun) L.push('', '> Anteprima: rilancia senza `--dry-run` per scrivere fix + token.');
  return L.join('\n');
}

function printHelp() {
  process.stdout.write(`design-compliance scanner + fixer + closer
Usage: node compliance-check.mjs [path...] [--diff] [--format markdown|json]
       [--severity error|warning|info] [--report FILE]
       [--fix] [--unsafe] [--dry-run] [--emit-tokens [FILE]] [--close]
`);
}
