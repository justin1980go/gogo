import {findRegion} from './catalog.js';
import {labels,strategies,maps,validate,hm} from './input.js';
export {labels,strategies,maps,validate,hm} from './input.js';
export function distance(a,b){const rad=x=>x*Math.PI/180;const dlat=rad(a.lat-b.lat),dlng=rad(a.lng-b.lng);return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlng/2)**2)));}
function travel(a,b,o){if(!a||!b)return 0;const km=distance(a,b);const raw=o.transport==='drive'?km/20*60+20:km/12*60+25;return Math.ceil(raw/5)*5;}
function route(region,o,kind,used=new Set()){const day=new Date(o.date+'T12:00:00+08:00').getUTCDay(),excluded=o.exclude.split(/[,，、]/).map(x=>x.trim().replaceAll('臺','台')).filter(Boolean);const warnings=[];let candidates=region.places.filter(p=>!used.has(p.id)&&!excluded.some(x=>p.name.replaceAll('臺','台').includes(x))&&(!p.closed?.includes(day))&&(kind==='sun'||p.indoor));const requested=region.places.find(p=>p.id===region.requestedId)||region.places.find(p=>p.name.replaceAll('臺','台')===o.destination.replaceAll('臺','台'));if(requested&&!used.has(requested.id)&&!candidates.includes(requested))warnings.push(`${requested.name} 因排除條件、參考休館日或雨備策略未安排。`);
const closed=region.places.filter(p=>p.closed?.includes(day));if(closed.length)warnings.push(`依一般休館規則略過：${closed.map(p=>p.name).join('、')}。國定假日例外尚未核對。`);
candidates.sort((a,b)=>((b.id===requested?.id?100:0)+(b.tags.includes(o.interest)?10:0))-((a.id===requested?.id?100:0)+(a.tags.includes(o.interest)?10:0)));
if(!candidates.length)return {kind,items:[],warnings:[...warnings,'目前沒有符合日期與條件且未安排過的候選景點，請縮短天數、換地點或調整條件。'],available:false};
const items=[];let t=o.startMin,previous=null;const add=(type,name,duration,extra={})=>{items.push({type,name,start:hm(t),end:hm(t+duration),minutes:duration,...extra});t+=duration;};
const outbound=o.dayIndex>0?30:o.transfer,inbound=o.dayIndex<o.days-1?30:o.transfer;
add('travel',o.dayIndex>0?'住宿區 → 首站（住宿待確認）':`${o.origin} → ${region.city}`,outbound,{description:o.dayIndex>0?'住宿接駁暫留 30 分鐘；住宿位置待確認。':'依你填寫的單程時間預留；未取得即時路況或班次。'});
const reserve=inbound+20;let count=0,lunch=false;
const target=o.pace==='easy'||o.group==='長輩同行'?4:5;
const category=p=>p.category||p.tags[0];
while(candidates.length&&count<target){
 const seen=items.filter(i=>i.place).map(i=>category(i.place));
 const score=p=>(count===0&&p.id===requested?.id?1000:0)+(p.tags.includes(o.interest)?25:0)+(seen.includes(category(p))?0:30)-(previous?travel(previous,p,o)*0.5:0);
 candidates.sort((a,b)=>score(b)-score(a));const p=candidates.shift();const leg=travel(previous,p,o);const duration=p.category==='shopping'?120:o.pace==='easy'||o.group!=='成人同行'?80:60;const meal=!lunch&&t+leg+duration>720?60:0;const begin=Math.max(t+leg+meal,p.open??540);if(begin+duration+reserve+(lunch||meal?0:60)>o.endMin||begin+duration>(p.close??1020))continue;
if(meal){add('meal','午餐與休息',60,{description:`${previous?.name||p.name}周邊找合適餐廳；尚未選店、未訂位，預留每人 300 元。`,address:previous?.address||p.address,search:maps({name:(previous?.name||p.name)+' 附近餐廳',address:previous?.address||p.address})});lunch=true;}
if(leg)add('travel',o.transport==='drive'?'移動與停車緩衝':'移動與候車緩衝',leg,{description:'依直線距離推估並加緩衝，不是導航車程；出發前請確認實際路線。'});
if(t<(p.open??540))add('rest','開館前彈性休息',(p.open??540)-t,{description:'請先確認當日開館時間。'});
add('place',p.name,duration,{place:p,description:p.description});previous=p;count++;
}
if(!count)return {kind,items:[],warnings:[...warnings,'扣除往返交通、用餐與開館時間後，行程放不下；請提早出門或延後返家。'],available:false};
if(!lunch)add('meal','午餐與休息',60,{description:`${previous.name}周邊餐廳候選，尚未選店、未訂位，預留每人 300 元。`,address:previous.address,search:maps({name:previous.name+' 附近餐廳',address:previous.address})});
add('rest','離場與返程緩衝',20,{description:'整理隨身物品，確認返程路況與班次。'});add('travel',o.dayIndex<o.days-1?'返回住宿區（住宿待確認）':`返回 ${o.origin}`,inbound,{description:o.dayIndex<o.days-1?'住宿接駁暫留 30 分鐘；住宿位置待確認。':'依你填寫的單程時間預留。'});
if(count<target)warnings.push(`本日安排 ${count} 站；受候選數量、營業時間與交通限制，未填滿 ${target} 站上限。`);
if(count<2)warnings.push('目前僅有一個適合的景點，採半日慢遊並提早返家，不重複塞入同一景點。');
const known=items.filter(i=>i.place).reduce((n,i)=>n+(i.place.fee??0)*o.people,0);const unknown=items.filter(i=>i.place&&i.place.fee===null).length;const food=o.people*300;const transport=o.transport==='drive'?600:o.people*200;const total=known+food+transport;
warnings.push('交通費與餐費是預留額度；未確認票價不當成免費。停車費、特展、購物及跨縣市車資可能另計。');if(total>o.budget)warnings.push(`目前預留金額 ${total.toLocaleString()} 元已超過總預算 ${o.budget.toLocaleString()} 元。`);
return {kind,items,warnings,available:true,finish:hm(t),known,food,transport,total,unknown};}
export function buildPlan(raw,regionOverride){
 const o=validate(raw),region=regionOverride||findRegion(o.destination);
 if(!region)throw Error('此地點需啟用線上查詢服務。');
 const used={sun:new Set(),light:new Set(),heavy:new Set()},days=[];
 for(let index=0;index<o.days;index++){
  const date=new Date(Date.parse(o.date+'T12:00:00Z')+index*86400000).toISOString().slice(0,10);
  const dayRegion={...region,places:region.dayPlaces?.[new Date(date+'T12:00:00Z').getUTCDay()]||region.places};
  const routes=Object.fromEntries(['sun','light','heavy'].map(kind=>{
   const r=route(dayRegion,{...o,date,dayIndex:index},kind,used[kind]);
   r.items.filter(i=>i.place).forEach(i=>used[kind].add(i.place.id));return [kind,r];
  }));days.push({date,routes});
 }
 if(!days.some(d=>Object.values(d.routes).some(r=>r.available)))throw Error(days[0].routes.sun.warnings.join(' '));
 const totals=Object.fromEntries(['sun','light','heavy'].map(k=>[k,days.reduce((n,d)=>n+(d.routes[k].total||0),0)]));
 return {version:3,input:o,days,totals,region:{city:region.city,subtitle:region.subtitle,cover:region.cover},routes:days[0].routes,sourceMode:region.live?'live':'catalog',checked:region.checked||'2026-09-26',generated:new Date().toISOString(),notes:['此版本為候選行程，未完成訂位。','未串接天氣預報；晴雨頁籤為手動情境切換。同一天氣路線跨日不重複，混用晴雨路線時請留意重複景點。',...(o.days>1?['多日以同一旅遊區住宿為前提；每日住宿接駁暫留 30 分鐘，住宿地點、費用、早餐與晚餐另行安排。候選不足的日期不強行補滿。']:[]),'出發前確認場館公告、票價、交通班次、停車及餐廳；日期為台灣時間。']};
}
