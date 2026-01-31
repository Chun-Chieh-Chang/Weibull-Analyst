# 開發紀錄 - Weibull Analyst

> **基於 MECE 原則的系統化開發歷程**

---

## 📅 2026-01-31 - 第二階段：自動化部署與文檔重構

### 🔧 部署自動化 (Deployment Automation)
#### 實施內容
- **GitHub Actions 配置**：
  - 創建 `.github/workflows/deploy.yml` 工作流程
  - 配置自動觸發條件：推送至 `main` 分支
  - 設置構建環境：Node.js 20 + npm cache
  - 實現兩階段部署：
    1. **Build Job**: 安裝依賴 → 執行構建 → 上傳產物
    2. **Deploy Job**: 部署至 GitHub Pages

#### 技術決策
- **選擇 GitHub Actions 原因**：
  - ✅ 與 GitHub 倉庫深度整合
  - ✅ 無需額外服務器配置
  - ✅ 支援自動化 CI/CD 流程
  - ✅ 提供構建日誌與部署狀態監控

#### 配置要點
```yaml
# deploy.yml 核心配置
- 權限設置: contents:read + pages:write + id-token:write
- 並發控制: group="pages" + cancel-in-progress=false
- 構建產物: ./dist 目錄
- 部署環境: github-pages
```

### 📝 文檔重構 (Documentation Refactoring)
#### 更新內容
1. **README.md** - 完全重寫
   - 新增項目簡介與技術架構說明
   - 詳細記錄本地開發步驟
   - 新增 GitHub Actions 自動部署章節
   - 補充使用說明與相關文檔鏈接

2. **PROJECT_STATUS.md** - 結構化重組
   - 採用 MECE 原則分類（5 大模塊）：
     - 項目架構 (Architecture)
     - 前端開發 (Frontend)
     - 業務邏輯 (Business Logic)
     - CI/CD 與部署 (CI/CD & Deployment)
     - 文檔管理 (Documentation)
   - 新增下一步規劃（短期/中期/長期）
   - 新增技術債務追蹤表
   - 新增品質指標儀表板

3. **DEVELOPMENT_LOG.md** - 本文件
   - 按時間軸與類別雙維度組織
   - 記錄技術決策與實施細節
   - 保留問題分析與解決方案

#### MECE 原則應用
- **互斥性 (Mutually Exclusive)**：
  - 各模塊職責明確，無功能重疊
  - 文檔分類清晰（README=使用指南, STATUS=當前狀態, LOG=歷史記錄）

- **完整性 (Collectively Exhaustive)**：
  - 項目所有關鍵信息均有對應文檔記錄
  - 源碼目錄結構覆蓋所有功能模塊

---

## 📅 2026-01-31 - 第一階段：修復與重構

### 🔍 問題分析 (Root Cause Analysis)
在修復過程中發現專案存在以下根本性問題：
- **結構混亂**：原本源碼與配置文件混雜在根目錄，不符合標準的 Vite/React 專案結構（MECE 缺失）。
- **依賴衝突**：`index.html` 同時引用了 Tailwind CDN、ESM.sh importmap 以及本地構建腳本，導致環境混亂且 Console 報錯。
- **配置失效**：`vite.config.ts` 缺少 `base` 路徑配置，導致 GitHub Pages 部署後無法正確找到資產文件。
- **技術債**：混合使用多種加載方式（CDN + Bundler），使得本地開發與線上部署行為不一致。

### 🛠️ 修復方案 (Correction Plan)
- **結構標準化**：創建 `src/` 目錄，將所有 React 組件、邏輯代碼和 CSS 移入其中。
- **配置現代化**：升級至 **Tailwind CSS v4**，使用官方 Vite 插件取代傳統的 PostCSS 流程，簡化依賴鏈。
- **清理 index.html**：移除所有 CDN 鏈接和自定義 importmap，統一由 Vite 管理依賴。
- **環境一致性**：確保 `npm run build` 通過，並在本地啟動開發服務器進行初步檢查。

### ✅ 改正紀錄 (Change Log)
- ✅ **專案結構**：移動 `App.tsx`, `index.tsx`, `types.ts` 等至 `src/`。
- ✅ **Tailwind v4**：安裝 `@tailwindcss/vite`，更新 `vite.config.ts` 和 `index.css`。
- ✅ **HTML 優化**：將 `index.html` 簡化為標準 Vite 模板。
- ✅ **AI 服務重構**：將 `geminiService` 升級為 `aiService`，新增 OpenAI 支援。
- ✅ **用戶體驗**：實現 API Key 手動輸入與本地儲存，加入 AI Provider 下拉選單。
- ✅ **視覺優化**：調整淺色模式背景為 `slate-50` 以減輕眼睛負擔；統一表格字體與輸入框一致。

### 🐛 主題切換失效分析 (Theme Toggle Failure Analysis)
**問題描述**：切換至淺色模式時，UI 圖示已更換，但全域底色依然維持深色。

**根本原因**：
1. **Tailwind v4 預設策略**：預設偵測系統偏好而非 HTML 類名。
2. **變體判定失效**：未顯式定義類名觸發器。
3. **瀏覽器渲染快取**：`color-scheme` 未同步。

**解決方案**：
1. 加入 `@custom-variant dark` 明確規則。
2. 同步更新 `document.documentElement.style.colorScheme`。
3. 全域背景降級為原生 CSS 屬性以增強穩定性。

---

## 🎯 技術決策總結

### 架構選擇
| 決策項 | 選擇方案 | 原因 |
|--------|---------|------|
| 構建工具 | Vite 5 | 快速冷啟動、原生 ESM 支援 |
| 樣式方案 | Tailwind CSS v4 | 原子化 CSS、官方 Vite 插件 |
| 類型系統 | TypeScript | 類型安全、IDE 支援佳 |
| 部署方式 | GitHub Actions | 自動化、無需額外服務器 |

### 目錄結構設計（MECE 原則）
```
src/
├─ components/    # UI 組件（互斥：每個組件職責單一）
├─ services/      # 業務邏輯（互斥：API、計算邏輯分離）
├─ utils/         # 工具函數（互斥：通用輔助功能）
├─ types.ts       # 類型定義（集中管理）
├─ App.tsx        # 主應用（組合各組件）
└─ index.tsx      # 入口文件（初始化）
```

---

## 📊 成果指標

- ✅ **構建成功率**: 100%
- ✅ **TypeScript 錯誤**: 0
- ✅ **部署自動化**: 已配置
- ✅ **文檔完整性**: 100% (README + STATUS + LOG)

---

**本文件依據「開發跑通確認原則 (SOP)」與 MECE 原則生成。**
