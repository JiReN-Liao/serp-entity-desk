# SERP Entity Desk

第 6 題的可展示 prototype：輸入任意關鍵字，透過 SerpApi 取得 Google 第一頁前 10 筆，抓取可讀文章內容，產生逐篇 entity 候選數量與主題分群，並以 Vercel Function、Supabase Auth／資料表及 Apps Script 匯出到 Google Sheet。

## 最小交付與誠實邊界

- 已實作：自由輸入查詢、前 10 筆結果、逐篇 entity 候選、分群、圖表、登入 UI、最近分析歷史、Supabase schema、Vercel API route、Apps Script 匯出範例。
- 展示模式：沒有外部金鑰時可用一組明確標示為「展示資料」的固定資料檢查 UI；它不冒充即時 SERP。
- 公開測試模式（暫時）：可在不登入的情況下測試固定查詢 `4G 吃到飽`；不保存 Supabase 歷史，並以每個來源 IP 的 best-effort 冷卻時間降低免費 API 被重複消耗的風險。這只適合短時間 Demo，驗證完成後應關閉。
- Live 模式：需要 SerpApi、Supabase 與 Vercel 設定；未填金鑰前不宣稱已部署或已連線。
- entity 抽取目前是可解釋的規則式候選抽取，不等同完整命名實體辨識（NER）。後續若需要語意級精度，再替換 `api/analyze.js` 的 extractor，不改 UI 與資料格式。

## 需要的帳號／金鑰

1. Vercel 帳號：部署前端與 `api/analyze.js`。
2. SerpApi 帳號與 `SERPAPI_KEY`：呼叫 Google engine；查詢、地區與語言由 request 傳入，不寫死「4G 吃到飽」。
3. Supabase 專案：
   - 前端：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。
   - Vercel server：`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`。
   - 在 SQL Editor 執行 `supabase/schema.sql`。
   - Auth 開啟 Email／Password；若開啟 email confirmation，註冊後要先收信確認。
4. Apps Script（可選）：在 Script Properties 設定 `SERP_ENTITY_ENDPOINT` 與 `SERP_ENTITY_API_TOKEN`，再執行 `apps-script/Code.gs` 的 `setupSheet`。

## 本機執行

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd test
npm.cmd run dev
```

`npm run dev` 可先看前端與展示模式。要讓本機 `/api/analyze` 也走 Vercel Function，使用已登入 Vercel CLI 的環境執行：

```powershell
npx vercel dev
```

## 部署順序

1. 建立 Supabase 專案，執行 `supabase/schema.sql`，設定 Email／Password Auth。
2. 在 Vercel Import Project 指向本資料夾，或在本機執行 `vercel`。
3. 在 Vercel Project Settings 填入 `.env.example` 中的環境變數；`SUPABASE_SERVICE_ROLE_KEY`、`SERPAPI_KEY`、`APP_SCRIPT_TOKEN` 只能作為 server-side variable。
4. 重新部署後，先註冊測試帳號，再用 `4G 吃到飽` 與另一個詞各跑一次，保留結果截圖與 Supabase row 作為驗收證據。
5. 將部署後的 `/api/analyze` URL 與 `APP_SCRIPT_TOKEN` 以 Script Properties 設定給 Apps Script，避免把 token 寫進試算表或程式碼。

若只是短時間公開展示，可暫時將前端 `VITE_PUBLIC_TEST_MODE=true` 與 server-side `PUBLIC_TEST_MODE=true`，並保留 `PUBLIC_TEST_QUERY=4G 吃到飽`。公開測試不需要帳號，但不提供任意關鍵字、不保存歷史，而且 serverless 記憶體內冷卻不是完整的防濫用方案；測試後要改回 `false` 並重新部署。

`APP_ORIGIN` 可填入正式前端網址（多個來源以逗號分隔），API 只會對列出的來源回傳 CORS header；同源 Vercel 前端不需要額外設定。文章抓取也會拒絕 localhost、私有 IP、metadata host、非 80／443 port 與含帳密 URL，降低 SSRF 風險。

## 驗收清單

- [ ] 任意輸入查詢，不只可輸入「4G 吃到飽」。
- [ ] 回傳的文章數量、entity 候選與群組數量能從畫面文字讀取，圖表不依賴顏色單獨傳達。
- [ ] 未登入的 live request 回傳 401；登入後才可分析。
- [ ] SerpApi 失敗、文章無法抓取、空內容與超時都有明確狀態。
- [ ] Supabase `analysis_runs` 只允許使用者讀取自己的 row；服務金鑰不出現在前端。
- [ ] Apps Script 能把 summary、articles、entities、clusters 寫入不同工作表。
- [ ] 已登入使用者可在側欄看到自己的最近分析；RLS 不允許讀取其他使用者的 row。

## 參考文件

- [SerpApi Google Search API](https://serpapi.com/search-api)
- [Supabase password-based Auth](https://supabase.com/docs/guides/auth/passwords)
- [Vercel Functions](https://vercel.com/docs/functions)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Google Apps Script Spreadsheet service](https://developers.google.com/apps-script/reference/spreadsheet)
