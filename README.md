# gk-web

The browser control room: the lawn view, character and item sheets, progression
surfaces, and the live game HUD.

- **Working rules:** [AGENTS.md](AGENTS.md)
- **Design:** `gk-workflow/docs/design/`

## What belongs here

| Path | What it is |
|---|---|
| `src/` | React + TypeScript. Routes, components, the Phaser lawn scene. |
| `scripts/` | Build and verification scripts (card rendering, bundle checks). |
| `package.json` | Node toolchain, **developer only** — never shipped. |

## What does NOT belong here

- **Game logic** → `gk-core`. The web reads state; it does not decide it.
- **Injector/host code** → `gk-fusion`.
- **Content data** → `gk-content`, `gk-data`.

## Build

```bash
npm ci
npm test          # vitest
npm run build     # tsc --noEmit + vite build — a type error fails the build
npm run check:bundle   # Phaser must stay out of the entry chunk
```

**Node is a developer tool, not a runtime dependency.** Players get a static
build served by `FusionRpg.Server` from the same origin.

## Status

Empty. `kvsplit` does not yet route any path here — the ownership rules still
send `web/**` content to `gk-core`. **Do not start web work here until those
rules are updated**, or the migration will write the files somewhere else.
