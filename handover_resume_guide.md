# Handover & Resume Guide — Weibull AI Analyst

> **Restoration Baseline & Project Checkpoint**  
> **Timestamp**: 2026-09-05 Phase 12  

---

## 📌 Project Overview
Weibull AI Analyst is a high-performance, progressive web application (PWA) for Weibull distribution reliability engineering analysis, multi-dataset comparative fitting, interactive Plotly visualization, AI-assisted engineering diagnosis, and self-contained HTML report generation.

---

## 📐 Architecture & MECE Structure
```
Weibull-Analyst/
├── DEVELOPMENT_LOG.md       # Full development timeline (Phases 1–12)
├── PROJECT_STATUS.md        # Feature & module status tracker
├── README.md                # User & setup guide
├── handover_resume_guide.md # Restoration baseline & checkpoint (this file)
├── index.html               # Main HTML entry with PWA manifest links
├── package.json             # NPM dependencies & scripts
├── vite.config.ts           # Vite + PWA + Tailwind v4 build configuration
└── src/
    ├── App.tsx              # Root component & multi-group dataset state
    ├── index.css            # Design tokens (SkillsBuilder Color Master Palette)
    ├── index.tsx            # React root & PWA register
    ├── types.ts             # Core interfaces (GroupDataset, WeibullResult, etc.)
    ├── components/
    │   ├── ResultsPanel.tsx    # Analysis tab, N-dataset table & AI controls
    │   ├── TheoreticalGuide.tsx# Interactive Weibull parameter guide
    │   └── WeibullChart.tsx    # Plotly Probability/Reliability/PDF & Report engine (FS typography SSOT)
    ├── vite-env.d.ts           # PWA client types (virtual:pwa-register)
    ├── services/
    │   ├── aiService.ts        # Gemini, OpenAI, Agnes, Claude API integration
    │   └── weibullMath.ts      # Median rank regression algorithm
    └── utils/
        └── locales.ts          # Bilingual (en/zh) translation strings
```

---

## 🚀 Key Commands & Workflow
- **Development Server**: `npm run dev`
- **Production Build**: `npm run build`
- **Type Checking**: `npx tsc --noEmit`

---

## 🔍 Recent Major Fixes & Baseline Status (Phase 12)
1. **Typography SSOT**: `FS` constant in `WeibullChart.tsx` drives all chart font sizes (base 13 / tick 11.5 / axis 13.5 / annotation 20 / label 13 / stat 11.5); dead `StatRow` removed.
2. **Report 2×2 Redesign**: charts at ~600px each (2× PNG capture shown 1:1); "04 Key Parameters" tile (β/η/MTTF/R²/R(MTTF)/B₁₀) fills the grid; pinned `plotly-3.3.1.min.js` async CDN; report strings fully `lang`-aware.
3. **Icon 404 Fix**: `index.html` uses `%BASE_URL%` for favicon/apple-touch-icon (dist rewrite verified).
4. **Hygiene**: `src/vite-env.d.ts` added; `GroupDataset` imported in `ResultsPanel.tsx`; contradictory zero-usage `@` alias removed from vite.config.ts + tsconfig.json; `WeibullChart.tsx` line endings normalized to CRLF; point-stats modal localized.
5. **Clean Build**: `npm run build` exit 0; `npx tsc --noEmit` 0 errors.
6. **Known caveat**: the four `public/*.png` icons are byte-identical 1024×1024 JPEG-data files (manifest declares 192/512); regeneration deferred to avoid visual regression.

---

## 🛡️ Next Development Steps & Recommendations
- All core features are complete and fully operational.
- When resuming work in future sessions, reference `DEVELOPMENT_LOG.md` for historical RCA/CAPA context and `PROJECT_STATUS.md` for feature tracking.
