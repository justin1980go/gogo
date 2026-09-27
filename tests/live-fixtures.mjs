// Explicitly synthetic provider responses for tests only, never shipped as user data.
export const input={destination:'台中',origin:'出發地',date:'2026-10-03',start:'09:00',end:'18:00',transfer:30,people:2,budget:3000,transport:'drive',pace:'easy',interest:'nature',group:'成人同行',exclude:''};
export const env={ALLOWED_ORIGINS:'https://example.github.io,http://127.0.0.1:4173',GOOGLE_PLACES_API_KEY:'test-key-not-real',RATE_LIMITER:{limit:async()=>({success:true})}};
export function providerFixture({empty=false,photoFailure=false,upstreamStatus=200,noIndoor=false}={}){
  const calls=[];
  const fetcher=async(url,options={})=>{
    calls.push({url,body:options.body?JSON.parse(options.body):null});
    if(upstreamStatus!==200)return new Response('',{status:upstreamStatus});
    if(url.includes('/media?'))return photoFailure?new Response('',{status:503}):Response.json({photoUri:'https://photos.example.test/fixture.png'});
    const body=JSON.parse(options.body);
    if(empty)return Response.json({places:[]});
    const position=body.locationBias?.circle.center||{latitude:24.15,longitude:120.66};
    const basic=(id,name,types,offset=0)=>({id,displayName:{text:name},formattedAddress:'【模擬測試】台灣測試地址',location:{latitude:position.latitude+offset,longitude:position.longitude},types,addressComponents:[{types:['country'],shortText:'TW'}],businessStatus:'OPERATIONAL',googleMapsUri:'https://maps.google.com/?q='+encodeURIComponent(name),regularOpeningHours:{periods:Array.from({length:7},(_,day)=>({open:{day,hour:9},close:{day,hour:17}})),weekdayDescriptions:['【模擬測試】09:00–17:00']},photos:[{name:`places/${id}/photos/testphoto`,authorAttributions:[{displayName:'測試作者',uri:'https://example.test/author'}]}]});
    if(body.textQuery.startsWith('台灣 '))return Response.json({places:[basic('anchor',body.textQuery.slice(3),body.textQuery.includes('日月潭')?['tourist_attraction']:['locality'])]});
    if(body.textQuery.includes('室內'))return Response.json({places:noIndoor?[]:[basic('museum','【模擬測試】室內展館',['museum'],.005)]});
    return Response.json({places:[basic('park','【模擬測試】河畔公園',['park'],.001),basic('museum','【模擬測試】室內展館',['museum'],.005),basic('distant','【模擬測試】過遠景點',['park'],2)]});
  };
  return {fetcher,calls};
}
