# Development Log — Weibull AI Analyst

> **Systematic development history based on MECE principles**

## 📅 2026-09-06 — Phase 13: Chart Axis Harmony & 8D-Creator Color System

### Overview
Improved probability-plot readability (anchored Y ticks, frame-safe fit line, balanced point/line weights, engineering X-axis ticks), adopted the 8D-Creator interface color logic (token bridge with navy primary), evaluated and rolled back a mono-color print palette after visual review, and ran a second hygiene pass.

### Changes
- **Chart harmony**: Y-axis tick anchors restored below 10% (0.5/1/2/5); fit-line extension clamped to F ∈ [2%, 98%] in `weibullMath.ts` (cosmetic only — β/η/MTTF/R² untouched); data points 8→10px, fit line 2→2.25px; report markers 11→12px.
- **X-axis engineering ticks**: log-axis raw mantissa labels (2,3,4… meaning 200,300,400) replaced with explicit real values 50/100/200/300/400/500/1000 in both interactive chart and HTML report.
- **8D-Creator color system**: `index.css` now carries a `--brand-*` SSOT constant layer bridged to runtime tokens (`--accent` → navy `#1E3A5F` light mode, `--accent-interactive` → blue `#3B82F6` for interactive elements, `--accent-hover`, `--warning`); all hardcoded indigo/blue classes removed across `App.tsx`, `ResultsPanel.tsx`, `PwaPrompt.tsx`, `WeibullChart.tsx` report CSS.
- **mono-color evaluation & rollback**: applied a two-ink print palette (Cobalt/Terracotta on Cool-Gray substrate) per the mono-color skill; rolled back after review — the 8D-Creator look was kept. No mono-color tokens remain (verified by grep).
- **Hygiene pass 2**: removed dead CSS (`bounceSoft` keyframes/class, `pb-safe`) and 14 dead locale keys (both en + zh, verified unreferenced including dynamic-leaf checks); locale SSOT now 51 keys, 0 unused.

### Verification
- `npm run build` → exit 0; `npx tsc --noEmit` → 0 errors.
- Grep: zero residual mono-color hex values; zero unused locale keys; dead CSS classes absent.
- X-tick fix and chart-harmony values verified present after rollback (surgical, zero feature regression).


---

## 📅 2026-09-05 — Phase 12: Typography System, Report Layout Redesign & Codebase Hygiene

### Overview
Established a single-source typography scale (FS constant) for the interactive chart, redesigned the HTML report layout from a dense 3-up chart grid to a 2×2 grid with a Key Parameters tile, and performed a full codebase hygiene pass (zero-regression policy).

### Changes
- **Typography SSOT**: Added `FS` scale constant in `WeibullChart.tsx` (base 13 / tick 11.5 / axis 13.5 / annotation 20 / label 13 / stat 11.5). All chart fonts now reference it; removed conflicting JSX margin override and dead `StatRow` component.
- **Report Layout Redesign**: Chart grid changed 3-up → 2×2 (each chart ~600px, matching the 2× PNG capture 1:1); third chart paired with a new "04 Key Parameters" tile (β/η/MTTF/R²/R(MTTF)/B₁₀ per group, color-coded); removed duplicate metrics from Summary boxes; numbered captions (01–04); print-safe `break-inside:avoid`.
- **Report Engineering**: CDN pinned to `plotly-3.3.1.min.js` (async); capture upgraded to 1200×800 @2×; all plotly `font.weight` specs removed (unsupported in plotly.js v3); report fully localized via `lang` (`zh-TW`/`en-US` date, headers, table columns, failure modes).
- **Information Density**: Interactive footer stat strip (β/η/MTTF/R²/N per visible group); probability-plot hover now shows Median Rank % + fitted F(t)%; report summary includes sample context line and B₁₀/R(MTTF).
- **Codebase Hygiene (this phase)**: Fixed real 404 — `index.html` icons now use `%BASE_URL%` (dist rewrite verified); added `src/vite-env.d.ts` (`vite-plugin-pwa/client` types); imported `GroupDataset` into `ResultsPanel.tsx` (pre-existing tsc error); removed contradictory zero-usage `@` alias (vite.config.ts + tsconfig.json); normalized `WeibullChart.tsx` line endings to CRLF; i18n hole closed (point-statistics modal now localized).
- **Tooling note**: Verification baseline is `npm run build` (vite only) + `npx tsc --noEmit`; both exit 0 after this phase.

### Verification
- `npm run build` → exit 0; `npx tsc --noEmit` → 0 errors (baseline was 3).
- Icon 404 fixed: `dist/index.html` carries `/Weibull-Analyst/` prefix on favicon & apple-touch-icon.
- Known asset caveat: the four `public/*.png` icons are byte-identical 1024×1024 JPEG-data files named .png (PWA manifest declares 192/512). Browsers render them via content sniffing; regeneration deferred to avoid visual regression.


## 📅 2026-08-12 — Phase 11: AI Engine Upgrade & PWA Base URL Path Fix

### Overview
Upgraded AI provider models to the latest API standards (Agnes 2.5-flash & Gemini 3.6-flash). Fixed GitHub Pages subpath 404 image request bug in PWA components using `import.meta.env.BASE_URL`. Performed full MECE codebase audit and documentation alignment.

### Changes
- **Agnes Model Upgrade**: Updated Agnes model identifier from `agnes-2.0-flash` to `agnes-2.5-flash` in `aiService.ts` and dropdown UI in `ResultsPanel.tsx`.
- **Gemini Model Upgrade**: Added `gemini-3.6-flash` to `GeminiModel` union in `types.ts`, set as default in `aiService.ts` and `ResultsPanel.tsx`, and updated model selector options with 3.6 Flash (Latest), 3.5 Flash (Stable), and 2.5 Flash (Legacy).
- **PWA Image Path 404 Fix**: Replaced absolute root image paths (`/pwa-192x192.png`) with Vite base-aware paths (`${import.meta.env.BASE_URL}pwa-192x192.png`) in `PwaPrompt.tsx` to fix 404 errors when deployed on GitHub Pages subpath (`/Weibull-Analyst/`).
- **Documentation & Handover Sync**: Synced `README.md`, `PROJECT_STATUS.md`, `DEVELOPMENT_LOG.md`, and `handover_resume_guide.md` with Phase 11 updates.

---

## 📅 2026-08-12 — Phase 10: Mobile PWA Engine & Touch UX Optimization

### Overview
Upgraded Weibull AI Analyst into a full-featured Progressive Web App (PWA). Configured Workbox runtime caching for offline Plotly CDN charts, built custom PWA installation banner for Android/Chrome & iOS Safari, added Service Worker auto-update toast notifications, and optimized mobile touch UX with 44x44px touch targets and safe-area-inset boundary adaptation.

### Changes
- **Workbox Runtime Caching**: Added `runtimeCaching` rule in `vite.config.ts` for `https://cdn.plot.ly/*` with CacheFirst strategy, ensuring offline HTML report generation and interactive chart rendering without network connection.
- **PWA Manifest & Meta Tags Calibration**: Aligned `theme_color` and `background_color` to `#F9FAFB` in `vite.config.ts`; added comprehensive PWA meta tags (`apple-mobile-web-app-capable`, `mobile-web-app-capable`, `viewport-fit=cover`) in `index.html`.
- **PWA Prompt & SW Toast Component (`PwaPrompt.tsx`)**: Created `PwaPrompt.tsx` supporting Chrome `beforeinstallprompt` event, iOS Safari "Add to Home Screen" step-by-step modal guide, and Service Worker version update toast notifications. Repositioned install prompt to `top-16` to avoid bottom button overlaps.
- **Offline Network Indicator**: Integrated `navigator.onLine` state detection in `App.tsx` header with real-time offline status badge ("離線模式 Offline").
- **Mobile Touch UX & Layout Calibration**: Added `pb-safe`, `mb-safe`, and safe-area-inset CSS variables in `index.css`. Upgraded mobile bottom tab switcher and action buttons to meet >=44x44px touch target guidelines.
- **Chart Aspect Ratio & Button Obscuration Fixes**: Refactored `WeibullChart.tsx` toolbar into responsive wrap layout; restricted plot max-height (`max-h-[calc(100vh-170px)]`) to prevent vertical stretch; added bottom padding (`pb-28 lg:pb-6`) in `ResultsPanel.tsx` so all bottom actions remain 100% visible.
- **Build Verification**: Verified `npm run build` passes cleanly with Workbox service worker (`dist/sw.js`) and manifest generated.

---

## 📅 2026-07-28 — Phase 9: Multi-Group Calculation Engine, HTML Report Fix & Typography Polish

### Overview
Fixed multi-group data calculation empty state bug, refactored HTML report generator for N-dataset dynamic rendering, refined top-right formula box typography, created handover restoration baseline, and synced all development documentation.

### Changes
- **Multi-Group Data Calculation Fix**: Replaced legacy `if (!result1)` checks with `validGroups.length === 0` in `ResultsPanel.tsx` and `WeibullChart.tsx`, resolving empty-state blockage when operating in Multi-Group mode with 3 or more datasets.
- **Dynamic HTML Report Generator**: Refactored `generateHTMLReport` in `WeibullChart.tsx` to eliminate hardcoded `r1` / `r2` references that caused `TypeError` runtime crashes. Report now dynamically renders Metrics, Summary, Raw Data tables, and Plotly CDN charts for N datasets.
- **Dynamic Data Points Table**: Updated `ResultsPanel.tsx` Data tab to dynamically render table columns and failure/suspension toggle buttons for all active datasets.
- **Chart Typography Refinement**: Reduced formula annotation box font size to 10.5px–11px with `font-weight: 600` on dataset labels and soft border styling; adjusted overlay badges (`R=0.95`, `R(η)=e⁻¹`) for clean visual harmony.
- **Handover Baseline & Doc Sync**: Created `handover_resume_guide.md` as project restoration checkpoint; updated `DEVELOPMENT_LOG.md` and `PROJECT_STATUS.md`.
- **Build Verification**: Verified `npm run build` passes with zero errors and clean output.

---

## 📅 2026-07-17 — Phase 8: Report Chart UI Overhaul & Codebase Cleanup

### Overview
Interactive CDN charts for all three report charts, layout refinements, offline fallback fix, axis font consistency, and comprehensive dead code removal.

### Changes
- **All report charts use Plotly CDN**: Probability, Reliability, and PDF now all render interactively from `cdn.plot.ly/plotly-latest.min.js` with draggable overlay labels on Reliability chart
- **Offline fallback**: `showFallback()` helper hides empty `.plot` div and shows PNG fallback when CDN fails (previously the absolutely-positioned plot div covered the fallback)
- **Axis font consistency**: Fixed y-axis title losing `font.size` due to `layout.yaxis.title = { text }` overwrite; both axes now have identical font config
- **Label clipping fix**: Removed `overflow:hidden` from `.chart-wrap`, applied to `.chart-wrap .plot` instead, so draggable labels and annotations are visible
- **Report layout rearrangement**: Left column (Metrics + Summary stacked) | Right column (Raw Data), AI Analysis full-width below
- **Dead code removal**: Removed unused `getFMShort()` function; simplified `RankMethod` enum (removed dead `MEAN` branch, inlined MEDIAN calculation)
- **Dependency fix**: Moved `@tailwindcss/vite` from `dependencies` to `devDependencies`
- **Theme color fix**: `index.html` meta `theme-color` changed from `#0F172A` (dark) to `#F9FAFB` (light)
- **Docs sync**: README.md, DEVELOPMENT_LOG.md, PROJECT_STATUS.md updated

---

## 📅 2026-07-17 — Phase 7: Final Codebase Refactor & Dark Mode Purge

### Overview
Complete removal of all dark mode remnants, dead code audit, garbled text fix, MECE cleanup, git baseline.

### Changes
- **Purged dark mode**: Removed `Theme` type, all `dark:` Tailwind classes across ResultsPanel.tsx and TheoreticalGuide.tsx; strict light-only theme
- **Removed dead code**: `generatePDFPoints()` unused export from weibullMath.ts
- **Fixed garbled Chinese**: Restored `App.tsx` lines 136/140 corrupted Chinese strings to `'A 組數據 (Group A)'`, `'B 組數據 (Group B)'`, `'失效數據 (Failure Data)'`
- **Cleaned artifacts**: Removed `.vite/` auto-generated cache directory, added to `.gitignore`
- **Documentation sync**: Updated DEVELOPMENT_LOG.md and PROJECT_STATUS.md to reflect current feature set
- **Build verification**: Confirmed `npm run build` passes with zero errors

---

## 📅 2026-07-16 — Phase 6: Codebase Cleanup & Doc Sync

### Overview
Full project audit: identify and remove dead code, unused dependencies, obsolete config; rewrite all docs to match current feature state; MECE reorganization; create version baseline.

### Changes
- **Removed dead files**: `.env.local`, `metadata.json`, `jules.yml`, `REFACTORING_SUMMARY.md`, `PROJECT_STRUCTURE.md`
- **Cleaned dependencies**: Removed `autoprefixer` + `postcss` (unused with Tailwind v4)
- **Tuned config**: Removed `experimentalDecorators` from tsconfig.json
- **Normalized whitespace**: Removed excess blank lines in App.tsx
- **Rewrote docs**: `README.md`, `PROJECT_STATUS.md`, `DEVELOPMENT_LOG.md` synced to latest features
- **Committed baseline**: `git commit` + `git push`

---

## 📅 2026-07-16 — Phase 5: OpenAI Model Selector + Claude Provider

### Overview
Added model selection for OpenAI and Claude, matching the existing Gemini pattern.

### Changes
- **types.ts** — Added `OpenAIModel` (`gpt-4o-mini`) and `ClaudeModel` (`claude-sonnet-4-6`, `claude-haiku-4-5`); extended `AIProvider` with `'CLAUDE'`
- **aiService.ts** — Added Claude branch using `api.anthropic.com/v1/messages` Messages API; `analyzeWithAI` accepts `openaiModel` and `claudeModel` params
- **ResultsPanel.tsx** — Model selectors for OpenAI and Claude; Claude API key management; localStorage persistence for model preferences

---

## 📅 2026-07-15 — Phase 4: UI/UX Overhaul & Report Polish

### Overview
Applied SkillsBuilder Color Master Palette, optimized report layout, fixed Gemini API changes.

### Changes
- **CSS variables**: `--bg-app`, `--bg-surface`, `--bg-sidebar`, `--text-primary`, `--text-secondary`, `--border`, `--accent` across App.tsx, ResultsPanel, WeibullChart, index.css
- **Report layout**: Dense horizontal, 3-column charts, min font 13px, Metrics + Summary side by side, AI + Data side by side
- **Report footer**: "本報告由凱益品管部產出 This Report is Generated by Mouldex QC Department"
- **AI text colorization**: Chinese in `#1D4ED8` blue, English in `#374151` dark gray
- **Fixed Gemini v1.39.0 API**: `getGenerativeModel` → `ai.models.generateContent({ model, contents, config })`
- **Fixed model name**: `gemini-1.5-flash` → `gemini-2.5-flash`
- **Added `GeminiModel` type**: `gemini-2.5-flash` | `gemini-3.5-flash`
- **Gemini Model selector**: Dropdown in AI Settings modal, persisted in localStorage

---

## 📅 2026-04-10 — Phase 3: PWA Integration & Mobile Optimization

### Overview
Added PWA support with Service Worker auto-update, Web App Manifest, icons, and mobile viewport optimization.

### Changes
- Installed `vite-plugin-pwa` with `autoUpdate` registration
- Manifest with theme `#0F172A`, display `standalone`
- PWA icons in `public/` (192, 512, maskable, apple-touch)
- Service Worker registration in `src/index.tsx` via `virtual:pwa-register`
- SEO meta tags (theme-color, description, apple-mobile-web-app)

---

## 📅 2026-01-31 — Phase 2: Deployment Automation & Doc Refactor

### Changes
- GitHub Actions `deploy.yml` (checkout → npm ci → build → upload → deploy)
- README rewrite with tech stack, setup, auto-deploy docs
- PROJECT_STATUS.md structured into 5 MECE modules
- DEVELOPMENT_LOG.md timeline + decision records

---

## 📅 2026-01-31 — Phase 1: Fixes & Refactoring

### Changes
- Standardized structure: moved all source to `src/`
- Upgraded to Tailwind CSS v4 with Vite plugin
- Cleaned `index.html`: removed CDN links, unified Vite dependency management
- AI service refactor: `geminiService` → `aiService`, added OpenAI support
- API Key input via UI + localStorage
- Dark/light theme toggle fix (`@custom-variant dark`)

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build tool | Vite 6 | Fast HMR, native ESM |
| Styling | Tailwind CSS v4 | Atomic CSS, official Vite plugin |
| Charts | plotly.js-dist-min v3 | Probability axis transformation support |
| AI SDK | `@google/genai` | Official Google SDK (v1.39+) |
| State | React hooks + localStorage | Simple, no external state lib needed |
| Deployment | GitHub Actions → Pages | Zero-infrastructure CI/CD |

## Directory Structure (MECE)

```
src/
  components/     UI components (single responsibility)
    WeibullChart.tsx      Chart rendering, report generation
    ResultsPanel.tsx      Metrics, AI analysis, settings modal
    TheoreticalGuide.tsx  Weibull theory reference
  services/
    weibullMath.ts        Weibull calculation engine
    aiService.ts          AI provider service (Gemini/OpenAI/Agnes/Claude)
  utils/
    locales.ts            Bilingual translation (zh/en)
  types.ts                All TypeScript type definitions
  App.tsx                 Main layout and state orchestration
  index.tsx               Entry point + PWA registration
  index.css               Global styles + CSS variables + animations
```

---

*This log follows the Development Verification SOP (Standard Operating Procedure) and MECE principles.*
