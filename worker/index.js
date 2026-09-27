import {buildPlan,validate,distance} from '../src/engine.js';

const fields=['id','displayName','formattedAddress','location','types','googleMapsUri','websiteUri','regularOpeningHours','businessStatus','addressComponents','attributions','photos'].map(s=>'places.'+s).join(',');
const allowed=(env,origin)=>Boolean(origin)&&origin!=='null'&&(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean).includes(origin);
const isTaiwan=p=>p.addressComponents?.some(a=>a.types.includes('country')&&a.shortText==='TW');
const isAttraction=p=>p.types?.some(t=>['tourist_attraction','museum','art_gallery','park','historical_landmark','library','national_park','botanical_garden','shopping_mall','department_store','zoo','aquarium','amusement_park'].includes(t));
const checkedDate=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});

export async function searchPlaces(query,env,fetcher=fetch,center){
  const body={textQuery:query,languageCode:'zh-TW',regionCode:'TW',pageSize:20};
  if(center)body.locationBias={circle:{center:{latitude:center.lat,longitude:center.lng},radius:15000}};
  const response=await fetcher('https://places.googleapis.com/v1/places:searchText',{
    method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':env.GOOGLE_PLACES_API_KEY,'X-Goog-FieldMask':fields},
    body:JSON.stringify(body),signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw Error(response.status===429?'地點服務配額暫時用盡，請稍後再試。':'地點資料服務回應失敗，請確認 API 啟用、金鑰及配額。');
  const result=await response.json();
  return (result.places||[]).filter(p=>isTaiwan(p)&&Number.isFinite(p.location?.latitude)&&Number.isFinite(p.location?.longitude)&&!['CLOSED_PERMANENTLY','CLOSED_TEMPORARILY'].includes(p.businessStatus));
}

export function convertPlace(p,day){
  const types=p.types||[],indoor=types.some(t=>['museum','art_gallery','library','department_store','aquarium'].includes(t));
  const category=types.some(t=>['shopping_mall','department_store'].includes(t))?'shopping':types.some(t=>['zoo','aquarium','amusement_park'].includes(t))?'family':types.some(t=>['park','national_park','botanical_garden'].includes(t))?'nature':'culture';
  const periods=p.regularOpeningHours?.periods,entries=periods?.filter(x=>x.open?.day===day);
  let open=540,close=1020,closed=[];
  if(periods?.length){
    if(periods.some(x=>x.open?.day===0&&!x.close)){open=0;close=1440;}
    else if(!entries.length)closed=[day];
    else{
      // Select one complete interval, never join across a lunch closure.
      const duration=x=>(x.close.hour*60+(x.close.minute||0))-(x.open.hour*60+(x.open.minute||0));
      const usable=entries.filter(x=>x.close?.day===day).sort((a,b)=>duration(b)-duration(a));
      if(usable.length){open=usable[0].open.hour*60+(usable[0].open.minute||0);close=usable[0].close.hour*60+(usable[0].close.minute||0);}
      else closed=[day];
    }
  }
  return {
    id:'g-'+p.id,name:p.displayName?.text||'未命名地點',address:p.formattedAddress||'地址待確認',
    lat:p.location.latitude,lng:p.location.longitude,indoor,category,tags:[category],
    mapUrl:p.googleMapsUri,source:p.websiteUri||p.googleMapsUri||'https://maps.google.com/',
    description:indoor?'地點資料分類為室內場館候選；實際展區與出遊當日開放情形仍須確認。':'依查詢選出的戶外或混合場域候選，請確認步道路況與可參觀範圍。',
    open,close,closed,fee:null,hours:p.regularOpeningHours?.weekdayDescriptions?.join('；')||'未取得營業時間；暫以白天時段估排，請向場館確認。',
    attributions:p.attributions||[],photoReference:p.photos?.[0],checked:checkedDate()
  };
}

export async function liveRegion(input,env,fetcher=fetch){
  const anchors=await searchPlaces(`台灣 ${input.destination}`,env,fetcher);
  if(!anchors.length)throw Error('找不到台灣境內的對應地點，請補上縣市或完整景點名稱。');
  const anchor=anchors[0],center={lat:anchor.location.latitude,lng:anchor.location.longitude};
  const nearby=await Promise.all([
    searchPlaces(input.interest==='nature'?'觀光景點 公園 自然景觀':'觀光景點',env,fetcher,center),
    searchPlaces('博物館 美術館 室內參觀',env,fetcher,center),
    searchPlaces('大型購物中心 百貨公司',env,fetcher,center),
    searchPlaces(input.interest==='family'?'親子景點 動物園 水族館':'公園 歷史街區 文化景點',env,fetcher,center)
  ]);
  const day=new Date(input.date+'T12:00:00+08:00').getUTCDay();
  const rawPlaces=[...new Map([anchor,...nearby.flat()].map(p=>[p.id,p])).values()]
    .filter(isAttraction);
  const forDay=day=>rawPlaces.map(p=>convertPlace(p,day)).filter(p=>distance(center,p)<15)
    .sort((a,b)=>distance(center,a)-distance(center,b));
  const places=forDay(day),dayPlaces=Array.from({length:7},(_,d)=>forDay(d));
  if(!places.length)throw Error('附近暫時沒有足夠可辨識的景點，請改用較明確的行政區或景點名稱。');
  return {city:input.destination,subtitle:'依本次線上地點資料安排的候選路線',live:true,checked:checkedDate(),places,dayPlaces,
    requestedId:isAttraction(anchor)?'g-'+anchor.id:null,
    resolvedLocation:{name:anchor.displayName?.text||input.destination,address:anchor.formattedAddress||'',mapUrl:anchor.googleMapsUri}
  };
}

async function attachPhotos(plan,env,fetcher){
  const routes=plan.days.flatMap(d=>Object.values(d.routes));
  const places=[...new Map(routes.flatMap(r=>r.items.filter(i=>i.place).map(i=>[i.place.id,i.place]))).values()];
  await Promise.all(places.slice(0,12).map(async p=>{
    const ref=p.photoReference;
    if(!ref?.name||!/^places\/[^/?#]+\/photos\/[^/?#]+$/.test(ref.name))return;
    try{
      const response=await fetcher(`https://places.googleapis.com/v1/${ref.name}/media?maxWidthPx=900&skipHttpRedirect=true`,{
        headers:{'X-Goog-Api-Key':env.GOOGLE_PLACES_API_KEY},signal:AbortSignal.timeout(8000)
      });
      if(!response.ok)return;const data=await response.json();
      if(new URL(data.photoUri).protocol!=='https:')return;
      p.image={url:data.photoUri,authors:(ref.authorAttributions||[]).map(a=>({displayName:a.displayName,uri:a.uri,photoUri:a.photoUri}))};
    }catch{ /* A missing photo must not discard a usable route. */ }
  }));
  // Do not store or expose photo resource names; image URLs remain session-only.
  const images=new Map(places.filter(p=>p.image).map(p=>[p.id,p.image]));
  for(const route of routes)for(const item of route.items)if(item.place){if(images.has(item.place.id))item.place.image=images.get(item.place.id);delete item.place.photoReference;}
}

export function createWorker(fetcher=fetch){return {async fetch(request,env){
  const origin=request.headers.get('Origin')||'',url=new URL(request.url);
  const cors=allowed(env,origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
  const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors}});
  if(url.pathname==='/health')return json({ok:true,version:'0.3.0',mode:'live-only',liveConfigured:!!env.GOOGLE_PLACES_API_KEY,rateLimitConfigured:!!env.RATE_LIMITER});
  if(!allowed(env,origin))return json({error:'此網站尚未列入允許來源。'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}});
  if(url.pathname!=='/api/plan')return json({error:'找不到此端點。'},404);
  if(request.method!=='POST')return json({error:'請使用 POST。'},405);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'請傳送 JSON 格式。'},415);
  try{
    if(Number(request.headers.get('Content-Length')||0)>8192)return json({error:'輸入資料過大。'},413);
    const reader=request.body?.getReader();let size=0,parts=[];
    if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return json({error:'輸入資料過大。'},413);}parts.push(value);}
    let input;try{const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}input=validate(JSON.parse(new TextDecoder().decode(bytes)));}
    catch(e){return json({error:e instanceof SyntaxError?'JSON 格式錯誤。':e.message},400);}
    if(!env.GOOGLE_PLACES_API_KEY)return json({error:'線上地點查詢尚未設定。請在 Cloudflare 設定 GOOGLE_PLACES_API_KEY。'},503);
    if(!env.RATE_LIMITER)return json({error:'線上查詢的流量限制尚未設定。'},503);
    if(!(await env.RATE_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'})).success)return json({error:'查詢過於頻繁，請稍後再試。'},429);
    const region=await liveRegion(input,env,fetcher);
    let plan;try{plan=buildPlan(input,region);}catch(e){return json({error:e.message},422);}
    plan.resolvedLocation=region.resolvedLocation;
    plan.notes.push('地點搜尋採周邊約 15 公里範圍；同名地點請核對搜尋位置。','站間時間依直線距離估算；未確認實際道路、跨水域交通或船班。');
    await attachPhotos(plan,env,fetcher);
    return json(plan);
  }catch(e){return json({error:e.name==='TimeoutError'?'地點查詢逾時，請稍後再試。':e.message||'規劃服務暫時不可用。'},502);}
}};}
export default createWorker();
