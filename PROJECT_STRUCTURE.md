# Weibull Analyst 專案結構圖（MECE 版）

> 本文檔展示專案的完整目錄結構，並說明各模塊如何遵循 MECE 原則

---

## 📦 完整目錄結構

```
Weibull-Analyst/
│
├─ 📄 配置與元數據 (Configuration & Metadata)
│  ├─ .env.local              # 環境變量（API Keys）
│  ├─ .gitignore              # Git 忽略規則
│  ├─ package.json            # 專案依賴與腳本
│  ├─ package-lock.json       # 依賴鎖定文件
│  ├─ tsconfig.json           # TypeScript 配置
│  ├─ vite.config.ts          # Vite 構建配置
│  ├─ index.html              # HTML 入口模板
│  └─ metadata.json           # AI Studio 元數據
│
├─ 🤖 CI/CD 自動化 (CI/CD Automation)
│  └─ .github/
│     └─ workflows/
│        └─ deploy.yml        # GitHub Actions 部署流程
│
├─ 💻 源代碼 (Source Code)
│  └─ src/
│     ├─ 🧩 組件層 (Component Layer)
│     │  └─ components/
│     │     ├─ DataInput.tsx           # 數據輸入組件
│     │     ├─ WeibullChart.tsx        # 威布爾圖表組件
│     │     └─ AIAnalysisPanel.tsx     # AI 分析面板組件
│     │
│     ├─ 🔧 服務層 (Service Layer)
│     │  └─ services/
│     │     ├─ aiService.ts            # AI 服務（Gemini + OpenAI）
│     │     └─ weibullCalculations.ts  # 威布爾計算引擎
│     │
│     ├─ 🛠️ 工具層 (Utility Layer)
│     │  └─ utils/
│     │     └─ formatters.ts           # 格式化工具函數
│     │
│     ├─ 📐 類型定義 (Type Definitions)
│     │  └─ types.ts                   # TypeScript 接口與類型
│     │
│     ├─ 🎨 樣式 (Styles)
│     │  └─ index.css                  # 全局樣式（Tailwind v4）
│     │
│     ├─ 🚀 應用入口 (Application Entry)
│     │  ├─ App.tsx                    # 主應用組件
│     │  └─ index.tsx                  # React 渲染入口
│
├─ 📚 文檔 (Documentation)
│  ├─ README.md                # 專案使用指南（對外）
│  ├─ PROJECT_STATUS.md        # 專案當前狀態（團隊同步）
│  ├─ DEVELOPMENT_LOG.md       # 開發歷程記錄（技術追溯）
│  └─ REFACTORING_SUMMARY.md   # 文檔重構總結（本次提交）
│
└─ 🏗️ 構建產物 (Build Artifacts) - 僅本地
   ├─ node_modules/           # 依賴包（不提交）
   ├─ dist/                   # 生產構建產物（部署至 GitHub Pages）
   └─ .vite/                  # Vite 緩存（不提交）
```

---

## 🎯 MECE 原則體現

### 一、代碼層級分離（互斥性）

| 層級 | 目錄 | 職責 | 依賴關係 |
|------|------|------|----------|
| **展示層** | `src/components/` | UI 組件、用戶交互 | → 服務層、工具層 |
| **服務層** | `src/services/` | 業務邏輯、API 調用 | → 工具層 |
| **工具層** | `src/utils/` | 通用輔助函數 | 無依賴（最底層） |
| **類型層** | `src/types.ts` | TypeScript 類型定義 | 被所有層引用 |

**互斥保證**：
- ✅ 組件不包含業務邏輯計算
- ✅ 服務層不包含 UI 渲染
- ✅ 工具函數完全獨立於業務

### 二、文檔分類（互斥性 + 完整性）

| 文檔 | 目標讀者 | 時間維度 | 內容重點 |
|------|---------|---------|---------|
| `README.md` | 新用戶、外部開發者 | 永恆（不常變） | 如何使用、如何部署 |
| `PROJECT_STATUS.md` | 團隊成員、協作者 | 當前時刻 | 進度、狀態、計劃 |
| `DEVELOPMENT_LOG.md` | 技術負責人、未來維護者 | 歷史時間軸 | 決策、問題、方案 |

**完整性保證**：
- ✅ 任何專案相關問題都能在某份文檔找到答案
- ✅ 無信息空白區域

### 三、配置文件分類（功能互斥）

| 配置文件 | 作用範疇 | 影響階段 |
|---------|---------|---------|
| `package.json` | 依賴管理、腳本定義 | 開發 + 構建 |
| `tsconfig.json` | TypeScript 編譯規則 | 開發 + 構建 |
| `vite.config.ts` | 構建流程配置 | 構建 + 部署 |
| `.env.local` | 環境變量（密鑰） | 運行時 |
| `.github/workflows/deploy.yml` | CI/CD 自動化 | 部署 |

---

## 🔄 數據流示意圖

```
用戶輸入
   ↓
📱 DataInput.tsx (組件層)
   ↓
🔧 aiService.ts (服務層)
   ↓
🌐 Gemini/OpenAI API
   ↓
🔧 weibullCalculations.ts (服務層)
   ↓
📊 WeibullChart.tsx (組件層)
   ↓
用戶查看結果
```

**分層保障**：
- 每層職責單一
- 數據流向明確
- 易於測試與維護

---

## 🚀 部署流程圖

```
開發者推送代碼
   ↓
GitHub 接收 push 事件
   ↓
觸發 .github/workflows/deploy.yml
   ↓
┌─────────────────────────┐
│   Build Job             │
│  ├─ Checkout 代碼       │
│  ├─ Setup Node.js 20    │
│  ├─ npm ci              │
│  ├─ npm run build       │
│  └─ Upload ./dist       │
└─────────────────────────┘
   ↓
┌─────────────────────────┐
│   Deploy Job            │
│  └─ Deploy to Pages     │
└─────────────────────────┘
   ↓
✅ GitHub Pages 更新完成
```

---

## 📊 模塊依賴關係圖

```
┌──────────────────────────────────────────┐
│              App.tsx                     │  ← 頂層組合
│  (整合所有組件與服務)                     │
└──────────────────────────────────────────┘
         ↓          ↓          ↓
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ DataInput   │ │WeibullChart │ │AIAnalysis   │  ← 組件層
└─────────────┘ └─────────────┘ └─────────────┘
         ↓                ↓              ↓
┌──────────────────────────────────────────┐
│         services/                        │  ← 服務層
│  ├─ aiService.ts                         │
│  └─ weibullCalculations.ts               │
└──────────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────────┐
│         utils/                           │  ← 工具層
│  └─ formatters.ts                        │
└──────────────────────────────────────────┘
                  ↓
┌──────────────────────────────────────────┐
│         types.ts                         │  ← 類型層
│  (被所有層引用)                           │
└──────────────────────────────────────────┘
```

---

## ✅ MECE 檢查清單

### 互斥性檢查 (Mutually Exclusive)
- [x] 無重複功能模塊
- [x] 組件/服務/工具職責清晰
- [x] 文檔內容不重疊
- [x] 配置文件作用域明確

### 完整性檢查 (Collectively Exhaustive)
- [x] 所有業務邏輯有對應服務
- [x] 所有 UI 元素有對應組件
- [x] 所有類型有明確定義
- [x] 所有階段有配置支援（開發/構建/部署）
- [x] 所有文檔需求有對應文件

---

## 🎓 最佳實踐總結

1. **新增組件時**：
   - 放入 `src/components/`
   - 提取業務邏輯至 `services/`
   - 定義接口於 `types.ts`

2. **新增功能時**：
   - 更新 `PROJECT_STATUS.md` 的進度
   - 記錄至 `DEVELOPMENT_LOG.md` 的時間軸
   - 必要時更新 `README.md` 的使用說明

3. **部署流程**：
   - 推送至 `main` 分支即自動觸發
   - 查看 Actions 頁面確認構建
   - 無需手動干預

---

**本結構圖嚴格遵循 MECE 原則，確保專案組織清晰、易於擴展與維護。**
