import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import {
  getLogEvents,
  subscribeLog,
  useCheatAction,
  useCheats,
  useCheatSchema,
  useClearCheatField,
  useEndProbe,
  useProbePacks,
  useRunProbePack,
  useSaveCheats,
  useSetCheatFloat,
  useToggleCheat
} from "@/lib/bus";
import { clearCheatFloatDirty, isCheatFloatDirty, markCheatFloatDirty } from "@/lib/bus/cheat-dirty";
import type { CheatEntry, CheatSnapshot, ProbePackDto, ProbeRunResult } from "@/lib/bus";
import { Page } from "@/layouts/Page";
import { Button, Checkbox, Field, NumberInput, Panel, TextInput } from "@/ui";

/** Fallback when schema fetch fails — matches CheatSchema ToggleDefault. */
const FALLBACK_TOGGLE_DEFAULT_ON = new Set(["A-APPLY", "SYS-EMIT-PROOF"]);

const TABS = [
  { id: "A", label: "Scale", prefix: "A-" },
  { id: "B", label: "Plant", prefix: "P-" },
  { id: "C", label: "Zombie", prefix: "Z-" },
  { id: "D", label: "Bullet", prefix: "D-" },
  { id: "E", label: "Board", prefix: "E-" },
  { id: "F", label: "Spawn", prefix: "F-" },
  { id: "G", label: "Eco", prefix: "G-" },
  { id: "H", label: "QoL", prefix: "H-" },
  { id: "I", label: "Meta", prefix: "I-" },
  { id: "J", label: "Sys", prefix: "SYS-" }
] as const;

function entryMap(snap: CheatSnapshot | undefined): Map<string, CheatEntry> {
  const m = new Map<string, CheatEntry>();
  for (const e of snap?.entries ?? []) m.set(e.id, e);
  return m;
}

function CheatToggle({
  id,
  label,
  checked,
  onToggle
}: {
  id: string;
  label: string;
  checked: boolean;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  return (
    <Checkbox
      label={`${id} — ${label}`}
      checked={checked}
      onChange={(e) => onToggle(id, e.target.checked)}
    />
  );
}

/** Local draft — empty means unset; Clear removes the field from SSOT. */
function CheatFloat({
  id,
  label,
  value,
  isSet,
  onCommit,
  onClear
}: {
  id: string;
  label: string;
  value: number | undefined;
  isSet: boolean;
  onCommit: (id: string, value: number) => void;
  onClear: (id: string) => void;
}) {
  const [draft, setDraft] = useState(isSet && value != null ? String(value) : "");
  useEffect(() => {
    if (!isCheatFloatDirty(id)) setDraft(isSet && value != null && Number.isFinite(value) ? String(value) : "");
  }, [value, id, isSet]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      markCheatFloatDirty(id);
      onClear(id);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      setDraft(isSet && value != null ? String(value) : "");
      clearCheatFloatDirty(id);
      return;
    }
    markCheatFloatDirty(id);
    onCommit(id, n);
  };

  return (
    <Field label={`${id} ${label}${isSet ? "" : " (unset)"}`}>
      <div className="flex gap-1">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="unset"
          className="w-full rounded-sm border border-border bg-soil px-2 py-1.5 font-mono text-md text-text"
          value={draft}
          onChange={(e) => {
            markCheatFloatDirty(id);
            setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
          }}
        />
        <Button type="button" onClick={commit}>
          Set
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!isSet && draft.trim() === ""}
          title={!isSet && draft.trim() === "" ? "Nothing set to clear" : undefined}
          onClick={() => {
            setDraft("");
            markCheatFloatDirty(id);
            onClear(id);
          }}
        >
          Clear
        </Button>
      </div>
    </Field>
  );
}

function TabClearBar({
  prefix,
  onResetGroup,
  onResetAll
}: {
  prefix: string;
  onResetGroup: () => void;
  onResetAll: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-1 border-b border-border pb-2">
      <Button type="button" variant="ghost" onClick={onResetGroup}>
        Clear this tab ({prefix})
      </Button>
      <Button type="button" variant="ghost" onClick={onResetAll}>
        Reset all cheats
      </Button>
    </div>
  );
}

export function CheatsPage() {
  const remote = useCheats();
  const schema = useCheatSchema();
  const packs = useProbePacks();
  const save = useSaveCheats();
  const toggle = useToggleCheat();
  const setFloat = useSetCheatFloat();
  const clearField = useClearCheatField();
  const action = useCheatAction();
  const runPack = useRunProbePack();
  const endProbe = useEndProbe();
  const logEvents = useSyncExternalStore(subscribeLog, getLogEvents, getLogEvents);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("A");
  const [manualId, setManualId] = useState(0);
  const [wave, setWave] = useState(1);
  const [waveTimer, setWaveTimer] = useState(5);
  const [eco, setEco] = useState(9999);
  const [spawnCol, setSpawnCol] = useState(3);
  const [spawnRow, setSpawnRow] = useState(2);
  const [activeProbe, setActiveProbe] = useState<ProbeRunResult | null>(null);
  const entries = useMemo(() => entryMap(remote.data), [remote.data]);

  const toggleDefaultOn = useMemo(() => {
    const fields = schema.data?.fields;
    if (!fields?.length) return FALLBACK_TOGGLE_DEFAULT_ON;
    return new Set(fields.filter((f) => f.kind === "toggle" && f.toggleDefault).map((f) => f.id));
  }, [schema.data]);

  const isSet = (id: string) => entries.has(id);
  const on = (id: string) =>
    entries.has(id) ? !!entries.get(id)?.enabled : toggleDefaultOn.has(id);
  const fv = (id: string) => (entries.has(id) ? entries.get(id)?.floatValue : undefined);
  const tabMeta = TABS.find((t) => t.id === tab)!;

  const probeId = activeProbe?.probeId || remote.data?.activeProbeId || "";
  const expected = activeProbe?.expectedKinds ?? [];
  const seenKinds = useMemo(() => {
    if (!probeId) return new Set<string>();
    const s = new Set<string>();
    for (const e of logEvents) {
      const raw = e.payload;
      const json = typeof raw === "string" ? raw : JSON.stringify(raw ?? {});
      if (!json.includes(probeId)) continue;
      s.add(e.kind);
    }
    return s;
  }, [logEvents, probeId]);

  const onToggle = (id: string, enabled: boolean) => {
    void toggle.mutateAsync({ id, enabled });
  };
  const onFloat = (id: string, value: number) => {
    void setFloat.mutateAsync({ id, value });
  };
  const onClear = (id: string) => {
    void clearField.mutateAsync({ id });
  };
  const resetGroup = () => {
    void action.mutateAsync({ action: "reset-group", prefix: tabMeta.prefix });
  };
  const resetAll = () => {
    void action.mutateAsync({ action: "reset-all" });
  };

  const startPack = async (pack: ProbePackDto) => {
    const r = await runPack.mutateAsync({ packId: pack.id });
    setActiveProbe(r);
  };

  const F = (id: string, label: string) => (
    <CheatFloat
      key={id}
      id={id}
      label={label}
      value={fv(id)}
      isSet={isSet(id)}
      onCommit={onFloat}
      onClear={onClear}
    />
  );

  return (
    <Page
      testId="page-cheats"
      title="Cheats"
      description="Web-only cheat UI (SSOT). Unset fields are empty — they are never applied as 0/-1/1. Clear removes a value."
      actions={
        <Button
          data-testid="cheats-push"
          disabled={save.isPending || !remote.data}
          title={save.isPending ? "Pushing…" : !remote.data ? "Nothing loaded yet" : undefined}
          onClick={() => remote.data && void save.mutateAsync(remote.data)}
        >
          Push snapshot to injector
        </Button>
      }
    >
      <Panel title="Probe packs" testId="panel-probe-packs" className="mb-3">
        <p className="mb-2 text-sm text-muted">
          Run a pack, play briefly, watch expected kinds light up (same probeId on inject + outcomes).
        </p>
        <div className="mb-2 flex flex-wrap gap-1">
          {(packs.data ?? []).map((p) => (
            <Button
              key={p.id}
              data-testid={`probe-pack-${p.id}`}
              disabled={runPack.isPending}
              onClick={() => void startPack(p)}
              title={p.hint}
            >
              {p.label}
            </Button>
          ))}
          <Button
            data-testid="probe-end"
            variant="ghost"
            disabled={endProbe.isPending || !probeId}
            title={endProbe.isPending ? "Ending…" : !probeId ? "No probe running" : undefined}
            onClick={() => {
              void endProbe.mutateAsync({ probeId: probeId || undefined, reason: "web" });
              setActiveProbe(null);
            }}
          >
            End probe
          </Button>
          {probeId ? (
            <Link
              className="inline-flex items-center rounded-sm border border-border px-2 py-1 text-sm text-text"
              to={`/log?q=${encodeURIComponent(probeId)}`}
            >
              Open log filtered
            </Link>
          ) : null}
        </div>
        {activeProbe ? (
          <div className="rounded-sm border border-border bg-panel-inset p-2 text-sm" data-testid="probe-active">
            <div>
              <strong>{activeProbe.packId}</strong> · probeId=
              <code className="font-mono text-xs">{activeProbe.probeId}</code>
            </div>
            <p className="text-muted">{activeProbe.hint}</p>
            <ul className="mt-1 list-inside list-disc">
              {expected.map((k) => (
                <li key={k} data-testid={`probe-kind-${k}`}>
                  {seenKinds.has(k) ? "✓" : "○"} {k}
                </li>
              ))}
            </ul>
            <p className="mt-1">
              Soft verdict: {expected.filter((k) => seenKinds.has(k)).length}/{expected.length} expected kinds
              seen
            </p>
          </div>
        ) : null}
      </Panel>

      <div className="mb-3 flex flex-wrap gap-1" data-testid="cheats-tabs">
        {TABS.map((t) => (
          <Button
            key={t.id}
            data-testid={`cheat-tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={tab === t.id ? "border-lawn-hot bg-lawn" : undefined}
          >
            {t.id} {t.label}
          </Button>
        ))}
      </div>

      <Panel title={`Tab ${tab}`} testId="panel-cheats">
        <TabClearBar prefix={tabMeta.prefix} onResetGroup={resetGroup} onResetAll={resetAll} />
        {tab === "A" && (
          <>
            <CheatToggle id="A-APPLY" label="Apply stats" checked={on("A-APPLY")} onToggle={onToggle} />
            {F("A-P-HP%", "Plant HP%")}
            {F("A-P-HP+", "Plant HP flat")}
            {F("A-P-ATK%", "Plant ATK%")}
            {F("A-P-ATK+", "Plant ATK flat")}
            {F("A-P-DEF%", "Plant DEF%")}
            {F("A-P-DEF+", "Plant DEF flat")}
            {F("A-Z-HP%", "Zombie HP%")}
            {F("A-Z-HP+", "Zombie HP flat")}
            {F("A-Z-ATK%", "Zombie ATK%")}
            {F("A-Z-ATK+", "Zombie ATK flat")}
            {F("A-Z-DEF%", "Zombie DEF%")}
            {F("A-Z-DEF+", "Zombie DEF flat")}
            <p className="mt-2 text-sm text-muted">
              Empty = unset (not applied). Type a value → <strong>Set</strong>. <strong>Clear</strong> removes
              the field. Identity for % is 1; do not Set 0 unless you mean zero HP.
            </p>
            <Button onClick={() => void action.mutateAsync({ action: "reapply" })}>Reapply living</Button>
            <Button onClick={() => void action.mutateAsync({ action: "push-now" })}>A-PUSH-NOW</Button>
            <Button onClick={() => void action.mutateAsync({ action: "pull-stats" })}>Pull stats</Button>
            <Button onClick={() => void action.mutateAsync({ action: "push-stats" })}>Push stats</Button>
          </>
        )}
        {tab === "B" && (
          <>
            {F("P-HP", "HP")}
            {F("P-MAXHP", "MaxHP")}
            {F("P-SHIELD", "Shield")}
            {F("P-ATK", "ATK")}
            {F("P-ATK-INT", "Atk interval")}
            {F("P-ATK-CD", "Atk CD")}
            {F("P-ATK-ADD", "Atk add")}
            {F("P-PROD-INT", "Produce interval")}
            {F("P-PROD-CD", "Produce CD")}
            {F("P-SPEED", "Speed")}
            {F("P-MOVE", "Move")}
            {F("P-LEVEL", "Level")}
            {F("P-SHOOTLVL", "Shoot level")}
            {F("P-LIMDMG", "LimDamage (read-only)")}
            <CheatToggle id="P-MOD-HP" label="ModifyHealth" checked={on("P-MOD-HP")} onToggle={onToggle} />
            <CheatToggle id="P-MOD-ATK" label="ModifyDamage" checked={on("P-MOD-ATK")} onToggle={onToggle} />
            <CheatToggle id="P-DEF-REAL" label="DEF note (TakeDamage)" checked={on("P-DEF-REAL")} onToggle={onToggle} />
            <CheatToggle id="P-GOD" label="Plant godmode" checked={on("P-GOD")} onToggle={onToggle} />
            <CheatToggle id="P-GOD-DIE" label="Block Die" checked={on("P-GOD-DIE")} onToggle={onToggle} />
            <Button onClick={() => void action.mutateAsync({ action: "apply-plants" })}>Apply plants</Button>
          </>
        )}
        {tab === "C" && (
          <>
            {F("Z-HP", "HP")}
            {F("Z-MAXHP", "MaxHP")}
            {F("Z-ARM1", "Armor1")}
            {F("Z-ARM1MAX", "Armor1 max")}
            {F("Z-ARM2", "Armor2")}
            {F("Z-ARM2MAX", "Armor2 max")}
            {F("Z-ATK", "ATK")}
            {F("Z-ARMOR-F", "theArmor")}
            {F("Z-TAKEMULT", "takeDmgMult")}
            {F("Z-SPD-U", "uniqueSpeed")}
            {F("Z-SPD", "theSpeed")}
            {F("Z-SPD-O", "originSpeed")}
            {F("Z-SLOW-FREEZE", "freezeSpeed")}
            {F("Z-SLOW-COLD", "coldSpeed")}
            {F("Z-SLOW-BUTTER", "butterSpeed")}
            <CheatToggle id="Z-DEF-BODY" label="DEF note Body" checked={on("Z-DEF-BODY")} onToggle={onToggle} />
            <CheatToggle id="Z-DEF-APPLY" label="DEF note Apply" checked={on("Z-DEF-APPLY")} onToggle={onToggle} />
            <CheatToggle id="Z-GOD" label="Godmode" checked={on("Z-GOD")} onToggle={onToggle} />
            <CheatToggle
              id="Z-REAPPLY-RC"
              label="Reapply after reinforce"
              checked={on("Z-REAPPLY-RC")}
              onToggle={onToggle}
            />
            <Button onClick={() => void action.mutateAsync({ action: "apply-zombies" })}>Apply zombies</Button>
            <Button onClick={() => void action.mutateAsync({ action: "kill-zombies" })}>Kill all</Button>
            <Button onClick={() => void action.mutateAsync({ action: "hypno-all" })}>Hypno all</Button>
            <Button onClick={() => void action.mutateAsync({ action: "oneshot" })}>One-shot</Button>
          </>
        )}
        {tab === "D" && (
          <>
            {F("D-DMG-SET", "Damage set")}
            {F("D-DMG-%", "Damage %")}
            <CheatToggle id="D-PROBE-PLANT" label="Probe plant ATK" checked={on("D-PROBE-PLANT")} onToggle={onToggle} />
            <CheatToggle id="D-PROBE-BULLET" label="Probe bullet" checked={on("D-PROBE-BULLET")} onToggle={onToggle} />
            <CheatToggle id="D-HOMING" label="Homing Track" checked={on("D-HOMING")} onToggle={onToggle} />
            {F("D-TYPE-SWAP", "Type swap")}
          </>
        )}
        {tab === "E" && (
          <>
            {F("E-ZH", "zombieHealthMult")}
            {F("E-ZD", "zombieDamageMult")}
            {F("E-ZS", "zombieSpeedMult")}
            {F("E-ZC", "zombieCountMult")}
            {F("E-ZARM", "zombieStartAmmor")}
            {F("E-PMIN", "plantModifyMin")}
            {F("E-PMAX", "plantModifyMax")}
            {F("E-ZMIN", "zombieModifyMin")}
            {F("E-ZMAX", "zombieModifyMax")}
            {F("E-WAVE-I", "waveInterval")}
            {F("E-CONV-I", "conveyInterval")}
            <Button onClick={() => void action.mutateAsync({ action: "load-board-config" })}>Load config</Button>
            <Button onClick={() => void action.mutateAsync({ action: "board-config" })}>Apply config</Button>
          </>
        )}
        {tab === "F" && (
          <>
            <Field label="spawn col">
              <NumberInput value={spawnCol} onChange={setSpawnCol} />
            </Field>
            <Field label="spawn row">
              <NumberInput value={spawnRow} onChange={setSpawnRow} />
            </Field>
            <Button
              onClick={() =>
                void action.mutateAsync({ action: "set-spawn-cell", col: spawnCol, row: spawnRow })
              }
            >
              Set spawn cell
            </Button>
            <p className="text-sm text-muted">
              Catalog P={remote.data?.catalogPlants ?? remote.data?.catalog?.plants?.length ?? 0} Z=
              {remote.data?.catalogZombies ?? remote.data?.catalog?.zombies?.length ?? 0}
            </p>
            <div className="flex max-h-48 flex-col gap-1 overflow-auto">
              {(remote.data?.catalog?.plants ?? []).slice(0, 40).map((p) => (
                <Button
                  key={`p-${p.type}`}
                  onClick={() => void action.mutateAsync({ action: "spawn-plant", type: p.type })}
                >
                  Plant {p.type} {p.displayName || p.typeName}
                </Button>
              ))}
              {(remote.data?.catalog?.zombies ?? []).slice(0, 40).map((z) => (
                <div key={`z-${z.type}`} className="flex gap-1">
                  <Button onClick={() => void action.mutateAsync({ action: "spawn-zombie", type: z.type })}>
                    Z {z.type} {z.displayName || z.typeName}
                  </Button>
                  <Button
                    onClick={() =>
                      void action.mutateAsync({ action: "spawn-zombie", type: z.type, mindControl: true })
                    }
                  >
                    MC
                  </Button>
                </div>
              ))}
            </div>
            <Field label="Manual type id">
              <NumberInput value={manualId} onChange={setManualId} />
            </Field>
            <Button onClick={() => void action.mutateAsync({ action: "spawn-plant", type: manualId })}>
              Spawn plant id
            </Button>
            <Button onClick={() => void action.mutateAsync({ action: "spawn-zombie", type: manualId })}>
              Spawn zombie id
            </Button>
            <Button onClick={() => void action.mutateAsync({ action: "clear-failed" })}>Clear failed</Button>
            <Button onClick={() => void action.mutateAsync({ action: "delete-plants" })}>Delete plants</Button>
            <Button onClick={() => void action.mutateAsync({ action: "delete-zombies" })}>Delete zombies</Button>
            <Field label="Wave">
              <NumberInput value={wave} onChange={setWave} />
            </Field>
            <Button onClick={() => void action.mutateAsync({ action: "summon", wave })}>Summon</Button>
            <Button onClick={() => void action.mutateAsync({ action: "huge-wave" })}>Huge wave</Button>
            <Field label="Wave timer">
              <NumberInput value={waveTimer} onChange={setWaveTimer} />
            </Field>
            <Button onClick={() => void action.mutateAsync({ action: "wave-timer", value: waveTimer })}>
              Set F-WAVE-T
            </Button>
            <CheatToggle
              id="F-WAVE-FREEZE"
              label="Freeze wave timer"
              checked={on("F-WAVE-FREEZE")}
              onToggle={onToggle}
            />
          </>
        )}
        {tab === "G" && (
          <>
            <Field label="Economy value">
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className="w-full rounded-sm border border-border bg-soil px-2 py-1.5 font-mono text-md text-text"
                value={String(eco)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) setEco(n);
                  else if (e.target.value.trim() === "") setEco(0);
                }}
              />
            </Field>
            <Button onClick={() => void action.mutateAsync({ action: "economy", which: "sun", value: eco })}>
              Sun set
            </Button>
            <Button
              onClick={() => void action.mutateAsync({ action: "economy", which: "sun", value: eco, add: true })}
            >
              Sun add
            </Button>
            <Button onClick={() => void action.mutateAsync({ action: "economy", which: "money", value: eco })}>
              Money set
            </Button>
            <Button
              onClick={() =>
                void action.mutateAsync({ action: "economy", which: "money", value: eco, add: true })
              }
            >
              Money add
            </Button>
            <Button onClick={() => void action.mutateAsync({ action: "economy", which: "points", value: eco })}>
              Points set
            </Button>
            <Button
              onClick={() =>
                void action.mutateAsync({ action: "economy", which: "points", value: eco, add: true })
              }
            >
              Points add
            </Button>
            <Button onClick={() => void action.mutateAsync({ action: "economy", which: "maxSun", value: eco })}>
              maxSun
            </Button>
            <Button
              onClick={() => void action.mutateAsync({ action: "economy", which: "maxMoney", value: eco })}
            >
              maxMoney
            </Button>
            {F("G-TIMESCALE", "timeScale")}
            <CheatToggle id="G-TIMEFREEZE" label="Freeze time" checked={on("G-TIMEFREEZE")} onToggle={onToggle} />
            <CheatToggle id="G-AUTOCOLLECT" label="Autocollect" checked={on("G-AUTOCOLLECT")} onToggle={onToggle} />
            <CheatToggle id="G-FREE-SET" label="Free SetPlant" checked={on("G-FREE-SET")} onToggle={onToggle} />
          </>
        )}
        {tab === "H" && (
          <>
            <CheatToggle id="H-ANYWHERE" label="Plant anywhere" checked={on("H-ANYWHERE")} onToggle={onToggle} />
            <CheatToggle id="H-NOCD-CARD" label="No card CD" checked={on("H-NOCD-CARD")} onToggle={onToggle} />
            <CheatToggle id="H-NOCD-GLOVE" label="No glove CD" checked={on("H-NOCD-GLOVE")} onToggle={onToggle} />
            <CheatToggle id="H-NOCD-HAMMER" label="No hammer CD" checked={on("H-NOCD-HAMMER")} onToggle={onToggle} />
            <CheatToggle id="H-NOCD-WHEEL" label="No wheel CD" checked={on("H-NOCD-WHEEL")} onToggle={onToggle} />
            <CheatToggle id="H-MOWER-INF" label="Block Mower.Die" checked={on("H-MOWER-INF")} onToggle={onToggle} />
          </>
        )}
        {tab === "I" && (
          <>
            <Button onClick={() => void action.mutateAsync({ action: "recipes" })}>Dump recipes</Button>
            <Button onClick={() => void action.mutateAsync({ action: "almanac-dump-all" })}>
              Dump almanac (all)
            </Button>
            <Button onClick={() => void action.mutateAsync({ action: "reinforce" })}>Reinforce</Button>
            <Button onClick={() => void action.mutateAsync({ action: "set-zombie-hp", hp: 27000 })}>
              Set zombie HP 27000
            </Button>
            <Button onClick={() => void action.mutateAsync({ action: "travel-buff" })}>
              Travel buff (stub)
            </Button>
            <Field label="type id">
              <NumberInput value={manualId} onChange={setManualId} />
            </Field>
            <Button onClick={() => void action.mutateAsync({ action: "spawn-pet", type: manualId })}>
              Spawn pet
            </Button>
            <Button onClick={() => void action.mutateAsync({ action: "spawn-grid", type: manualId })}>
              Spawn grid
            </Button>
            <Button onClick={() => void action.mutateAsync({ action: "spawn-bucket", type: 0 })}>
              Spawn bucket
            </Button>
            <Button onClick={() => void action.mutateAsync({ action: "present" })}>Present</Button>
          </>
        )}
        {tab === "J" && (
          <>
            <CheatToggle
              id="SYS-EMIT-PROOF"
              label="Emit proof events"
              checked={on("SYS-EMIT-PROOF")}
              onToggle={onToggle}
            />
            <p className="text-sm text-muted">
              sel={remote.data?.selectedSide}:{remote.data?.selectedPtr} persist={String(remote.data?.persist)}
            </p>
            <Button onClick={() => void action.mutateAsync({ action: "clear-selection" })}>
              Clear selection
            </Button>
            <Button onClick={() => void action.mutateAsync({ action: "reset-all" })}>Reset all</Button>
            <Button
              onClick={() => void action.mutateAsync({ action: "reset-group", prefix: tabMeta.prefix })}
            >
              Reset group {tabMeta.prefix}
            </Button>
            <Button onClick={() => void action.mutateAsync({ action: "save-persist" })}>Save persist</Button>
            <Button onClick={() => void action.mutateAsync({ action: "reload-persist" })}>
              Reload persist
            </Button>
            <Field label="Note">
              <TextInput value={remote.data?.note ?? ""} readOnly />
            </Field>
          </>
        )}
      </Panel>
    </Page>
  );
}
