import React from 'react';

const paths={
  dashboard:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  map:<><path d="m3 6 5-3 8 3 5-3v15l-5 3-8-3-5 3Z"/><path d="M8 3v15M16 6v15"/></>,
  sprout:<><path d="M12 22V9"/><path d="M12 13C7 13 4 10 4 5c5 0 8 3 8 8Z"/><path d="M12 11c0-5 3-8 8-8 0 5-3 8-8 8Z"/></>,
  'clipboard-list':<><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h4"/></>,
  package:<><path d="m4 7 8-4 8 4-8 4Z"/><path d="m4 7v10l8 4 8-4V7M12 11v10"/></>,
  wheat:<><path d="M12 22V8M12 10C8 10 6 8 6 5c4 0 6 2 6 5ZM12 14c-4 0-6-2-6-5 4 0 6 2 6 5ZM12 10c4 0 6-2 6-5-4 0-6 2-6 5ZM12 14c4 0 6-2 6-5-4 0-6 2-6 5Z"/></>,
  warehouse:<><path d="M3 10 12 4l9 6v10H3Z"/><path d="M7 20v-6h10v6M8 10h.01M12 10h.01M16 10h.01"/></>,
  wallet:<><path d="M4 6h14a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12"/><path d="M16 11h5v4h-5a2 2 0 1 1 0-4Z"/></>,
  chart:<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  settings:<><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2L3 14.5l2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 3.1h5l.4-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2.1-1.5a7 7 0 0 0 .1-1Z"/></>,
  check:<><path d="m5 12 4 4L19 6"/></>,
  alert:<><path d="M12 3 2.8 20h18.4Z"/><path d="M12 9v4M12 17h.01"/></>,
  search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  refresh:<><path d="M20 6v5h-5M4 18v-5h5"/><path d="M18 9a7 7 0 0 0-12-3L4 8M6 15a7 7 0 0 0 12 3l2-2"/></>,
  menu:<><path d="M4 7h16M4 12h16M4 17h16"/></>,
  close:<><path d="m6 6 12 12M18 6 6 18"/></>,
  logout:<><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/></>,
  leaf:<><path d="M20 4C10 4 5 9 5 16c0 2 1 4 3 5 7-1 12-6 12-17Z"/><path d="M6 19c3-5 7-8 12-11"/></>
};

export function Icon({name,size=20,className=''}){
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]??paths.leaf}</svg>;
}
