import test from 'node:test';import assert from 'node:assert/strict';
import worker,{createWorker,searchPlaces,convertPlace} from '../worker/index.js';
import {input,env,providerFixture} from './live-fixtures.mjs';
const req=(body=input,origin='https://example.github.io')=>new Request('https://api.example/api/plan',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});

test('地址片段缺少 types 不應中斷全程規劃，仍須有台灣國別才接受',async()=>{
  const mock=providerFixture();
  const fetcher=async(url,options)=>{
    const response=await mock.fetcher(url,options);
    if(url.includes('/media?'))return response;
    const data=await response.json();
    for(const p of data.places||[])p.addressComponents.unshift({longText:'未分類地址片段'},null,{types:null});
    return Response.json(data);
  };
  const response=await createWorker(fetcher).fetch(req({...input,days:3,interest:'shopping'}),env);
  assert.equal(response.status,200,await response.clone().text());
  assert.equal((await response.json()).days.length,3);
  const places=await searchPlaces('test',env,async()=>Response.json({places:[{location:{latitude:24,longitude:121},addressComponents:[{shortText:'TW'},{types:null,shortText:'TW'}]}]}));
  assert.equal(places.length,0);
});
test('所有城市都需要線上設定，不再回傳內建四地',async()=>{for(const destination of ['台北','宜蘭','台中','台南','花蓮','日月潭'])assert.equal((await worker.fetch(req({...input,destination}),{ALLOWED_ORIGINS:env.ALLOWED_ORIGINS})).status,503);});
test('API 拒絕錯誤來源、null 來源、超大資料及無效條件',async()=>{
  assert.equal((await worker.fetch(req(input,'https://bad.example'),env)).status,403);
  assert.equal((await worker.fetch(req(input,'null'),{...env,ALLOWED_ORIGINS:'null'})).status,403);
  assert.equal((await worker.fetch(req(input,''),{})).status,403);
  assert.equal((await worker.fetch(req({...input,people:0}),env)).status,400);
  assert.equal((await worker.fetch(req({...input,extra:'x'.repeat(9000)}),env)).status,413);
});
test('付費查詢前檢查流量限制',async()=>{
  const mock=providerFixture(),api=createWorker(mock.fetcher);
  assert.equal((await api.fetch(req(),{...env,RATE_LIMITER:undefined})).status,503);
  assert.equal((await api.fetch(req(),{...env,RATE_LIMITER:{limit:async()=>({success:false})}})).status,429);
  assert.equal(mock.calls.length,0);
});
test('全台查詢含雨備、正確區域偏好、照片作者且不洩漏 key 或 photo name',async()=>{
  for(const destination of ['台中','花蓮','日月潭']){
    const mock=providerFixture(),response=await createWorker(mock.fetcher).fetch(req({...input,destination}),env);
    assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
    const text=await response.text(),plan=JSON.parse(text);
    assert.equal(plan.sourceMode,'live');assert.equal(plan.region.city,destination);assert.equal(plan.resolvedLocation.name,destination);
    assert.ok(plan.routes.sun.available);assert.ok(plan.routes.heavy.available);
    assert.ok(plan.routes.heavy.items.filter(i=>i.place).every(i=>i.place.indoor));
    assert.ok(!text.includes('過遠景點'));assert.ok(!text.includes(env.GOOGLE_PLACES_API_KEY));assert.ok(!text.includes('photoReference'));
    assert.ok(plan.routes.sun.items.some(i=>i.place?.image?.authors[0].displayName==='測試作者'));
    const searches=mock.calls.filter(c=>c.body);assert.equal(searches.length,5);
    assert.equal(searches[1].body.locationBias.circle.radius,15000);
    assert.ok(mock.calls.length<=17);
    if(destination==='日月潭')assert.equal(plan.routes.sun.items.find(i=>i.place).place.id,'g-anchor');
  }
});
test('照片失敗仍回傳可用行程，無結果不補造資料',async()=>{
  const mock=providerFixture({photoFailure:true}),r=await createWorker(mock.fetcher).fetch(req(),env);
  assert.equal(r.status,200);assert.ok(!(await r.json()).routes.sun.items.some(i=>i.place?.image));
  const no=await createWorker(providerFixture({empty:true}).fetcher).fetch(req(),env);
  assert.equal(no.status,502);assert.match((await no.json()).error,/找不到/);
});
test('Google adapter 排除境外、停業、無座標結果',async()=>{
  const item={id:'a',displayName:{text:'測試博物館'},location:{latitude:22.63,longitude:120.3},types:['museum'],addressComponents:[{types:['country'],shortText:'TW'}]};
  const result=await searchPlaces('test',env,async(url,opts)=>{assert.equal(new URL(url).hostname,'places.googleapis.com');assert.ok(!opts.headers['X-Goog-FieldMask'].includes('*'));return Response.json({places:[item,{...item,id:'b',businessStatus:'CLOSED_PERMANENTLY'},{...item,id:'c',addressComponents:[]},{...item,id:'d',location:null}]});});
  assert.equal(result.length,1);
});
test('Google adapter 不跨午休、例行休館與未知時段正確標示',()=>{
  const p={id:'a',types:['museum'],location:{latitude:25,longitude:121},regularOpeningHours:{periods:[{open:{day:0,hour:9},close:{day:0,hour:12}},{open:{day:0,hour:14},close:{day:0,hour:17}}]}};
  const a=convertPlace(p,0);assert.equal(a.close-a.open,180);assert.deepEqual(convertPlace(p,1).closed,[1]);
  assert.match(convertPlace({...p,regularOpeningHours:undefined},1).hours,/未取得/);
});
test('上游錯誤及配額提示不暴露金鑰',async()=>{const r=await createWorker(providerFixture({upstreamStatus:429}).fetcher).fetch(req(),env);assert.equal(r.status,502);assert.match((await r.json()).error,/配額/);});
