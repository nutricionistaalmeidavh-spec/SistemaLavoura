import {app,BrowserWindow,ipcMain} from 'electron';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStandaloneHost} from '../runtime/host.mjs';
const here=dirname(fileURLToPath(import.meta.url));
let host=null;
const channels=['describe','authState','bootstrap','login','validate','logout','load','action'];
async function boot(){host=await createStandaloneHost({dataDir:join(app.getPath('userData'),'data'),edition:process.env.ARTISYS_EDITION||'complete'});for(const channel of channels)ipcMain.handle(`artisys:${channel}`,(_event,payload)=>host.backend[channel](payload));const win=new BrowserWindow({width:1440,height:900,minWidth:1024,minHeight:680,show:false,webPreferences:{preload:join(here,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});await win.loadFile(join(here,'../dist/index.html'));win.once('ready-to-show',()=>win.show());}
app.whenReady().then(boot);
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>{void host?.close?.();});
