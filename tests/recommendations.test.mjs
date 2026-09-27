import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendations,mealHours,validateRecommendations} from '../worker/recommendations.js';
import {createWorker} from '../worker/index.js';
import {recommendationInput} from '../src/dining.js';
import {env,input} from './live-fixtures.mjs';
import {buildPlan} from '../src/engine.js';
const anchor={lat:24.15,lng:120.66,name:'測試景點',start:720,end:780};
const request={date:'2026-10-03',overnight:true,lunch:anchor,dinner:{...anchor,start:1080,end:1140}};
const place=(id,rating=4.5,extra={})=>({id,rating,userRatingCount:123,displayName:{text:`模擬${id}`},types:['restaurant'],location:{latitude:anchor.lat,longitude:anchor.lng},addressComponents:[{types:['country'],shortText:'TW'}],...extra});
test('餐廳嚴格保留 4.5 分與三公里範圍，不足兩家不降標準',async()=>{
 const data=await recommendations({...request,overnight:false},async()=>[place('good'),place('low',4.4),place('unknown',undefined,{rating:null}),place('far',5,{location:{latitude:25,longitude:121}}),place('shop',5,{types:['shopping_mall']})]);
 assert.deepEqual(data.lunch.items.map(p=>p.id),['good']);assert.equal(data.lodging,null);assert.match(data.lunch.note,/不足兩家/);assert.equal(data.lunch.items[0].hoursStatus,'unknown');
});
test('用餐時段包含午休、休館、跨夜與週界，不使用查詢當下營業取代旅遊日期',()=>{
 const p=place('a',5,{regularOpeningHours:{periods:[{open:{day:6,hour:11},close:{day:6,hour:13}},{open:{day:6,hour:17},close:{day:6,hour:21}}]}});
 assert.equal(mealHours(p,request.date,720,780),'open');assert.equal(mealHours(p,request.date,750,810),'closed');assert.equal(mealHours(p,'2026-10-04',720,780),'closed');
 const overnight={regularOpeningHours:{periods:[{open:{day:6,hour:22},close:{day:0,hour:2}}]}};
 assert.equal(mealHours(overnight,'2026-10-04',30,90),'open');
 assert.equal(mealHours({regularOpeningHours:{periods:[{open:{day:0,hour:0}}]}},request.date,720,780),'open');
});
test('飯店星級來自官方資料，Google 高分飯店不能冒充高分民宿',async()=>{
 const snapshot={source:'https://data.gov.tw/dataset/7780',updated:'2026-09-27',hotels:[{id:'three',stars:3,...anchor},{id:'two',stars:2,...anchor},{id:'far',stars:5,...anchor,lat:25}]};
 const searcher=async q=>q==='民宿'?[place('bnb',4.5,{types:['bed_and_breakfast']}),place('low',4.4,{types:['guest_house']}),place('hotel',5,{types:['hotel']}),place('unknown',5,{types:['lodging']})]:[];
 const d=await recommendations(request,searcher,snapshot);assert.deepEqual(d.lodging.hotels.map(p=>p.id),['three']);assert.deepEqual(d.lodging.homestays.map(p=>p.id),['bnb']);
});
test('餐宿失敗保留官方飯店，錯誤可重試',async()=>{
 const data=await recommendations(request,async()=>{throw Error('timeout');},{hotels:[{id:'a',stars:3,...anchor}],updated:'2026-09-27',source:'https://data.gov.tw/dataset/7780'});
 assert.ok(data.lunch.failed);assert.ok(data.dinner.failed);assert.ok(data.lodging.failed);assert.equal(data.lodging.hotels.length,1);
});
test('餐宿 API 有來源、輸入、限流保護，評分只查餐宿並且不外洩金鑰',async()=>{
 const calls=[];const api=createWorker(async(url,opts)=>{calls.push(opts);return Response.json({places:[place('a')]});});
 const req=body=>new Request('https://api.example/api/recommendations',{method:'POST',headers:{Origin:'https://example.github.io','Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await api.fetch(req({...request,date:'2026-02-30'}),env)).status,400);assert.equal(calls.length,0);
 assert.equal((await api.fetch(req(request),{...env,RATE_LIMITER:{limit:async()=>({success:false})}})).status,429);
 const r=await api.fetch(req(request),env);assert.equal(r.status,200);const text=await r.text();assert.ok(!text.includes(env.GOOGLE_PLACES_API_KEY));assert.equal(calls.length,3);
 assert.ok(calls.every(o=>o.headers['X-Goog-FieldMask'].includes('places.rating')));assert.equal(JSON.parse(calls[0].body).minRating,4.5);assert.ok(!text.includes('photoReference'));
 for(const patch of [{overnight:'yes'},{lunch:{...anchor,lat:0}},{dinner:{...anchor,start:1440,end:1500}}])assert.throws(()=>validateRecommendations({...request,...patch}));
});
test('餐廳中心沿午餐前一站與當日末站，末日不推薦住宿',()=>{
 const plan=buildPlan({...input,days:1},{city:'測試',places:[{id:'a',name:'A',lat:24.1,lng:120.6,tags:['nature'],open:540,close:1200,fee:null},{id:'b',name:'B',lat:24.11,lng:120.6,tags:['nature'],open:540,close:1200,fee:null}]});
 const q=recommendationInput(plan,0,'sun');assert.equal(q.overnight,false);assert.equal(q.dinner.name,'B');assert.equal(q.dinner.start,1080);assert.equal(q.dinner.end,1140);
 assert.equal(recommendationInput({days:[{date:input.date,routes:{sun:{items:[]}}}]},0,'sun'),null);
});
