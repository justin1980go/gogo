import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createWorker} from '../worker/index.js';
import {env,providerFixture} from '../tests/live-fixtures.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/leon1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
await mkdir('test-output/online',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173');
  await page.getByRole('heading',{name:'先連接線上地點服務'}).waitFor();
  if(await page.locator('[data-export],input[type=file]').count())throw Error('Old download/upload controls remain');
  await page.locator('#generate').click();await page.getByText('線上查詢尚未設定。請完成 Google Places 與 Cloudflare Worker 設定，再將 Worker 網址填入 config.js。',{exact:true}).waitFor();
  await page.screenshot({path:'test-output/online/setup.png',fullPage:true});
  await page.route('**/config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.TRAVEL_CONFIG={apiBase:"https://api.example.test"};'}));
  const requests=[];
  await page.route('https://api.example.test/api/plan',async route=>{
    const request=route.request();
    if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:4173','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS'}});return;}
    const data=JSON.parse(request.postData());requests.push(data.destination);
    const api=createWorker(providerFixture({empty:data.destination==='查無結果'}).fetcher);
    const response=await api.fetch(new Request('https://api.example.test/api/plan',{method:'POST',headers:{Origin:'http://127.0.0.1:4173','Content-Type':'application/json'},body:request.postData()}),env);
    await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  });
  await page.route('https://photos.example.test/**',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1cAAAAASUVORK5CYII=','base64')}));
  await page.reload();await page.getByRole('heading',{name:'輸入目的地，開始查詢'}).waitFor();
  if(requests.length)throw Error('A paid request was made on load');
  for(const destination of ['台中','花蓮','日月潭']){
    await page.locator('[name=destination]').fill(destination);
    await page.locator('[name=date]').fill('2026-10-03');
    await page.locator('[name=transport]').selectOption('drive');
    await page.locator('#generate').click();
    await page.getByRole('heading',{name:destination+'一日遊',exact:true}).waitFor();
  }
  if(requests.join(',')!=='台中,花蓮,日月潭')throw Error('Some cities bypassed live API');
  if(!await page.locator('.place-image figcaption').first().innerText().then(t=>t.includes('測試作者')))throw Error('Attribution missing');
  await page.screenshot({path:'test-output/online/mock-result.png',fullPage:true});
  await page.locator('[data-weather=heavy]').click();
  if(await page.locator('.stop .pill').allTextContents().then(a=>a.some(s=>s!=='室內候選')))throw Error('Outdoor rainy route');
  if(requests.length!==3)throw Error('Switching weather made a paid request');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-output/online/mobile.png',fullPage:true});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
  await page.locator('[name=destination]').fill('查無結果');
  if(await page.locator('.route-cover').count())throw Error('Stale result after input');
  await page.locator('#generate').click();await page.getByText('找不到台灣境內的對應地點，請補上縣市或完整景點名稱。',{exact:true}).waitFor();
  if(await page.locator('.route-cover').count())throw Error('Stale result after error');
  await page.goto(pathToFileURL(resolve('web-dist/index.html')).href);
  await page.locator('#generate').click();await page.getByText(/全台即時查詢需要連線服務/).waitFor();
  await page.goto('http://127.0.0.1:4173/services.html');await page.getByRole('heading',{name:'啟用全台線上查詢'}).waitFor();
  if(errors.length)throw Error(errors.join('\n'));
  await writeFile('test-output/online/browser-result.json',JSON.stringify({passed:true,provider:'synthetic fixtures; no real Google key used',requests,checks:['no-downloads','missing-config','no-fetch-on-load','all-cities-live','photo-attribution','weather-switch','mobile','no-results','no-stale-content','file-url-guidance','setup-page'],errors},null,2));
  console.log('Web-only browser QA passed (provider mocked; live credentials still required).');
}finally{await browser.close();}
