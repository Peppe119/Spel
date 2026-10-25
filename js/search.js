/* Filterlogik. Delas av sidan och av tests/run-scenarios.js. */
const toMin=s=>{const[h,m]=s.split(":");return +h*60+ +m};
function match(s,f,now){
  const L={};
  if(s.aud==="women"&&(f.who==="man"||f.who==="family"))return null;
  if(s.aud==="families"&&(f.who==="man"||f.who==="woman"))return null;
  if(f.walk&&s.access==="referral")return null;
  if(f.area!=="any"&&s.area!=="all"&&s.area!==f.area)return null;
  if(!s.sch){
    if(f.open)return null;
    if(f.need!=="any"&&!(s.needs||[]).includes(f.need))return null;
    return {s,slots:[],unknown:true,first:9999};
  }
  const pc=parseInt(f.pc,10);
  const day=f.open?now.d:(f.day==="any"?null:+f.day);
  const slots=s.sch.filter(e=>{
    if(f.need!=="any"&&needOf(e.k)!==f.need)return false;
    if(f.need==="meal"&&f.meal!=="any"&&e.k!==f.meal)return false;
    if(e.w&&f.who==="man")return false;
    if(e.pc&&pc>=1000){if(e.pc==="other"){if(ALLPC.includes(pc))return false}else if(!e.pc.includes(pc))return false}
    if(day!==null&&!e.d.includes(day))return false;
    if(f.open&&!(now.m>=toMin(e.t[0])&&now.m<toMin(e.t[1])))return false;
    return true;
  });
  if(!slots.length)return null;
  return {s,slots,first:Math.min(...slots.map(e=>toMin(e.t[0])))};
}
function search(f,now){
  now=now||{d:new Date().getDay(),m:new Date().getHours()*60+new Date().getMinutes()};
  return S.map(s=>match(s,f,now)).filter(Boolean).sort((a,b)=>a.first-b.first||a.s.name.localeCompare(b.s.name));
}
