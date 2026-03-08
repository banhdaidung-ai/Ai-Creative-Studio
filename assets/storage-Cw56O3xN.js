import{c as d}from"./createLucideIcon-SvGSDG_l.js";/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M12 3v18",key:"108xh3"}]],v=d("columns-2",u);/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]],j=d("plus",l);/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],M=d("trash-2",h);/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["line",{x1:"21",x2:"16.65",y1:"21",y2:"16.65",key:"13gj7c"}],["line",{x1:"11",x2:"11",y1:"8",y2:"14",key:"1vmskp"}],["line",{x1:"8",x2:"14",y1:"11",y2:"11",key:"durymu"}]],S=d("zoom-in",x);/**
 * @license lucide-react v0.561.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["line",{x1:"21",x2:"16.65",y1:"21",y2:"16.65",key:"13gj7c"}],["line",{x1:"8",x2:"14",y1:"11",y2:"11",key:"durymu"}]],N=d("zoom-out",m),p="YodyAIStudioDB",s="app_state",k=1,i=()=>new Promise((t,r)=>{const e=indexedDB.open(p,k);e.onupgradeneeded=o=>{const c=o.target.result;c.objectStoreNames.contains(s)||c.createObjectStore(s,{keyPath:"id"})},e.onsuccess=o=>{t(o.target.result)},e.onerror=o=>{r(o.target.error)}}),g=async(t,r)=>{try{const e=await i();return new Promise((o,c)=>{const n=e.transaction([s],"readwrite").objectStore(s).put({id:t,value:r});n.onsuccess=()=>o(),n.onerror=()=>c(n.error)})}catch(e){console.error(`IndexedDB Save Error for ${t}:`,e)}},w=async t=>{try{const r=await i();return new Promise((e,o)=>{const a=r.transaction([s],"readonly").objectStore(s).get(t);a.onsuccess=()=>{const n=a.result;e(n?n.value:null)},a.onerror=()=>o(a.error)})}catch(r){return console.error(`IndexedDB Load Error for ${t}:`,r),null}};export{v as C,j as P,M as T,N as Z,S as a,w as l,g as s};
