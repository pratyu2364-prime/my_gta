// core/save.js — progression-only save (money/owned/ammo) to localStorage. World is not persisted.
const KEY='gta_save_v1';let timer=null;
export function hasSave(){try{const r=JSON.parse(localStorage.getItem(KEY));return !!(r&&r.v===1&&typeof r.money==='number'&&Array.isArray(r.owned));}catch(e){return false;}}
export function loadProgress(){
  try{const r=JSON.parse(localStorage.getItem(KEY));
    if(r&&r.v===1)return {money:r.money,owned:r.owned.slice(),ammo:Object.assign({},r.ammo)};}catch(e){}
  return null;
}
export function saveProgress(data){
  if(timer)clearTimeout(timer);
  timer=setTimeout(()=>{timer=null;
    try{localStorage.setItem(KEY,JSON.stringify({v:1,money:data.money,owned:data.owned,ammo:data.ammo}));}catch(e){}
  },1000);
}
