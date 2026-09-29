#!/usr/bin/env node
// H6 (tasks/passive-tree-todo.md), spec-tree-review.md §5.1-§5.4.
//
// Renders ONE reviewable HTML card per passive tree — the artifact §5 says a reviewer must be able
// to judge in ~90 seconds. Imports the SHIPPED `formatMagnitude` contract directly (§5.4: "one
// implementation of the magnitude contract, not two" — a second renderer in Python or C# would be
// a second source of truth for how a number reaches a person, the exact defect
// `gk-data/packs/fusion/data/seed/derived-stats/catalog.json`'s `_meta` already refuses for channel expansion).
//
// Offline by construction (H6 verification: "a card renders from a fixture corpus with no
// network"): every input is a local file this process reads with node:fs. No fetch, no XHR, no
// WebSocket, anywhere in this file — `--fixtures`/`--anchor-dir` let a test point both loaders at a
// synthetic corpus instead of the committed one, which is what makes that offline proof possible
// before the real 35,280-node corpus exists (D51, 2026-09-06: 24 statuses, not 21 -- was 35,160;
// H9's generation is partial -- 379/480 primary-tree nodes exist -- and its bind+commit step has
// not run for any tree, as of this writing).
//
// Two documented extension points this script depends on but does not itself produce — named here
// so they are not rediscovered as a surprise mid-build:
//
//  1. `atom.previewMagnitude` (a `Magnitude`) — `tree-catalog` §1/§2.3 is explicit that the baked
//     catalog stores a `kMicro` COEFFICIENT and "there is no magnitude among them": resolving it
//     against `P(Θ)`/`Θ` is a `PowerLadder` read that belongs to C# ("one power ladder, no private
//     curves" — AGENTS.md, decisions.md). This script never evaluates that itself; it only formats
//     a `Magnitude` the generator already attached for review purposes. A node whose atom carries no
//     `previewMagnitude` renders its name/flavor with a note instead of a fabricated number.
//  2. `quotaCellProxy` — the tree-language quota cell is `(nodeClass, trigger, element, status,
//     channelFamily, exclusionForm)` (spec-tree-language.md §4), but `NodeRecord` (spec-tree-catalog
//     §2.2/§2.3) does not carry it as a field — only `nodeClass`, `atoms[].channelId/trigger` and
//     `exclusionForm` are stored. The fingerprint below reconstructs the closest available proxy
//     from those committed fields rather than inventing a channel the catalog does not ship.
//
// The `--verdict` mode's `reason` (on a reject) is written in the exact shape
// `gk-forge/tools/seedsmith/seedsmith/adapters/trees/nodegen/brief.py`'s `render_brief` already accepts as
// `anti_motifs: Sequence[str]` (§5.2 rule 6) — reading `_review/<lot>.json` into that sequence is
// `species-tree`'s wiring to do, not this script's; verified compatible here, not wired here.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
// Node ships `zlib.crc32` (stable since Node 21) — the one non-node:fs, non-formatMagnitude
// dependency of this file, used only to keep the MinHash signature below deterministic across
// processes (see §2's comment on why crc32 rather than a language-default string hash).
import { crc32 as zlibCrc32 } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatMagnitude } from "../src/i18n/magnitude.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..", "..");

export const DEFAULT_CATALOG_DIR = path.join(repoRoot, "data", "generated", "passive-tree");
export const DEFAULT_ANCHOR_DIR = path.join(repoRoot, "data", "seed", "creatures", "species");
export const DEFAULT_REVIEW_DIR = path.join(repoRoot, "data", "seed", "passive-tree", "_review");
//: H7's own path (spec-tree-review.md "Project structure": "docs/research/passive-tree/_review/
//: <lot>/sheet.html — the corpus sheet - COMMITTED"). The `sheet.json` sidecar
//: `adapters.trees.review.census_gate` reads (Python side) lives beside it, same directory.
export const DEFAULT_SHEET_DIR = path.join(repoRoot, "docs", "research", "passive-tree", "_review");

// ===========================================================================
// 1. Loading a lot — the concrete catalog (or a fixture directory shaped
//    exactly like it) plus, for a species tree, its anchor's `reason`/`traits`.
// ===========================================================================

/** Every `.json` file directly under `dir`, plus every one under `dir/species/` (the two shipped
 * locations — spec-tree-binder.md:741, spec-species-tree.md:545). Mirrors `--trees` when given
 * explicitly instead. Never recurses further, and never reads a `_`-prefixed file (H7 territory —
 * this script counts nothing there; it only must not choke on one sitting beside a real tree file). */
export function listCatalogFiles(catalogDir) {
  const files = [];
  if (!existsSync(catalogDir)) return files;
  for (const entry of readdirSync(catalogDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".json") && !entry.name.startsWith("_")) {
      files.push(path.join(catalogDir, entry.name));
    }
  }
  const speciesDir = path.join(catalogDir, "species");
  if (existsSync(speciesDir)) {
    for (const entry of readdirSync(speciesDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".json") && !entry.name.startsWith("_")) {
        files.push(path.join(speciesDir, entry.name));
      }
    }
  }
  return files;
}

/** One tree record, validated just enough to fail loudly on a shape this script cannot render
 * (never a silent default — the load-path discipline `tree-catalog` §6 already uses). */
export function loadTree(filePath) {
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  if (!raw.treeId) throw new Error(`render-tree-cards: ${filePath} has no treeId`);
  if (!Array.isArray(raw.nodes)) throw new Error(`render-tree-cards: ${raw.treeId} has no nodes[]`);
  return raw;
}

export function loadLot(catalogDir, treeIds = null) {
  const files = treeIds
    ? treeIds.map((id) => {
        const direct = path.join(catalogDir, `${id}.json`);
        const species = path.join(catalogDir, "species", `${id}.json`);
        if (existsSync(direct)) return direct;
        if (existsSync(species)) return species;
        throw new Error(`render-tree-cards: no catalog file for tree "${id}" under ${catalogDir}`);
      })
    : listCatalogFiles(catalogDir);
  return files.map(loadTree);
}

/** Species anchors (`gk-data/packs/fusion/data/seed/creatures/species/**`) keyed by `speciesId`, for the `reason`/`traits`
 * panel (§5.2 rule 4). Skips any `_`-prefixed file on purpose — `_needs-review.json`'s stale
 * duplicate (spec-tree-review.md §7) must never win a species id over the indexed copy, and the
 * only safe way to guarantee that here is to never read one. That is `tree-review`'s own
 * `HiddenFileCount` discipline applied at read time, not a substitute for that metric. */
export function loadAnchors(anchorDir) {
  const bySpeciesId = new Map();
  if (!existsSync(anchorDir)) return bySpeciesId;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith("_")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".json")) {
        const parsed = JSON.parse(readFileSync(full, "utf8"));
        const rows = Array.isArray(parsed) ? parsed : [parsed];
        for (const row of rows) {
          if (row && row.speciesId) bySpeciesId.set(row.speciesId, row);
        }
      }
    }
  };
  walk(anchorDir);
  return bySpeciesId;
}

// ===========================================================================
// 2. Fingerprint + nearest siblings (§5.2 rule 5) — MinHash + LSH, the SAME
//    technique `gk-forge/tools/seedsmith/seedsmith/metrics/dedup.py` already ships
//    (shingles -> 32-hash MinHash signature -> 8-band LSH -> Jaccard estimate),
//    applied to a per-TREE composite string instead of dedup's per-NAME one.
//    This is the algorithm the spec names as "already computes... free" — not
//    a third similarity metric, the same one at a different granularity.
// ===========================================================================

const SHINGLE_K = 5;
const NUM_HASHES = 32;
const LSH_BANDS = 8;
const PRIME = 4_294_967_311n;
// The same `(1 + 2i, 1 + 3i)` coefficient family `metrics/dedup.py` derives from a fixed seed
// sequence rather than hand-typing 32 pairs — deterministic across processes and languages alike,
// since it is arithmetic, not a language RNG.
const HASH_COEFFS = Array.from({ length: NUM_HASHES }, (_, i) => [BigInt(1 + 2 * i), BigInt(1 + 3 * i)]);

export function shingles(text) {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (normalized.length < SHINGLE_K) return normalized ? new Set([normalized]) : new Set();
  const out = new Set();
  for (let i = 0; i <= normalized.length - SHINGLE_K; i++) out.add(normalized.slice(i, i + SHINGLE_K));
  return out;
}

// crc32, not a language-default string hash: stable across processes and across languages, which
// is what lets this port agree with `metrics/dedup.py`'s Python crc32-based signatures in shape
// (not in exact numeric value — the two never need to compare bit-for-bit, only each be internally
// deterministic within its own process, which crc32 already guarantees on both sides).
function shingleHash(s) {
  return BigInt(zlibCrc32(Buffer.from(s, "utf8")));
}

export function minhashSignature(shingleSet) {
  if (shingleSet.size === 0) return new Array(NUM_HASHES).fill(0n);
  const hashes = [...shingleSet].map(shingleHash);
  return HASH_COEFFS.map(([a, b]) => {
    let min = null;
    for (const h of hashes) {
      const v = (a * h + b) % PRIME;
      if (min === null || v < min) min = v;
    }
    return min;
  });
}

export function jaccardEstimate(sigA, sigB) {
  let matches = 0;
  for (let i = 0; i < sigA.length; i++) if (sigA[i] === sigB[i]) matches += 1;
  return matches / sigA.length;
}

/** The closest recoverable proxy for tree-language's `quotaCell` out of committed `NodeRecord`
 * fields — see the file header's extension-point note. */
function quotaCellProxy(node) {
  const atom = node.atoms?.[0];
  return [node.nodeClass ?? "?", atom?.channelId ?? "?", atom?.trigger ?? "-", node.exclusionForm ?? "None"].join("/");
}

/** §5.2 rule 5's fingerprint text: node names, chosen affix ids, quota cells — one tree, one string. */
export function treeFingerprintText(tree) {
  const parts = [];
  for (const node of tree.nodes) {
    if (node.name) parts.push(node.name);
    for (const affixId of node.affixIds ?? []) parts.push(affixId);
    parts.push(quotaCellProxy(node));
  }
  return parts.join(" | ");
}

export function treeFingerprint(tree) {
  return minhashSignature(shingles(treeFingerprintText(tree)));
}

/** The `k` nearest OTHER trees by fingerprint, highest similarity first, ties broken by `treeId` so
 * the result is a total function of its inputs — never the tree itself, never a duplicate
 * (`the_sibling_panel_names_three_distinct_trees`). */
export function nearestSiblings(trees, treeId, k = 3) {
  const target = trees.find((t) => t.treeId === treeId);
  if (!target) throw new Error(`render-tree-cards: unknown treeId "${treeId}" in nearestSiblings`);
  const targetSig = treeFingerprint(target);
  return trees
    .filter((t) => t.treeId !== treeId)
    .map((t) => ({ treeId: t.treeId, tree: t, similarity: jaccardEstimate(targetSig, treeFingerprint(t)) }))
    .sort((a, b) => b.similarity - a.similarity || a.treeId.localeCompare(b.treeId))
    .slice(0, k);
}

// ===========================================================================
// 3. Collapsing gate findings to one chip (§5.2 rule 1, §6.4's "FAIL beats
//    NOT_MEASURED" discipline). Vocabulary matches the shipped
//    `metrics/model.py` (`Loop`, `Severity` — GAP / NOTE / NOT_MEASURED; a
//    metric that ran clean emits NO finding at all, so "green" is read from
//    absence, never from a synthesized "pass" the real schema does not have).
// ===========================================================================

/**
 * `gateMetricIds`: every CLOSED-loop, `gates=True` metric this tree was actually checked against —
 * the caller's job to pass, never inferred here (an inferred list could silently shrink and every
 * unchecked gate would read as green, exactly the `NOT_MEASURED`-denies-a-pass failure §6.4 rule 1
 * exists to catch).
 * `findings`: `{ metric, severity: "gap"|"note"|"not_measured", loop: "closed"|"open", subject?, message? }[]`.
 *
 * A CLOSED-loop metric with no finding here collapses into the chip. A CLOSED-loop metric that DID
 * report — `gap` (a real failure) or `not_measured` — gets its own line, never hidden: this module
 * never lets a lot look clean by omission. Every OPEN-loop finding gets its own line unconditionally
 * — an OPEN metric never resolves to a boolean at all, so it never has a "clean" state to collapse
 * into (`Quality/FlavourGeneric`'s own contract, spec-tree-review.md §4.3).
 */
export function collapseFindings(gateMetricIds, findings = []) {
  const lines = [];
  const flaggedGateIds = new Set();
  for (const f of findings) {
    const loop = (f.loop ?? "closed").toLowerCase();
    if (loop === "open") {
      lines.push(f);
      continue;
    }
    // closed loop
    if (f.severity === "gap" || f.severity === "not_measured") {
      lines.push(f);
      if (gateMetricIds.includes(f.metric)) flaggedGateIds.add(f.metric);
    }
    // a closed-loop `note` (informational, not a gate failure) stays folded into the chip.
  }
  const greenCount = gateMetricIds.filter((id) => !flaggedGateIds.has(id)).length;
  return { greenCount, totalGates: gateMetricIds.length, lines };
}

// ===========================================================================
// 4. The card — §5.1's layout, rendered through formatMagnitude (rule 3).
// ===========================================================================

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** One node's display line: its name, its magnitude (if a `previewMagnitude` was attached — see the
 * file header's extension-point note), a `*` for a mechanism node (§5.1's own legend), and `[excl]`
 * when it carries an exclusion. Never a raw channel id — `formatMagnitude` or nothing. */
function renderNodeCell(node) {
  const mechMark = node.nodeClass === "Mechanism" ? "* " : "";
  const exclMark = node.exclusionForm && node.exclusionForm !== "None" ? ' <span class="excl">[excl]</span>' : "";
  const atom = node.atoms?.[0];
  let valueText = "";
  if (atom?.previewMagnitude) {
    valueText = ` <span class="mag">${escapeHtml(formatMagnitude(atom.previewMagnitude))}</span>`;
  } else if (node.nodeClass !== "Mechanism") {
    valueText = ` <span class="mag mag-pending">(no preview value)</span>`;
  }
  const retired = node.enabled === false ? ' <span class="retired">[retired]</span>' : "";
  return `<span class="tier">t${node.tier}</span> ${mechMark}<span class="node-name">${escapeHtml(node.name ?? node.nodeId)}</span>${valueText}${exclMark}${retired}`;
}

/** Two columns (off/def), each holding that branch's own nodes in (tier, nodeKey) order — the
 * "40 per tree, 20 per branch" invariant every archetype shares (spec-tree-catalog.md §2.2,
 * spec-tree-binder.md's per-archetype widths all sum to 20/branch). Rows are zipped by index so a
 * branch mismatch (a malformed fixture) still renders instead of throwing mid-card. */
export function renderLattice(tree) {
  const byBranch = (branch) =>
    tree.nodes
      .filter((n) => n.branch === branch)
      .sort((a, b) => a.tier - b.tier || String(a.nodeKey).localeCompare(String(b.nodeKey)));
  const off = byBranch("Off");
  const def = byBranch("Def");
  const rowCount = Math.max(off.length, def.length);
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push(`<tr><td>${off[i] ? renderNodeCell(off[i]) : ""}</td><td>${def[i] ? renderNodeCell(def[i]) : ""}</td></tr>`);
  }
  return { rowCount, offCount: off.length, defCount: def.length, html: rows.join("\n") };
}

function renderSiblingPanel(siblings) {
  if (siblings.length === 0) return `<p class="siblings">NEAREST SIBLINGS &nbsp; (none in this lot)</p>`;
  const text = siblings.map((s) => `${escapeHtml(s.treeId)} ${(s.similarity * 100).toFixed(0)}%`).join(" &middot; ");
  return `<p class="siblings">NEAREST SIBLINGS &nbsp; ${text}</p>`;
}

function renderFindingsPanel(collapsed) {
  const chip = `<span class="chip-green">${collapsed.greenCount} green</span>`;
  if (collapsed.lines.length === 0) {
    return `<p class="findings">${chip} &middot; nothing needs a person</p>`;
  }
  const items = collapsed.lines
    .map((f) => `<li>[${escapeHtml((f.loop ?? "closed").toUpperCase())}/${escapeHtml(f.severity)}] ${escapeHtml(f.metric)} — ${escapeHtml(f.message ?? "")}</li>`)
    .join("\n");
  return `<p class="findings">${chip} &middot; ${collapsed.lines.length} need${collapsed.lines.length === 1 ? "s" : ""} a person</p><ul class="findings-list">${items}</ul>`;
}

function renderVerdictControl(lot, treeId) {
  // No live network, no server behind this card (H6 verification: "no network"). The buttons are
  // labelled with the exact `--verdict` invocation a reviewer runs after judging the card — the
  // persistence step §5.2 rule 6 requires still happens through this same script, in its CLI mode.
  const base = `node scripts/render-tree-cards.mjs --verdict --lot ${lot} --tree ${treeId} --by <you>`;
  return `<div class="verdict">
  <p>NEEDS A DECISION</p>
  <code>${escapeHtml(base)} --status accept</code>
  <code>${escapeHtml(base)} --status reject --reason "&lt;why&gt;"</code>
  <code>${escapeHtml(base)} --status owner --reason "&lt;question&gt;"</code>
</div>`;
}

const CARD_STYLE = `
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #1a1a1a; background: #fafafa; }
  .card { max-width: 960px; margin: 0 auto; border: 1px solid #ccc; border-radius: 8px; padding: 1.5rem; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #333; padding-bottom: .5rem; }
  .anchor { background: #f4f4f4; padding: .75rem 1rem; border-radius: 4px; margin: 1rem 0; }
  .anchor .traits { color: #555; font-size: .9rem; }
  table.lattice { width: 100%; border-collapse: collapse; margin: 1rem 0; }
  table.lattice td { padding: .25rem .5rem; border-bottom: 1px solid #eee; font-size: .92rem; vertical-align: top; }
  .tier { color: #888; font-family: monospace; margin-right: .35rem; }
  .mag { font-weight: 600; }
  .mag-pending { font-weight: 400; font-style: italic; color: #999; }
  .excl { color: #b45309; font-size: .8rem; }
  .retired { color: #999; font-size: .8rem; text-decoration: line-through; }
  .siblings { background: #eef2ff; padding: .5rem .75rem; border-radius: 4px; }
  .findings { font-weight: 600; }
  .chip-green { background: #dcfce7; color: #166534; padding: .1rem .5rem; border-radius: 999px; }
  .findings-list { font-size: .9rem; }
  .verdict code { display: block; background: #111; color: #eee; padding: .35rem .5rem; margin: .25rem 0; border-radius: 4px; overflow-x: auto; }
`;

/**
 * One card, one screen, no scrolling (§5.1). `lot` names the review lot this card belongs to, so
 * the verdict commands it prints are already correct — never a placeholder a reviewer has to edit.
 */
export function renderCard(tree, { siblings = [], anchor = null, collapsedFindings = { greenCount: 0, totalGates: 0, lines: [] }, lot = "unnamed" } = {}) {
  const lattice = renderLattice(tree);
  const anchorHtml = anchor
    ? `<div class="anchor"><p>"${escapeHtml(anchor.reason)}"</p><p class="traits">traits: ${(anchor.traits ?? []).map(escapeHtml).join(" &middot; ")}</p></div>`
    : "";
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(tree.treeId)} — tree review card</title><style>${CARD_STYLE}</style></head>
<body>
<div class="card" data-tree-id="${escapeHtml(tree.treeId)}" data-lot="${escapeHtml(lot)}">
  <div class="header">
    <h1>${escapeHtml(tree.treeId)}</h1>
    <span>${escapeHtml(tree.category ?? "")} &middot; ${lattice.offCount + lattice.defCount}/40</span>
  </div>
  ${anchorHtml}
  <table class="lattice">
    <thead><tr><th>OFFENSIVE</th><th>DEFENSIVE</th></tr></thead>
    <tbody>
${lattice.html}
    </tbody>
  </table>
  ${renderSiblingPanel(siblings)}
  ${renderFindingsPanel(collapsedFindings)}
  ${renderVerdictControl(lot, tree.treeId)}
</div>
</body>
</html>`;
}

// ===========================================================================
// 5. The verdict control (§5.2 rule 6) — writes data, not prose.
// ===========================================================================

const VALID_STATUSES = new Set(["accept", "reject", "owner"]);

/** Appends one verdict row to `data/seed/passive-tree/_review/<lot>.json` (committed, per §5.6 —
 * this is the one file this whole program writes that is NOT regenerated). Append-only: a review
 * that produces no machine-readable artifact cannot be measured (§5.2 rule 6's own reasoning), so
 * this never overwrites a prior entry for the same tree — a re-review is a new row, and the file's
 * own history is the review's history. */
/** `{lot, entries: [...], sheetReads: [...]}`, read from `<reviewDir>/<lot>.json` — the ONE file
 * both H6's verdict rows and H7's `sheetRead` acknowledgments live in (spec-tree-review.md §5.5's
 * own resolved ambiguity: a companion KEY in the same file, never a second file format). Missing
 * file reads as the empty shape, never an error — the same "no file yet" tolerance `appendVerdict`
 * already had before `sheetReads` existed. */
export function loadReviewDoc(reviewDir, lot) {
  const file = path.join(reviewDir, `${lot}.json`);
  if (!existsSync(file)) return { lot, entries: [], sheetReads: [] };
  const doc = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(doc.entries)) doc.entries = [];
  if (!Array.isArray(doc.sheetReads)) doc.sheetReads = [];
  return doc;
}

export function appendVerdict(reviewDir, lot, entry) {
  if (!VALID_STATUSES.has(entry.status)) {
    throw new Error(`render-tree-cards: status must be one of ${[...VALID_STATUSES].join("/")}, got "${entry.status}"`);
  }
  if (entry.status === "reject" && !entry.reason) {
    throw new Error("render-tree-cards: a reject verdict must name a reason (§6.1 — a rejection names the rule)");
  }
  if (!entry.treeId) throw new Error("render-tree-cards: a verdict must name a treeId");
  mkdirSync(reviewDir, { recursive: true });
  const file = path.join(reviewDir, `${lot}.json`);
  const doc = loadReviewDoc(reviewDir, lot);
  doc.lot = lot;
  doc.entries.push({
    treeId: entry.treeId,
    status: entry.status,
    reason: entry.reason ?? null,
    by: entry.by ?? "unknown",
    utc: entry.utc ?? new Date().toISOString()
  });
  writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  return file;
}

/** Appends one `{lot, sheetRevision, by, utc}` row (§5.5's exact shape) — written when a reviewer
 * DISMISSES the corpus sheet, never on render. Append-only, matching `appendVerdict`'s own
 * discipline: the LATEST row is the current acknowledgment, and the file's history is the
 * dismissal history. `gk-forge/tools/seedsmith`'s `trees review --census` reads this same file to decide
 * whether a census may start (spec-tree-review.md §5.5; `adapters.trees.review.census_gate`). */
export function appendSheetRead(reviewDir, lot, entry) {
  if (!entry.sheetRevision) {
    throw new Error("render-tree-cards: a sheetRead row must name a sheetRevision");
  }
  mkdirSync(reviewDir, { recursive: true });
  const file = path.join(reviewDir, `${lot}.json`);
  const doc = loadReviewDoc(reviewDir, lot);
  doc.lot = lot;
  doc.sheetReads.push({
    lot,
    sheetRevision: entry.sheetRevision,
    by: entry.by ?? "unknown",
    utc: entry.utc ?? new Date().toISOString()
  });
  writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  return file;
}

function contentHashSlug(text) {
  return createHash("sha1").update(text).digest("hex").slice(0, 8);
}

// ===========================================================================
// 6. The corpus sheet (task H7, spec-tree-review.md §5.5) — one page for the
//    WHOLE lot, read BEFORE the tree cards (§5.5's own ordering). Every panel
//    below either reuses data already sitting on the loaded catalog (name
//    tokens, the exclusion census, the sibling fingerprint, the review queue)
//    or accepts an EXTERNALLY-COMPUTED artifact from the metric/gate that
//    already owns it (quota cells from H3/H4, the machine verdict from
//    `nodegen/verdict.py`'s RunReport, the hidden-file census from
//    `metrics/passive_tree.py`'s HiddenFileCountMetric) — never a second,
//    JS-side re-derivation of a Python-owned computation (the same "one
//    implementation, not two" rule §5.4 states for `formatMagnitude`). A
//    panel with no supplied input reports itself unavailable rather than
//    fabricating a number.
// ===========================================================================

const STOPWORDS = new Set(["the", "a", "an", "of", "to", "and", "or", "for", "in", "on", "with", "its", "it"]);

/** ⭐ H5 at corpus scale (§5.5): the 50 commonest tokens across every node name in the lot, each
 * with how many DISTINCT trees it appears in — "if `wrath` appears in 300 trees, the census is
 * premature." Tokenized the same way a reviewer reads a name: lowercase, split on non-alphanumerics,
 * short stopwords dropped. */
export function nameTokenFrequency(trees, topN = 50) {
  const byToken = new Map(); // token -> { count, trees: Set<treeId> }
  for (const tree of trees) {
    for (const node of tree.nodes) {
      const tokens = String(node.name ?? "").toLowerCase().split(/[^a-z0-9]+/)
        .filter((t) => t.length > 1 && !STOPWORDS.has(t));
      for (const token of tokens) {
        const entry = byToken.get(token) ?? { token, count: 0, trees: new Set() };
        entry.count += 1;
        entry.trees.add(tree.treeId);
        byToken.set(token, entry);
      }
    }
  }
  return [...byToken.values()]
    .map((e) => ({ token: e.token, count: e.count, treeCount: e.trees.size }))
    .sort((a, b) => b.count - a.count || a.token.localeCompare(b.token))
    .slice(0, topN);
}

/** Tier 1's own population, laid out in one list (§5.5, §6.4 rule 8's companion): every node
 * carrying a non-`None` `exclusionForm`, its form, its property keys and its printed text — read
 * straight off the committed `NodeRecord` (spec-tree-catalog.md §2.2), never recomputed. This is
 * the census POPULATION, not a judgement of it — whether each one PASSES the presentation contract
 * is `PassiveTree/ExclusionPresentation`'s job (§6.4 rule 2), not this panel's. */
export function exclusionCensus(trees) {
  const rows = [];
  for (const tree of trees) {
    for (const node of tree.nodes) {
      const form = node.exclusionForm ?? "None";
      if (form === "None") continue;
      rows.push({
        treeId: tree.treeId,
        nodeId: node.nodeId ?? node.id ?? "?",
        form,
        propertyKeys: node.excludeProps ?? [],
        printedText: node.printedText ?? null
      });
    }
  }
  return rows;
}

/** "Is the 166x failure back?" (§5.5) — the (aptitude x element) quota grid. **Not derivable from
 * the committed catalog alone**: `NodeRecord` does not persist the four quota-cell axes (the
 * wiring gap `metrics/passive_tree.py`'s own module docstring names — "the day a generation run
 * persists quotaCell onto the node record itself, this ctx field is filled from the committed
 * corpus directly"). Until then, this panel is opt-in: pass `quotaCellsByTree` (the SAME
 * `{treeId: {nodeId: QuotaCell}}` shape H3/H4 already compute) to populate it, or the sheet
 * reports the gap by name rather than a fabricated zero grid. */
export function quotaHeatMap(trees, quotaCellsByTree = null) {
  if (!quotaCellsByTree) {
    return {
      available: false,
      reason: "quota-cell axes are not persisted on the committed NodeRecord (spec-tree-catalog.md "
        + "§2.2's own wiring-gap note, restated in metrics/passive_tree.py) — supply "
        + "--quota-cells <path> (H3/H4's own quota_cells_by_tree dump) to populate this panel"
    };
  }
  const counts = new Map(); // "aptitude|element" -> count
  for (const tree of trees) {
    const cells = quotaCellsByTree[tree.treeId];
    if (!cells) continue;
    for (const node of tree.nodes) {
      const cell = cells[node.nodeId ?? node.id];
      if (!cell) continue;
      const key = `${cell.aptitude ?? cell.trigger ?? "?"}|${cell.element ?? "?"}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return {
    available: true,
    cells: [...counts.entries()]
      .map(([key, count]) => {
        const [aptitude, element] = key.split("|");
        return { aptitude, element, count };
      })
      .sort((a, b) => b.count - a.count)
  };
}

/** The 20 most similar tree pairs, corpus-wide — H6's OWN MinHash fingerprint
 * (`treeFingerprint`/`jaccardEstimate`, §2 above) reused at (n choose 2) pairs instead of per-tree
 * top-3. "The worst sameness offenders, named" (§5.5) — this is the panel that decides whether the
 * census is worth starting at all, before a single card is opened. */
export function nearestNeighbourTopPairs(trees, topN = 20) {
  const sigs = trees.map((t) => ({ treeId: t.treeId, sig: treeFingerprint(t) }));
  const pairs = [];
  for (let i = 0; i < sigs.length; i++) {
    for (let j = i + 1; j < sigs.length; j++) {
      pairs.push({ a: sigs[i].treeId, b: sigs[j].treeId, similarity: jaccardEstimate(sigs[i].sig, sigs[j].sig) });
    }
  }
  return pairs
    .sort((x, y) => y.similarity - x.similarity || `${x.a}|${x.b}`.localeCompare(`${y.a}|${y.b}`))
    .slice(0, topN);
}

/** "When to stop and reprompt" (§5.5) — the rejection rate against the review queue's own history,
 * reused verbatim from `_review/<lot>.json` (H6's own file), never a separate counter. Only the
 * LATEST verdict per tree counts (a re-review supersedes, matching §8's "a reviewer judges a
 * change... never as an isolated line" for the vote itself, not only for the diff card). */
export function rejectionSummary(reviewDir, lot, totalTrees) {
  const doc = loadReviewDoc(reviewDir, lot);
  const latestByTree = new Map();
  for (const entry of doc.entries) latestByTree.set(entry.treeId, entry.status);
  let accepted = 0, rejected = 0, owner = 0;
  for (const status of latestByTree.values()) {
    if (status === "accept") accepted += 1;
    else if (status === "reject") rejected += 1;
    else if (status === "owner") owner += 1;
  }
  const reviewed = latestByTree.size;
  return {
    reviewed, accepted, rejected, owner, totalTrees,
    rejectionSharePermille: reviewed ? Math.round((rejected * 1000) / reviewed) : 0
  };
}

function loadJsonIfPresent(filePath) {
  if (!filePath || !existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

/** The machine verdict panel (§5.5): "every gate PASS/FAIL/NOT_MEASURED, plus
 * `missing_thresholds` — a gate with no number is visible BEFORE the run." Reused, never
 * re-derived: `runReportPath` is `nodegen/verdict.py`'s own `RunReport.to_dict()` (§7 gate 23's
 * machinery, already built in H1/H2), dumped to JSON by whatever caller ran it, with
 * `missingThresholds` appended alongside (`missing_thresholds_report`'s own output). Absent input
 * renders as "not measured," never a synthesized pass. */
export function machineVerdictSummary(runReportPath) {
  const report = loadJsonIfPresent(runReportPath);
  if (!report) return { available: false };
  return {
    available: true,
    verdict: report.verdict ?? "not_measured",
    heldPartitions: report.heldPartitions ?? [],
    metrics: report.metrics ?? [],
    missingThresholds: report.missingThresholds ?? []
  };
}

/** The hidden-file census (§5.5, §7): reused from `PassiveTree/HiddenFileCountMetric`'s own
 * findings (`metrics/passive_tree.py`), dumped to JSON by whatever caller ran it —
 * `hiddenFileReportPath` is that finding LIST, never recomputed here (this script does not walk
 * seed roots; that is the metric's own job, in Python, over the real seed tree). Reports
 * `visitedFileCount` explicitly, mirroring the metric's own "a green that visited nothing and a
 * green that visited forty empty files are different facts" discipline. */
export function hiddenFileSummary(hiddenFileReportPath) {
  const findings = loadJsonIfPresent(hiddenFileReportPath);
  if (!findings) return { available: false };
  const note = findings.find((f) => String(f.severity ?? "").toLowerCase() === "note");
  const parked = findings.filter((f) => String(f.severity ?? "").toLowerCase() === "gap");
  return {
    available: true,
    visitedFileCount: note?.evidence?.visitedFileCount ?? null,
    parked: parked.map((f) => ({
      path: f.evidence?.path ?? f.subject ?? "?",
      entryCount: f.evidence?.entryCount ?? null
    }))
  };
}

/** The `sheetRevision` (§5.5): "the `catalog_revision` pair it was rendered from, plus a hash of
 * its own inputs." Every input that changes what a reviewer would SEE on the sheet is folded in —
 * the loaded tree files (sorted, so file discovery order never matters) and every optional
 * artifact actually supplied. `sheetReads` itself is deliberately EXCLUDED: including the
 * acknowledgment log in the hash the acknowledgment is ABOUT would make dismissing the sheet
 * invalidate the very revision the dismissal just recorded. */
export function computeSheetRevision({ treeFiles, quotaCellsRaw = "", runReportRaw = "", hiddenFileReportRaw = "", reviewEntriesRaw = "" }) {
  const sortedTrees = [...treeFiles].sort((a, b) => a.treeId.localeCompare(b.treeId));
  const parts = [
    ...sortedTrees.map((t) => `tree:${t.treeId}:${t.raw}`),
    `quota:${quotaCellsRaw}`,
    `runReport:${runReportRaw}`,
    `hiddenFile:${hiddenFileReportRaw}`,
    `entries:${reviewEntriesRaw}`
  ];
  return contentHashSlug(parts.join("\n—\n"));
}

const SHEET_STYLE = `
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #1a1a1a; background: #fafafa; }
  .sheet { max-width: 1100px; margin: 0 auto; }
  .panel { background: #fff; border: 1px solid #ccc; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1rem; }
  .panel h2 { margin-top: 0; font-size: 1rem; text-transform: uppercase; letter-spacing: .03em; color: #444; }
  .unavailable { color: #92400e; background: #fffbeb; padding: .5rem .75rem; border-radius: 4px; font-size: .9rem; }
  table.grid { border-collapse: collapse; font-size: .85rem; }
  table.grid td, table.grid th { border: 1px solid #eee; padding: .25rem .5rem; text-align: right; }
  table.grid th { text-align: left; background: #f4f4f4; }
  .token-row { display: flex; justify-content: space-between; font-size: .85rem; padding: .1rem 0; border-bottom: 1px solid #f4f4f4; }
  .verdict-pass { color: #166534; font-weight: 600; }
  .verdict-fail { color: #991b1b; font-weight: 600; }
  .verdict-not_measured { color: #92400e; font-weight: 600; }
`;

function renderPanel(title, bodyHtml) {
  return `<div class="panel"><h2>${escapeHtml(title)}</h2>${bodyHtml}</div>`;
}

function renderQuotaPanel(heat) {
  if (!heat.available) return renderPanel("Quota grid heat map", `<p class="unavailable">${escapeHtml(heat.reason)}</p>`);
  const rows = heat.cells.map((c) => `<tr><td style="text-align:left">${escapeHtml(c.aptitude)}</td><td style="text-align:left">${escapeHtml(c.element)}</td><td>${c.count}</td></tr>`).join("\n");
  return renderPanel("Quota grid heat map", `<table class="grid"><thead><tr><th>Aptitude</th><th>Element</th><th>Count</th></tr></thead><tbody>${rows}</tbody></table>`);
}

function renderTokenPanel(tokens) {
  const rows = tokens.map((t) => `<div class="token-row"><span>${escapeHtml(t.token)}</span><span>${t.count}× in ${t.treeCount} tree(s)</span></div>`).join("\n");
  return renderPanel("Name-token frequency", rows || "<p>(no node names loaded)</p>");
}

function renderExclusionPanel(rows) {
  const body = rows.length
    ? `<table class="grid"><thead><tr><th>Tree</th><th>Node</th><th>Form</th><th>Keys</th><th>Printed text</th></tr></thead><tbody>${
        rows.map((r) => `<tr><td style="text-align:left">${escapeHtml(r.treeId)}</td><td style="text-align:left">${escapeHtml(r.nodeId)}</td><td style="text-align:left">${escapeHtml(r.form)}</td><td style="text-align:left">${escapeHtml(r.propertyKeys.join(", "))}</td><td style="text-align:left">${escapeHtml(r.printedText ?? "")}</td></tr>`).join("\n")
      }</tbody></table>`
    : "<p>(no exclusions in this lot)</p>";
  return renderPanel(`Exclusion census (${rows.length})`, body);
}

function renderSiblingsPanel(pairs) {
  const rows = pairs.map((p) => `<div class="token-row"><span>${escapeHtml(p.a)} ↔ ${escapeHtml(p.b)}</span><span>${(p.similarity * 100).toFixed(0)}%</span></div>`).join("\n");
  return renderPanel("Nearest-neighbour top 20", rows || "<p>(fewer than two trees in this lot)</p>");
}

function renderRejectionPanel(summary) {
  return renderPanel("Rejected so far", `<p>${summary.reviewed}/${summary.totalTrees} trees reviewed — ${summary.accepted} accepted, ${summary.rejected} rejected, ${summary.owner} escalated (${summary.rejectionSharePermille}‰ of reviewed)</p>`);
}

function renderMachineVerdictPanel(mv) {
  if (!mv.available) return renderPanel("Machine verdict", `<p class="unavailable">no run report supplied — pass --run-report &lt;path&gt; (nodegen/verdict.py's RunReport.to_dict())</p>`);
  const metricRows = mv.metrics.map((m) => `<tr><td style="text-align:left">${escapeHtml(m.metric)}</td><td class="verdict-${escapeHtml(m.verdict)}">${escapeHtml(m.verdict)}</td><td style="text-align:left">${escapeHtml(m.detail ?? "")}</td></tr>`).join("\n");
  const missing = mv.missingThresholds.length ? `<p class="unavailable">missing_thresholds: ${mv.missingThresholds.map(escapeHtml).join(", ")}</p>` : "";
  return renderPanel("Machine verdict", `<p class="verdict-${escapeHtml(mv.verdict)}">${escapeHtml(mv.verdict.toUpperCase())}</p>${missing}<table class="grid"><thead><tr><th>Metric</th><th>Verdict</th><th>Detail</th></tr></thead><tbody>${metricRows}</tbody></table>`);
}

function renderHiddenFilePanel(hf) {
  if (!hf.available) return renderPanel("Hidden-file census", `<p class="unavailable">no hidden-file report supplied — pass --hidden-file-report &lt;path&gt; (PassiveTree/HiddenFileCount's own findings)</p>`);
  const parkedHtml = hf.parked.length
    ? `<ul>${hf.parked.map((p) => `<li>${escapeHtml(p.path)}: ${p.entryCount} entr${p.entryCount === 1 ? "y" : "ies"}</li>`).join("\n")}</ul>`
    : "<p>none parked</p>";
  return renderPanel("Hidden-file census", `<p>visited ${hf.visitedFileCount ?? "?"} \`_\`-prefixed file(s)</p>${parkedHtml}`);
}

/**
 * Assembles the whole corpus sheet (§5.5's seven panels) plus its `sheetRevision`. Returns
 * `{ html, sheetRevision }` — the caller (the CLI below) writes both `sheet.html` and the
 * `sheet.json` sidecar the census gate reads (`adapters.trees.review.census_gate`, Python side).
 */
export function renderSheet(trees, {
  lot, treeFiles, quotaCellsByTree = null, quotaCellsRaw = "",
  runReportPath = "", runReportRaw = "", hiddenFileReportPath = "", hiddenFileReportRaw = "",
  reviewDir
} = {}) {
  const tokens = nameTokenFrequency(trees);
  const exclusions = exclusionCensus(trees);
  const siblingPairs = nearestNeighbourTopPairs(trees);
  const rejection = rejectionSummary(reviewDir, lot, trees.length);
  const machineVerdict = machineVerdictSummary(runReportPath);
  const hiddenFile = hiddenFileSummary(hiddenFileReportPath);
  const heat = quotaHeatMap(trees, quotaCellsByTree);
  const reviewDoc = loadReviewDoc(reviewDir, lot);

  const sheetRevision = computeSheetRevision({
    treeFiles, quotaCellsRaw, runReportRaw, hiddenFileReportRaw,
    reviewEntriesRaw: JSON.stringify(reviewDoc.entries)
  });

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(lot)} — corpus sheet</title><style>${SHEET_STYLE}</style></head>
<body>
<div class="sheet" data-lot="${escapeHtml(lot)}" data-sheet-revision="${escapeHtml(sheetRevision)}">
  <h1>${escapeHtml(lot)} — corpus sheet (${trees.length} tree(s))</h1>
  <p>Read this BEFORE the tree cards (spec-tree-review.md §5.5). Revision <code>${escapeHtml(sheetRevision)}</code>.</p>
  ${renderQuotaPanel(heat)}
  ${renderTokenPanel(tokens)}
  ${renderExclusionPanel(exclusions)}
  ${renderSiblingsPanel(siblingPairs)}
  ${renderRejectionPanel(rejection)}
  ${renderMachineVerdictPanel(machineVerdict)}
  ${renderHiddenFilePanel(hiddenFile)}
  <div class="panel">
    <h2>Dismiss this sheet</h2>
    <code>node scripts/render-tree-cards.mjs --sheet-read --lot ${escapeHtml(lot)} --by &lt;you&gt;</code>
  </div>
</div>
</body>
</html>`;

  return { html, sheetRevision };
}

// ===========================================================================
// 7. CLI
// ===========================================================================

function argValue(args, name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

export function run(argv) {
  const args = argv.slice(2);
  const lot = argValue(args, "--lot");
  if (!lot) throw new Error("render-tree-cards: --lot is required");

  if (args.includes("--verdict")) {
    const reviewDir = argValue(args, "--review-dir") ?? DEFAULT_REVIEW_DIR;
    const file = appendVerdict(reviewDir, lot, {
      treeId: argValue(args, "--tree"),
      status: argValue(args, "--status"),
      reason: argValue(args, "--reason"),
      by: argValue(args, "--by")
    });
    console.log(`render-tree-cards --verdict: wrote ${path.relative(repoRoot, file)}`);
    return;
  }

  if (args.includes("--sheet-read")) {
    const reviewDir = argValue(args, "--review-dir") ?? DEFAULT_REVIEW_DIR;
    const sheetDir = argValue(args, "--sheet-dir") ?? DEFAULT_SHEET_DIR;
    const sheetJsonPath = path.join(sheetDir, lot, "sheet.json");
    if (!existsSync(sheetJsonPath)) {
      throw new Error(`render-tree-cards --sheet-read: no sheet rendered for lot "${lot}" — expected ${sheetJsonPath}; run --sheet first`);
    }
    const { sheetRevision } = JSON.parse(readFileSync(sheetJsonPath, "utf8"));
    const file = appendSheetRead(reviewDir, lot, { sheetRevision, by: argValue(args, "--by") });
    console.log(`render-tree-cards --sheet-read: wrote ${path.relative(repoRoot, file)} (sheetRevision ${sheetRevision})`);
    return;
  }

  if (args.includes("--sheet")) {
    const catalogDir = argValue(args, "--catalog-dir") ?? argValue(args, "--fixtures") ?? DEFAULT_CATALOG_DIR;
    const reviewDir = argValue(args, "--review-dir") ?? DEFAULT_REVIEW_DIR;
    const sheetDir = argValue(args, "--sheet-dir") ?? DEFAULT_SHEET_DIR;
    const treesArg = argValue(args, "--trees");
    const treeIds = treesArg ? treesArg.split(",") : null;
    const quotaCellsPath = argValue(args, "--quota-cells") ?? "";
    const runReportPath = argValue(args, "--run-report") ?? "";
    const hiddenFileReportPath = argValue(args, "--hidden-file-report") ?? "";

    const files = treeIds
      ? treeIds.map((id) => {
          const direct = path.join(catalogDir, `${id}.json`);
          const species = path.join(catalogDir, "species", `${id}.json`);
          if (existsSync(direct)) return direct;
          if (existsSync(species)) return species;
          throw new Error(`render-tree-cards --sheet: no catalog file for tree "${id}" under ${catalogDir}`);
        })
      : listCatalogFiles(catalogDir);
    if (files.length === 0) {
      console.error(`render-tree-cards --sheet: no trees found under ${catalogDir}`);
      process.exitCode = 1;
      return;
    }
    const treeFiles = files.map((f) => ({ treeId: loadTree(f).treeId, raw: readFileSync(f, "utf8") }));
    const trees = files.map(loadTree);
    const quotaCellsRaw = quotaCellsPath && existsSync(quotaCellsPath) ? readFileSync(quotaCellsPath, "utf8") : "";
    const runReportRaw = runReportPath && existsSync(runReportPath) ? readFileSync(runReportPath, "utf8") : "";
    const hiddenFileReportRaw = hiddenFileReportPath && existsSync(hiddenFileReportPath) ? readFileSync(hiddenFileReportPath, "utf8") : "";
    const quotaCellsByTree = quotaCellsRaw ? JSON.parse(quotaCellsRaw) : null;

    const { html, sheetRevision } = renderSheet(trees, {
      lot, treeFiles, quotaCellsByTree, quotaCellsRaw,
      runReportPath, runReportRaw, hiddenFileReportPath, hiddenFileReportRaw,
      reviewDir
    });
    const outDir = path.join(sheetDir, lot);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "sheet.html"), html);
    writeFileSync(path.join(outDir, "sheet.json"), JSON.stringify(
      { lot, sheetRevision, treeCount: trees.length, generatedAt: new Date().toISOString() }, null, 2) + "\n");
    console.log(`render-tree-cards --sheet: wrote ${path.relative(repoRoot, path.join(outDir, "sheet.html"))} (sheetRevision ${sheetRevision})`);
    return;
  }

  const catalogDir = argValue(args, "--catalog-dir") ?? argValue(args, "--fixtures") ?? DEFAULT_CATALOG_DIR;
  const anchorDir = argValue(args, "--anchor-dir") ?? DEFAULT_ANCHOR_DIR;
  const outDir = argValue(args, "--out") ?? path.join(repoRoot, ".review", lot);
  const treesArg = argValue(args, "--trees");
  const treeIds = treesArg ? treesArg.split(",") : null;

  const trees = loadLot(catalogDir, treeIds);
  if (trees.length === 0) {
    console.error(`render-tree-cards: no trees found under ${catalogDir}`);
    process.exitCode = 1;
    return;
  }
  const anchors = loadAnchors(anchorDir);
  mkdirSync(outDir, { recursive: true });

  for (const tree of trees) {
    const siblings = nearestSiblings(trees, tree.treeId, 3);
    const anchor = anchors.get(tree.treeId) ?? null;
    const collapsedFindings = collapseFindings(tree.gateMetricIds ?? [], tree.findings ?? []);
    const html = renderCard(tree, { siblings, anchor, collapsedFindings, lot });
    const outFile = path.join(outDir, `${tree.treeId}.html`);
    writeFileSync(outFile, html);
    console.log(`render-tree-cards: wrote ${path.relative(repoRoot, outFile)} (hash ${contentHashSlug(html)})`);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) run(process.argv);
