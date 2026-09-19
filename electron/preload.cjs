const {contextBridge,ipcRenderer}=require('electron');
const call=(name,payload)=>ipcRenderer.invoke(`artisys:${name}`,payload);
contextBridge.exposeInMainWorld('artisys',Object.freeze({describe:()=>call('describe'),authState:()=>call('authState'),bootstrap:(payload)=>call('bootstrap',payload),login:(payload)=>call('login',payload),validate:(payload)=>call('validate',payload),logout:(payload)=>call('logout',payload),load:(payload)=>call('load',payload),action:(payload)=>call('action',payload)}));
