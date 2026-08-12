# Project Local Rules — Weibull AI Analyst

<RULE[mobile_chart_and_floating_ui_defense]>
## 行動版圖表與浮動 UI 防遮擋防禦 SOP (Mobile Chart & Floating UI Defense)

為防止 Mobile / PWA 開發中出現「圖表垂直拉伸失真」與「底部浮動元件遮擋操作按鈕」的 Regression Bug，所有程式碼變更必須遵守以下原則：

1. **響應式圖表繪畫邊界法則 (Responsive Canvas Boundary Rule)**：
   - 任何動態圖表 (如 Plotly.js) 在行動版 `flex-1` 容器中，必須設置 `max-height` 邊界 constraint（如 `max-h-[calc(100vh-170px)]`）並搭配居中 flex 佈局，防止直向螢幕過度拉伸 y 軸比例。
   - 圖表頂部工具列在 Mobile 視圖 (`<640px`) 必須具備 `flex-wrap gap-2` 自適應換行能力，禁止寫死 `space-x-8` 或大邊距。

2. **浮動導航與 Z-Index 雙重防護 (Floating Nav Scroll Padding SOP)**：
   - 凡是在包含 `fixed bottom` 浮動導航欄的 Mobile 版面中，所有內層 `overflow-y-auto` 滾動容器的底部必須強制添加 `pb-28 lg:pb-6` 或 `pb-safe`。
   - 全域提示框 / PWA 提示 Banner 在 Mobile 端優先設置於頂部 (`top-16`)，避免與底部的主要計算 / 操作按鈕產生堆疊遮擋。
</RULE[mobile_chart_and_floating_ui_defense]>
