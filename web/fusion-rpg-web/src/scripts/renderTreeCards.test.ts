import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadLot,
  loadAnchors,
  nearestSiblings,
  treeFingerprint,
  collapseFindings,
  renderLattice,
  renderCard,
  appendVerdict,
  appendSheetRead,
  loadReviewDoc,
  nameTokenFrequency,
  exclusionCensus,
  nearestNeighbourTopPairs,
  rejectionSummary,
  computeSheetRevision,
  renderSheet,
  run
} from "../../scripts/render-tree-cards.mjs";
import { formatMagnitude } from "../i18n/magnitude";

// H6 (tasks/passive-tree-todo.md), spec-tree-review.md §5.1-§5.4. This suite is the "renders from a
// fixture corpus with no network" proof the todo's own verification line names: every fixture below
// is a temp directory this process writes and reads itself, and the "no network" test asserts it
// directly rather than assuming it.

type FixtureNode = ReturnType<typeof node>;

function node(id: string, branch: "Off" | "Def", tier: number, idx: number, overrides: Record<string, unknown> = {}) {
  return {
    nodeId: `skill.${id}-${branch.toLowerCase()}-t${tier}-n${idx}`,
    treeId: id,
    branch,
    tier,
    nodeKey: `n${idx}`,
    nodeClass: tier >= 7 ? "Mechanism" : "Magnitude",
    name: `${branch} ${id} ${tier}.${idx}`,
    flavor: "flavor text",
    affixIds: [`affix.${id}.${branch}.${tier}.${idx}`],
    atoms: [
      {
        channelId: `combat.${id}-secret-channel`,
        unitClass: "gameUnits",
        op: "flat",
        trigger: null,
        previewMagnitude: tier >= 7 ? undefined : { unit: "gameUnits", value: tier }
      }
    ],
    exclusionForm: "None",
    enabled: true,
    ...overrides
  };
}

function makeTree(id: string, opts: { findings?: unknown[]; gateMetricIds?: string[]; category?: string } = {}) {
  const nodes: FixtureNode[] = [];
  for (const branch of ["Off", "Def"] as const) {
    for (let tier = 1; tier <= 10; tier++) {
      for (let idx = 0; idx < 2; idx++) nodes.push(node(id, branch, tier, idx));
    }
  }
  return {
    treeId: id,
    category: opts.category ?? "Primary",
    nodes,
    gateMetricIds: opts.gateMetricIds ?? [],
    findings: opts.findings ?? []
  };
}

const cleanupDirs: string[] = [];
afterEach(() => {
  while (cleanupDirs.length) {
    const dir = cleanupDirs.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

function tmpDir() {
  const dir = mkdtempSync(path.join(tmpdir(), "tree-review-test-"));
  cleanupDirs.push(dir);
  return dir;
}

function writeCatalog(dir: string, trees: ReturnType<typeof makeTree>[]) {
  mkdirSync(dir, { recursive: true });
  for (const tree of trees) writeFileSync(path.join(dir, `${tree.treeId}.json`), JSON.stringify(tree));
}

describe("render-tree-cards — the lattice (§5.2 rule 2)", () => {
  it("the_card_fits_a_fixed_two_by_ten_lattice_for_every_tree", () => {
    const tree = makeTree("might");
    const lattice = renderLattice(tree);
    expect(lattice.offCount).toBe(20);
    expect(lattice.defCount).toBe(20);
    expect(lattice.rowCount).toBe(20);
  });
});

describe("render-tree-cards — the magnitude contract (§5.2 rule 3)", () => {
  it("the_card_renders_every_effect_through_formatMagnitude", () => {
    const tree = makeTree("might");
    const html = renderCard(tree, { lot: "smoke" });
    const expected = formatMagnitude({ unit: "gameUnits", value: 1 });
    expect(html).toContain(expected);
  });

  it("the card renders no raw channel id anywhere", () => {
    const tree = makeTree("might");
    const html = renderCard(tree, { lot: "smoke" });
    expect(html).not.toContain("combat.might-secret-channel");
  });

  it("a mechanism node with no attached preview magnitude never fabricates a number", () => {
    const tree = makeTree("might");
    const html = renderCard(tree, { lot: "smoke" });
    // tier >= 7 nodes are Mechanism class and carry no previewMagnitude in this fixture (§5.1's own
    // mockup shows "* Drag Under" with no trailing value for a mechanism node — never a made-up one).
    const mechanismRow = html.split("\n").find((line) => line.includes("Off might 7.0"));
    expect(mechanismRow).toBeDefined();
    expect(mechanismRow).not.toContain('class="mag"');
    expect(mechanismRow).toContain("* ");
  });

  it("a magnitude-class node with no attached preview value says so rather than fabricating one", () => {
    const tree = makeTree("might");
    // Strip the preview off an otherwise-Magnitude (tier < 7) node.
    (tree.nodes[0].atoms[0] as { previewMagnitude?: unknown }).previewMagnitude = undefined;
    const html = renderCard(tree, { lot: "smoke" });
    expect(html).toContain("no preview value");
  });
});

describe("render-tree-cards — the sibling panel (§5.2 rule 5)", () => {
  it("the_sibling_panel_names_three_distinct_trees", () => {
    const trees = ["might", "fortitude", "vigor", "onslaught", "agility"].map((id) => makeTree(id));
    const siblings = nearestSiblings(trees, "might", 3);
    expect(siblings).toHaveLength(3);
    const ids = siblings.map((s) => s.treeId);
    expect(new Set(ids).size).toBe(3);
    expect(ids).not.toContain("might");
  });

  it("reuses one fingerprint algorithm — two calls on the same tree agree exactly", () => {
    const tree = makeTree("might");
    expect(treeFingerprint(tree)).toEqual(treeFingerprint(tree));
  });

  it("two trees built from the same name pattern score more similar than an unrelated one", () => {
    // "might" and "mighty" share almost every node-name shingle; "vigor" shares almost none.
    const might = makeTree("might");
    const mighty = makeTree("mighty");
    const vigor = makeTree("vigor");
    const trees = [might, mighty, vigor];
    const siblings = nearestSiblings(trees, "might", 2);
    expect(siblings[0].treeId).toBe("mighty");
    expect(siblings[0].similarity).toBeGreaterThan(siblings[1].similarity);
  });
});

describe("render-tree-cards — gates collapse to one chip (§5.2 rule 1, §6.4 rule 1)", () => {
  it("twenty-three green gates collapse to one chip, and only OPEN/NOT_MEASURED get a line", () => {
    const gateMetricIds = Array.from({ length: 23 }, (_, i) => `Gate${i}`);
    const findings = [
      { metric: "Quality/FlavourGeneric", severity: "note", loop: "open", message: "1 flavour sampled" },
      { metric: "PassiveTree/DeepMechanismValue", severity: "not_measured", loop: "closed", message: "sim pending" }
    ];
    const collapsed = collapseFindings(gateMetricIds, findings);
    expect(collapsed.greenCount).toBe(23);
    expect(collapsed.lines).toHaveLength(2);
  });

  it("a closed-loop gap is never hidden inside the green chip", () => {
    const gateMetricIds = ["PassiveTree/QuotaDrift", "PassiveTree/ExclusionPresentation", "PassiveTree/UnresolvedCount"];
    const findings = [
      { metric: "PassiveTree/ExclusionPresentation", severity: "gap", loop: "closed", message: "loser marked unlocked, not inert" }
    ];
    const collapsed = collapseFindings(gateMetricIds, findings);
    expect(collapsed.greenCount).toBe(2);
    expect(collapsed.lines).toHaveLength(1);
    expect(collapsed.lines[0].metric).toBe("PassiveTree/ExclusionPresentation");
  });

  it("a closed-loop NOTE (informational) still folds into the green chip", () => {
    const collapsed = collapseFindings(["G1"], [{ metric: "G1", severity: "note", loop: "closed", message: "fyi" }]);
    expect(collapsed.greenCount).toBe(1);
    expect(collapsed.lines).toHaveLength(0);
  });

  it("an open-loop metric can never gate — it always shows regardless of gateMetricIds", () => {
    const collapsed = collapseFindings([], [{ metric: "Quality/FlavourGeneric", severity: "note", loop: "open", message: "x" }]);
    expect(collapsed.greenCount).toBe(0);
    expect(collapsed.lines).toHaveLength(1);
  });
});

describe("render-tree-cards — the species anchor panel (§5.2 rule 4)", () => {
  it("the species' own reason sentence and traits render beside the nodes", () => {
    const anchorDir = tmpDir();
    writeFileSync(
      path.join(anchorDir, "undead.json"),
      JSON.stringify([{ speciesId: "SnorkleZombie", reason: "It bypasses defenses.", traits: ["stealth", "amphibious"] }])
    );
    const anchors = loadAnchors(anchorDir);
    const tree = makeTree("SnorkleZombie", { category: "Species" });
    const html = renderCard(tree, { lot: "smoke", anchor: anchors.get("SnorkleZombie") });
    expect(html).toContain("It bypasses defenses.");
    expect(html).toContain("stealth");
    expect(html).toContain("amphibious");
  });

  it("an underscore-prefixed anchor file is never read (§7's blind spot)", () => {
    const anchorDir = tmpDir();
    writeFileSync(
      path.join(anchorDir, "_needs-review.json"),
      JSON.stringify([{ speciesId: "SnorkleZombie", reason: "STALE — must never surface", traits: [] }])
    );
    const anchors = loadAnchors(anchorDir);
    expect(anchors.has("SnorkleZombie")).toBe(false);
  });
});

describe("render-tree-cards — the verdict control (§5.2 rule 6)", () => {
  it("a_verdict_writes_a_machine_readable_row", () => {
    const reviewDir = tmpDir();
    const file = appendVerdict(reviewDir, "smoke-lot", { treeId: "might", status: "accept", by: "tester" });
    const doc = JSON.parse(readFileSync(file, "utf8"));
    expect(doc.lot).toBe("smoke-lot");
    expect(doc.entries).toHaveLength(1);
    expect(doc.entries[0]).toMatchObject({ treeId: "might", status: "accept", by: "tester" });
  });

  it("a reject verdict without a reason is refused — a rejection always names the rule (§6.1)", () => {
    const reviewDir = tmpDir();
    expect(() => appendVerdict(reviewDir, "smoke-lot", { treeId: "might", status: "reject" })).toThrow(/reason/i);
  });

  it("an unknown status is refused rather than silently accepted", () => {
    const reviewDir = tmpDir();
    expect(() => appendVerdict(reviewDir, "smoke-lot", { treeId: "might", status: "maybe" })).toThrow();
  });

  it("appends rather than overwrites — the file is the review's own history", () => {
    const reviewDir = tmpDir();
    appendVerdict(reviewDir, "smoke-lot", { treeId: "might", status: "accept", by: "a" });
    const file = appendVerdict(reviewDir, "smoke-lot", { treeId: "fortitude", status: "reject", reason: "flat", by: "b" });
    const doc = JSON.parse(readFileSync(file, "utf8"));
    expect(doc.entries).toHaveLength(2);
  });

  it("a reject reason is a plain string — compatible with brief.py's anti_motifs: Sequence[str]", () => {
    const reviewDir = tmpDir();
    const file = appendVerdict(reviewDir, "smoke-lot", { treeId: "fortitude", status: "reject", reason: "too many rage motifs" });
    const doc = JSON.parse(readFileSync(file, "utf8"));
    expect(typeof doc.entries[0].reason).toBe("string");
  });
});

describe("render-tree-cards — offline by construction (H6 verification)", () => {
  it("a card renders from a fixture corpus with no network", () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("render-tree-cards must never call fetch");
    });
    const original = globalThis.fetch;
    // @ts-expect-error -- test-only stub
    globalThis.fetch = fetchSpy;
    try {
      const catalogDir = tmpDir();
      writeCatalog(catalogDir, [makeTree("might"), makeTree("fortitude")]);
      const trees = loadLot(catalogDir);
      expect(trees).toHaveLength(2);
      for (const tree of trees) {
        const siblings = nearestSiblings(trees, tree.treeId, 3);
        const html = renderCard(tree, { lot: "offline-check", siblings });
        expect(html).toContain("<!doctype html>");
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = original;
    }
  });

  it("run() renders one HTML file per tree in the lot, fully offline, via the CLI entry point", () => {
    const catalogDir = tmpDir();
    const outDir = tmpDir();
    writeCatalog(catalogDir, [makeTree("might"), makeTree("fortitude"), makeTree("vigor")]);
    run(["node", "render-tree-cards.mjs", "--lot", "cli-smoke", "--catalog-dir", catalogDir, "--anchor-dir", tmpDir(), "--out", outDir]);
    for (const id of ["might", "fortitude", "vigor"]) {
      const html = readFileSync(path.join(outDir, `${id}.html`), "utf8");
      expect(html).toContain(`data-tree-id="${id}"`);
      expect(html).toContain('data-lot="cli-smoke"');
    }
  });

  it("run() in --verdict mode writes the same _review/<lot>.json shape the direct call does", () => {
    const reviewDir = tmpDir();
    run(["node", "render-tree-cards.mjs", "--lot", "cli-smoke", "--verdict", "--tree", "might", "--status", "accept", "--by", "tester", "--review-dir", reviewDir]);
    const doc = JSON.parse(readFileSync(path.join(reviewDir, "cli-smoke.json"), "utf8"));
    expect(doc.entries[0]).toMatchObject({ treeId: "might", status: "accept" });
  });
});

describe("render-tree-cards — the corpus sheet (task H7, spec-tree-review.md §5.5)", () => {
  it("name-token frequency counts occurrences and distinct-tree spread separately", () => {
    const trees = [makeTree("might"), makeTree("fortitude")];
    // Every fixture node name is "<branch> <id> <tier>.<idx>" — "might"/"fortitude" appear once
    // per node in their own tree only, so treeCount must stay 1 even though count is high.
    const tokens = nameTokenFrequency(trees, 100);
    const might = tokens.find((t: { token: string }) => t.token === "might");
    expect(might).toBeDefined();
    expect(might!.treeCount).toBe(1);
    expect(might!.count).toBeGreaterThan(1);
  });

  it("the exclusion census lists only nodes carrying a real exclusion, with form and keys", () => {
    const tree = makeTree("might");
    tree.nodes[0].exclusionForm = "Nullification";
    (tree.nodes[0] as unknown as { excludeProps: string[] }).excludeProps = ["posture"];
    (tree.nodes[0] as unknown as { printedText: string }).printedText = "cannot combine";
    const rows = exclusionCensus([tree]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ form: "Nullification", propertyKeys: ["posture"], printedText: "cannot combine" });
  });

  it("nearest-neighbour top pairs reuses the same fingerprint the sibling panel uses, over all pairs", () => {
    const trees = ["might", "mighty", "vigor"].map((id) => makeTree(id));
    const pairs = nearestNeighbourTopPairs(trees, 20);
    expect(pairs.length).toBe(3); // 3 choose 2
    expect(pairs[0]).toMatchObject({ a: "might", b: "mighty" });
  });

  it("rejection summary reads the review queue's LATEST verdict per tree, not every row", () => {
    const reviewDir = tmpDir();
    appendVerdict(reviewDir, "smoke-lot", { treeId: "might", status: "reject", reason: "flat", by: "a" });
    appendVerdict(reviewDir, "smoke-lot", { treeId: "might", status: "accept", by: "b" }); // re-review supersedes
    appendVerdict(reviewDir, "smoke-lot", { treeId: "fortitude", status: "reject", reason: "flat", by: "a" });
    const summary = rejectionSummary(reviewDir, "smoke-lot", 5);
    expect(summary.reviewed).toBe(2);
    expect(summary.accepted).toBe(1);
    expect(summary.rejected).toBe(1);
    expect(summary.totalTrees).toBe(5);
  });

  it("sheetRevision changes when a tree file's content changes, and stays stable otherwise", () => {
    const treeFiles = [{ treeId: "might", raw: JSON.stringify(makeTree("might")) }];
    const revA = computeSheetRevision({ treeFiles });
    const revB = computeSheetRevision({ treeFiles });
    expect(revA).toBe(revB);
    const changed = [{ treeId: "might", raw: JSON.stringify(makeTree("might", { category: "Elemental" })) }];
    const revC = computeSheetRevision({ treeFiles: changed });
    expect(revC).not.toBe(revA);
  });

  it("sheetRevision is order-independent over which file loaded first", () => {
    const a = [{ treeId: "might", raw: "1" }, { treeId: "fortitude", raw: "2" }];
    const b = [{ treeId: "fortitude", raw: "2" }, { treeId: "might", raw: "1" }];
    expect(computeSheetRevision({ treeFiles: a })).toBe(computeSheetRevision({ treeFiles: b }));
  });

  it("a_census_refuses_to_start_without_a_matching_sheet_read_row — the sheet embeds its own revision and the read row records it", () => {
    const reviewDir = tmpDir();
    const trees = [makeTree("might"), makeTree("fortitude")];
    const treeFiles = trees.map((t) => ({ treeId: t.treeId, raw: JSON.stringify(t) }));
    const { sheetRevision } = renderSheet(trees, { lot: "smoke-lot", treeFiles, reviewDir });
    const file = appendSheetRead(reviewDir, "smoke-lot", { sheetRevision, by: "tester" });
    const doc = JSON.parse(readFileSync(file, "utf8"));
    expect(doc.sheetReads[0]).toMatchObject({ lot: "smoke-lot", sheetRevision, by: "tester" });
  });

  it("appendSheetRead refuses a row with no sheetRevision", () => {
    const reviewDir = tmpDir();
    expect(() => appendSheetRead(reviewDir, "smoke-lot", { by: "tester" })).toThrow(/sheetRevision/);
  });

  it("appendSheetRead is append-only and shares the file with appendVerdict without clobbering entries", () => {
    const reviewDir = tmpDir();
    appendVerdict(reviewDir, "smoke-lot", { treeId: "might", status: "accept", by: "a" });
    appendSheetRead(reviewDir, "smoke-lot", { sheetRevision: "rev-1", by: "b" });
    const doc = loadReviewDoc(reviewDir, "smoke-lot");
    expect(doc.entries).toHaveLength(1);
    expect(doc.sheetReads).toHaveLength(1);
  });

  it("a mechanism node with no attached quota-cells input reports the panel as NOT_MEASURED, never a fabricated grid", () => {
    const trees = [makeTree("might")];
    const treeFiles = [{ treeId: "might", raw: JSON.stringify(trees[0]) }];
    const reviewDir = tmpDir();
    const { html } = renderSheet(trees, { lot: "smoke-lot", treeFiles, reviewDir });
    expect(html).toContain("wiring-gap");
  });

  it("run() in --sheet mode writes sheet.html and a sheet.json sidecar carrying the same revision", () => {
    const catalogDir = tmpDir();
    const sheetDir = tmpDir();
    const reviewDir = tmpDir();
    writeCatalog(catalogDir, [makeTree("might"), makeTree("fortitude")]);
    run(["node", "render-tree-cards.mjs", "--lot", "sheet-smoke", "--sheet",
         "--catalog-dir", catalogDir, "--sheet-dir", sheetDir, "--review-dir", reviewDir]);
    const html = readFileSync(path.join(sheetDir, "sheet-smoke", "sheet.html"), "utf8");
    const sidecar = JSON.parse(readFileSync(path.join(sheetDir, "sheet-smoke", "sheet.json"), "utf8"));
    expect(html).toContain('data-lot="sheet-smoke"');
    expect(sidecar.sheetRevision).toBeTruthy();
    expect(html).toContain(sidecar.sheetRevision);
  });

  it("run() in --sheet-read mode reads the CURRENT sheet.json and appends the matching revision", () => {
    const catalogDir = tmpDir();
    const sheetDir = tmpDir();
    const reviewDir = tmpDir();
    writeCatalog(catalogDir, [makeTree("might")]);
    run(["node", "render-tree-cards.mjs", "--lot", "sheet-smoke", "--sheet",
         "--catalog-dir", catalogDir, "--sheet-dir", sheetDir, "--review-dir", reviewDir]);
    const sidecar = JSON.parse(readFileSync(path.join(sheetDir, "sheet-smoke", "sheet.json"), "utf8"));
    run(["node", "render-tree-cards.mjs", "--lot", "sheet-smoke", "--sheet-read",
         "--sheet-dir", sheetDir, "--review-dir", reviewDir, "--by", "tester"]);
    const doc = loadReviewDoc(reviewDir, "sheet-smoke");
    expect(doc.sheetReads[0]).toMatchObject({ sheetRevision: sidecar.sheetRevision, by: "tester" });
  });

  it("run() in --sheet-read mode refuses when no sheet was ever rendered for the lot", () => {
    const sheetDir = tmpDir();
    const reviewDir = tmpDir();
    expect(() => run(["node", "render-tree-cards.mjs", "--lot", "never-rendered", "--sheet-read",
                      "--sheet-dir", sheetDir, "--review-dir", reviewDir, "--by", "tester"])).toThrow();
  });
});
