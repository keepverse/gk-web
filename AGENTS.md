# gk-web — agent guide

The browser control room. **Public.**

The binding rules for every Keepverse repository are in the workspace root:
`../AGENTS.md` (loaded automatically for any agent working inside this folder).
Docs live in `../docs/`. This file is emitted by kvsplit; change its template in
`tools/kvsplit/rules/templates/`, not here.

## Rules specific to this repo

- **The web reads state; it does not decide it.** Game logic is `gk-core`. A
  decision made in the browser and not in the domain is a defect in both.
- **Node is developer-only.** Players get a static build served by
  `FusionRpg.Server` from the same origin. Nothing here may become a runtime
  dependency of the shipped game.
- **A type error fails the build.** `npm run build` runs `tsc --noEmit` first; do
  not weaken it to make a red build pass.
- **Phaser stays out of the entry chunk.** Use dynamic `import()` and route-level
  splitting. A fat bundle is a code-splitting failure, not a licence to ban the
  library.
- **Buy before build.** Prefer a maintained component library over a hand-rolled
  icon, chart, gauge or animation. Ask before adding a second overlapping one.
- **Player names and roster membership load from the content catalog.** Do not
  hardcode a front-end union, and do not put copy in a numbers file.
- **No engine vocabulary on a player surface** — no raw `typeId`, `Intent` or
  `UniqueActor` in the UI, and no developer surface in game navigation.

## Build and test

```bash
npm ci
npm test            # vitest
npm run build       # tsc --noEmit + vite build
npm run check:bundle
```

## Status

Empty; not staged yet. The ownership rules still route `web/**` to `gk-core`, so
do not start work here until they are updated.
