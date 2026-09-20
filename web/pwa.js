export async function registerPwa(){
  if(typeof window==='undefined'||!('serviceWorker' in navigator))return null;
  if(!['http:','https:'].includes(window.location.protocol))return null;
  try{return await navigator.serviceWorker.register('./sw.js',{scope:'./'});}catch(error){console.warn('PWA registration failed:',error);return null;}
}
