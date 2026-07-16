# Weibull AI Analyst

> 現代化韋伯分析工具 — 互動式機率繪圖、可靠度曲線、AI 驅動的可靠度工程洞察。

[![Deploy](https://github.com/Chun-Chieh-Chang/Weibull-Analyst/actions/workflows/deploy.yml/badge.svg)](https://github.com/Chun-Chieh-Chang/Weibull-Analyst/actions/workflows/deploy.yml)

---

## 功能特色

- **韋伯分析引擎** — 支援單組與雙組比較分析、暫緩數據 (Suspension)、中位秩回歸
- **三種圖表** — 機率圖 (Probability Plot)、可靠度曲線 (Reliability)、機率密度函數 (PDF)
- **AI 分析** — 支援 Gemini / OpenAI / Agnes / Claude，可選模型，雙語分析 (繁中 + English)
- **HTML 報告** — 一鍵導出含三張圖表、指標卡、AI 分析與原始數據的完整報告
- **雙主題** — 深色/淺色模式，遵循 SkillsBuilder Color Master Palette
- **雙語言** — 繁體中文 / English

## 技術架構

- **前端**: React 19 + TypeScript + Vite 6
- **樣式**: Tailwind CSS v4 (`@tailwindcss/vite`)
- **圖表**: plotly.js-dist-min v3 + react-plotly.js v2
- **AI**: `@google/genai` (Gemini SDK) + OpenAI SDK + fetch (Agnes / Claude)
- **PWA**: vite-plugin-pwa (Service Worker, Manifest)
- **CI/CD**: GitHub Actions → GitHub Pages

## 本地開發

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # → dist/
```

## 使用說明

1. 左側輸入失效數據（每行一筆，加 `S` 表示暫緩），點擊 Calculate
2. 中央圖表區可切換 Probability / Reliability / PDF 三種視圖
3. 右側 Insights 分頁顯示指標；點擊 Generate Insights 使用 AI 分析
4. 工具列 Report 按鈕可導出 HTML 報告

## AI 供應商

| 供應商 | 模型選項 | API 格式 |
|--------|---------|---------|
| Google Gemini | gemini-2.5-flash / gemini-3.5-flash | `@google/genai` SDK |
| OpenAI | gpt-4o-mini | `openai` SDK |
| Agnes | agnes-2.0-flash | REST API (`apihub.agnes-ai.com`) |
| Anthropic Claude | claude-sonnet-4-6 / claude-haiku-4-5 | REST API (`api.anthropic.com`) |

API Key 儲存於瀏覽器 localStorage，不會傳送至第三方伺服器。

## 自動部署

推送至 `main` 分支即觸發 GitHub Actions 自動構建與部署至 GitHub Pages。

---

*Developed by Wesley Chang @ Mouldex*
