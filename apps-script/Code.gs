const CONFIG_SHEET = '設定';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SERP Entity Desk')
    .addItem('建立工作表', 'setupSheet')
    .addItem('執行分析並匯出', 'exportSerpEntityAnalysis')
    .addToUi();
}

function setupSheet() {
  const spreadsheet = SpreadsheetApp.getActive();
  const config = getOrCreateSheet_(spreadsheet, CONFIG_SHEET);
  config.getRange('A1:B4').setValues([
    ['設定', '值'],
    ['query', '4G 吃到飽'],
    ['endpoint', '請在 Script Properties 設定 SERP_ENTITY_ENDPOINT'],
    ['說明', 'Live API 需要 X-App-Script-Token；不要把 token 寫在儲存格'],
  ]);
  config.autoResizeColumns(1, 2);
  ['summary', 'articles', 'entities', 'clusters'].forEach((name) => {
    getOrCreateSheet_(spreadsheet, name).clear();
  });
  return config;
}

function exportSerpEntityAnalysis() {
  const spreadsheet = SpreadsheetApp.getActive();
  const config = spreadsheet.getSheetByName(CONFIG_SHEET) || setupSheet();
  const query = String(config.getRange('B2').getValue() || '').trim();
  const props = PropertiesService.getScriptProperties();
  const endpoint = String(props.getProperty('SERP_ENTITY_ENDPOINT') || '').trim();
  const token = String(props.getProperty('SERP_ENTITY_API_TOKEN') || '').trim();

  if (!query) throw new Error('請在 設定!B2 輸入查詢字詞。');
  if (!endpoint) throw new Error('缺少 Script Property：SERP_ENTITY_ENDPOINT。');
  if (!token) throw new Error('缺少 Script Property：SERP_ENTITY_API_TOKEN。');

  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-App-Script-Token': token },
    payload: JSON.stringify({ query, gl: 'tw', hl: 'zh-tw', persist: false }),
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  const body = JSON.parse(response.getContentText() || '{}');
  if (status < 200 || status >= 300) {
    throw new Error('SERP Entity API ' + status + ': ' + (body.error || '未知錯誤'));
  }

  const result = body.result || body;
  writeRows_(spreadsheet, 'summary', [
    ['query', 'source', 'mode', 'article_count', 'entity_count', 'cluster_count', 'created_at'],
    [result.query, result.source, result.mode, result.summary.articleCount, result.summary.entityCount, result.summary.clusterCount, result.createdAt],
  ]);

  writeRows_(spreadsheet, 'articles', [
    ['position', 'title', 'source', 'link', 'entity_count', 'fetch_status'],
    ...result.articles.map((article) => [article.position, article.title, article.source, article.link, article.entityCount, article.fetchStatus]),
  ]);

  writeRows_(spreadsheet, 'entities', [
    ['entity', 'total_frequency', 'article_count', 'topic'],
    ...result.entities.map((entity) => [entity.name, entity.totalFrequency, entity.articleCount, entity.topic]),
  ]);

  writeRows_(spreadsheet, 'clusters', [
    ['topic', 'entity_count', 'total_frequency', 'entities'],
    ...result.clusters.map((cluster) => [cluster.topic, cluster.entityCount, cluster.totalFrequency, cluster.entities.map((entity) => entity.name).join(', ')]),
  ]);
}

function getOrCreateSheet_(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function writeRows_(spreadsheet, name, rows) {
  const sheet = getOrCreateSheet_(spreadsheet, name);
  sheet.clearContents();
  if (!rows.length) return;
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, rows[0].length);
}
