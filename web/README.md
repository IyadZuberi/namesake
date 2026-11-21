# Namesake web

Static product site. React, TypeScript, Vite, Tailwind, shadcn-style components, Framer Motion, React Flow. No server. No API keys. Synthetic Fire Drill data only.

## Run

```
cd web
npm install
npm run dev
```

Open http://127.0.0.1:5173/. `npm run build` writes `dist/`. `npm run preview` serves that build.

## Vercel

Set the project **Root Directory** to `web`.

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- No environment variables

`vercel.json` rewrites SPA routes to `index.html` and sets a CSP. `style-src` allows inline styles because React Flow and Framer Motion set style attributes. Scripts stay on `'self'`.

## Data

- `data/cases.json` and `public/data/cases.json` — 122 Fire Drill cases from `tools/bundle.py` (engine traces). Gate facts stay the engine's dicts. `one_fact` is copied from the engine reason when that reason already says what would settle it, and left empty otherwise.
- `data/scoreboard.json` and `public/data/scoreboard.json` — aggregates only.
- `src/data/showcase.json` — case `S-0072` sliced from that bundle. The screen shows this one case; the other 121 are in the bundle.
- `web/data/sample-cases.json` — the hand-written contract sample. `python selfcheck.py` still checks it.

Do not put event data in this folder.

## Credits

- [shadcn/ui](https://ui.shadcn.com) (MIT) — button, card, and badge patterns
- [React Flow](https://reactflow.dev) / `@xyflow/react` (MIT) — the knowledge graph
- [Framer Motion](https://www.framer.com/motion/) (MIT) — page motion, ease-out, reduced motion
- [Geist](https://vercel.com/font) (SIL Open Font License) via Fontsource
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (SIL Open Font License) via Fontsource
- [Tailwind CSS](https://tailwindcss.com) (MIT), [Radix Slot](https://www.radix-ui.com) (MIT), [Lucide](https://lucide.dev) (ISC)
