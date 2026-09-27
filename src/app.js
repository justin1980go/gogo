import {labels,strategies,maps,validate} from './input.js';
import {recommendationInput} from './dining.js';
const $=s=>document.querySelector(s),form=$('#planner'),output=$('#output'),status=$('#status');
const config=window.TRAVEL_CONFIG||{};
let plan=null,active='sun',activeDay=0,revision=0,controller=null;
const recommendationCache=new Map(),recommendationControllers=new Set();
let recommendationView=0;
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'#';}catch{return '#';}};
const link=(title,url)=>`<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${escape(title)} ↗</a>`;
function message(text,error=false){status.innerHTML=text?`<div class="notice ${error?'error':''}">${escape(text)}</div>`:'';}
function empty(title,text){output.innerHTML=`<div class="empty"><p class="eyebrow">TAIWAN / LIVE SEARCH</p><h2>${escape(title)}</h2><p>${escape(text)}</p><a href="./services.html">查看線上查詢設定步驟 ↗</a></div>`;}
function endpoint(){
  if(location.protocol==='file:')throw Error('全台即時查詢需要連線服務。請完成設定後使用正式網站或啟動旅遊規劃室.cmd；直接雙擊檔案可查看介面，但無法查詢。');
  if(!config.apiBase)throw Error('線上查詢尚未設定。請完成 Google Places 與 Cloudflare Worker 設定，再將 Worker 網址填入 config.js。');
  const u=new URL(config.apiBase);
  if(u.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(u.hostname))throw Error('查詢服務網址必須使用 HTTPS。');
  if(u.username||u.password||u.search||u.hash)throw Error('服務網址不可包含帳密、金鑰或查詢參數。');
  return u.href.replace(/\/$/,'');
}
function resetRecommendations(){recommendationView++;recommendationCache.clear();for(const c of recommendationControllers)c.abort();recommendationControllers.clear();}
function invalidate(){revision++;controller?.abort();controller=null;resetRecommendations();$('#generate').disabled=false;plan=null;message('');empty('準備好就出發','按「查詢並規劃」，尋找這個地點周邊的景點與室內雨備。');}
form.addEventListener('input',invalidate);form.addEventListener('change',invalidate);
$('#date').value=new Date(Date.now()+86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});
$('#mode').textContent=config.apiBase?'全台線上查詢':'線上服務尚未設定';
document.querySelectorAll('[data-city]').forEach(b=>b.onclick=()=>{$('#destination').value=b.dataset.city;invalidate();});
async function generate(){
  if(!form.reportValidity())return;
  controller?.abort();const abort=new AbortController();controller=abort;const current=++revision;
  resetRecommendations();
  plan=null;$('#generate').disabled=true;message('正在查詢地點、景點及室內雨備…');empty('正在尋找這趟旅行的路線','第一次查詢可能需要一些時間；修改條件會取消本次查詢。');
  const timer=setTimeout(()=>abort.abort('timeout'),55000);
  try{
    const input=validate(Object.fromEntries(new FormData(form)));
    const response=await fetch(endpoint()+'/api/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:abort.signal});
    let data;try{data=await response.json();}catch{throw Error('查詢服務沒有回傳有效資料，請確認 Worker 網址及部署狀態。');}
    if(!response.ok)throw Error(data.error||'地點查詢暫時無法使用，請稍後重試。');
    if(data.version!==3||!data.days?.length||data.sourceMode!=='live'||!data.routes?.sun||!data.input||!data.region)throw Error('查詢服務版本不相符，請更新 Worker 至全台線上版。');
    if(current!==revision)return;plan=data;activeDay=0;active=Object.keys(labels).find(k=>data.routes[k]?.available)||'sun';message('');render();
  }catch(error){if(current!==revision)return;const detail=abort.signal.reason==='timeout'?'查詢逾時，請稍後再試。':error instanceof TypeError?'無法連線到查詢服務，請檢查網路、Worker 網址及允許來源設定。':error.message;empty('這次尚未產生行程','請查看上方提示，調整條件或完成線上服務設定後再試。');message(detail,true);
  }finally{clearTimeout(timer);if(current===revision){$('#generate').disabled=false;controller=null;}}
}
form.onsubmit=e=>{e.preventDefault();generate();};
function photograph(p){
  if(!p.image?.url)return '<p class="photo-note">此景點暫無可顯示的實景照片，可開啟 Google Maps 查看。</p>';
  return `<figure class="place-image"><img class="stop-photo" loading="lazy" src="${safeUrl(p.image.url)}" alt="${escape(p.name)}實景照片"><figcaption><span translate="no">Google Maps</span> · ${(p.image.authors||[]).map(a=>link(a.displayName||'照片作者',a.uri)).join(' · ')||'由地點服務提供'} ${link('查看地點',p.mapUrl||maps(p))}</figcaption></figure>`;
}
function recommendationCard(p){
  const badge=p.stars?`官方飯店星級 ${p.stars} 星`:`Google 旅客評分 ${Number(p.rating).toFixed(1)} / 5`;
  return `<article class="recommendation-card"><h4>${escape(p.name)}</h4><p class="rating">${badge}${p.reviews!=null?` · ${escape(p.reviews)} 則評分`:''}</p><p>距參考景點約 ${escape(p.distanceKm)} 公里（直線距離）</p><p>${escape(p.address)}</p>${p.hoursStatus?`<p>${p.hoursStatus==='open'?'一般營業時段涵蓋參考用餐時間，出發前仍請確認。':'未取得完整用餐時段資訊，請先向店家確認。'}</p><details><summary>查看一般營業時間</summary><p>${escape(p.hours)}</p></details>`:''}<div class="stop-links">${link('Google Maps',p.mapUrl)}${p.website?link('官方網站',p.website):''}${p.source?link('星級資料來源',p.source):''}</div>${p.attributions?.length?`<p>${p.attributions.map(a=>link(a.provider,a.uri)).join(' · ')}</p>`:''}</article>`;
}
async function loadRecommendations(){
  const view=++recommendationView,box=$('#recommendations');
  const input=recommendationInput(plan,activeDay,active);if(!input){box.innerHTML='';return;}
  const key=JSON.stringify(input);
  box.innerHTML='<h3>附近美食與住宿</h3><p role="status">正在尋找符合條件的餐廳與住宿…</p>';
  if(!recommendationCache.has(key)){
    const abort=new AbortController();recommendationControllers.add(abort);
    const timer=setTimeout(()=>abort.abort(),20000);
    const pending=(async()=>{try{
      const response=await fetch(endpoint()+'/api/recommendations',{method:'POST',headers:{'Content-Type':'application/json'},body:key,signal:abort.signal});
      const data=await response.json();if(!response.ok)throw Error(data.error||'餐宿服務未更新，請部署 v0.4 Worker。');
      if(!data.lunch||!data.dinner)throw Error('請更新 Worker 至 v0.4 餐宿推薦版。');return data;
    }catch(e){return {error:abort.signal.aborted?'餐宿查詢逾時或已取消。':e.message||'餐宿查詢暫時失敗。'};}
    finally{clearTimeout(timer);recommendationControllers.delete(abort);}})();
    recommendationCache.set(key,pending);
  }
  const data=await recommendationCache.get(key);if(view!==recommendationView||!box.isConnected)return;
  const section=(title,items,note='')=>`<h4>${escape(title)}</h4><div class="recommendation-grid">${items.map(recommendationCard).join('')}</div>${note?`<p class="form-note">${escape(note)}</p>`:''}`;
  if(data.error)box.innerHTML=`<h3>附近美食與住宿</h3><p>${escape(data.error)} 原行程仍可使用。</p>`;
  else {
    const s=data.lodging;
    box.innerHTML=`<h3>附近美食與住宿</h3><p class="form-note">餐廳與民宿評分來自 <span translate="no">Google Maps</span>，查詢日期 ${escape(data.checked?.slice(0,10))}。餐廳距參考景點 3 公里內；營業、座位與房況請先確認。</p>${section(`午餐 · ${data.lunch.anchor}附近 · ${data.lunch.time}`,data.lunch.items,data.lunch.note)}${section(`晚餐 · ${data.dinner.anchor}附近 · 參考 ${data.dinner.time}`,data.dinner.items,data.dinner.note)}<p class="form-note">晚餐依最後一站推薦，尚未排入行程與預算；若已返家可略過，若續留用餐請延後返程並預留往返餐廳的時間。午餐移動也需另留交通餘裕。</p>${s?`<h3>本晚住宿候選</h3><p>以 ${escape(s.anchor)} 周邊 15 公里內推薦，尚未選定住宿，不會自動更動每日接駁時間。</p>${section('三星以上飯店（官方星級）',s.hotels,s.hotels.length?'':'附近暫無符合條件的官方星級飯店資料。')}<p class="form-note">資料：${link('交通部觀光署',s.source)} · 資料日期 ${escape(s.updated?.slice(0,10))}。星級與營運現況請出發前確認。</p>${section('民宿／家庭旅宿（旅客評分 4.5 分以上）',s.homestays,s.note||(!s.homestays.length?'附近暫無符合評分與類型的民宿候選。':''))}<p class="form-note">未查詢指定日期空房、房價或完成訂房，住宿費另計。飯店星級與旅客評分為不同標準。</p>`:''}`;
  }
  if(data.error||data.lunch?.failed||data.dinner?.failed||data.lodging?.failed){const button=document.createElement('button');button.className='outline';button.textContent='重試餐宿查詢';button.onclick=()=>{recommendationCache.delete(key);loadRecommendations();};box.append(button);}
}
function render(){const day=plan.days[activeDay],r=day.routes[active],o=plan.input;
  output.innerHTML=`<div class="route-cover"><div class="cover-content"><p class="eyebrow">TAIWAN / LIVE SEARCH</p><h2>${escape(plan.region.city)}${o.days===1?'一日遊':o.days+' 日遊'}</h2><p>${escape(day.date)} ${new Date(day.date+'T12:00:00+08:00').toLocaleDateString('zh-TW',{weekday:'long',timeZone:'Asia/Taipei'})} · ${o.people} 人 · ${escape(o.group)}</p><p>${escape(plan.resolvedLocation?.name||'')} ${escape(plan.resolvedLocation?.address||'')}</p></div></div>
  <div class="summary"><div><small>景點安排</small><strong>${r.items.filter(i=>i.place).length} 站</strong></div><div><small>本日結束</small><strong>${escape(r.finish||'尚無路線')}</strong></div><div><small>預留金額・非報價</small><strong>${r.available?'NT$ '+r.total.toLocaleString():'—'}</strong></div></div>
  <div class="notice">本次查詢：${escape(plan.checked)}。地點、營業時間及照片由 <span translate="no">Google Maps</span> 提供；行程順序與時間由本網站估算，不代表已確認出遊當日營業。</div>
  <div class="toolbar"><div class="tabs" aria-label="旅遊日期">${plan.days.map((d,index)=>`<button class="${activeDay===index?'active':''}" data-day="${index}" aria-pressed="${activeDay===index}">第 ${index+1} 天 · ${escape(d.date.slice(5))}</button>`).join('')}</div></div><div class="toolbar"><div class="tabs" role="tablist" aria-label="天氣情境">${Object.entries(labels).map(([k,title])=>`<button role="tab" aria-selected="${active===k}" class="${active===k?'active':''}" data-weather="${k}">${title}</button>`).join('')}</div></div>
  <p class="form-note" style="margin-bottom:20px">${escape(strategies[active])}</p>
  ${r.available?'':`<div class="notice">這個日期或條件下沒有合適的${escape(labels[active])}。請調整日期或地點，不建議在大雨時勉強採用戶外行程。</div>`}
  <div class="timeline">${r.items.map(i=>{const p=i.place;return `<article class="stop ${p?'':'minor'}"><div class="time">${escape(i.start)}<small>至 ${escape(i.end)}</small></div><div class="stop-body"><div class="stop-head"><h3>${escape(i.name)}</h3>${p?`<span class="pill">${p.indoor?'室內候選':'戶外／混合場域'}</span>`:''}</div><p>${escape(i.description)}</p>${p?`<p class="address">${escape(p.address)}</p><p>${escape(p.hours)}</p><div class="stop-links">${link('Google Maps 導航',p.mapUrl||maps(p))}${link('查看資料來源',p.source)}</div>${photograph(p)}${p.attributions?.length?`<p class="photo-note">資料提供者：${p.attributions.map(a=>link(a.provider,a.uri)).join(' · ')}</p>`:''}`:i.search?`<div class="stop-links">${link('尋找周邊餐廳（未訂位）',i.search)}</div>`:''}</div></article>`;}).join('')}</div>
  <div class="notice">${escape(labels[active])}全程預留 NT$ ${plan.totals[active].toLocaleString()}（不含住宿、購物與待查票價）。${plan.totals[active]>o.budget?'已超過全程預算，請調整條件。':''}</div><div class="tips"><h3>出發前，留意這幾件事</h3><ul>${[...new Set([...r.warnings,...plan.notes])].map(n=>`<li>${escape(n)}</li>`).join('')}</ul>${r.available?`<p>餐費預留 ${r.food} 元、交通預留 ${r.transport} 元、已知門票 ${r.known} 元；${r.unknown} 站票價待查。總預算 ${o.budget.toLocaleString()} 元。</p>`:''}<p>搜尋以「${escape(plan.resolvedLocation?.name||o.destination)}」周邊約 15 公里為範圍。若地點不符，請補上縣市或完整名稱重新查詢。</p></div>`;
  output.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{activeDay=Number(b.dataset.day);render();});
  output.querySelectorAll('[data-weather]').forEach(b=>b.onclick=()=>{active=b.dataset.weather;render();});
  output.querySelectorAll('.place-image img').forEach(img=>img.onerror=()=>{img.hidden=true;img.closest('figure').querySelector('figcaption').prepend(document.createTextNode('照片暫時無法載入。 '));});
  const dining=document.createElement('section');dining.id='recommendations';dining.className='recommendations';dining.setAttribute('aria-label','附近美食與住宿');output.querySelector('.tips').before(dining);loadRecommendations();
}
if(document.modelContext?.registerTool){try{document.modelContext.registerTool({name:'read_travel_plan',description:'讀取畫面上的旅遊候選規劃，不建立訂位。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({plan,active})});}catch{}}
empty(config.apiBase?'輸入目的地，開始查詢':'先連接線上地點服務',config.apiBase?'可輸入台灣城市、行政區或景點名稱；按下查詢後才會向服務取得資料。':'這一版使用全台線上查詢，不再使用固定四地資料。請依設定步驟啟用 Google Places 與 Cloudflare Worker。');
