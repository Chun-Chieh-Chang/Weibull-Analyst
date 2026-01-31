# Weibull Analyst

> 一款現代化的威布爾分析工具，具備橫向佈局、互動式概率繪圖與 AI 驅動的可靠性洞察功能。

[![Deploy to GitHub Pages](https://github.com/Chun-Chieh-Chang/Weibull-Analyst/actions/workflows/deploy.yml/badge.svg)](https://github.com/Chun-Chieh-Chang/Weibull-Analyst/actions/workflows/deploy.yml)

---

## 📋 項目簡介

**Weibull Analyst** 是一款專為可靠性工程師設計的 Web 應用程式，提供：
- **威布爾分析**：支援多種失效數據輸入與參數估算
- **互動式圖表**：實時概率圖繪製與視覺化
- **AI 分析助手**：整合 Gemini AI 與 OpenAI 提供智能分析建議
- **響應式設計**：支援深色/淺色模式切換

---

## 🛠️ 技術架構

### 核心技術棧
- **前端框架**: React 18 + TypeScript
- **構建工具**: Vite 5
- **樣式方案**: Tailwind CSS v4
- **圖表庫**: Recharts
- **AI 服務**: Google Gemini API / OpenAI API

### 項目結構（遵循 MECE 原則）
```
Weibull-Analyst/
├─ .github/workflows/    # CI/CD 自動化流程
│  └─ deploy.yml         # GitHub Pages 部署配置
├─ src/                  # 源代碼目錄
│  ├─ components/        # React 組件
│  ├─ services/          # 業務邏輯服務
│  ├─ utils/             # 工具函數
│  ├─ types.ts           # TypeScript 類型定義
│  ├─ App.tsx            # 主應用組件
│  ├─ index.tsx          # 應用入口
│  └─ index.css          # 全局樣式
├─ index.html            # HTML 模板
├─ vite.config.ts        # Vite 配置
├─ tsconfig.json         # TypeScript 配置
├─ package.json          # 依賴管理
├─ DEVELOPMENT_LOG.md    # 開發紀錄
├─ PROJECT_STATUS.md     # 專案狀態
└─ README.md             # 本文件
```

---

## 🚀 本地開發

### 前置需求
- **Node.js** 20.x 或更高版本
- **npm** 或 **pnpm**

### 安裝步驟
1. **克隆倉庫**
   ```bash
   git clone https://github.com/Chun-Chieh-Chang/Weibull-Analyst.git
   cd Weibull-Analyst
   ```

2. **安裝依賴**
   ```bash
   npm install
   ```

3. **配置 API Key**（可選）
   - 複製 `.env.local` 文件並填入您的 API Key：
     ```
     GEMINI_API_KEY=your_gemini_api_key_here
     ```
   - 或在運行時通過 UI 手動輸入

4. **啟動開發服務器**
   ```bash
   npm run dev
   ```
   訪問 `http://localhost:5173` 即可查看應用

### 構建生產版本
```bash
npm run build
```
構建產物將輸出至 `dist/` 目錄。

---

## 🔄 自動部署（GitHub Actions）

本專案已配置 **GitHub Actions** 自動化部署流程：

### 工作流程
1. **觸發條件**：推送至 `main` 分支時自動觸發
2. **構建步驟**：
   - 安裝 Node.js 20
   - 安裝項目依賴 (`npm ci`)
   - 執行生產構建 (`npm run build`)
   - 上傳構建產物到 GitHub Pages
3. **部署步驟**：自動部署至 GitHub Pages

### 查看部署狀態
訪問 [Actions 頁面](https://github.com/Chun-Chieh-Chang/Weibull-Analyst/actions) 查看構建與部署日誌。

### 手動觸發部署
如需手動部署，只需推送任何變更至 `main` 分支：
```bash
git add .
git commit -m "Update: 您的變更描述"
git push origin main
```

---

## 📖 使用說明

1. **數據輸入**：在左側面板輸入失效時間數據
2. **參數設置**：配置威布爾分析參數
3. **圖表查看**：右側實時顯示概率圖
4. **AI 分析**：點擊 AI 分析按鈕獲取智能洞察

---

## 📝 相關文檔

- [專案結構圖](./PROJECT_STRUCTURE.md) - MECE 分層架構與模塊說明
- [開發紀錄](./DEVELOPMENT_LOG.md) - 詳細的開發歷程與技術決策
- [專案狀態](./PROJECT_STATUS.md) - 當前進度與待辦事項

---

## 📄 授權

本專案採用 MIT 授權，詳見 LICENSE 文件。
