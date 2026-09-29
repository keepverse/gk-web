import { Navigate } from "react-router-dom";
import { useResetSim, useSimCommand, useSimState } from "@/lib/bus";
import { Page } from "@/layouts/Page";
import { Button, HelpText, JsonBlock, Panel, Row } from "@/ui";

export function SimPage() {
  const sim = useSimState();
  const cmd = useSimCommand();
  const reset = useResetSim();
  const state = sim.data;

  if (sim.isSuccess && state == null) {
    return <Navigate to="/status" replace />;
  }

  const run = (path: string, body: unknown = {}) => void cmd.mutateAsync({ path, body });

  return (
    <Page title="Simulator" description="Fake injector. Do not launch PVZRH against this server.">
      <Panel>
        <HelpText className="mb-3">Fake injector. Do not launch PVZRH against this server.</HelpText>
        <Row className="gap-2">
          <Button size="sm" onClick={() => run("/hello")}>
            Hello
          </Button>
          <Button size="sm" onClick={() => run("/board/start", { levelName: "Sim" })}>
            Start board
          </Button>
          <Button size="sm" onClick={() => run("/plant/spawn", {})}>
            Spawn plant
          </Button>
          <Button size="sm" onClick={() => run("/plant/place", {})}>
            Place plant
          </Button>
          <Button size="sm" onClick={() => run("/zombie/spawn", {})}>
            Spawn zombie
          </Button>
          <Button
            size="sm"
            onClick={() => run("/plant/damage", { ptr: state?.plants[0]?.ptr, damage: 50 })}
          >
            Hit plant
          </Button>
          <Button
            size="sm"
            onClick={() => run("/zombie/damage", { ptr: state?.zombies[0]?.ptr, damage: 50 })}
          >
            Hit zombie
          </Button>
          <Button size="sm" onClick={() => run("/plant/die", { ptr: state?.plants[0]?.ptr })}>
            Die plant
          </Button>
          <Button size="sm" onClick={() => run("/zombie/die", { ptr: state?.zombies[0]?.ptr })}>
            Die zombie
          </Button>
          <Button size="sm" onClick={() => run("/mower/place", { row: 0 })}>
            Place mower
          </Button>
          <Button
            size="sm"
            onClick={() => run("/mower/start", { ptr: state?.mowers?.[0]?.ptr })}
          >
            Start mower
          </Button>
          <Button size="sm" onClick={() => run("/mower/die", { ptr: state?.mowers?.[0]?.ptr })}>
            Die mower
          </Button>
          <Button
            size="sm"
            onClick={() =>
              run("/wave", { wave: (state?.wave ?? 0) + 1, maxWave: state?.maxWave || 10 })
            }
          >
            Wave
          </Button>
          <Button size="sm" onClick={() => run("/match/win")}>
            Win
          </Button>
          <Button size="sm" onClick={() => run("/match/lose")}>
            Lose
          </Button>
          <Button size="sm" onClick={() => run("/match/result", { result: "victory" })}>
            Result victory
          </Button>
          <Button size="sm" onClick={() => run("/bullet", {})}>
            Bullet
          </Button>
          <Button size="sm" onClick={() => run("/board/end", { summary: {} })}>
            End board
          </Button>
          <Button size="sm" variant="danger" onClick={() => void reset.mutateAsync()}>
            Reset
          </Button>
        </Row>
        <JsonBlock className="mt-4" value={state} />
      </Panel>
    </Page>
  );
}
