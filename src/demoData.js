const demoArticles = [
  {
    position: 1,
    title: '4G 吃到飽方案怎麼選？速度、流量與資費一次比較',
    source: 'demo.telecom.tw',
    link: 'https://example.com/4g-plan-guide',
    snippet: '從月租、網路速度、合約與熱點分享比較常見的 4G 方案。',
    entities: [
      { name: '4G', frequency: 5 },
      { name: '吃到飽', frequency: 4 },
      { name: '月租', frequency: 3 },
      { name: '網路速度', frequency: 3 },
      { name: '熱點分享', frequency: 2 },
    ],
  },
  {
    position: 2,
    title: '台灣電信 4G 吃到飽價格整理：合約與優惠比較',
    source: 'demo.mobile-lab.tw',
    link: 'https://example.com/carrier-price',
    snippet: '整理不同電信業者的月租價格、綁約條件與期間優惠。',
    entities: [
      { name: '4G', frequency: 4 },
      { name: '吃到飽', frequency: 3 },
      { name: '電信業者', frequency: 3 },
      { name: '月租', frequency: 4 },
      { name: '合約', frequency: 3 },
      { name: '優惠', frequency: 2 },
    ],
  },
  {
    position: 3,
    title: '4G 與 5G 吃到飽差在哪裡？日常使用情境分析',
    source: 'demo.tech-note.tw',
    link: 'https://example.com/4g-vs-5g',
    snippet: '用通勤、影音、遊戲與訊號涵蓋等情境說明 4G 和 5G 的差異。',
    entities: [
      { name: '4G', frequency: 3 },
      { name: '5G', frequency: 5 },
      { name: '網路速度', frequency: 3 },
      { name: '訊號涵蓋', frequency: 2 },
      { name: '影音', frequency: 2 },
    ],
  },
  {
    position: 4,
    title: '學生族 4G 吃到飽推薦：低月租與預付卡選擇',
    source: 'demo.student-life.tw',
    link: 'https://example.com/student-4g',
    snippet: '以學生預算與使用量為前提，整理低月租、預付卡與申辦條件。',
    entities: [
      { name: '4G', frequency: 3 },
      { name: '吃到飽', frequency: 3 },
      { name: '學生', frequency: 3 },
      { name: '低月租', frequency: 3 },
      { name: '預付卡', frequency: 2 },
    ],
  },
  {
    position: 5,
    title: '手機分享網路會降速嗎？4G 吃到飽熱點規則',
    source: 'demo.device-check.tw',
    link: 'https://example.com/hotspot-policy',
    snippet: '比較熱點分享、網路管理政策與不同裝置連線的實際限制。',
    entities: [
      { name: '4G', frequency: 3 },
      { name: '吃到飽', frequency: 2 },
      { name: '熱點分享', frequency: 5 },
      { name: '降速', frequency: 3 },
      { name: '手機', frequency: 2 },
    ],
  },
  {
    position: 6,
    title: '4G 吃到飽合約到期後，續約與攜碼哪個划算？',
    source: 'demo.consumer-guide.tw',
    link: 'https://example.com/renew-or-port',
    snippet: '從續約、攜碼、違約金與贈品條件拆解換方案前的檢查項目。',
    entities: [
      { name: '4G', frequency: 2 },
      { name: '吃到飽', frequency: 3 },
      { name: '續約', frequency: 4 },
      { name: '攜碼', frequency: 4 },
      { name: '合約', frequency: 3 },
      { name: '違約金', frequency: 2 },
    ],
  },
  {
    position: 7,
    title: '偏鄉與室內訊號怎麼看？4G 電信網路涵蓋比較',
    source: 'demo.signal-map.tw',
    link: 'https://example.com/coverage',
    snippet: '提醒使用者檢查生活圈、室內與偏鄉地點的電信網路涵蓋。',
    entities: [
      { name: '4G', frequency: 3 },
      { name: '訊號涵蓋', frequency: 5 },
      { name: '電信業者', frequency: 2 },
      { name: '室內', frequency: 3 },
      { name: '偏鄉', frequency: 2 },
    ],
  },
  {
    position: 8,
    title: 'iPhone、Android 使用 4G 吃到飽的流量與速度注意事項',
    source: 'demo.phone-review.tw',
    link: 'https://example.com/phone-compatibility',
    snippet: '從手機支援頻段、系統設定與流量管理檢查使用體驗。',
    entities: [
      { name: '4G', frequency: 4 },
      { name: '吃到飽', frequency: 2 },
      { name: 'iPhone', frequency: 3 },
      { name: 'Android', frequency: 3 },
      { name: '流量', frequency: 3 },
    ],
  },
  {
    position: 9,
    title: '網路吃到飽真的不限速嗎？公平使用原則與降速條款',
    source: 'demo.contract-watch.tw',
    link: 'https://example.com/fair-use',
    snippet: '閱讀方案條款時，應特別留意公平使用原則、流量門檻與降速。',
    entities: [
      { name: '吃到飽', frequency: 4 },
      { name: '不限速', frequency: 3 },
      { name: '公平使用原則', frequency: 3 },
      { name: '降速', frequency: 4 },
      { name: '流量', frequency: 2 },
    ],
  },
  {
    position: 10,
    title: '2025–2026 4G 吃到飽方案更新與申辦提醒',
    source: 'demo.plan-watch.tw',
    link: 'https://example.com/plan-update',
    snippet: '整理近期資費變動、線上申辦與門市優惠，實際條件以業者公告為準。',
    entities: [
      { name: '4G', frequency: 4 },
      { name: '吃到飽', frequency: 3 },
      { name: '資費', frequency: 3 },
      { name: '申辦', frequency: 3 },
      { name: '優惠', frequency: 2 },
    ],
  },
]

const topicByEntity = {
  '4G': '方案與技術',
  '5G': '方案與技術',
  '吃到飽': '方案與技術',
  '月租': '資費與合約',
  '低月租': '資費與合約',
  '資費': '資費與合約',
  '合約': '資費與合約',
  '優惠': '優惠與申辦',
  '申辦': '優惠與申辦',
  '續約': '優惠與申辦',
  '攜碼': '優惠與申辦',
  '預付卡': '優惠與申辦',
  '違約金': '資費與合約',
  '電信業者': '網路與涵蓋',
  '網路速度': '網路與涵蓋',
  '訊號涵蓋': '網路與涵蓋',
  '室內': '網路與涵蓋',
  '偏鄉': '網路與涵蓋',
  '熱點分享': '使用情境',
  '影音': '使用情境',
  '降速': '條款與限制',
  '不限速': '條款與限制',
  '公平使用原則': '條款與限制',
  '流量': '條款與限制',
  '手機': '裝置相容',
  'iPhone': '裝置相容',
  'Android': '裝置相容',
  '學生': '使用情境',
}

function buildAggregates(articles) {
  const entities = new Map()
  for (const article of articles) {
    for (const entity of article.entities) {
      const existing = entities.get(entity.name) || { name: entity.name, totalFrequency: 0, articleCount: 0 }
      existing.totalFrequency += entity.frequency
      existing.articleCount += 1
      entities.set(entity.name, existing)
    }
  }

  const orderedEntities = [...entities.values()]
    .map((entity) => ({ ...entity, topic: topicByEntity[entity.name] || '其他' }))
    .sort((a, b) => b.totalFrequency - a.totalFrequency || b.articleCount - a.articleCount)

  const clusterMap = new Map()
  for (const entity of orderedEntities) {
    const cluster = clusterMap.get(entity.topic) || { topic: entity.topic, entityCount: 0, totalFrequency: 0, entities: [] }
    cluster.entityCount += 1
    cluster.totalFrequency += entity.totalFrequency
    cluster.entities.push(entity)
    clusterMap.set(entity.topic, cluster)
  }

  return {
    entities: orderedEntities,
    clusters: [...clusterMap.values()].sort((a, b) => b.totalFrequency - a.totalFrequency),
  }
}

export function getDemoResult(query = '4G 吃到飽') {
  const articles = demoArticles.map((article) => ({
    ...article,
    entityCount: article.entities.length,
    fetchStatus: '展示資料',
  }))
  const aggregates = buildAggregates(articles)
  return {
    query,
    source: 'demo',
    mode: 'demo',
    createdAt: new Date().toISOString(),
    notice: '這是一組固定的展示資料；輸入仍可自由修改，連線到 SerpApi 後才會得到即時結果。',
    summary: {
      articleCount: articles.length,
      entityCount: aggregates.entities.length,
      clusterCount: aggregates.clusters.length,
      totalMentions: aggregates.entities.reduce((sum, entity) => sum + entity.totalFrequency, 0),
    },
    articles,
    ...aggregates,
  }
}
