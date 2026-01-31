# 開發紀錄 - Weibull Analyst 修復與重構

## 日期：2026-01-31

### 1. 問題分析 (Root Cause Analysis)
在修復過程中發現專案存在以下根本性問題：
- **結構混亂**：原本源碼與配置文件混雜在根目錄，不符合標準的 Vite/React 專案結構（MECE 缺失）。
- **依賴衝突**：`index.html` 同時引用了 Tailwind CDN、ESM.sh importmap 以及本地構建腳本，導致環境混亂且 Console 報錯。
- **配置失效**：`vite.config.ts` 缺少 `base` 路徑配置，導致 GitHub Pages 部署後無法正確找到資產文件。
- **技術債**：混合使用多種加載方式（CDN + Bundler），使得本地開發與線上部署行為不一致。

### 2. 修復方案 (Correction Plan)
- **結構標準化**：創建 `src/` 目錄，將所有 React 組件、邏輯代碼和 CSS 移入其中。
- **配置現代化**：升級至 **Tailwind CSS v4**，使用官方 Vite 插件取代傳統的 PostCSS 流程，簡化依賴鏈。
- **清理 index.html**：移除所有 CDN 鏈接和自定義 importmap，統一由 Vite 管理依賴。
- **環境一致性**：確保 `npm run build` 通過，並在本地啟動開發服務器進行初步檢查。

### 3. 改正紀錄 (Change Log)
- ✅ **專案結構**：移動 `App.tsx`, `index.tsx`, `types.ts` 等至 `src/`。
- ✅ **Tailwind v4**：安裝 `@tailwindcss/vite`，更新 `vite.config.ts` 和 `index.css`。
- ✅ **HTML 優化**：將 `index.html` 簡化為標準 Vite 模板。
- ✅ **AI 服務重構**：將 `geminiService` 升級為 `aiService`，新增 OpenAI 支援。
- ✅ **用戶體驗**：實現 API Key 手動輸入與本地儲存，加入 AI Provider 下拉選單。
- ✅ **視覺優化**：調整淺色模式背景為 `slate-50` 以減輕眼睛負擔；統一表格字體與輸入框一致。

### 4. 主題切換失效分析 (Theme Toggle Failure Analysis)
**問題描述**：切換至淺色模式時，UI 圖示已更換，但全域底色依然維持深色。
**根本原因**：
1. **Tailwind v4 預設策略**：預設偵測系統偏好而非 HTML 類名。
2. **變體判定失效**：未顯式定義類名觸發器。
3. **瀏覽器渲染快取**：`color-scheme` 未同步。
**解決方案**：
1. 加入 `@custom-variant dark` 明確規則。
2. 同步更新 `document.documentElement.style.colorScheme`。
3. 全域背景降級為原生 CSS 屬性以增強穩定性。

### 5. 部署與 MECE 整理
- 確保所有組件位於 `src/components/`。
- 確保所有業務邏輯位於 `src/services/`。
- 確保型別定義統一於 `src/types.ts`。
- 確保 GitHub Actions 流程已針對 Vite 構建資產目錄 `./dist` 進行優化。

---
**本文件依據「開發跑通確認原則 (SOP)」生成。**
