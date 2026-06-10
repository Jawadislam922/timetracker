import{c,z as s,R as n}from"./app-BX14l4KB.js";import{c as d,L as h}from"./AuthenticatedLayout-V7-1DyPS.js";/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]],u=c("circle-alert",y);/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=[["path",{d:"M21.801 10A10 10 0 1 1 17 3.335",key:"yps3ct"}],["path",{d:"m9 11 3 3L22 4",key:"1pflzl"}]],l=c("circle-check-big",k);/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=[["path",{d:"M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z",key:"kmsa83"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]],$=c("circle-play",f);/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m15 9-6 6",key:"1uzhvr"}],["path",{d:"m9 9 6 6",key:"z0biqf"}]],b=c("circle-x",p);/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=[["path",{d:"M10 2v2",key:"7u0qdc"}],["path",{d:"M14 2v2",key:"6buw04"}],["path",{d:"M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1",key:"pwadti"}],["path",{d:"M6 2v2",key:"colzsn"}]],m=c("coffee",g);/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=[["path",{d:"m10 17 5-5-5-5",key:"1bsop3"}],["path",{d:"M15 12H3",key:"6jk70r"}],["path",{d:"M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4",key:"u53s6r"}]],_=c("log-in",x);/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}]],v=c("rotate-ccw",C);/**
 * @license lucide-react v0.532.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}]],S=c("square",w),a={borderRadius:"12px",background:"#ffffff",color:"#1f2937",border:"1px solid #e5e7eb",padding:"16px",fontSize:"14px",fontWeight:"500",boxShadow:"0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"},i={width:"20px",height:"20px",marginRight:"8px"},N=(e,o=null)=>{const t={clock_in:{message:o||"Successfully clocked in! Ready to be productive? 💪",icon:_,color:"#10b981"},clock_out:{message:o||"Successfully clocked out! Great work today! 🎉",icon:h,color:"#ef4444"},break_start:{message:o||"Break started! Take your time to recharge ☕",icon:m,color:"#f59e0b"},break_end:{message:o||"Welcome back! Ready to continue? 🔄",icon:d,color:"#3b82f6"}}[e]||{message:o||"Action completed successfully!",icon:l,color:"#10b981"};s.success(t.message,{style:{...a,borderColor:t.color,borderLeftWidth:"4px"},icon:n.createElement(t.icon,{style:{...i,color:t.color}}),duration:4e3})},z=e=>{s.error(e,{style:{...a,borderColor:"#ef4444",borderLeftWidth:"4px"},icon:n.createElement(b,{style:{...i,color:"#ef4444"}}),duration:5e3})},R=(e,o)=>{const t=`${{clock_in:"Clock In",clock_out:"Clock Out",break_start:"Start Break",break_end:"End Break"}[e]||e} is not available. ${o}`;s(t,{style:{...a,borderColor:"#6b7280",borderLeftWidth:"4px"},icon:n.createElement(u,{style:{...i,color:"#6b7280"}}),duration:3e3})},W=(e="Processing...")=>s.loading(e,{style:{...a,borderColor:"#6b7280",borderLeftWidth:"4px"}}),E=()=>{s.success("📊 Time entries exported successfully! Check your downloads folder.",{style:{...a,borderColor:"#10b981",borderLeftWidth:"4px"},icon:n.createElement(l,{style:{...i,color:"#10b981"}}),duration:5e3})},q=e=>{const o=Math.max(0,Number(e)||0);if(o===0)return"0m";const r=Math.floor(o),t=Math.round((o-r)*60);return r===0?`${t}m`:t===0?`${r}h`:`${r}h ${t}m`},A=()=>{const e=new Date().getHours();return e<5?"Working late night? 🌙":e<12?"Good morning! ☀️":e<17?"Good afternoon! 🌤️":e<20?"Good evening! 🌅":"Good evening! 🌙"};export{m as C,v as R,S,$ as a,R as b,W as c,N as d,E as e,q as f,A as g,z as s};
