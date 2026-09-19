import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createIoTCommandService} from '../src/iot/commands.js';

const pkg=JSON.parse(readFileSync(fileURLToPath(new URL('../package.json',import.meta.url)),'utf8'));

test('normal Lavoura install has no mandatory IoT broker or protocol runtime dependency',()=>{
  const dependencies={...(pkg.dependencies??{}),...(pkg.optionalDependencies??{})};
  for(const forbidden of ['mqtt','modbus-serial','jsmodbus','node-opcua','chirpstack','node-red','redis','pg']){
    assert.equal(Object.hasOwn(dependencies,forbidden),false,`${forbidden} must remain optional/injected`);
  }
});

test('IoT command service stays disabled unless explicitly enabled',()=>{
  const service=createIoTCommandService({
    repository:{saveCommand:x=>x,getCommand:()=>null},
    authorize:async()=>true,
    capabilityResolver:async()=>true,
    adapterResolver:async()=>null
  });
  assert.equal(service.commandsEnabled,false);
});
