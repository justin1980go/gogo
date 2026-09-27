export function recommendationInput(plan,dayIndex,weather){
  const day=plan.days[dayIndex],items=day.routes[weather].items;
  const stops=items.filter(i=>i.place);if(!stops.length)return null;
  const mealIndex=items.findIndex(i=>i.type==='meal'),meal=items[mealIndex];
  const nearLunch=(mealIndex>=0?items.slice(0,mealIndex).filter(i=>i.place).at(-1):null)||stops[0],last=stops.at(-1);
  const min=time=>Number(time.slice(0,2))*60+Number(time.slice(3));
  const point=(stop,start,end)=>({name:stop.place.name,lat:stop.place.lat,lng:stop.place.lng,start,end});
  const dinnerStart=Math.max(1080,min(last.end));
  return {date:day.date,overnight:dayIndex<plan.days.length-1,lunch:point(nearLunch,meal?min(meal.start):720,meal?min(meal.end):780),dinner:point(last,dinnerStart,Math.min(1440,dinnerStart+60))};
}
