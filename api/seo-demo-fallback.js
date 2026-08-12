// Generated from the public n8n workflow's Build Demo Result node.
// Keep behavior aligned with workflow/n8n_seo_content_tool_workflow.json.
export function composeQuotaSafeDemo($json) {
const input = $json;
const folder = input.target_folder_key + '/revised/';
const sourceText = [input.keyword, input.product, input.scenario].join('|');
let seed = 2166136261;
for (const ch of sourceText) {
  seed ^= ch.codePointAt(0);
  seed = Math.imul(seed, 16777619) >>> 0;
}
const pick = (items, offset = 0) => items[(seed + offset) % items.length];
const chartUrl = (config) => 'https://quickchart.io/chart?width=1200&height=675&format=png&backgroundColor=white&version=4&c=' + encodeURIComponent(JSON.stringify(config));

const profiles = {
  shopping: {
    key: '選購比較', suffix: '選擇前先看懂這些條件',
    headings: ['先把必要條件和偏好分開', '比較時不要只看單一優點', '用真實情境做最後檢查', '決定後保留可回頭驗證的紀錄'],
    decisions: ['必要條件', '可接受取捨', '最後偏好'], stages: ['需求', '規格', '試用', '決定'], metrics: ['符合需求', '使用負擔', '後續成本', '整體滿意'],
    notes: [
      '選購題最常見的失誤，是先被一個亮眼規格吸引，之後才發現尺寸、維護方式或使用頻率不合。先列出不能妥協的條件，再看加分項目，通常比直接排品牌名次更可靠。',
      '比較資料必須放在同一個基準上。若一個方案強調入門價格，另一個方案強調完整服務，兩者其實回答的是不同問題；應先統一使用期間、包含項目與後續成本，再做判斷。',
      '真正的測試不是問「喜不喜歡」，而是把選項放進日常流程。從收納空間、操作次數、共同使用者到退換方式逐一走過，才容易在購買前發現摩擦。',
      '做完決定後，保留當初的三個關鍵理由。日後若需求改變，就能知道要調整的是預算、規格還是使用方式，而不是重新看完所有資訊。'
    ]
  },
  tutorial: {
    key: '步驟教學', suffix: '從第一步到實際完成',
    headings: ['先定義完成狀態', '把工作拆成可回復的小步驟', '先跑一次最小測試', '完成後留下下次能沿用的做法'],
    decisions: ['準備資料', '執行步驟', '完成檢查'], stages: ['準備', '小規模測試', '正式執行', '回顧'], metrics: ['是否完成', '錯誤次數', '處理時間', '可重複性'],
    notes: [
      '教學內容若只列操作順序，讀者很容易做到一半才發現前置條件不足。先說明起點、完成狀態與不能跳過的準備，能讓第一次執行的人判斷自己是否適合現在開始。',
      '每一步都應該有輸入、動作和可觀察結果。出錯時只回到上一個可確認的節點，不必整套重來；涉及刪除、付款或公開發布的動作，則另外標出確認點。',
      '第一次先用最小資料量跑完流程，並刻意保留一個錯誤案例。成功案例證明路徑可行，錯誤案例則能驗證提示是否足以協助排除問題。',
      '教學的價值不只在完成一次，而是讓下次更快。記錄實際耗時、最容易卡住的位置與最後採用的設定，下一位執行者就不必從聊天紀錄重新拼湊。'
    ]
  },
  marketing: {
    key: '行銷內容', suffix: '從受眾問題寫到可驗證成果',
    headings: ['先選定這篇要回答的搜尋問題', '讓產品出現在合理的決策位置', '發布前檢查內容是否可信', '發布後只改一個主要變因'],
    decisions: ['了解問題', '比較方法', '採取行動'], stages: ['題目', '草稿', '校對', '發布'], metrics: ['曝光', '點擊', '完整閱讀', '下一步行動'],
    notes: [
      '內容行銷最容易失焦的地方，是同時想教育、比較與成交。先從客服問題或站內搜尋挑出一個真實句子，再決定這篇只協助哪一個階段，文章才不會變成產品介紹的拼貼。',
      '產品出現的位置應跟讀者的決策進度一致。前段先建立判斷方式，中段再說明方案如何處理問題，最後才放下一步；若每段都重複品牌名稱，可信度和閱讀節奏都會下降。',
      '發布前要分開檢查事實與語氣。規格、價格、案例和連結需要來源；形容詞則要問是否符合品牌平常的說法。無法確認的成果主張應直接移除，不用為了字數留下。',
      '文章上線後，先看最接近本次目標的一個訊號。有曝光沒點擊就測標題，有閱讀沒行動就檢查證據與連結；一次只改一件事，才能知道改動是否有效。'
    ]
  },
  automation: {
    key: '工具自動化', suffix: '先把流程與例外整理清楚',
    headings: ['先確認哪些工作值得自動化', '把輸入、輸出與失敗狀態寫清楚', '從小資料量測試例外', '保留人工確認與回復方式'],
    decisions: ['重複工作', '判斷工作', '人工覆核'], stages: ['輸入', '處理', '驗證', '交付'], metrics: ['成功率', '節省時間', '需人工處理', '可追蹤性'],
    notes: [
      '自動化不是把所有步驟搬進工具，而是先找出規則穩定、重複頻率高且錯誤可回復的部分。需要大量背景判斷或結果會直接影響客戶的環節，仍應保留人工確認。',
      '每個節點都要說明收到什麼、產出什麼，以及資料不完整時如何停止。若只有成功路徑，展示時看起來很快，實際使用卻會把錯誤資料一路傳到最後。',
      '測試時至少準備正常、缺欄位和重複送出三種案例。除了看結果，也要確認錯誤訊息、重試與冪等行為，避免一次網路問題造成重複內容或錯誤覆寫。',
      '正式使用前要能回答三個問題：誰能重跑、舊結果放在哪裡、失敗後怎麼回到上一版。保留 request ID、版本與時間戳，才能讓自動化成為可維護流程。'
    ]
  },
  wellness: {
    key: '生活健康', suffix: '從日常紀錄找到可持續的調整',
    headings: ['先記錄目前狀態，不急著一次全改', '選一個能持續執行的小調整', '觀察身體反應與實際阻力', '知道何時應停止自行嘗試'],
    decisions: ['目前狀態', '可行調整', '需要協助'], stages: ['記錄', '調整', '觀察', '回顧'], metrics: ['執行天數', '主觀感受', '日常影響', '是否需諮詢'],
    notes: [
      '健康與生活習慣的內容不適合用單一結果保證每個人都有效。先記錄作息、環境與原本做法，再挑一個變因調整，才能分辨改變來自哪裡。',
      '可持續比短期強度重要。把行動縮小到忙碌日也做得到的程度，並預先安排中斷後如何恢復，通常比設定完美但難以維持的計畫更實際。',
      '觀察時同時記主觀感受和日常影響，不只看單一數字。如果做法造成明顯不適、影響原有治療或需要個別診斷，就不應依文章繼續自行調整。',
      '回顧的目的不是責怪自己沒有做到，而是找出時間、環境或步驟上的阻力。必要時把紀錄帶給合格專業人員，讓後續建議建立在真實狀況上。'
    ]
  },
  travel: {
    key: '旅遊規劃', suffix: '把時間、動線與備案排進同一份計畫',
    headings: ['先決定這趟最重要的體驗', '用地點與時間排出可走的動線', '把預約、交通與天候風險分開處理', '出發前做一次備案檢查'],
    decisions: ['必去安排', '彈性選項', '雨天備案'], stages: ['蒐集', '排序', '預約', '出發'], metrics: ['移動時間', '預算', '彈性', '備案完整度'],
    notes: [
      '行程不是景點清單越長越好。先選出這趟最重要的一到兩個體驗，再把其他安排分成順路與可刪除，遇到延誤時才不會整天追著表格跑。',
      '排動線時應同時看地點、開放時間與實際停留長度。地圖上距離很近，不代表轉乘、排隊或帶行李時仍然方便；每天保留一段空白時間會更有彈性。',
      '需要預約的項目、可現場決定的項目與受天候影響的項目要分開標記。價格與營業資訊可能變動，出發前仍需回到官方來源確認。',
      '備案不用重排另一套完整行程，只要知道主要安排取消時附近能去哪裡、交通中斷時怎麼返回，以及哪些費用可以退改即可。'
    ]
  },
  general: {
    key: '問題解決', suffix: '先釐清需求，再做可驗證的決定',
    headings: ['先說清楚現在要解決的問題', '把選項放回真實限制中比較', '用小規模方式驗證假設', '根據結果決定保留或調整'],
    decisions: ['核心需求', '現有限制', '下一步'], stages: ['定義', '比較', '測試', '決定'], metrics: ['是否適用', '執行成本', '遇到阻力', '下一步清晰度'],
    notes: [
      '遇到陌生題目時，先把「想知道」改寫成「做完後要能決定什麼」。決策清楚後，才知道哪些資料必要，哪些只是看起來完整但不會改變結果。',
      '比較選項時要放回時間、預算、能力與使用環境。脫離情境的優缺點清單很容易每項都合理，卻無法指出哪一個方案更適合現在。',
      '資訊不足時，不必急著做最大承諾。設計一個成本低、可停止的小測試，事先寫下通過條件與停止條件，結果才不會被當下感受帶著走。',
      '回顧時分開記錄事實、推測與下一步。若證據和原本假設不同，調整問題定義通常比繼續堆資料更有效。'
    ]
  }
};

const combined = (input.keyword + ' ' + input.product + ' ' + input.scenario).toLowerCase();
let profile = profiles.general;
if (/旅遊|旅行|景點|住宿|飯店|行程|機票/.test(combined)) profile = profiles.travel;
else if (/睡眠|飲食|健身|運動|健康|減重|增肌|壓力/.test(combined)) profile = profiles.wellness;
else if (/n8n|自動化|ai|軟體|系統|工具|工作流|資料工程|機器人/.test(combined)) profile = profiles.automation;
else if (/seo|行銷|廣告|品牌|內容|社群|文案|流量/.test(combined)) profile = profiles.marketing;
else if (/怎麼|如何|教學|步驟|入門|設定|安裝|製作/.test(combined)) profile = profiles.tutorial;
else if (/比較|推薦|選購|價格|方案|材質|規格|值得買/.test(combined)) profile = profiles.shopping;

const openings = [
  '搜尋「' + input.keyword + '」的人，通常不是缺少更多名詞，而是想知道在自己的限制下該怎麼判斷。',
  '當問題落在「' + input.keyword + '」，最難的往往不是找到選項，而是把選項放回真實使用情境。',
  '如果只看零散建議，「' + input.keyword + '」很容易越查越複雜；先確定要做的決定，資訊才有作用。',
  '面對「' + input.keyword + '」，與其先追求一份最完整答案，不如從現在最需要解決的限制開始。'
];
const transitions = [
  '這裡不預設某個方案一定最好，而是提供一套可以檢查的順序。',
  '以下重點不是堆滿術語，而是讓每個步驟都有可觀察結果。',
  '做法會刻意保留取捨與停止條件，避免把建議寫成沒有邊界的保證。',
  '先用小範圍完成一次，再根據結果調整，會比一開始追求完美更可靠。'
];
const anglePacks = [
  [
    '先把目標縮成一個這週能完成的決定，並寫下完成後會看到的具體改變。目標若無法觀察，後面再多比較也只會增加猶豫。',
    '從最常發生的場景開始，不先處理少見例外。做完第一輪後再補缺口，能更快看出原本假設是否貼近實際。',
    '把一次性支出、持續投入與學習時間分開記錄；免費不代表沒有成本，功能較多也不等於現在全部用得到。',
    '替每個選項寫一項淘汰條件。只要碰到不能接受的限制就先排除，避免用其他優點把關鍵問題稀釋。',
    '測試時只改一個主要變因，其他條件盡量固定。結果不理想時，才能分辨是做法本身、執行方式還是環境造成。',
    '保留一張執行前後對照，內容可以是時間、步驟數或需要協助的次數。這比只寫「感覺有改善」更容易回顧。',
    '選一個最接近目標的指標當主指標，其餘只作提醒。指標太多時，每個結果都能被解釋成成功，反而失去判斷力。',
    '回顧後只安排一個下一步，並標示負責人與日期。若沒有下一個動作，紀錄再完整也不會推動結果。'
  ],
  [
    '先列出最不希望發生的結果，再反推哪些條件必須確認。這種寫法能優先處理安全、預算或時間上的不可逆風險。',
    '將已知、推測與未知分開。推測可以用來設計測試，但不能在文章裡改寫成事實；未知則要指定查證來源。',
    '比較時加入「失敗後如何回復」一欄。即使兩個方案效果相近，能否取消、還原或換回原流程，可能才是關鍵差異。',
    '遇到需要帳號、付款、公開資料或長期承諾的步驟，先設人工確認點；條件未滿足時應停止，而不是自動往下執行。',
    '測試除了正常案例，也要放入缺資料、重複操作或中途失敗的情況。只驗證成功路徑，往往會低估正式使用的維護成本。',
    '把警訊寫成可以辨認的事件，例如連續失敗、明顯不適或超過預算，而不是模糊地寫「狀況不好再停止」。',
    '回顧先找是否碰到停止條件，再討論優化。若基本安全界線已被突破，就不應用局部成效說服自己繼續。',
    '若關鍵資訊仍無法確認，最合理的結果可以是暫不決定。保留未知與下一次查證方式，比勉強給出肯定答案更可信。'
  ],
  [
    '先確認誰會實際使用、誰負責決定、誰承擔後續維護。三種角色可能不是同一人，需求也常因此互相衝突。',
    '讓每位參與者各自寫一句最在意的結果，再把共同項目排前面。先處理共識，能減少後面為枝節反覆討論。',
    '比較選項時，同時寫出交接難度與所需背景知識。只有建立者會操作的方案，短期省時，長期可能成為新的瓶頸。',
    '把責任分到具體節點：誰準備資料、誰確認內容、誰處理例外。只寫「團隊共同負責」，出錯時通常沒有人知道該接手。',
    '測試安排一位未參與設計的人執行，觀察他在哪裡停住。口頭補充越多，代表文件或介面仍有資訊只存在建立者腦中。',
    '收集回饋時請對方描述看到了什麼、做了什麼，不只問好不好用。具體行為比較容易轉成可修正的問題。',
    '成果交付時同時附上目前版本、已知限制與重跑方式。接手者能判斷狀態，才不會把展示結果誤認為正式完成。',
    '回顧最後確認誰要做下一步，以及何時重新檢查。沒有責任人與時間的建議，通常會停留在會議紀錄裡。'
  ],
  [
    '先用使用者的一天描述問題在哪個時刻出現、前後做了什麼。具體情境比抽象需求更容易找出真正摩擦。',
    '把最理想與最低可接受體驗各寫一版。兩者之間的差距，就是目前值得投入改善、但不必一次全部完成的範圍。',
    '比較時走過開始、進行中與結束後三個階段。有些選項開始很方便，後續整理或維護卻會增加大量負擔。',
    '除了功能，也觀察是否容易理解、是否會打斷原本習慣，以及遇到問題時能不能找到下一步。這些常比功能數量更影響持續使用。',
    '第一次測試保持時間短，結束後立刻記下卡住、意外順利與想放棄的時刻。隔太久再回想，細節通常會被整體印象取代。',
    '不要只測最熟練的人。不同經驗、設備或環境可能讓同一個做法出現完全不同結果，差異本身就是需要記錄的證據。',
    '回顧時先修最常發生且影響最大的摩擦，不從最容易美化的地方開始。小幅降低日常阻力，通常比增加新功能更有感。',
    '下次測試要保留相同的核心情境，否則前後結果無法比較。確認改善有效後，再逐步擴大到其他使用者或例外情況。'
  ]
];
const angleA = anglePacks[seed % anglePacks.length];
const angleB = anglePacks[(seed >>> 5) % anglePacks.length];

const segments = [
  [
    '# ' + input.keyword + '：' + profile.suffix,
    '',
    pick(openings, 1) + '目前的情境是「' + input.scenario + '」，因此本文會把時間、執行負擔與可驗證結果一起納入，而不是只列一般優點。' + pick(transitions, 3),
    '',
    '## ' + profile.headings[0],
    '',
    profile.notes[0],
    '',
    '本次以「' + input.scenario + '」作為判斷邊界；若使用者、時間或資源改變，就應重新檢查結論，不能直接沿用。同時保留採用與不採用的理由，避免只記最後答案。',
    '',
    '針對「' + input.keyword + '」，' + angleA[0],
    '',
    angleB[1] + '本次情境是「' + input.scenario + '」，所有取捨都應回到這個條件檢查。'
  ].join('\n'),
  [
    '## ' + profile.headings[1],
    '',
    profile.notes[1],
    '',
    '這一段只討論' + input.product + '和目前需求的連結，不延伸宣稱輸入資料沒有提供的規格、價格或成果。遇到未知就明確標記待查證，不用模糊形容詞帶過。',
    '',
    '評估' + input.product + '時，可以依序問三件事：它處理的是核心問題還是周邊不便、導入後增加哪些新工作、若效果不如預期是否容易停止。回答時只使用能確認的條件；價格、效能、醫療效果、案例成果或服務保證若沒有來源，就標記待確認，不自行補成肯定句。',
    '',
    angleA[2] + '比較時仍以「' + input.scenario + '」為準。',
    '',
    angleB[3] + '若' + input.product + '未通過必要條件，就先保留理由，不以總分掩蓋。'
  ].join('\n'),
  [
    '## ' + profile.headings[2],
    '',
    profile.notes[2],
    '',
    '測試紀錄沿用 request ID「' + input.request_id + '」，避免不同題目或不同版本的結果被混在一起比較。完成後再依原定條件判斷，不在中途更換標準。',
    '',
    angleA[4] + '這次只測「' + input.scenario + '」中最常發生的一段。',
    '',
    '初稿只把「' + input.keyword + '」與' + input.product + '放在一起，仍不足以支持決定。修正版加入「' + input.scenario + '」的限制、明確查證項目和停止條件，讓讀者知道哪些內容來自輸入、哪些必須另外確認。三張圖也分別回答判斷重點、執行順序與回顧指標，不再只是裝飾。',
    '',
    angleB[5] + '若讀者無法說出' + input.product + '的適用條件，就先修段落，不急著整篇重寫。'
  ].join('\n'),
  [
    '## ' + profile.headings[3],
    '',
    profile.notes[3],
    '',
    '如果下一次輸入改成不同關鍵字、產品或情境，系統會重新選擇內容類型、段落重點、圖表標籤與數值。下次回顧時也能清楚分辨是哪一組輸入產生的結果。',
    '',
    angleA[6] + '結果不足時就保留「繼續觀察」，不把單次結果擴大成普遍結論。',
    '',
    '針對' + input.product + '，最後仍要由負責人核對規格、價格、合約、風險與適用範圍。文章的作用是整理判斷，不是取代專業診斷或官方資料。任何可能影響健康、安全、法律或重大支出的決定，都應再查證可靠來源並諮詢合格人員。',
    '',
    angleB[7] + '把本次「' + input.keyword + '」紀錄留在 `' + input.target_folder_key + '/revised/`，下次從證據繼續。'
  ].join('\n')
];

const quotaSafeExpansion = [
  '## 演示模式的品質邊界\n\n這次結果由 n8n 的輸入驅動內容編排器產生，不會呼叫外部 LLM，也不會消耗 Gemini 額度。它會依關鍵字、產品與情境選擇內容類型、段落角度、改善項目與圖表資料；用途是穩定展示完整流程，不冒充即時 AI。',
  '## 面試現場如何驗證\n\n可立即換一組關鍵字、產品與情境再執行，並比較標題、正文段落、三點改善、圖表標籤與資料夾路由是否跟著改變。若要展示模型能力，再手動切換即時 AI；即時服務異常時，正式站會清楚標示並保留可審查結果。'
];
let quotaSafeIndex = 0;
while (segments.reduce((sum, segment) => sum + [...segment].length, 0) < 1780 && quotaSafeIndex < quotaSafeExpansion.length) {
  segments[3] += '\n\n' + quotaSafeExpansion[quotaSafeIndex];
  quotaSafeIndex += 1;
}

const plainLengths = segments.map((segment) => [...segment].length);
const totalPlain = plainLengths.reduce((sum, value) => sum + value, 0);
const measured = [plainLengths[0], plainLengths[0] + plainLengths[1], plainLengths[0] + plainLengths[1] + plainLengths[2]]
  .map((value) => Math.round((value / totalPlain) * 100));
const valuesA = [38 + (seed % 9), 34 + ((seed >>> 3) % 8), 22 + ((seed >>> 6) % 7)];
const valuesB = [92, 74 + (seed % 10), 58 + ((seed >>> 4) % 9), 42 + ((seed >>> 8) % 9)];
const valuesC = [100, 62 + (seed % 10), 39 + ((seed >>> 5) % 10), 18 + ((seed >>> 9) % 8)];
const images = [
  {
    image_id: 'img-01', insert_after_pct: '25%', measured_position_percent: measured[0] + '%',
    alt_text: input.keyword + '的三項判斷重點', prompt: profile.decisions.join('、'), asset_path: folder + '01-decision-focus.png',
    asset_url: chartUrl({ type: 'doughnut', data: { labels: profile.decisions, datasets: [{ data: valuesA, backgroundColor: ['#0F766E', '#14B8A6', '#99F6E4'] }] }, options: { plugins: { title: { display: true, text: input.keyword + '｜判斷重點', font: { size: 24 } }, legend: { position: 'bottom' } } } })
  },
  {
    image_id: 'img-02', insert_after_pct: '50%', measured_position_percent: measured[1] + '%',
    alt_text: input.product + '的執行與檢查流程', prompt: profile.stages.join('、'), asset_path: folder + '02-action-flow.png',
    asset_url: chartUrl({ type: 'bar', data: { labels: profile.stages, datasets: [{ label: '階段檢查值', data: valuesB, backgroundColor: ['#0F766E', '#0D9488', '#14B8A6', '#5EEAD4'] }] }, options: { indexAxis: 'y', plugins: { title: { display: true, text: input.product + '｜執行流程', font: { size: 24 } }, legend: { display: false } }, scales: { x: { beginAtZero: true, max: 100 } } } })
  },
  {
    image_id: 'img-03', insert_after_pct: '75%', measured_position_percent: measured[2] + '%',
    alt_text: input.scenario + '的結果觀察指標', prompt: profile.metrics.join('、'), asset_path: folder + '03-review-signals.png',
    asset_url: chartUrl({ type: 'line', data: { labels: profile.metrics, datasets: [{ label: '相對觀察值', data: valuesC, borderColor: '#0F766E', backgroundColor: '#CCFBF1', fill: true, tension: 0.3, pointRadius: 6 }] }, options: { plugins: { title: { display: true, text: profile.key + '｜回顧指標', font: { size: 24 } }, legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } } })
  }
];

const article = [
  segments[0], '', '![' + images[0].alt_text + '](' + images[0].asset_url + ')', '',
  segments[1], '', '![' + images[1].alt_text + '](' + images[1].asset_url + ')', '',
  segments[2], '', '![' + images[2].alt_text + '](' + images[2].asset_url + ')', '',
  segments[3]
].join('\n');
const draftArticle = [
  '# ' + input.keyword + '｜初步整理', '',
  pick(openings, 2) + '本文先以「' + input.scenario + '」為背景，整理' + input.product + '可能扮演的角色。', '',
  '## 先列出問題', '', '確認目前限制、可接受取捨與想達成的結果，再蒐集資料。', '',
  '## 選一個做法', '', '比較選項後先做小範圍測試，記錄結果再決定是否繼續。'
].join('\n');
const improvements = [
  { point_no: 1, observed_issue: '初稿只概括「' + input.keyword + '」，沒有把使用者限制寫進判斷。', fix_action: '加入「' + input.scenario + '」的限制與完成定義。', result: '文章能對應這次輸入，而不是通用模板。' },
  { point_no: 2, observed_issue: '初稿沒有說明' + input.product + '的適用邊界與查證項目。', fix_action: '補上導入負擔、停止條件與需由負責人確認的資訊。', result: '產品不再只被硬塞進文章。' },
  { point_no: 3, observed_issue: '初稿缺少可以驗證的流程與圖像任務。', fix_action: '依「' + profile.key + '」主題重建三張圖與回顧指標。', result: '圖表標籤、數值與正文會隨輸入類型改變。' }
];
const articleCharCount = [...article.replace(/^!\[[^\n]*\]\([^\n]*\)$/gm, '')].length;
const positionPass = Math.abs(measured[0] - 25) <= 4 && Math.abs(measured[1] - 50) <= 4 && Math.abs(measured[2] - 75) <= 4;
const qualityGate = articleCharCount >= 1750 && articleCharCount <= 2100 && positionPass ? 'PASS' : 'REVIEW';
const draft = { version: 'draft', title: input.keyword + '｜初步整理', meta_description: '先釐清需求、限制與下一步。', article_markdown: draftArticle, char_count: [...draftArticle].length, images: [] };
const revised = { version: 'revised', title: input.keyword + '：' + profile.suffix, meta_description: '依「' + input.scenario + '」整理' + input.product + '的判斷方式、執行步驟與回顧指標。', article_markdown: article, char_count: articleCharCount, images };
return [{ json: { ...input, generation_method: 'input-driven-rule-composer', content_profile: profile.key, status: 'REVIEW', quality_gate: qualityGate, folder_path: folder, draft, improvements, revised } }];

}
