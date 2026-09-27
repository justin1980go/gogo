import {distance,maps,hm} from '../src/engine.js';
import {hotelStars} from './hotel-stars.js';

export function validateRecommendations(raw){
  if(!raw||typeof raw.overnight!=='boolean'||!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)||!Number.isFinite(Date.parse(raw.date+'T12:00:00Z'))||new Date(raw.date+'T12:00:00Z').toISOString().slice(0,10)!==raw.date)throw Error('餐宿查詢日期或住宿條件不正確。');
  const result={date:raw.date,overnight:raw.overnight};
  for(const key of ['lunch','dinner']){
    const p=raw[key];
    if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||p.lat<21||p.lat>27||p.lng<118||p.lng>123||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||!Number.isInteger(p.start)||!Number.isInteger(p.end)||p.start<0||p.end>1440||p.end<=p.start)throw Error('餐宿查詢的景點位置或用餐時段不正確。');
    result[key]={lat:p.lat,lng:p.lng,name:p.name,start:p.start,end:p.end};
  }
  return result;
}

// Compare the complete meal interval against weekly opening periods, including
// overnight periods and week boundaries. Unknown hours remain explicitly unknown.
export function mealHours(p,date,start,end){
  const periods=p.regularOpeningHours?.periods;
  if(!Array.isArray(periods)||!periods.length)return 'unknown';
  if(periods.some(x=>x.open?.day===0&&x.open?.hour===0&&!x.close))return 'open';
  const point=x=>x&&Number.isInteger(x.day)&&x.day>=0&&x.day<=6&&Number.isInteger(x.hour)&&x.hour>=0&&x.hour<=23&&Number.isInteger(x.minute??0)&&(x.minute??0)>=0&&(x.minute??0)<=59?x.day*1440+x.hour*60+(x.minute||0):null;
  const day=new Date(date+'T12:00:00Z').getUTCDay(),from=day*1440+start,to=day*1440+end;
  let complete=true;
  for(const period of periods){let a=point(period.open),b=point(period.close);if(a===null||b===null){complete=false;continue;}if(b<=a)b+=10080;
    for(const shift of [-10080,0,10080])if(from>=a+shift&&to<=b+shift)return 'open';
  }
  return complete?'closed':'unknown';
}
const types=p=>Array.isArray(p.types)?p.types:[];
const restaurant=p=>types(p).some(t=>t==='restaurant'||t.endsWith('_restaurant'));
const homestay=p=>types(p).some(t=>['bed_and_breakfast','guest_house','private_guest_room'].includes(t))||(types(p).includes('lodging')&&!types(p).some(t=>['hotel','motel','resort_hotel'].includes(t))&&p.displayName?.text?.includes('民宿'));
const position=p=>({lat:p.location.latitude,lng:p.location.longitude});
function card(p,center,hoursStatus){return {id:p.id,name:p.displayName?.text||'未命名店家',address:p.formattedAddress||'地址待確認',rating:p.rating,reviews:Number.isInteger(p.userRatingCount)?p.userRatingCount:null,distanceKm:Math.round(distance(center,position(p))*10)/10,mapUrl:p.googleMapsUri||maps({name:p.displayName?.text,address:p.formattedAddress}),website:p.websiteUri,hours:p.regularOpeningHours?.weekdayDescriptions?.join('；')||'營業時間待確認',hoursStatus,attributions:p.attributions||[]};}
function rated(results,center,radius,predicate){return [...new Map(results.filter(p=>Number.isFinite(p.rating)&&p.rating>=4.5&&p.rating<=5&&predicate(p)&&distance(center,position(p))<=radius).map(p=>[p.id,p])).values()].sort((a,b)=>distance(center,position(a))-distance(center,position(b))||b.rating-a.rating);}

export async function recommendations(input,searcher,snapshot=hotelStars){
  const meal=async(key)=>{const center=input[key];try{
    const results=await searcher('餐廳 美食',center,{radius:3000,rated:true,minRating:4.5,includedType:'restaurant'});
    const items=rated(results,center,3,restaurant).filter(p=>mealHours(p,input.date,center.start,center.end)!=='closed').slice(0,2).map(p=>card(p,center,mealHours(p,input.date,center.start,center.end)));
    return {anchor:center.name,time:`${hm(center.start)}–${hm(center.end)}`,items,note:items.length<2?'附近 3 公里內符合評分與參考營業時段的候選不足兩家；不降低評分門檻。':''};
  }catch{return {anchor:center.name,time:`${hm(center.start)}–${hm(center.end)}`,items:[],note:'餐廳查詢暫時失敗，行程仍可使用。請稍後重試。',failed:true};}};
  const stay=async()=>{if(!input.overnight)return null;const center=input.dinner;
    const hotels=snapshot.hotels.filter(p=>[3,4,5].includes(p.stars)&&distance(center,p)<=15).sort((a,b)=>distance(center,a)-distance(center,b)).slice(0,2).map(p=>({...p,distanceKm:Math.round(distance(center,p)*10)/10,mapUrl:maps(p),source:snapshot.source}));
    try{const results=await searcher('民宿',center,{radius:15000,rated:true});return {anchor:center.name,hotels,homestays:rated(results,center,15,homestay).slice(0,2).map(p=>card(p,center)),source:snapshot.source,updated:snapshot.updated};}
    catch{return {anchor:center.name,hotels,homestays:[],source:snapshot.source,updated:snapshot.updated,failed:true,note:'民宿評分查詢暫時失敗，仍可查看官方星級飯店。'};}
  };
  const [lunch,dinner,lodging]=await Promise.all([meal('lunch'),meal('dinner'),stay()]);
  return {lunch,dinner,lodging,checked:new Date().toISOString()};
}
