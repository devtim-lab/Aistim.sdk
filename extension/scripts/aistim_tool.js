(function(){"use strict";if(/^\/stok_opnams\/(proses_koreksi_so\/|proses_pengisian_hasil_so)/.test(location.pathname)){console.log("[AistimTool] Halaman proses SO ("+location.pathname+") -> Aistim Tool tidak aktif di sini");return}const v={autoRefreshSeconds:60,version:"v2026-09-05.20.5"},R="erzap_filter",M="erzap_panel_collapsed",C={_mem:{},get(t,o){try{const n=localStorage.getItem(t);if(n!==null)return n}catch{}return this._mem[t]!==void 0?this._mem[t]:o},set(t,o){this._mem[t]=o;try{localStorage.setItem(t,o)}catch{}}};let u=[],N=0,f=null,g=!1,w=null,q=null,O=null,S=!1;function m(...t){console.log("[AistimTool]",...t)}function K(t){const o=[],n=[];for(const a of t.rows){let r=0;for(let l=0;l<o.length;l++)o[l]>0&&r++;let s=0;for(const l of a.cells){for(;o[s]>0;)s++;const e=l.rowSpan||1,y=l.colSpan||1;for(let h=0;h<y;h++)o[s+h]=e;s+=y}n.push({row:a,covered:r});for(let l=0;l<o.length;l++)o[l]>0&&o[l]--}return n}function _(){if(g)return;const t=document.querySelector("table.no_data_table.table");if(!t)return;const o=K(t);if(!o.length)return;const n=o.filter(({row:e})=>e.closest("thead")!==null||e.querySelector("th")),a=n.some(({row:e})=>e.querySelector(".koreksi-col"));let r=1;if(n.length>0)for(const e of n[0].row.cells)r=Math.max(r,e.rowSpan||1);let s=a,l=!1;o.forEach(({row:e,covered:y})=>{if(e.querySelector(".koreksi-col")||e.getAttribute("data-koreksi-done")==="1")return;const h=e.closest("thead")!==null,E=e.querySelector("th")!==null,k=h||E,b=y>0;if(k){if(s){if(r===1){const p=document.createElement("th");p.className="table-header-so koreksi-col",p.style.textAlign="center",p.style.verticalAlign="middle",p.innerHTML="",e.appendChild(p)}}else{const p=document.createElement("th");p.className="table-header-so koreksi-col",p.style.textAlign="center",p.style.verticalAlign="middle",p.innerHTML="<div>Cek Selisih</div>",r>1&&(p.rowSpan=r),e.appendChild(p),s=!0}return}if(b)return;const d=e.cells[0],i=(d?d.textContent.trim():"")==="",c=document.createElement("td");c.className="koreksi-col",c.style.textAlign="center",c.style.verticalAlign="middle";let x="unknown";if(i)c.innerHTML="",c.style.border="none",x="blank";else{let p=0,H=0,A="";if(e.cells[5]&&e.cells[6]&&(A=e.cells[5].textContent.trim(),p=parseFloat(A.replace(/[^\d.-]/g,""))||0,H=parseFloat(e.cells[6].textContent.replace(/[^\d.-]/g,""))||0),A==="PCS"||A==="0.0 PCS")c.innerHTML="",x="uncalculated";else{let z=p-H;if(z===0)c.innerHTML='<span style="font-weight: bold; color: gray;">0</span>',x="nol";else{let V=z<0?"red":"green";c.innerHTML=`<span style="font-weight: bold; color: ${V};">${z}</span>`,x=z<0?"negatif":"positif"}}}e.appendChild(c),e.setAttribute("data-row-idx",String(N++)),e.setAttribute("data-koreksi-status",x),e.setAttribute("data-koreksi-done","1"),u.push({element:e,status:x,index:N-1}),l=!0}),l&&(I(),B())}function F(){return C.get(R,"koreksi")}function $(t){C.set(R,t),m("Filter saved:",t)}function I(){const t=document.getElementById("erzap-filter-select");if(!t)return;const o={semua:0,negatif:0,positif:0,nol:0,blank:0,koreksi:0};u.forEach(({status:a})=>{o.semua++,a==="negatif"?o.negatif++:a==="positif"?o.positif++:a==="nol"?o.nol++:(a==="blank"||a==="uncalculated")&&o.blank++,(a==="negatif"||a==="positif")&&o.koreksi++});const n={semua:"Semua",negatif:"Negatif (-)",positif:"Positif (+)",nol:"Real",blank:"Belum dicek",koreksi:"Ada Selisih (-/+)"};Array.from(t.options).forEach(a=>{const r=a.value;n[r]&&(a.textContent=`${n[r]} (${o[r]})`)})}function B(){if(g||u.length===0){m("applyFilter skipped:",{isFiltering:g,len:u.length});return}g=!0,f&&f.disconnect();const t=F();m("Applying filter:",t);const o=document.querySelector("table.no_data_table.table");if(!o){g=!1,f&&f.observe(document.body,{childList:!0,subtree:!0});return}const n=o.querySelector("tbody");if(!n){g=!1,f&&f.observe(document.body,{childList:!0,subtree:!0});return}u.forEach(({element:s})=>{if(s.parentNode===n)try{n.removeChild(s)}catch{}});let a=0;u.forEach(({element:s,status:l})=>{let e=!0;switch(t){case"negatif":e=l==="negatif";break;case"positif":e=l==="positif";break;case"nol":e=l==="nol";break;case"blank":e=l==="blank"||l==="uncalculated";break;case"koreksi":e=l==="negatif"||l==="positif";break;case"semua":default:e=!0;break}e&&(n.appendChild(s),a++)}),m("Filter result:",{filter:t,shown:a,total:u.length});const r=document.getElementById("erzap-filter-select");r&&(r.value=t),I(),f&&f.observe(document.body,{childList:!0,subtree:!0}),g=!1}function j(){return C.get(M,"0")==="1"}function J(t){C.set(M,t?"1":"0")}function D(){if(document.getElementById("erzap-panel"))return;let t=null;const o=document.querySelectorAll("*");for(const i of o)if(i.textContent&&i.textContent.trim()==="Administrator"){t=i;break}const n=document.createElement("div");n.id="erzap-wrapper",n.style.cssText="position: relative; display: inline-block; cursor: pointer;";const a=document.createElement("div");a.id="erzap-menu-btn",a.style.cssText=`
            padding: 8px 15px;
            background: #dc3545;
            color: #fff;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
            user-select: none;
        `,a.innerHTML='⚙️ Aistim Tool <span id="erzap-menu-arrow" style="font-size:10px;">▼</span>';const r=document.createElement("div");if(r.id="erzap-panel",r.style.cssText=`
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            z-index: 999999 !important;
            background: #dc3545;
            border: none;
            border-radius: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(255,165,0,0.4);
            width: 220px;
            overflow: hidden;
            color: #fff;
        `,a.addEventListener("click",i=>{i.stopPropagation();const c=r.style.display==="block";r.style.display=c?"none":"block",document.getElementById("erzap-menu-arrow").textContent=c?"▼":"▲"}),document.addEventListener("click",i=>{n.contains(i.target)||(r.style.display="none",document.getElementById("erzap-menu-arrow").textContent="▼")}),n.appendChild(a),n.appendChild(r),t){const i=t.closest('li, .nav-item, .menu-item, [class*="menu"], [class*="nav"]');i&&i.parentNode?i.parentNode.insertBefore(n,i.nextSibling):(document.body.appendChild(n),n.style.position="fixed",n.style.top="10px",n.style.right="10px")}else document.body.appendChild(n),n.style.position="fixed",n.style.top="10px",n.style.right="10px";if(!document.getElementById("erzap-panel-style")){const i=document.createElement("style");i.id="erzap-panel-style",i.textContent=`
                select#erzap-filter-select option {
                    background: #c82333 !important;
                    color: #fff !important;
                    font-size: 14px;
                    padding: 8px 12px;
                }
            `,document.head.appendChild(i)}const s=document.createElement("div");s.id="erzap-panel-body",s.style.cssText=`
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 0;
            background: #dc3545;
        `;const l=document.createElement("div");l.textContent="Filter Tampilan:",l.style.cssText="color: #fff; padding: 8px 12px 4px 12px; font-size: 13px; font-weight: 500;";const e=document.createElement("select");e.id="erzap-filter-select",e.disabled=!1,e.style.cssText=`
            padding: 10px 12px 10px 12px;
            border-radius: 4px;
            border: 1px solid rgba(255,255,255,0.3);
            font-size: 14px;
            cursor: pointer;
            background: #c82333;
            background-color: #c82333;
            color: #fff;
            width: 100%;
            pointer-events: auto !important;
            opacity: 1 !important;
            min-height: 40px;
            outline: none;
            text-align: left;
            box-sizing: border-box;
            margin: 0;
        `,[{value:"semua",text:"Semua"},{value:"koreksi",text:"Ada Selisih (-/+)"},{value:"negatif",text:"Negatif (-)"},{value:"positif",text:"Positif (+)"},{value:"nol",text:"Real"},{value:"blank",text:"Belum dicek"}].forEach(i=>{const c=document.createElement("option");c.value=i.value,c.textContent=i.text,e.appendChild(c)}),e.value=F();const h=i=>{$(i.target.value),B()};e.addEventListener("change",h),e.addEventListener("touchend",i=>{i.stopPropagation()},{passive:!0});const E=document.createElement("div");E.style.cssText="border-top: 1px solid rgba(255,255,255,0.2); margin: 0;";const k=document.createElement("div");k.textContent="Auto Refresh:",k.style.cssText="color: #fff; padding: 8px 12px 4px 12px; font-size: 13px; font-weight: 500;";const b=document.createElement("div");b.id="erzap-refresh-countdown",b.textContent=v.autoRefreshSeconds>0?"Menunggu...":"Mati",b.style.cssText="color: #fff; font-family: monospace; font-size: 13px; padding: 0 12px 8px 12px;";const d=document.createElement("button");d.textContent="🔄 Refresh Sekarang",d.style.cssText=`
            background: rgba(0,0,0,0.15);
            color: #fff;
            border: none;
            border-radius: 0;
            border-top: 1px solid rgba(255,255,255,0.2);
            padding: 10px 12px;
            font-size: 13px;
            cursor: pointer;
            font-weight: 500;
            width: 100%;
            text-align: left;
        `,d.onmouseenter=()=>d.style.background="rgba(0,0,0,0.25)",d.onmouseleave=()=>d.style.background="rgba(0,0,0,0.15)",d.ontouchstart=()=>d.style.background="rgba(0,0,0,0.25)",d.ontouchend=()=>d.style.background="rgba(0,0,0,0.15)",d.onclick=()=>location.reload(),s.appendChild(l),s.appendChild(e),s.appendChild(E),s.appendChild(k),s.appendChild(b),s.appendChild(d);const T=document.createElement("div");T.textContent="created by aistim",T.style.cssText="color: rgba(255,255,255,0.5); font-size: 10px; text-align: center; padding: 4px 0; font-style: italic;",s.appendChild(T),r.appendChild(s),I(),m("Panel created")}function U(t){const o=Math.floor(t/60),n=t%60;return`${o}:${n.toString().padStart(2,"0")}`}function G(){if(!v.autoRefreshSeconds||v.autoRefreshSeconds<=0)return;const t=v.autoRefreshSeconds*1e3;w=Date.now()+t,q=setInterval(()=>{const o=document.getElementById("erzap-refresh-countdown");if(!o||!w)return;const n=Math.ceil((w-Date.now())/1e3);n<=0?o.textContent="Refreshing...":o.textContent="Next: "+U(n)},1e3),O=setTimeout(()=>{location.reload()},t)}function P(){S||(m("Initializing..."),_(),D(),G(),S=!0,m("Init complete. Rows:",u.length))}function L(){if(document.querySelector("table.no_data_table.table"))P();else{m("Table not found, waiting...");const t=setInterval(()=>{document.querySelector("table.no_data_table.table")&&(clearInterval(t),P())},500);setTimeout(()=>clearInterval(t),15e3)}}f=new MutationObserver(()=>{S&&_()}),document.body&&f.observe(document.body,{childList:!0,subtree:!0}),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",L):L(),setInterval(()=>{S?_():L()},1e3)})();
