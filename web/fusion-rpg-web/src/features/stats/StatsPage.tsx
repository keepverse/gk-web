import { useEffect, useState } from "react";
import { emptyMod, useSaveStats, useStats, type StatMod, type StatsConfig } from "@/lib/bus";
import { Page } from "@/layouts/Page";
import { Button, Checkbox, Field, Grid, NumberInput, Panel, StatBar } from "@/ui";

function StatForm({
  title,
  mod,
  setMod,
  testId
}: {
  title: string;
  mod: StatMod;
  setMod: (m: StatMod) => void;
  testId?: string;
}) {
  const set = (k: keyof StatMod, n: number) => setMod({ ...mod, [k]: n });
  return (
    <Panel title={title} testId={testId}>
      <Field label="HP percent">
        <NumberInput value={mod.hpPercent} onChange={(n) => set("hpPercent", n)} />
      </Field>
      <StatBar label="HP %" value={mod.hpPercent} />
      <Field label="HP flat">
        <NumberInput value={mod.hpFlat} onChange={(n) => set("hpFlat", n)} />
      </Field>
      <Field label="Attack percent">
        <NumberInput value={mod.attackPercent} onChange={(n) => set("attackPercent", n)} />
      </Field>
      <StatBar label="ATK %" value={mod.attackPercent} />
      <Field label="Attack flat">
        <NumberInput value={mod.attackFlat} onChange={(n) => set("attackFlat", n)} />
      </Field>
      <Field label="Defense percent">
        <NumberInput value={mod.defensePercent} onChange={(n) => set("defensePercent", n)} />
      </Field>
      <StatBar label="DEF %" value={mod.defensePercent} />
      <Field label="Defense flat">
        <NumberInput value={mod.defenseFlat} onChange={(n) => set("defenseFlat", n)} />
      </Field>
    </Panel>
  );
}

export function StatsPage() {
  const remote = useStats();
  const save = useSaveStats();
  const [stats, setStats] = useState<StatsConfig>({
    plants: emptyMod(),
    zombies: emptyMod(),
    logDamage: true,
    applyStats: true
  });

  useEffect(() => {
    if (remote.data) setStats(remote.data);
  }, [remote.data]);

  return (
    <Page
      testId="page-stats"
      title="Stats"
      description="Global plant/zombie modifiers. Save pushes reload-stats to the injector."
      actions={
        <Button
          data-testid="stats-save"
          disabled={save.isPending}
          title={save.isPending ? "Saving…" : undefined}
          onClick={() => void save.mutateAsync(stats)}
        >
          Save and push to injector
        </Button>
      }
    >
      <Grid data-testid="stats-grid">
        <StatForm
          title="Plants"
          testId="panel-plants"
          mod={stats.plants}
          setMod={(m) => setStats({ ...stats, plants: m })}
        />
        <StatForm
          title="Zombies"
          testId="panel-zombies"
          mod={stats.zombies}
          setMod={(m) => setStats({ ...stats, zombies: m })}
        />
      </Grid>
      <Panel title="Apply" testId="panel-apply">
        <Checkbox
          label="Apply stats in game"
          checked={stats.applyStats}
          onChange={(e) => setStats({ ...stats, applyStats: e.target.checked })}
        />
        <Checkbox
          label="Log every hit (noisy)"
          checked={stats.logDamage}
          onChange={(e) => setStats({ ...stats, logDamage: e.target.checked })}
        />
      </Panel>
    </Page>
  );
}
