# 台灣旅遊規劃室 v0.2.0

全台線上查詢、僅網頁呈現。使用 GitHub Pages 前端與 Cloudflare Workers 後端；已移除下載、補圖與固定四地的使用者流程。

## 現況

程式與設定教學已完成，Google Places 真實金鑰與 Cloudflare 帳號尚未設定，因此還不能查詢真實地點，也尚未正式部署。測試使用清楚標示的模擬回應，不會以假資料冒充即時結果。

## 從這裡開始

開啟 [部署說明.md](部署說明.md)，或網站的「服務設定與版本範圍」，依序完成 Google Cloud、Cloudflare、網頁設定與 GitHub Pages。

金鑰僅放 Cloudflare Secret：`GOOGLE_PLACES_API_KEY`。`public/config.js` 只放 Worker 公開網址。

## 本機預覽

需要 Node.js 24，不需安裝前端套件。

```powershell
npm test
npm run build
npm run dev
```

開啟 http://127.0.0.1:4173 ，或雙擊「啟動旅遊規劃室.cmd」。關閉前請保留服務視窗。

直接雙擊 index.html 可以查看介面及設定提示，但因 file:// 沒有正常的網站來源，不能呼叫受保護的線上 API；不應將 null 來源列入 Worker 白名單。前一版 v0.1.1 的離線四地規劃保留在舊版壓縮包。

## 查詢流程

1. 輸入台灣城市、行政區或景點，設定日期、交通、出返時間及其他條件。
2. 點「查詢並規劃」，所有目的地都向 Worker 查詢，不再繞過 API 回傳內建資料。
3. Worker 以 Places API (New) 找到地點，在周邊約 15 公里搜尋景點與室內場館，去除境外、停業及過遠結果，套用旅遊條件。
4. 顯示晴天、小雨與中大雨路線、地址、營業資訊、可取得的照片／作者及導航。查無結果與服務錯誤有明確提示。

切換晴雨情境不重查。修改條件會取消未完成查詢並清除舊結果。每次最多 3 次 Text Search 與 6 次照片請求；Google 計費依所取欄位與最新計價為準。照片失敗不讓整條行程失敗。

## 版本範圍

- 不提供 DOCX、PDF、PNG 或其他內容下載。
- 沒有即時天氣、導航車程、實際餐廳選店或訂位。起點到旅遊區時間由使用者填入，站間車程依直線距離粗估；跨水域與船班需另查。
- 例行營業時段不能保證未來旅遊日期開放；假日／臨時公告仍需確認。
- 照片由服務回傳並保留作者資訊，無照片時說明缺項，不用假圖代替。
- Google Maps 導航連結不是地圖截圖。此版只顯示網頁，不製作文書成品。
- 不保證每個輸入都有足夠候選或完整雨備；同名地點請核對解析位置。

## 主要檔案

- `public/`：網頁原始檔，舊資產不會加入新發布目錄。
- `src/app.js`：純網頁操作與 API 查詢。
- `src/input.js`：輸入驗證與共用文案。
- `src/engine.js`：行程排程；本版本一律使用 Worker 查詢出的資料。
- `src/catalog.js`：留供既有排程回歸測試，不打包進前端、不作查詢備援。
- `worker/index.js`、`worker/wrangler.jsonc`：地點／照片介接、來源限制、限流。
- `web-dist/`：v0.2 的唯一發布目錄，只有 5 個網頁檔案。舊 `dist/` 不再發布。
- `scripts/browser-qa.mjs`：瀏覽器操作測試，需設定 `PLAYWRIGHT_PATH` 或使用本機 bundled Playwright。
- `tests/`：排程與 Worker 模擬測試；模擬資料不會放進網站。

執行 build 後再發布；不要手動修改 app.bundle.js。
