import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  applyLiveBoard,
  applyPlaybackFrame,
  BOARD_DO_NOT_IMPORT,
  paintStructureHpBar,
  type BoardActorRecord
} from "./index";

describe("board-contract freeze (lock 5a)", () => {
  it("BoardActorRecord hp is bigint — never float", () => {
    const actor: BoardActorRecord = {
      key: "a1",
      row: 0,
      col: 1,
      kind: "wall",
      hp: 1000n,
      isStructure: true,
      showInitiative: false
    };
    expect(typeof actor.hp).toBe("bigint");
    applyLiveBoard(null, [actor], { kind: "revision", value: 1 });
    applyPlaybackFrame(null, 0);
    paintStructureHpBar({
      overlays: null,
      key: "a1",
      hp: 500n,
      maxHp: 1000n
    });
  });

  it("createSiegeGame.ts is a thin createGame wrapper without lawn/siege scene imports", () => {
    const src = readFileSync(join(__dirname, "../createSiegeGame.ts"), "utf8");
    expect(src).toMatch(/export function createSiegeGame/);
    expect(src).toMatch(/createGame\(/);
    expect(src).not.toMatch(/^\s*import\s+.*LawnWorldScene/m);
    expect(src).not.toMatch(/^\s*import\s+.*SiegeBoardScene/m);
    expect(src).not.toMatch(/class\s+SiegeBoardScene/);
  });

  it("do-not-import: stages/siege (if present) must not import banned lawn symbols", () => {
    const siegeRoot = join(__dirname, "../../stages/siege");
    if (!existsSync(siegeRoot)) {
      expect(BOARD_DO_NOT_IMPORT.length).toBeGreaterThan(0);
      return;
    }
    const violations: string[] = [];
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else if (/\.(ts|tsx)$/.test(name)) out.push(full);
      }
      return out;
    };
    for (const file of walk(siegeRoot)) {
      const src = readFileSync(file, "utf8");
      for (const banned of BOARD_DO_NOT_IMPORT) {
        if (src.includes(banned) && /from\s+["']@\/game\//.test(src)) {
          violations.push(`${file} references banned ${banned}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
