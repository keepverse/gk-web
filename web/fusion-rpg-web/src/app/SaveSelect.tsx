import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCreatePlayer, usePlayers, useSelectPlayer } from "@/lib/bus";
import { Button, TextInput } from "@/ui";

/**
 * Plate 01 §B — "A save is chosen once, at the door. This is where the current build's HudBar
 * player picker goes — it is not a dropdown wedged into the top bar of every screen."
 *
 * The plate's own mockup shows level/creatures-bound/sectors-held/last-played per slot — `PlayerDto`
 * (contract/lib/bus/types.ts) only carries `id`/`name`/`createdUtc`/`worldSeed`. Shipping fabricated
 * stats would be worse than shipping the real, narrower ones: name, creation date and world seed,
 * honestly (the seed shown per spec-world-seed.md's own Q7 "the whole save" framing — a player can
 * see, and per that spec's §3.5 note, potentially share, their save's own root).
 */
export function SaveSelect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const players = usePlayers();
  const selectPlayer = useSelectPlayer();
  const createPlayer = useCreatePlayer();
  const [creating, setCreating] = useState(searchParams.get("create") === "1");
  const [newName, setNewName] = useState("");

  const items = players.data?.items ?? [];
  const currentId = players.data?.currentPlayerId;

  function continueWith(id: number) {
    void selectPlayer.mutateAsync(id).then(() => navigate("/sanctum"));
  }

  function submitCreate() {
    const name = newName.trim();
    if (!name) return;
    void createPlayer.mutateAsync(name).then((created) => {
      setNewName("");
      setCreating(false);
      continueWith(created.id);
    });
  }

  return (
    <div className="grid h-screen place-items-center bg-panel-inset" data-testid="save-select">
      <div className="w-[min(560px,90vw)]">
        <h2 className="mb-4 text-center font-display text-2xl text-text">Choose a summoner</h2>
        <div className="grid gap-2" data-testid="save-slots">
          {items.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-md border border-border-control bg-panel p-3"
              data-testid={`save-slot-${p.id}`}
              data-selected={p.id === currentId}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-text" data-testid={`save-slot-name-${p.id}`}>
                  {p.name}
                </span>
                <span className="block text-xs text-muted">
                  Created {new Date(p.createdUtc).toLocaleDateString()}
                </span>
                <span
                  className="block font-mono text-[10px] text-muted"
                  data-testid={`save-slot-seed-${p.id}`}
                >
                  Seed {p.worldSeed}
                </span>
              </span>
              <Button
                size="sm"
                variant={p.id === currentId ? "primary" : "ghost"}
                data-testid={`save-slot-continue-${p.id}`}
                onClick={() => continueWith(p.id)}
              >
                Continue
              </Button>
            </div>
          ))}

          {creating ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-border-control p-3" data-testid="save-slot-create-form">
              <TextInput
                autoFocus
                data-testid="save-slot-create-input"
                value={newName}
                placeholder="Summoner name"
                className="flex-1"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitCreate()}
              />
              <Button size="sm" data-testid="save-slot-create-submit" onClick={submitCreate}>
                Create
              </Button>
            </div>
          ) : (
            <button
              type="button"
              data-testid="save-slot-new"
              onClick={() => setCreating(true)}
              className="rounded-md border border-dashed border-border-control p-3 text-center text-muted hover:bg-panel hover:text-text"
            >
              + New summoner
            </button>
          )}
        </div>
        <div className="mt-4 text-center">
          <Button variant="ghost" size="sm" data-testid="save-select-back" onClick={() => navigate("/")}>
            Back to title
          </Button>
        </div>
      </div>
    </div>
  );
}
