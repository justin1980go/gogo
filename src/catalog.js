const p=(id,name,address,lat,lng,indoor,tags,source,extra={})=>({id,name,address,lat,lng,indoor,tags,source,description:indoor?'以室內展覽為主，保留休息與看展時間。':'以街區與建築散步為主，依體力調整停留時間。',hours:'請於出發前查閱官方當日公告',open:540,close:1020,closed:[],fee:null,checked:'2026-09-26',...extra});
export const catalog=[
{city:'台北',aliases:['臺北','台北市','臺北市','中正紀念堂','國立中正紀念堂','二二八和平公園','國立臺灣博物館','國立臺灣博物館南門館'],subtitle:'城中散步・建築與博物館',cover:'taipei-cksm.jpg',places:[
p('cksm','中正紀念堂','臺北市中正區中山南路21號',25.0346,121.5219,false,['culture'],'https://www.cksmh.gov.tw/',{photo:'taipei-cksm.jpg',description:'從紀念堂廣場與園區開始，留意建築尺度與城市綠地；室內展覽依當日公告。',close:1080,hours:'紀念堂參考 09:00–18:00；園區與展覽另依公告',fee:0}),
p('ntm','國立臺灣博物館','臺北市中正區襄陽路2號',25.0427,121.515, true,['culture','family'],'https://www.ntm.gov.tw/Default.aspx?Create=1',{closed:[1],open:570,hours:'參考週二至週日 09:30–17:00；假日例外請確認'}),
p('peace','二二八和平公園','臺北市中正區懷寧街103號',25.041,121.515,false,['nature','family'],'https://travel.taipei/zh-tw/attraction/nearby-attractions/31?page=1',{fee:0,description:'在市中心的樹蔭步道慢走，安排短距離散步與休息。'}),
p('nanmen','國立臺灣博物館南門館','臺北市中正區南昌路一段1號',25.0323,121.5152,true,['culture'],'https://www.ntm.gov.tw/News_Content_Due.aspx?n=5652&s=146821',{closed:[1],open:570,hours:'展館參考 09:30–17:00；週一休館，假日例外請確認'})]},
{city:'宜蘭',aliases:['宜蘭縣','頭城','頭城鎮','蘭陽博物館','頭城老街','烏石港'],subtitle:'頭城慢遊・山海與老街',cover:'yilan-lanyang.jpg',places:[
p('lym','蘭陽博物館','宜蘭縣頭城鎮青雲路三段750號',24.868,121.8331,true,['culture','family'],'https://www.lym.gov.tw/',{photo:'yilan-lanyang.jpg',closed:[3],hours:'參考 09:00–17:00；週三休館，假日例外請確認',fee:100,description:'透過山、平原與海的展示認識蘭陽；館外可觀察烏石港濕地。建築設計：姚仁喜／大元建築工場。'}),
p('toucheng','頭城老街','宜蘭縣頭城鎮和平街',24.8557,121.8234,false,['culture','nature'],'https://travel.yilan.gov.tw/zh-tw/district-fun/3/',{fee:0,description:'沿和平街閱讀頭城的歷史紋理；店家各自營業，不保證每間開放。'}),
p('wushi','烏石港','宜蘭縣頭城鎮烏石港路',24.8695,121.837,false,['nature'],'https://www.tad.gov.tw/m1.aspx?id=A12-00569&sNo=0001106',{fee:0,description:'在港區公共步行空間欣賞漁港風景；不安排出海，強風、雷雨時取消。'})]},
{city:'台中',aliases:['臺中','台中市','臺中市','國立臺灣美術館','國美館','審計新村'],subtitle:'西區散策・美術與街區',cover:'taichung-ntmofa.jpg',places:[
p('ntmofa','國立臺灣美術館','臺中市西區五權西路一段2號',24.1412,120.6631,true,['culture','family'],'https://www.ntmofa.gov.tw/en/cp.aspx?n=1583',{photo:'taichung-ntmofa.jpg',closed:[1],hours:'參考 09:00–17:00；週一休館，假日及延長時段請確認',fee:0,description:'以臺灣美術作品與展覽為主，依展期安排參觀；特殊展覽與活動另依公告收費。'}),
p('shenji','審計新村','臺中市西區民生路368巷',24.1443,120.6633,false,['culture','nature'],'https://travel.taichung.gov.tw/zh-tw/multimedia/album/8101',{open:660,fee:0,description:'走訪宿舍改造的街區與小店；各店營業時間不同，安排為候選散步點。'}),
p('green','草悟道','臺中市西區公益路與經國園道周邊',24.1508,120.664,false,['nature','family'],'https://travel.taichung.gov.tw/',{fee:0,description:'在西區綠帶慢走，依同行者體力縮短路線；遇雨取消戶外段。'})]},
{city:'台南',aliases:['臺南','台南市','臺南市','赤崁樓','臺南市美術館','台南市美術館','臺南孔廟','台南孔廟'],subtitle:'府城一日・古蹟與藝術',cover:'tainan-chihkan.jpg',places:[
p('chihkan','赤崁樓','臺南市中西區民族路二段212號',22.9975,120.2025,false,['culture'],'https://www.twtainan.net/zh-tw/application/activity/4/',{photo:'tainan-chihkan.jpg',description:'從府城古蹟認識臺南歷史；修復工程與可參觀區域須依現場公告。'}),
p('tnam','臺南市美術館2館','臺南市中西區忠義路二段1號',22.9907,120.2009,true,['culture','family'],'https://www.tnam.museum/service/faq',{open:600,close:1080,closed:[1],hours:'週二至週日 10:00–18:00；週六延長，週一與特殊休館日請確認',description:'安排室內看展與休息。2館設有收費地下停車場，空位及費率需另查。'}),
p('confucius','臺南孔廟','臺南市中西區南門路2號',22.9905,120.2042,false,['culture','nature'],'https://www.tn-confucius.org.tw/',{description:'漫步孔廟與周邊街區；園區與收費參觀區依公告分別開放。'})]}
];
export function findRegion(value){const q=String(value||'').trim().replaceAll('臺','台');return catalog.find(r=>[r.city,...r.aliases,...r.places.map(p=>p.name)].some(x=>x.replaceAll('臺','台')===q));}

const extraPhotos={"ntm":"taipei-ntm.jpg","peace":"taipei-228.jpg","nanmen":"taipei-nanmen.jpg","toucheng":"yilan-toucheng.jpg","wushi":"yilan-wushi.jpg","shenji":"taichung-shenji.jpg","green":"taichung-greenway.jpg","tnam":"tainan-art2.jpg","confucius":"tainan-confucius.jpg"};
for (const region of catalog) for (const place of region.places) if (extraPhotos[place.id]) place.photo=extraPhotos[place.id];
