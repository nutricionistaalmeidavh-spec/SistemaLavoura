const REQUIRED_METHODS=['start','stop','health','onReading'];

export function assertIoTAdapter(adapter){
  if(!adapter||typeof adapter!=='object') throw new TypeError('IoT adapter is required.');
  if(typeof adapter.id!=='string'||!adapter.id.trim()) throw new TypeError('Adapter id is required.');
  if(typeof adapter.protocol!=='string'||!adapter.protocol.trim()) throw new TypeError('Adapter protocol is required.');
  for(const method of REQUIRED_METHODS){
    if(typeof adapter[method]!=='function') throw new TypeError(`Adapter ${method}() is required.`);
  }
  return adapter;
}
