import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPlan,validate} from '../src/engine.js';
import {convertPlace,createWorker} from '../worker/index.js';
import {input,env,providerFixture} from './live-fixtures.mjs';
const places=Array.from({length:24},(_,i)=>({id:String(i),name:`測試景點 ${i}`,address:'測試地址',lat:24.15+i*.0001,lng:120.66,category:['nature','culture','family','shopping'][i%4],tags:[['nature','culture','family','shopping'][i%4]],indoor:i%2===1,open:540,close:1200,fee:null}));
const region={city:'測試',places,live:true};
test('充足候選下每天超過兩站、多種類、跨日不重複並且不超時',()=>{
 const plan=buildPlan({...input,days:3,pace:'normal'},region);
 assert.equal(plan.days.length,3);assert.equal(plan.days[2].date,'2026-10-05');
 for(const kind of ['sun','light','heavy']){
  const ids=[];let total=0;
  for(const day of plan.days){const r=day.routes[kind];assert.ok(r.available);assert.ok(r.finish<=input.end);let last=input.start;
   for(const i of r.items){assert.ok(i.start>=last);assert.ok(i.end>=i.start);last=i.end;if(i.place){ids.push(i.place.id);assert.ok(i.start>='09:00');if(kind!=='sun')assert.ok(i.place.indoor);}}
   total+=r.total;
  }
  assert.equal(ids.length,new Set(ids).size);assert.equal(plan.totals[kind],total);
 }
 const stops=plan.days[0].routes.sun.items.filter(i=>i.place);assert.ok(stops.length>2);assert.ok(new Set(stops.map(i=>i.place.category)).size>=3);
 assert.match(plan.days[0].routes.sun.items.at(-1).name,/住宿/);
 assert.match(plan.days[2].routes.sun.items.at(-1).name,/返回 出發地/);
});
test('購物偏好、每日日曆休館、候選耗盡與日期跨年',()=>{
 const shopping=buildPlan({...input,interest:'shopping'},region).routes.sun.items.find(i=>i.place);
 assert.equal(shopping.place.category,'shopping');assert.equal(shopping.minutes,120);
 const p=buildPlan({...input,date:'2026-12-31',days:3},{...region,places:[places[0]],dayPlaces:Array.from({length:7},(_,d)=>[{...places[0],closed:d===5?[5]:[]}])});
 assert.equal(p.days[1].date,'2027-01-01');assert.equal(p.days[1].routes.sun.available,false);assert.equal(p.days[2].routes.sun.available,false);
 for(const days of [0,6,1.5,'oops'])assert.throws(()=>validate({...input,days}));
});
test('商場可辨識，混合開放式商場不直接視為室內雨備',()=>{
 const p={id:'mall',types:['shopping_mall'],location:{latitude:24,longitude:121}};
 assert.equal(convertPlace(p,1).category,'shopping');assert.equal(convertPlace(p,1).indoor,false);
 assert.equal(convertPlace({...p,types:['department_store']},1).indoor,true);
});
test('多日服務只查詢一次候選池、各日營業規則生效、照片引用不外洩',async()=>{
 const mock=providerFixture();
 const req=new Request('https://api.example/api/plan',{method:'POST',headers:{Origin:env.ALLOWED_ORIGINS.split(',')[0],'Content-Type':'application/json'},body:JSON.stringify({...input,days:5,interest:'shopping'})});
 const res=await createWorker(mock.fetcher).fetch(req,env);assert.equal(res.status,200);
 const body=await res.text(),p=JSON.parse(body);assert.equal(p.days.length,5);assert.equal(p.version,3);assert.ok(!body.includes('photoReference'));assert.equal(mock.calls.filter(c=>c.body).length,5);
 assert.ok(mock.calls.some(c=>c.body?.textQuery.includes('購物中心')));
});
