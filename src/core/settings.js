// core/settings.js — persisted player settings (localStorage). Pure storage; applying is main.js's job.
const KEY='gta_settings_v1';
export const SETTINGS_DEFAULTS={volume:1,sensitivity:1,invertY:false,quality:'high'};
export function loadSettings(){
  try{const r=JSON.parse(localStorage.getItem(KEY));if(r&&typeof r==='object')return {...SETTINGS_DEFAULTS,...r};}catch(e){}
  return {...SETTINGS_DEFAULTS};
}
export function saveSettings(s){
  try{localStorage.setItem(KEY,JSON.stringify({volume:s.volume,sensitivity:s.sensitivity,invertY:s.invertY,quality:s.quality}));}catch(e){}
}
