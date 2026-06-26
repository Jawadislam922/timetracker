import{c as a,d as m,z as s,R as l}from"./app-CT9mg6iZ.js";import{C as f}from"./circle-x-H6x4JxnG.js";import{d as h,L as y}from"./AuthenticatedLayout-CmglaHry.js";import{C as p}from"./coffee-BnK4mSJq.js";/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]],k=a("circle-alert",g);/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b=[["path",{d:"M21.801 10A10 10 0 1 1 17 3.335",key:"yps3ct"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]],u=a("circle-check-big",b);/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=[["path",{d:"M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z",key:"kmsa83"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]],z=a("circle-play",x);/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _=[["path",{d:"m10 17 5-5-5-5",key:"1bsop3"}],["path",{d:"M15 12H3",key:"6jk70r"}],["path",{d:"M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4",key:"u53s6r"}]],C=a("log-in",_);/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S=[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}]],A=a("rotate-ccw",S);/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}]],D=a("square",L);function E(){const e=m().props.display||{},o=e.timezone||"Asia/Karachi",r=String(e.format)!=="24",t=(c,n)=>{if(!c)return"";try{return n(new Date(c))}catch{return""}};return{formatTime:c=>t(c,n=>n.toLocaleTimeString("en-US",{timeZone:o,hour:"numeric",minute:"2-digit",hour12:r})),formatDateTime:c=>t(c,n=>n.toLocaleString("en-US",{timeZone:o,year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:r})),formatDate:c=>t(c,n=>n.toLocaleDateString("en-US",{timeZone:o,year:"numeric",month:"short",day:"numeric"})),tz:o,hour12:r}}const i={borderRadius:"12px",background:"#ffffff",color:"#1f2937",border:"1px solid #e5e7eb",padding:"16px",fontSize:"14px",fontWeight:"500",boxShadow:"0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"},d={width:"20px",height:"20px",marginRight:"8px"},N=(e,o=null)=>{const t={clock_in:{message:o||"Successfully clocked in! Ready to be productive? 💪",icon:C,color:"#10b981"},clock_out:{message:o||"Successfully clocked out! Great work today! 🎉",icon:y,color:"#ef4444"},break_start:{message:o||"Break started! Take your time to recharge ☕",icon:p,color:"#f59e0b"},break_end:{message:o||"Welcome back! Ready to continue? 🔄",icon:h,color:"#3b82f6"}}[e]||{message:o||"Action completed successfully!",icon:u,color:"#10b981"};s.success(t.message,{style:{...i,borderColor:t.color,borderLeftWidth:"4px"},icon:l.createElement(t.icon,{style:{...d,color:t.color}}),duration:4e3})},B=e=>{s.error(e,{style:{...i,borderColor:"#ef4444",borderLeftWidth:"4px"},icon:l.createElement(f,{style:{...d,color:"#ef4444"}}),duration:5e3})},G=(e,o)=>{const t=`${{clock_in:"Clock In",clock_out:"Clock Out",break_start:"Start Break",break_end:"End Break"}[e]||e} is not available. ${o}`;s(t,{style:{...i,borderColor:"#6b7280",borderLeftWidth:"4px"},icon:l.createElement(k,{style:{...d,color:"#6b7280"}}),duration:3e3})},q=(e="Processing...")=>s.loading(e,{style:{...i,borderColor:"#6b7280",borderLeftWidth:"4px"}}),H=()=>{s.success("📊 Time entries exported successfully! Check your downloads folder.",{style:{...i,borderColor:"#10b981",borderLeftWidth:"4px"},icon:l.createElement(u,{style:{...d,color:"#10b981"}}),duration:5e3})},I=e=>{const o=Math.max(0,Number(e)||0);if(o===0)return"0m";const r=Math.floor(o),t=Math.round((o-r)*60);return r===0?`${t}m`:t===0?`${r}h`:`${r}h ${t}m`},P=()=>{const e=new Date().getHours();return e<5?"Working late night? 🌙":e<12?"Good morning! ☀️":e<17?"Good afternoon! 🌤️":e<20?"Good evening! 🌅":"Good evening! 🌙"};export{z as C,A as R,D as S,G as a,q as b,N as c,H as d,I as f,P as g,B as s,E as u};
