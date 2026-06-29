import{c as n,d as m,z as s,R as l}from"./app-Cazu8Kmx.js";import{C as h}from"./circle-x-ByXwXvuE.js";import{c as f,L as y}from"./AuthenticatedLayout-C6gIZNWs.js";/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]],k=n("circle-alert",p);/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=[["path",{d:"M21.801 10A10 10 0 1 1 17 3.335",key:"yps3ct"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]],u=n("circle-check-big",g);/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b=[["path",{d:"M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z",key:"kmsa83"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]],z=n("circle-play",b);/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=[["path",{d:"M10 2v2",key:"7u0qdc"}],["path",{d:"M14 2v2",key:"6buw04"}],["path",{d:"M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1",key:"pwadti"}],["path",{d:"M6 2v2",key:"colzsn"}]],_=n("coffee",x);/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=[["path",{d:"m10 17 5-5-5-5",key:"1bsop3"}],["path",{d:"M15 12H3",key:"6jk70r"}],["path",{d:"M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4",key:"u53s6r"}]],S=n("log-in",w);/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}]],R=n("rotate-ccw",C);/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}]],W=n("square",L);function A(){const o=m().props.display||{},e=o.timezone||"Asia/Karachi",r=String(o.format)!=="24",t=(c,a)=>{if(!c)return"";try{return a(new Date(c))}catch{return""}};return{formatTime:c=>t(c,a=>a.toLocaleTimeString("en-US",{timeZone:e,hour:"numeric",minute:"2-digit",hour12:r})),formatDateTime:c=>t(c,a=>a.toLocaleString("en-US",{timeZone:e,year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:r})),formatDate:c=>t(c,a=>a.toLocaleDateString("en-US",{timeZone:e,year:"numeric",month:"short",day:"numeric"})),tz:e,hour12:r}}const i={borderRadius:"12px",background:"#ffffff",color:"#1f2937",border:"1px solid #e5e7eb",padding:"16px",fontSize:"14px",fontWeight:"500",boxShadow:"0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"},d={width:"20px",height:"20px",marginRight:"8px"},E=(o,e=null)=>{const t={clock_in:{message:e||"Successfully clocked in! Ready to be productive? 💪",icon:S,color:"#10b981"},clock_out:{message:e||"Successfully clocked out! Great work today! 🎉",icon:y,color:"#ef4444"},break_start:{message:e||"Break started! Take your time to recharge ☕",icon:_,color:"#f59e0b"},break_end:{message:e||"Welcome back! Ready to continue? 🔄",icon:f,color:"#3b82f6"}}[o]||{message:e||"Action completed successfully!",icon:u,color:"#10b981"};s.success(t.message,{style:{...i,borderColor:t.color,borderLeftWidth:"4px"},icon:l.createElement(t.icon,{style:{...d,color:t.color}}),duration:4e3})},B=o=>{s.error(o,{style:{...i,borderColor:"#ef4444",borderLeftWidth:"4px"},icon:l.createElement(h,{style:{...d,color:"#ef4444"}}),duration:5e3})},G=(o,e)=>{const t=`${{clock_in:"Clock In",clock_out:"Clock Out",break_start:"Start Break",break_end:"End Break"}[o]||o} is not available. ${e}`;s(t,{style:{...i,borderColor:"#6b7280",borderLeftWidth:"4px"},icon:l.createElement(k,{style:{...d,color:"#6b7280"}}),duration:3e3})},H=(o="Processing...")=>s.loading(o,{style:{...i,borderColor:"#6b7280",borderLeftWidth:"4px"}}),q=()=>{s.success("📊 Time entries exported successfully! Check your downloads folder.",{style:{...i,borderColor:"#10b981",borderLeftWidth:"4px"},icon:l.createElement(u,{style:{...d,color:"#10b981"}}),duration:5e3})},I=o=>{const e=Math.max(0,Number(o)||0);if(e===0)return"0m";const r=Math.floor(e),t=Math.round((e-r)*60);return r===0?`${t}m`:t===0?`${r}h`:`${r}h ${t}m`},U=o=>{let e;try{e=o?Number(new Intl.DateTimeFormat("en-US",{hour:"numeric",hour12:!1,timeZone:o}).format(new Date)):new Date().getHours()}catch{e=new Date().getHours()}return e===24&&(e=0),e<5?"Working late night? 🌙":e<12?"Good morning! ☀️":e<17?"Good afternoon! 🌤️":e<20?"Good evening! 🌅":"Good evening! 🌙"};export{_ as C,R,W as S,z as a,G as b,H as c,E as d,q as e,I as f,U as g,B as s,A as u};
