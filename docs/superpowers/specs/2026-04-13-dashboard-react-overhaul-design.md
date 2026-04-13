# Dashboard React + Vite Overhaul

**Date:** 2026-04-13
**Status:** Spec complete. Execute next session.
**Scope:** Replace the vanilla 1500-line JS / 760-line HTML dashboard with a React + Vite + Tailwind app using the agentos.sh design system, light/dark mode, and scenario-driven theming.

---

## 1. Goal

Rewrite the paracosm dashboard as a React + Vite single-page app that:
- Uses the agentos.sh theme system (CSS custom properties, light/dark mode, 5 named theme variants)
- Renders entirely from `ScenarioPackage` data via the existing `GET /scenario` endpoint
- Maintains full SSE event consumption parity with the current vanilla dashboard
- Is type-safe (TypeScript throughout)
- Builds to static HTML/JS that the existing Node HTTP server serves

---

## 2. Tech Stack

| Tool | Purpose |
|------|---------|
| React 19 | Component architecture |
| Vite | Build tooling, dev server with HMR |
| TypeScript | Type safety |
| Tailwind CSS 4 | Utility-first styling using agentos.sh design tokens |
| `next-themes` (or equivalent) | Light/dark mode with system preference detection |

No SSR. No Next.js. The Vite build produces static `index.html` + `assets/` that the paracosm HTTP server serves from `cli/dashboard/dist/`.

---

## 3. Directory Structure

```
src/cli/dashboard/
  vite.config.ts
  tailwind.config.ts
  tsconfig.json
  index.html              entry point
  src/
    main.tsx              React root
    App.tsx               tab router, scenario context, SSE provider
    theme/
      tokens.css          agentos.sh CSS custom properties (light + dark)
      tailwind-preset.ts  maps tokens to Tailwind config
      ThemeProvider.tsx    light/dark toggle, system preference
    hooks/
      useSSE.ts           SSE connection, event parsing, reconnection
      useScenario.ts      fetch /scenario, fallback to Mars defaults
      useGameData.ts      event accumulation, localStorage persistence
      useToast.ts         toast notifications
    components/
      layout/
        TopBar.tsx         logo, tagline, crisis ticker, metadata, progress
        TabBar.tsx         sim / reports / log / settings / chat / about
        LeaderBar.tsx      two-column leader cards with HEXACO traits
        StatsBar.tsx       per-side metrics driven by scenario.ui.headerMetrics
      sim/
        SimView.tsx        two-column simulation event feed
        EventCard.tsx      polymorphic: renders promotion, dept_done, decision, outcome, reaction, bulletin
        CrisisHeader.tsx   per-column crisis title/category/summary
        DivergenceRail.tsx appears when timelines diverge
        TimelineColumn.tsx compact year/event/badge timeline
        SparkLine.tsx      inline population/morale sparklines
      reports/
        ReportView.tsx     turn-by-turn comparison
        TurnCard.tsx       side-by-side turn rendering
        ReplayScrubber.tsx range slider with speed control
      settings/
        SettingsPanel.tsx  form shell
        LeaderConfig.tsx   name, archetype, colony, instructions, HEXACO sliders
        HexacoSlider.tsx   individual trait slider with label/value
        PresetSelector.tsx dropdown driven by scenario.presets
        ResourceConfig.tsx starting resources, politics, life support
        DepartmentConfig.tsx checkboxes driven by scenario.departments
        CustomEvents.tsx   turn/title/description rows
        ModelConfig.tsx    provider, commander/dept/judge model inputs
        ApiKeyConfig.tsx   API key inputs with test button
        PersonnelConfig.tsx key personnel rows driven by scenario.departments
      chat/
        ChatPanel.tsx      colonist sidebar + message thread
        ColonistCard.tsx   sidebar entry with mood color
      shared/
        Tooltip.tsx        floating popover on hover (Radix or custom)
        Toast.tsx          notification toasts
        Badge.tsx          outcome badges (RISKY WIN, SAFE LOSS, etc.)
        Card.tsx           base card with glass/neumorphic styling
```

---

## 4. Design System Integration

### 4.1 Theme tokens

Copy the agentos.sh CSS custom properties (`:root` and `.dark` blocks from `globals.css`) into `theme/tokens.css`. This gives the dashboard identical colors, typography, borders, shadows, and glass effects.

Key tokens used:
- `--color-background-primary/secondary/tertiary/glass/card/elevated`
- `--color-text-primary/secondary/muted/placeholder/contrast`
- `--color-accent-primary/secondary/gradient`
- `--color-border-primary/subtle/interactive`
- `--color-success/warning/error`
- `--neumorphic-light-shadow/dark-shadow/glow-soft`
- `--glass-surface/border/reflection`

### 4.2 Scenario color injection

The scenario's `theme.cssVariables` override tokens at runtime. Mars keeps the current warm amber/rust look through its `cssVariables` map. Lunar gets indigo/silver. The base agentos.sh tokens are the fallback.

### 4.3 Light/dark mode

System preference detection on load. Manual toggle in the top bar. Persisted to localStorage. The `.dark` class on `<html>` flips all tokens.

### 4.4 Font stack

Match agentos.sh: Inter for body, SF Mono/JetBrains Mono for monospace. Loaded via Google Fonts link (already in the current index.html).

---

## 5. SSE Architecture

### 5.1 useSSE hook

```typescript
function useSSE(): {
  status: 'connecting' | 'connected' | 'error';
  events: SimEvent[];
  results: ResultEvent[];
  isComplete: boolean;
}
```

Connects to `/events`. Parses `sim`, `status`, `result`, `complete`, `sim_error` events. Handles reconnection. Returns accumulated events for the current run.

### 5.2 useGameData hook

Wraps useSSE. Accumulates events into structured state per side (v/e). Handles localStorage persistence, cache restore on reload, clear, save/load game files. Replaces the 200 lines of state management in the current main.js.

### 5.3 useScenario hook

Fetches `GET /scenario` on mount. Falls back to Mars defaults. Returns typed `ScenarioClientPayload`. Components read labels, departments, presets, theme, and UI config from this.

---

## 6. Component Design

### 6.1 EventCard (polymorphic)

The core rendering component. Receives a `SimEvent` and renders the appropriate card based on `event.type`. Replaces the 350-line `handleSimEvent` switch block.

| Event type | Renders |
|-----------|---------|
| `turn_start` | Updates crisis header, progress bar, stats |
| `promotion` | Compact promotion list with tooltips |
| `dept_start` | Loading indicator |
| `dept_done` | Department pill with citations/tools count, tool forge cards |
| `commander_deciding` | Loading indicator |
| `commander_decided` + `outcome` | Decision card with outcome badge, colony deltas, expandable reasoning |
| `drift` | Inline HEXACO drift indicators |
| `colonist_reactions` | Mood distribution bar, individual quotes with tooltips |
| `bulletin` | Colony bulletin posts |
| `turn_done` | Turn separator |

### 6.2 StatsBar (scenario-driven)

Reads `scenario.ui.headerMetrics` to determine which stats to show, with format instructions (number, percent, currency). No hardcoded "Population", "Morale", "Food" labels.

### 6.3 SettingsPanel (scenario-driven)

Leader presets from `scenario.presets`. Department checkboxes from `scenario.departments`. Setup defaults from `scenario.setup`. The form adapts to any scenario without code changes.

### 6.4 Tooltip

Floating popover using portal rendering. Positioned relative to trigger element. Shows on hover with debounce. Replaces the 60-line vanilla tooltip system.

---

## 7. Build Integration

### 7.1 Development

```bash
cd src/cli/dashboard && npm run dev
# Vite dev server on :5173 with HMR
# Proxies /events, /scenario, /setup, /chat, /clear to :3456
```

### 7.2 Production build

```bash
cd src/cli/dashboard && npm run build
# Produces dist/index.html + dist/assets/
```

The paracosm HTTP server serves `dist/index.html` and `dist/assets/*` instead of the current `main.js` and `index.html`.

### 7.3 Package scripts

```json
{
  "dashboard:dev": "cd src/cli/dashboard && npm run dev",
  "dashboard:build": "cd src/cli/dashboard && npm run build",
  "dashboard": "npm run dashboard:build && npx tsx src/cli/serve.ts"
}
```

---

## 8. Migration Strategy

### 8.1 Keep the vanilla dashboard as fallback

The old `main.js` and `index.html` stay in the repo (renamed to `main.legacy.js` and `index.legacy.html`) until the React version reaches full parity. The server can switch between them via an env flag: `DASHBOARD=legacy npx tsx src/cli/serve.ts`.

### 8.2 Phased parity

| Sub-project | What | Parity target |
|------------|------|---------------|
| A: Scaffold | Vite + React + Tailwind + theme + SSE hook + app shell with tabs | App boots, shows scenario name, connects SSE |
| B: Simulation view | Two-column event feed, crisis headers, stats bars, leader bars, sparklines, tooltips | The main 80% of what users see |
| C: Settings + Reports + Chat | Setup form, report generation with scrubber, colonist chat | Full feature parity |
| D: Polish | Save/load/replay, toasts, keyboard shortcuts, mobile responsiveness, scenario selector | Production-ready |

### 8.3 Acceptance criteria per sub-project

**A (Scaffold):**
- `npm run dashboard:dev` boots Vite with HMR
- App renders with agentos.sh theme tokens in light and dark mode
- `useScenario` fetches and displays scenario name
- `useSSE` connects and logs events to console
- Tab navigation works (sim, settings, reports, chat, log, about)

**B (Simulation view):**
- All SSE event types render in the two-column feed
- Crisis headers update per column
- Stats bars update from `scenario.ui.headerMetrics`
- Leader bars show HEXACO traits and sparklines
- Tool forge cards render with expandable details
- Decision cards render with outcome badges and colony deltas
- Colonist reactions render with mood distribution bar
- Divergence rail appears when timelines diverge
- Tooltips work on all hover-tip elements

**C (Settings + Reports + Chat):**
- Settings form populates from scenario presets and defaults
- HEXACO sliders work with live value display
- Department checkboxes generated from scenario.departments
- Custom events and personnel rows are additive/removable
- Launch button sends POST /setup and switches to sim tab
- Reports generate turn-by-turn comparison from accumulated events
- Replay scrubber works
- Chat connects to POST /chat with colonist context

**D (Polish):**
- Save game downloads JSON, load game replays events
- Config sharing via URL parameters
- Toast notifications for rate limits, errors, completion
- localStorage persistence survives refresh
- Scenario selector dropdown in settings (Mars / Lunar)
- Mobile responsive (stacked columns on narrow screens)
- Keyboard shortcuts (Ctrl+S save, Ctrl+R replay)

---

## 9. What Does NOT Change

- Node HTTP server (`server-app.ts`) stays as-is
- SSE protocol and event types stay as-is
- `GET /scenario`, `POST /setup`, `POST /chat`, `POST /clear` endpoints stay as-is
- Save/load JSON format stays as-is
- The engine and runtime layers are untouched
- `npm run build` (tsc for the package) is separate from `npm run dashboard:build` (Vite for the UI)

---

## 10. Dependencies

```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "@vitejs/plugin-react": "^4.0.0",
  "vite": "^6.0.0",
  "tailwindcss": "^4.0.0",
  "typescript": "^5.4.0"
}
```

These are devDependencies of the dashboard, not the paracosm package. They live in `src/cli/dashboard/package.json` and are not published to npm.

---

## 11. Risks

- **Vite dev server port conflicts** with the simulation server on 3456. Vite runs on 5173 with a proxy config to forward API calls.
- **SSE reconnection** needs careful handling. The current vanilla implementation handles reconnection and buffer replay. The React version must match this behavior.
- **localStorage key migration.** The React app should read existing `mars-game-data` / `mars-settings` keys so users don't lose their data. New keys use the `storageKey()` pattern from Phase 3.
- **Bundle size.** React + Vite production build should stay under 200KB gzipped. No heavy UI libraries (no Material UI, no Chakra). Just Tailwind utilities.
