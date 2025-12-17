export const state={};
const alpha9=2/(9+1);
const alpha26=2/(26+1);

export function updateDynamic(token, tr){
  if(!state[token]) state[token]={ema9:null,ema26:null, volumeWindow:[], lastAlert:{}};
  const s=state[token];
  const price=tr.px;
  const vol=tr.sz;

  if(s.ema9===null){ s.ema9=price; s.ema26=price; }

  s.ema9 = s.ema9 + alpha9*(price - s.ema9);
  s.ema26 = s.ema26 + alpha26*(price - s.ema26);

  s.volumeWindow.push(vol);
  if(s.volumeWindow.length>20) s.volumeWindow.shift();

  return {price, ema9:s.ema9, ema26:s.ema26, volume:s.volumeWindow};
}