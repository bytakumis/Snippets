import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateCases, buildRequest, parseResponse, summarize, executeRun, reportOnly, MODELS, MODEL_VERSIONS } from './benchmark.mjs';
import { renderReport, rankByAccuracy } from './report.mjs';
const cases=JSON.parse(await readFile(new URL('./cases.json',import.meta.url),'utf8'));
const b=cases.c01_b1, c=cases.c01_c1;
const model=MODELS[0];
const response=(answer,extra={})=>({model,answers:{decision:answer},...extra});
const boolean=p=>response({type:'noul',noul:p});
const choice=()=>response({type:'choice',choice:'accept',probabilities:{accept:.6,decline:.1,request:.1,question:.1,unclear:.1}});
test('60件・10カテゴリ・各6件・30/30・true/false各15件',()=>{
  validateCases(cases);assert.equal(Object.keys(cases).length,60);
  const bs=Object.values(cases).filter(c=>c.question.type==='boolean');assert.equal(bs.length,30);assert.equal(bs.filter(c=>c.expected).length,15);
  const categories=[...new Set(Object.values(cases).map(c=>c.category))];assert.equal(categories.length,10);
  for(const cat of categories){const rows=Object.values(cases).filter(c=>c.category===cat);assert.equal(rows.length,6);assert.equal(rows.filter(c=>c.question.type==='choice').length,3);}
});
test('期待値と理由を送信せず、同じ判定条件を送る',()=>{
  const payload=buildRequest(model,{...b,expected:'DO_NOT_SEND',rationale:'SECRET_REASON',question:{...b.question,expected:'LEAK'}});
  assert.deepEqual(Object.keys(payload),['model','state','questions']);assert.equal(JSON.stringify(payload).includes('DO_NOT_SEND'),false);assert.equal(JSON.stringify(payload).includes('SECRET_REASON'),false);assert.equal(JSON.stringify(payload).includes('LEAK'),false);
  assert.deepEqual(buildRequest(MODELS[1],b).questions,payload.questions);assert.equal(payload.questions.decision.type,'noul');assert.equal(payload.state,b.state);
});
test('期待値の型と分類キーを検査',()=>{
  assert.throws(()=>validateCases({a:{...b,expected:'true'}}));assert.throws(()=>validateCases({a:{...c,expected:'unknown'}}));assert.throws(()=>validateCases({}));
});
test('Yes/Noの境界0.5と誤判定',()=>{
 assert.equal(parseResponse(boolean(.5),model,b).prediction,true);assert.equal(parseResponse(boolean(.499),model,b).correct,false);
 for(const p of [-.1,1.1,NaN,null,'0.5'])assert.throws(()=>parseResponse(boolean(p),model,b));
});
test('分類の全確率・選択肢・欠損を検査、欠損distributionは未取得',()=>{
 assert.equal(parseResponse(choice(),model,c).correct,true);
 assert.equal(parseResponse(response({type:'choice',choice:'accept'}),model,c).selectedProbability,null);
 for(const data of [{model,answers:{}},{...choice(),model:'wrong'},response({type:'choice',choice:'other'}),response({type:'choice',choice:'accept',probabilities:{accept:1}}),response({type:'noul',noul:1})])assert.throws(()=>parseResponse(data,model,c));
 const bad=choice();bad.answers.decision.probabilities.accept=.2;assert.throws(()=>parseResponse(bad,model,c));
});
test('未知のusage/costはゼロではなくnull、OpenRouterメタデータだけ抽出',()=>{
 const unknown=parseResponse(boolean(1),model,b);assert.equal(unknown.cost,null);assert.equal(unknown.usage.inputTokens,null);
 const known=parseResponse(response({type:'noul',noul:1},{usage:{input_tokens:10,output_tokens:0,cost:.0001},provider:'provider',id:'gen_test'}),model,b);
 assert.equal(known.cost,.0001);assert.equal(known.provider,'provider');
});
test('エラーと未実行を分離し、3回有効なケースだけで一致率算出',()=>{
 const manifest={models:[model],repeats:3,cases:{b,c}};
 const records=[1,2,3].map(repeat=>({model,caseId:'b',repeat,status:'ok',httpStatus:200,latencyMs:repeat*10,...parseResponse(boolean(1),model,b)}));
 records.push({model,caseId:'c',repeat:1,status:'error',httpStatus:200,latencyMs:5});
 const s=summarize(manifest,records)[0];assert.equal(s.correct,3);assert.equal(s.valid,3);assert.equal(s.planned,6);assert.equal(s.apiSuccess,4);assert.equal(s.errors,1);assert.equal(s.consistencyEligible,1);assert.equal(s.consistent,1);assert.equal(s.medianMs,20);assert.equal(s.p95Ms,30);assert.equal(s.cost,null);
});
test('認証エラーで停止・安全なエラー記録・保存と再生成',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'decision-test-'));
 try{
 let calls=0;const key='PRIVATE_TEST_KEY';
 const result=await executeRun({cases:{b},models:[model],repeats:3,outDir:dir,apiKey:key,fetchImpl:async()=>{calls++;return new Response(key,{status:401});}});
 assert.equal(calls,1);assert.equal(result.manifest.state,'stopped');assert.equal(result.records[0].error,'http_401');assert.equal(result.summary[0].planned,3);
 const saved=await readFile(path.join(dir,'results.jsonl'),'utf8');assert.equal(saved.includes(key),false);
 await reportOnly(dir);assert.match(await readFile(path.join(dir,'report.html'),'utf8'),/日本語 Decision API/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('通常実行の巡回順序・繰り返し・エラー後の継続',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'decision-test-'));
 try{
 let calls=0;const order=[];
 const result=await executeRun({cases:{b1:b,b2:b},models:MODELS.slice(0,2),repeats:2,outDir:dir,apiKey:'test',fetchImpl:async(url,opts)=>{
 const body=JSON.parse(opts.body);order.push(body.model);calls++;
 if(calls===2)throw new Error('sensitive external error');
 return Response.json({model:body.model,answers:{decision:{type:'noul',noul:1}}});}});
 assert.equal(calls,8);assert.deepEqual(order,[MODELS[0],MODELS[1],MODELS[1],MODELS[0],MODELS[1],MODELS[0],MODELS[0],MODELS[1]]);assert.equal(result.manifest.state,'completed_with_errors');assert.equal(result.records[1].error,'network_error');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('HTML内のscript終了文字・日本語・特殊文字を安全に保存',()=>{
 const state='日本語 <img src=x onerror=alert(1)> </script> &';
 const manifest={models:[model],repeats:3,cases:{b:{...b,state}},caseHash:'hash'};
 const html=renderReport(manifest,[],[]);assert.equal(html.includes(state),false);
 const json=html.match(/<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/)[1];assert.equal(JSON.parse(json).manifest.cases.b.state,state);
 assert.equal(html.includes('textContent'),true);
});

test('実Clef Flash応答の契約と15モデルの構成', async()=>{
 assert.equal(MODELS.length,15);assert.equal(new Set(MODELS).size,15);assert.ok(MODELS.includes('cloudflare/clef-flash'));
 const parsed=parseResponse({model:'cloudflare/clef-flash',answers:{decision:{type:'noul',noul:.9124}},usage:{input_tokens:164,output_tokens:0,cost:.000003444},id:'gen-dec-test',provider:'PrimeIntellect'},'cloudflare/clef-flash',b);
 assert.equal(parsed.correct,true);assert.equal(parsed.usage.inputTokens,164);assert.equal(parsed.cost,.000003444);assert.equal(parsed.provider,'PrimeIntellect');assert.equal(parsed.generationId,'gen-dec-test');
});

test('カタログの正式モデルIDを受け入れ、別モデルを拒否する',()=>{
 for(const model of MODELS){
  const parsed=parseResponse({model:MODEL_VERSIONS[model],answers:{decision:{type:'noul',noul:1}}},model,b);
  assert.equal(parsed.correct,true);assert.equal(parsed.responseModel,MODEL_VERSIONS[model]);
 }
 assert.throws(()=>parseResponse({model:'typesafe/jev-1.13-wrong',answers:{decision:{type:'noul',noul:1}}},'typesafe/jev-1.13',b));
 assert.throws(()=>parseResponse({model:'liquid/d1',answers:{decision:{type:'noul',noul:1}}},'typesafe/jev-1.13',b));
});
test('丸め済みの実Clef分布・Jev分布を補正せず保持、整数の不正分布は拒否',()=>{
 const probabilities={accept:.9724,decline:.0074,request:.005,question:.0051,unclear:.0102};
 const parsed=parseResponse({model:'cloudflare/clef',answers:{decision:{type:'choice',choice:'accept',probabilities}}},'cloudflare/clef',c);
 assert.deepEqual(parsed.probabilities,probabilities);
 const rounded={accept:.98,decline:.01,request:0,question:0,unclear:0};
 assert.deepEqual(parseResponse(response({type:'choice',choice:'accept',probabilities:rounded}),model,c).probabilities,rounded);
 assert.throws(()=>parseResponse(response({type:'choice',choice:'accept',probabilities:{accept:1,decline:1,request:1,question:1,unclear:1}}),model,c));
});

test('全体比較だけを正答率順に並べ、有効回答0件を最後にする',()=>{
 const rows=[{model:'a',correct:9,valid:10},{model:'none',correct:0,valid:0},{model:'b',correct:2,valid:2},{model:'tie',correct:18,valid:20}];
 const ranked=rankByAccuracy(rows);assert.deepEqual(ranked.map(r=>r.model),['b','a','tie','none']);assert.equal(rows[0].model,'a');
 const html=renderReport({models:rows.map(r=>r.model),cases:{}},[],rows);
 const data=JSON.parse(html.match(/<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 assert.deepEqual(data.overview.map(r=>r.model),['b','a','tie','none']);assert.deepEqual(data.summary,rows);
});
test('2回とも有効なケースだけで2回一致率を計算する',()=>{
 const manifest={models:[model],repeats:2,cases:{b,c}};
 const rows=[1,2].map(repeat=>({model,caseId:'b',repeat,status:'ok',httpStatus:200,latencyMs:10,...parseResponse(boolean(1),model,b)}));
 rows.push({model,caseId:'c',repeat:1,status:'error',httpStatus:500,latencyMs:5});
 let s=summarize(manifest,rows)[0];assert.equal(s.consistencyEligible,1);assert.equal(s.consistent,1);
 rows[1]={...rows[1],prediction:false,correct:false};s=summarize(manifest,rows)[0];assert.equal(s.consistencyEligible,1);assert.equal(s.consistent,0);
});
