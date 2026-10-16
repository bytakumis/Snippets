export function rankByAccuracy(summary) {
  const accuracy = row => row.valid ? row.correct / row.valid : -1;
  return [...summary].sort((a, b) => accuracy(b) - accuracy(a));
}

function reportClient(data) {
  const { manifest: m, records, summary, overview } = data;
  document.getElementById('report-title').textContent = `日本語の判断を、${m.models.length}モデルで見比べる`;
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
  const label = v => v === true ? 'はい' : v === false ? 'いいえ' : v;
  const pct = (n,d) => d ? `${(100*n/d).toFixed(1)}%` : '未計測';
  const rate = s => `${s.correct}/${s.valid} (${pct(s.correct,s.valid)})`;
  const ms = n => n == null ? '未取得' : `${Math.round(n).toLocaleString()} ms`;
  const fmt = n => n == null ? '未取得' : n.toFixed(3);
  const modelName = id => id.split('/').at(-1);
  const table = (headers, rows, target) => { const wrap = el('div',null,'scroll'); const t = el('table'); const h = el('thead'); const tr = el('tr'); headers.forEach(x => tr.append(el('th',x))); h.append(tr); t.append(h); const b = el('tbody'); rows.forEach(row => { const tr = el('tr'); row.forEach(value => { const td = el('td'); td.append(value instanceof Node ? value : el('span',value)); tr.append(td); }); b.append(tr); }); t.append(b); wrap.append(t); target.append(wrap); };
  const metadata = document.getElementById('metadata');
  metadata.textContent = `${new Date(m.startedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})} JST · ${new URL(m.endpoint).hostname} · ${Object.keys(m.cases).length}文 × ${m.models.length}モデル × ${m.repeats}回 · ${records.length}/${Object.keys(m.cases).length*m.models.length*m.repeats}リクエスト記録`;
  const stateText = { completed:'比較完了', completed_with_errors:'比較完了・エラーあり', stopped:'途中で停止', running:'実行途中', preview:'表示検証用・実API未実行' };
  document.getElementById('run-state').textContent = (stateText[m.state] || m.state) + (m.stopReason ? ` (${m.stopReason})` : '');
  document.getElementById('hash').textContent = `データ SHA-256: ${m.caseHash}\n接続先: ${m.endpoint}\nYes/No閾値: ${m.threshold} · タイムアウト: ${m.timeoutMs/1000}秒 · 自動再試行なし\n完了時刻: ${m.finishedAt ? new Date(m.finishedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})+' JST' : '未完了'}`;
  table(['モデル','正解／有効回答','予定数に対する正解','API成功／試行','エラー','処理時間 中央値 / p95','取得費用 USD',`${m.repeats}回一致／対象ケース`], overview.map(s => [s.model,rate(s),`${s.correct}/${s.planned} (${pct(s.correct,s.planned)})`,`${s.apiSuccess}/${s.attempted} (${pct(s.apiSuccess,s.attempted)})`,`${s.errors}（未実行 ${s.planned-s.attempted}）`,`${ms(s.medianMs)} / ${ms(s.p95Ms)}`,s.cost == null ? '未取得' : `$${s.cost.toFixed(8)} (${s.costCount}/${s.valid}件取得)`,m.repeats >= 2 ? `${s.consistent}/${s.consistencyEligible} (${pct(s.consistent,s.consistencyEligible)})` : '複数回実行時のみ算出']),document.getElementById('overview'));
  const categories = [...new Set(Object.values(m.cases).map(c=>c.category))];
  table(['カテゴリ',...m.models.map(modelName)], categories.map(c=>[c,...summary.map(s=>rate(s.categories[c]))]),document.getElementById('categories'));
  table(['判定の型',...m.models.map(modelName)], ['boolean','choice'].map(t=>[t === 'boolean'?'Yes/No':'分類',...summary.map(s=>rate(s.types[t]))]).concat([['Yes/No 誤検出 / 見逃し',...summary.map(s=>`${s.falsePositive} / ${s.falseNegative}`)]]),document.getElementById('types'));
  const categorySelect = document.getElementById('category'); categories.forEach(c=>{ const opt=el('option',c);opt.value=c;categorySelect.append(opt); });
  const filterSelect = document.getElementById('filter');
  const recordsFor = id => records.filter(r=>r.caseId===id);
  const hasDisagreement = rows => { for(let repeat=1;repeat<=m.repeats;repeat++) if(new Set(rows.filter(r=>r.repeat===repeat&&r.status==='ok').map(r=>r.prediction)).size>1)return true; return false; };
  const hasVariation = rows => m.models.some(model=>new Set(rows.filter(r=>r.model===model&&r.status==='ok').map(r=>r.prediction)).size>1);
  const matched = (id,item) => { if(categorySelect.value&&categorySelect.value!==item.category)return false; const rows=recordsFor(id);switch(filterSelect.value){case 'wrong':return rows.some(r=>r.status==='ok'&&!r.correct);case 'disagree':return hasDisagreement(rows);case 'vary':return hasVariation(rows);case 'error':return rows.some(r=>r.status!=='ok');default:return true;} };
  const answerCell = (id,model) => {
    const box=el('div',null,'answers');const rows=recordsFor(id).filter(r=>r.model===model);
    for(let repeat=1;repeat<=m.repeats;repeat++){
      const r=rows.find(r=>r.repeat===repeat);const block=el('div',null,'answer');
      if(!r){block.append(el('span',`${repeat}回目 · 未実行`,'muted'));box.append(block);continue;}
      if(r.status!=='ok'){block.append(el('span',`${repeat}回目 · エラー`,'badge error'),el('div',r.error,'small'));box.append(block);continue;}
      block.append(el('span',`${repeat}回目 · ${r.correct?'✓ 正解':'✗ 誤判定'}`,r.correct?'badge correct':'badge wrong'));
      block.append(el('div',typeof r.prediction==='boolean'?label(r.prediction):m.cases[id].question.criteria[r.prediction],'prediction'));
      block.append(el('div',`${r.probability!=null?'P(はい)':'選択肢の確率'}: ${fmt(r.probability??r.selectedProbability)} · ${ms(r.latencyMs)}`,'small'));
      const details=el('details');details.append(el('summary','確率・使用量の詳細'));
      if(r.probabilities)for(const [key,value]of Object.entries(r.probabilities))details.append(el('div',`${m.cases[id].question.criteria[key]}: ${fmt(value)}`,'small'));
      details.append(el('div',`入力tokens: ${r.usage?.inputTokens??'未取得'} / 出力tokens: ${r.usage?.outputTokens??'未取得'}\n費用 USD: ${r.cost==null?'未取得':r.cost.toFixed(8)}\n実行モデル: ${r.responseModel??'未取得'}\nprovider: ${r.provider??'未取得'}\nGeneration ID: ${r.generationId??'未取得'}`,'small pre'));
      block.append(details);box.append(block);
    }return box;
  };
  const renderCases=()=>{
    const target=document.getElementById('cases');target.replaceChildren();
    const items=Object.entries(m.cases).filter(([id,item])=>matched(id,item));
    document.getElementById('count').textContent=`${items.length} / ${Object.keys(m.cases).length}ケース`;
    table(['本文・期待値',...m.models.map(modelName)],items.map(([id,item])=>{
      const desc=el('div',null,'case');desc.append(el('div',`${id} · ${item.category} · ${item.question.type==='boolean'?'Yes/No':'分類'}`,'small muted'),el('p',item.state,'sentence'),el('p',item.question.instructions,'question'),el('p',`期待値: ${typeof item.expected==='boolean'?label(item.expected):item.question.criteria[item.expected]}`,'expected'),el('p',item.rationale,'small'));
      const details=el('details');details.append(el('summary','判定基準'));for(const [key,value]of Object.entries(item.question.criteria))details.append(el('div',`${key}: ${value}`,'small'));desc.append(details);
      return [desc,...m.models.map(model=>answerCell(id,model))];
    }),target);
  };
  categorySelect.addEventListener('change',renderCases);filterSelect.addEventListener('change',renderCases);renderCases();
}
export function renderReport(manifest, records, summary) {
  const data=JSON.stringify({manifest,records,summary,overview:rankByAccuracy(summary)}).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'"><title>日本語 Decision API 比較</title><style>
:root{font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif;color:#193129;background:#f5f7f5;font-size:14px}*{box-sizing:border-box}body{margin:0}main{max-width:1700px;margin:auto;padding:36px 28px 80px}header{border-bottom:2px solid #173e32;padding-bottom:24px}h1{font-size:30px;letter-spacing:-.02em;margin:10px 0}h2{font-size:21px;margin:0 0 18px}.eyebrow{font-size:12px;letter-spacing:.12em;color:#537568}section{margin-top:28px;background:white;border:1px solid #dce6df;border-radius:12px;padding:22px}.muted{color:#62766a}.small{font-size:12px;line-height:1.7}.pre{white-space:pre-wrap;overflow-wrap:anywhere}.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;vertical-align:top;padding:14px 12px;border-bottom:1px solid #e3eae5}th{background:#edf4ef;font-size:12px;color:#416050;white-space:nowrap}tbody tr:last-child td{border-bottom:0}.controls{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:18px}label{font-size:13px}select{font:inherit;padding:9px 12px;background:white;border:1px solid #b9c9bf;border-radius:6px;margin-left:7px}.case{width:310px}.sentence{font-size:15px;font-weight:600;line-height:1.8}.question{font-size:12px;line-height:1.8;color:#526d5e}.expected{font-weight:600;line-height:1.6}.answers{min-width:195px}.answer{padding:0 0 14px;margin-bottom:14px;border-bottom:1px dashed #e2e8e3}.answer:last-child{border:0;margin:0}.badge{display:inline-block;font-size:11px;font-weight:600;border-radius:5px;padding:3px 7px}.correct{background:#e2f4e9;color:#256344}.wrong{background:#fde8e1;color:#a64426}.error{background:#fff0ce;color:#7f5911}.prediction{margin:7px 0 3px;font-weight:600;line-height:1.6}details{margin-top:9px;color:#5e7466}summary{cursor:pointer;font-size:12px}.note{font-size:12px;color:#67786c;line-height:1.9}#run-state{display:inline-block;padding:7px 12px;border:1px solid #ccd9d0;border-radius:20px;font-size:12px}#hash{margin-bottom:0}footer{margin-top:25px}@media(max-width:700px){main{padding:20px 12px}h1{font-size:24px}section{padding:15px}}
</style></head><body><main><header><div class="eyebrow">JAPANESE DECISION BENCHMARK</div><h1 id="report-title">日本語の判断を見比べる</h1><p id="metadata" class="muted"></p><span id="run-state"></span><details><summary>実行条件・データ識別情報</summary><p id="hash" class="small pre"></p></details></header><section><h2>全体比較</h2><div id="overview"></div><p class="note">正解率は有効回答のみで計算。予定数に対する正解と、エラー・未実行件数も併記します。API成功はHTTP 2xxであり、不正応答は有効回答に含めません。処理時間は有効回答の通信開始から応答検査完了まで。費用はAPIが返した値の取得分だけの合計です。一致率は指定回数すべて有効なケースのみが対象です。</p></section><section><h2>日本語の難しさ別</h2><div id="categories"></div></section><section><h2>判定の型別</h2><div id="types"></div></section><section><h2>文章ごとの比較</h2><div class="controls"><label>カテゴリ<select id="category"><option value="">すべて</option></select></label><label>表示<select id="filter"><option value="all">すべて</option><option value="wrong">誤判定あり</option><option value="disagree">モデル間で不一致</option><option value="vary">同じモデルで判定が揺れた</option><option value="error">APIエラーあり</option></select></label><span id="count" class="small muted"></span></div><div id="cases"></div></section><footer class="note">合成した日本語の評価データに対する比較です。期待値・理由はモデルに送信しません。確率はモデルの予測であり、モデル間で同じ意味の確信度を保証するものではありません。実行時のモデル・配信経路・混雑状況により結果は変化します。</footer></main><script id="report-data" type="application/json">${data}</script><script>(${reportClient.toString()})(JSON.parse(document.getElementById('report-data').textContent));</script></body></html>`;
}
