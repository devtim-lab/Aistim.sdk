(function(){"use strict";if(document.getElementById("az_btn"))return;const w=t=>new Promise(a=>setTimeout(a,t)),X=`
    #az_btn{background:linear-gradient(135deg,#e63946,#b30d1c);color:#fff;border:none;
        border-radius:8px;padding:8px 18px;font:600 13px/1 'Segoe UI',Arial,sans-serif;
        cursor:pointer;box-shadow:0 2px 8px rgba(230,57,70,.4);white-space:nowrap;
        margin-left:12px;align-self:center}
    #az_btn:active{transform:scale(.95)}
    #az_overlay{display:none;position:fixed;inset:0;z-index:99998;
        background:rgba(0,0,0,.55)}
    #az_overlay.az_open{display:flex;align-items:center;justify-content:center}
    #az_modal{background:#fff;border-radius:12px;width:560px;max-width:94vw;
        max-height:92vh;display:flex;flex-direction:column;overflow:hidden;
        box-shadow:0 10px 40px rgba(0,0,0,.35);font-family:'Segoe UI',Arial,sans-serif}
    #az_head{display:flex;align-items:center;justify-content:space-between;
        background:linear-gradient(135deg,#e63946,#b30d1c);color:#fff;
        padding:10px 14px;font-weight:700;font-size:14px}
    #az_close{background:rgba(255,255,255,.2);border:none;color:#fff;
        width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:14px}
    #az_body{padding:12px 14px;overflow-y:auto;overflow-x:hidden}
    .az_row{margin-bottom:9px}
    .az_row>label{display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px}
    .az_row input[type=text],.az_row select{width:100%;box-sizing:border-box;
        padding:7px 9px;border:1px solid #ccc;border-radius:8px;font-size:13px}
    .az_row input:focus,.az_row select:focus{outline:none;border-color:#e63946;
        box-shadow:0 0 0 2px rgba(230,57,70,.15)}
    #az_scan{width:100%;padding:9px;border:none;border-radius:8px;cursor:pointer;
        background:linear-gradient(135deg,#e63946,#b30d1c);color:#fff;box-shadow:0 2px 8px rgba(230,57,70,.4);
        font:700 13px 'Segoe UI',Arial,sans-serif}
    #az_scan:active{transform:scale(.98)}
    #az_scan:disabled{opacity:.6;cursor:not-allowed}
    .az_row input[type=text]:disabled{background:#f3f3f3;color:#999;cursor:not-allowed}
    #az_btn_barcode:disabled{opacity:.5;cursor:not-allowed}
    #az_outlet.az_belum{border-color:#e63946;background:#fff5f5}
    #az_langkah{font-size:11px;color:#777;margin:-4px 0 8px}
    /* toggle switch filter stok minus */
    .az_switch{width:42px;height:24px;border-radius:20px;background:#ccc;position:relative;
        cursor:pointer;transition:background .2s;flex:0 0 auto;align-self:center}
    .az_switch.on{background:#e63946}
    .az_knob{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;
        background:#fff;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.35)}
    .az_switch.on .az_knob{left:21px}
    /* hasil */
    #az_hasil{margin-top:14px}
    #az_info{font-size:12px;color:#666;margin-bottom:6px}
    #az_tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:12px}
    #az_tbl td{padding:7px 6px;border-bottom:1px solid #eee;vertical-align:top}
    #az_tbl tr:nth-child(even) td{background:#f9f9f9}
    .az-minus{color:#e63946;font-weight:700}
    .az-plus{color:#2a9d3f;font-weight:700}
    #az_tbl td.az-stok-cell{text-align:center}
    .az-harga{color:#b58900;font-weight:600;white-space:nowrap}
    .az-nama{word-break:break-word}
    .az-stok-link{cursor:pointer;color:#1d3557;font-weight:700;text-decoration:underline}
    .az-stok-link:hover{color:#e63946}
    .az-gudang{white-space:nowrap;font-size:11px;color:#333}
    .az-gudang div{padding:1px 0}
    .az-gudang b{color:#1d3557}
    .az-gudang .az-outlet{font-weight:700;color:#555;margin-top:3px}
    .az-gudang .az-gdn{padding-left:8px}
    .az-gudang .az-minus{color:#e63946}
    .az-gudang .az-muted{color:#999}
    /* panel analisa aktifitas */
    #az_analisa{margin-top:14px}
    .az_analisa_box{border:1px solid #f0c36d;background:#fffdf5;
        border-radius:8px;padding:10px 12px;margin-bottom:10px}
    .az_analisa_box h4{margin:0 0 8px;font-size:13px;color:#8a5a00}
    .az_chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
    .az_chip{background:#fff;border:1px solid #f0c36d;border-radius:20px;
        padding:4px 10px;font-size:11px;font-weight:600;color:#555}
    .az_chip b{color:#1d3557}
    .az_chip_red b{color:#e63946}
    .az_chip_green b{color:#2a9d3f}
    .az_jenis_wrap{overflow-x:auto;margin-bottom:8px;border:1px solid #f0e6cc;border-radius:6px}
    .az_jenis_tbl{width:100%;border-collapse:collapse;font-size:11px}
    .az_jenis_tbl td{padding:5px 6px;border-bottom:1px solid #f0e6cc;white-space:nowrap}
    .az_trx_wrap{max-height:180px;overflow:auto;border:1px solid #f0e6cc;border-radius:6px}
    .az_trx_tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:11px}
    .az_trx_tbl td{padding:5px 6px;border-bottom:1px solid #f2f2f2;vertical-align:top;white-space:nowrap}
    .az_out{color:#e63946;font-weight:700;white-space:nowrap}
    .az_in{color:#2a9d3f;font-weight:700;white-space:nowrap}
    /* semua header tabel di modal = MERAH + shadow merah */
    #az_tbl th,.az_trx_tbl th,.az_jenis_tbl th{
        background-color:#e63946 !important;background:linear-gradient(135deg,#e63946,#b30d1c) !important;
        color:#fff !important;
        text-align:left;
        box-shadow:0 3px 6px rgba(230,57,70,.45);
        border:1px solid #b30d1c}
    #az_tbl th{padding:7px 6px;position:sticky;top:0;z-index:5}
    .az_trx_tbl th{padding:5px 6px;position:sticky;top:0;z-index:5}
    .az_jenis_tbl th{padding:5px 6px}
    /* barcode input + tombol scan kamera */
    #az_barcode_wrap{display:flex;gap:6px;align-items:stretch}
    #az_barcode_wrap input{flex:1;min-width:0}
    #az_btn_barcode{flex:0 0 auto;width:40px;border:1px solid #ccc;border-radius:8px;
        background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;
        padding:0;color:#1d3557}
    #az_btn_barcode:active{transform:scale(.93);background:#f0f0f0}
    #az_btn_barcode svg{width:22px;height:22px}
    /* overlay kamera scanner */
    #az_cam_overlay{display:none;position:fixed;inset:0;z-index:999999;
        background:rgba(0,0,0,.85);align-items:center;justify-content:center}
    #az_cam_box{background:#111;border-radius:14px;overflow:hidden;width:420px;max-width:92vw;
        max-height:86vh;max-height:86dvh;
        border:3px solid #e63946;box-shadow:0 0 0 4px rgba(255,255,255,.12),0 12px 40px rgba(0,0,0,.6);
        display:flex;flex-direction:column;font-family:'Segoe UI',Arial,sans-serif}
    #az_cam_head{display:flex;align-items:center;justify-content:space-between;
        background:linear-gradient(135deg,#e63946,#b30d1c);color:#fff;
        padding:10px 14px;font-weight:700;font-size:14px}
    #az_cam_close{background:rgba(255,255,255,.2);border:none;color:#fff;
        width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:14px}
    #az_cam_video{width:100%;aspect-ratio:4/3;background:#000;object-fit:cover}
    #az_cam_status{padding:10px 14px;color:#ddd;font-size:12px;text-align:center}
    /* ===== ANIMASI VIEWFINDER SCANNER ===== */
    #az_cam_overlay{animation:azFadeIn .25s ease}
    #az_cam_box{animation:azPopIn .3s cubic-bezier(.2,1.4,.4,1)}
    @keyframes azFadeIn{from{opacity:0}to{opacity:1}}
    @keyframes azPopIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
    #az_cam_view{position:relative;overflow:hidden}
    /* sudut-sudut viewfinder */
    .az_corner{position:absolute;width:34px;height:34px;border:3px solid #e63946;
        z-index:2;animation:azCornerPulse 2s ease-in-out infinite}
    .az_corner.tl{top:12px;left:12px;border-right:none;border-bottom:none;border-radius:8px 0 0 0}
    .az_corner.tr{top:12px;right:12px;border-left:none;border-bottom:none;border-radius:0 8px 0 0}
    .az_corner.bl{bottom:12px;left:12px;border-right:none;border-top:none;border-radius:0 0 0 8px}
    .az_corner.br{bottom:12px;right:12px;border-left:none;border-top:none;border-radius:0 0 8px 0}
    @keyframes azCornerPulse{0%,100%{opacity:1}50%{opacity:.45}}
    /* garis laser scan bergerak naik-turun */
    #az_laser{position:absolute;left:8%;right:8%;height:3px;z-index:2;
        background:linear-gradient(90deg,transparent,#e63946 20%,#ff6b78 50%,#e63946 80%,transparent);
        border-radius:3px;box-shadow:0 0 12px 3px rgba(230,57,70,.7);
        animation:azLaser 2.2s ease-in-out infinite}
    @keyframes azLaser{0%,100%{top:12%}50%{top:85%}}
    /* area bidik semi-transparan di tengah */
    #az_reticle{position:absolute;left:8%;right:8%;top:25%;bottom:25%;z-index:1;
        border:1px dashed rgba(255,255,255,.35);border-radius:10px;
        animation:azReticle 2.2s ease-in-out infinite}
    @keyframes azReticle{0%,100%{border-color:rgba(255,255,255,.35)}50%{border-color:rgba(230,57,70,.8)}}
    /* flash hijau saat barcode berhasil terbaca */
    #az_cam_view.az_success::after{content:'';position:absolute;inset:0;z-index:3;
        background:rgba(42,157,63,.45);animation:azSuccess .5s ease}
    #az_cam_view.az_success #az_laser{animation:none;top:50%;background:#2a9d3f;
        box-shadow:0 0 16px 4px rgba(42,157,63,.8)}
    @keyframes azSuccess{from{opacity:0}to{opacity:1}}
    /* ===== RESPONSIF MOBILE ===== */
    @media (max-width:600px){
        /* 100dvh = tinggi viewport real di HP (tidak kepotong toolbar browser) */
        #az_modal{width:100vw;max-width:100vw;height:100vh;height:100dvh;
            max-height:100vh;max-height:100dvh;border-radius:0}
        #az_body{padding:12px}
        /* baris barcode+outlet jadi vertikal */
        .az_row[style*="display:flex"]{flex-direction:column;gap:12px !important}
        /* input 16px supaya HP tidak auto-zoom saat fokus */
        .az_row input[type=text],.az_row select{font-size:16px !important;padding:10px}
        #az_btn_barcode{width:46px}
        /* tombol scan besar & mudah disentuh */
        #az_scan{padding:12px;font-size:15px}
        /* tabel lebih rapat di layar kecil */
        #az_tbl{font-size:11px}
        #az_tbl td,#az_tbl th{padding:5px 4px}
        .az_trx_tbl,.az_jenis_tbl{font-size:10px}
        .az_chip{font-size:10px;padding:4px 8px}
        /* tombol Analisa utama lebih kecil di HP */
        #az_btn{padding:7px 12px;font-size:12px;margin-left:6px}
        /* kamera: tetap kotak berbingkai di HP (tidak full layar) */
        #az_cam_box{width:92vw;max-width:92vw}
        #az_cam_view{display:flex;flex-direction:column}
        #az_cam_video{aspect-ratio:3/4}
    }
    /* desktop lebar: modal sedikit lebih lega */
    @media (min-width:900px){
        #az_modal{width:640px}
    }`,N=document.createElement("style");N.textContent=X,document.head.appendChild(N);const D=document.createElement("div");D.innerHTML=`
    <div id="az_overlay">
      <div id="az_modal">
        <div id="az_head"><span>📊 Analisa Stok</span><button id="az_close">✕</button></div>
        <div id="az_body">
          <div class="az_row" style="display:flex;gap:10px">
            <div style="flex:1.4;min-width:0">
              <label>Barcode</label>
              <div id="az_barcode_wrap">
                <input type="text" id="az_barcode" placeholder="Pilih outlet dulu" autocomplete="off" inputmode="numeric" disabled>
                <button type="button" id="az_btn_barcode" title="Scan barcode dengan kamera" disabled>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
                    <line x1="7" y1="8" x2="7" y2="16"/><line x1="10.5" y1="8" x2="10.5" y2="16"/>
                    <line x1="13.5" y1="8" x2="13.5" y2="16"/><line x1="17" y1="8" x2="17" y2="16"/>
                  </svg>
                </button>
              </div>
            </div>
            <div style="flex:1;min-width:0">
              <label>Outlet (pilih dulu)</label>
              <div style="display:flex;gap:6px;align-items:center">
                <select id="az_outlet" style="flex:1;min-width:0"><option value="">-- Pilih outlet --</option><option value="all" selected>Semua outlet</option></select>
                <div style="display:flex;flex-direction:column;align-items:center;gap:1px;flex:0 0 auto">
                  <div id="az_toggle_minus" class="az_switch" title="Aktif = hanya stok < 0, Nonaktif = semua stok">
                    <div class="az_knob"></div>
                  </div>
                  <span style="font-size:9px;color:#888;white-space:nowrap">Stok &lt; 0</span>
                </div>
              </div>
            </div>
          </div>
          <div id="az_langkah">Pilih outlet dulu. Barcode & tombol CARI aktif setelah outlet dipilih.</div>
          <!-- Tombol cari full width -->
          <div class="az_row" style="margin-bottom:0">
            <button type="button" id="az_scan" disabled>🔍 CARI</button>
          </div>
          <!-- Nilai internal perkiraan jumlah (hidden) -->
          <input type="hidden" id="az_cmp" value="">
          <input type="hidden" id="az_jml" value="">
          <div id="az_hasil"></div>
          <div id="az_analisa"></div>
        </div>
      </div>
    </div>
    <div id="az_cam_overlay">
      <div id="az_cam_box">
        <div id="az_cam_head"><span>📷 Scan Barcode</span><button id="az_cam_close">✕</button></div>
        <div id="az_cam_view">
          <video id="az_cam_video" playsinline muted></video>
          <div class="az_corner tl"></div><div class="az_corner tr"></div>
          <div class="az_corner bl"></div><div class="az_corner br"></div>
          <div id="az_reticle"></div>
          <div id="az_laser"></div>
        </div>
        <div id="az_cam_status">Arahkan kamera ke barcode...</div>
      </div>
    </div>`,document.body.appendChild(D);const m=document.createElement("button");m.id="az_btn",m.textContent="📊 Analisa";const R=Array.from(document.querySelectorAll("h1")).find(t=>t.textContent.includes("Lihat Stok")),y=R?R.parentElement:null;y?(y.style.display="flex",y.style.alignItems="center",y.appendChild(m)):(m.style.cssText="position:fixed;right:16px;bottom:16px;z-index:99999",document.body.appendChild(m));const x=[],_={},U={},C=$("#az_outlet");function I(){$(".checkbox_list_outlets").each(function(){const t=$(this),a=String(t.attr("id")||"").match(/outlet_list_(\d+)/),e=a?a[1]:t.val()||"";if(!e)return;let i="";const o=this.nextElementSibling;o&&o.tagName==="SPAN"&&(i=o.innerText.trim()),!i&&t.attr("id")&&(i=$('label[for="'+t.attr("id")+'"]').text().trim()),i=i.replace(/\s+/g," ").trim(),!(!i||_[e]!==void 0)&&(x.push([e,i]),_[e]=i,U[i]=e,C.append($("<option>").val(e).text(i)))}),console.log("[AnalisaStok] outlet dari sidebar:",x.length,x)}I(),x.length===0&&setTimeout(I,1500);const B=()=>!!$("#az_outlet").val();function T(){const t=B();$("#az_barcode").prop("disabled",!t).attr("placeholder",t?"Scan / ketik barcode lalu Enter":"Pilih outlet dulu"),$("#az_btn_barcode").prop("disabled",!t),$("#az_scan").prop("disabled",!t),$("#az_outlet").toggleClass("az_belum",!t);const a=$("#az_outlet").val();$("#az_langkah").text(t?"Outlet: "+(a==="all"?"Semua outlet":_[a]||a)+" → Langkah 2: scan / ketik barcode lalu Enter.":"Pilih outlet dulu. Barcode & tombol CARI aktif setelah outlet dipilih.")}T();function Z(t){if(!t||C.find("option").filter(function(){return $(this).text().trim()===t}).length>0)return;const e=U[t];C.append($("<option>").val(e!==void 0?e:t).text(t))}let A="",b=null,tt="";$("#az_btn").on("click",function(){$("#az_overlay").addClass("az_open"),$("#az_hasil").html(""),x.length===0&&I(),T(),B()?$("#az_barcode").trigger("focus"):$("#az_outlet").trigger("focus")}),$("#az_close").on("click",G),$("#az_overlay").on("click",function(t){t.target===this&&G()});function G(){$("#az_overlay").removeClass("az_open")}$("#az_barcode").on("keydown",function(t){t.key==="Enter"&&M()}),$("#az_scan").on("click",M),$("#az_toggle_minus").on("click",function(){$(this).toggleClass("on");const t=$(this).hasClass("on");$("#az_cmp").val(t?"<":""),$("#az_jml").val(t?"0":"")});let z=null,S=!1;function at(){try{const t=new(window.AudioContext||window.webkitAudioContext),a=t.createOscillator(),e=t.createGain();a.connect(e),e.connect(t.destination),a.type="sine",a.frequency.setValueAtTime(880,t.currentTime),a.frequency.setValueAtTime(1318,t.currentTime+.09),e.gain.setValueAtTime(.3,t.currentTime),e.gain.exponentialRampToValueAtTime(.001,t.currentTime+.28),a.start(),a.stop(t.currentTime+.3),a.onended=()=>t.close()}catch{}}function q(){S=!1,z&&(z.getTracks().forEach(a=>a.stop()),z=null);const t=document.getElementById("az_cam_overlay");t&&(t.style.display="none")}async function et(){const t=document.getElementById("az_cam_overlay"),a=document.getElementById("az_cam_video"),e=document.getElementById("az_cam_status");if(t.style.display="flex",!("BarcodeDetector"in window)){e.textContent="⚠️ Browser tidak support scan kamera. Ketik manual atau pakai scanner USB/Bluetooth.";return}if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){e.textContent="⚠️ Kamera tidak tersedia di browser ini.";return}e.textContent="Membuka kamera...";try{z=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:!1}),a.srcObject=z,await a.play(),e.textContent="Arahkan kamera ke barcode...";const i=new BarcodeDetector({formats:["ean_13","ean_8","code_128","code_39","upc_a","upc_e","qr_code","codabar","itf"]});S=!0;const o=async()=>{if(S){try{const r=await i.detect(a);if(r&&r.length>0){const d=r[0].rawValue;S=!1,at();const n=document.getElementById("az_cam_view");n&&n.classList.add("az_success"),e.textContent="✅ Barcode terbaca: "+d,setTimeout(()=>{q(),n&&n.classList.remove("az_success"),$("#az_barcode").val(d),M()},650);return}}catch{}setTimeout(o,250)}};o()}catch(i){e.textContent="⚠️ Kamera gagal dibuka: "+(i.message||i.name)+". Pastikan izin kamera diberikan."}}document.getElementById("az_btn_barcode").addEventListener("click",et),document.getElementById("az_cam_close").addEventListener("click",q),document.getElementById("az_cam_overlay").addEventListener("click",function(t){t.target===this&&q()});function M(){const t=$("#az_barcode").val().trim(),a=$("#az_outlet").val(),e=$("#az_cmp").val(),i=$("#az_jml").val().trim();if(!B()){T(),$("#az_outlet").trigger("focus");return}if(!t){alert("Isi barcode dulu.");return}A=t,tt="",$("#az_hasil").html('<div id="az_info">⏳ Mencari data...</div>'),$("#az_analisa").html(""),$("#az_scan").prop("disabled",!0).show(),clearTimeout(b),$("#pencarian_sn").val(""),$("#pencarian_tmp_no_batch").val(""),$("#pencarian_idproduk_kategori").val(""),$("#produk_kategori_nama").val(""),$("#pencarian_idproduk_sub_kategori").val(""),$("#produk_sub_kategori_nama").val(""),$("#pencarian_idproduk_merek").val(""),$("#produk_merek_nama").val(""),$("#pencarian_idwarna").val(""),$("#warna_nama").val(""),$("#pencarian_idproduk_ukuran").val(""),$("#produk_ukuran_nama").val(""),$("#pencarian_idproduk_satuan").val(""),$("#produk_satuan_nama").val(""),$("#pencarian_idsupplier").val(""),$("#pencarian_idoutlet").val(""),$("#pencarian_nama_supplier").val(""),$("#pencarian_umur_produk").val(""),$("#pencarian_perbandingan_umur_produk").val(""),$("#pencarian_nama").val(t),$("#pencarian_perbandingan_jumlah").val(e),$("#pencarian_jumlah").val(i);const o=a&&a!=="all"&&_[a]!==void 0?a:"";$("#pencarian_idgudang").val(""),$(".checkbox_list_outlets").prop("checked",!o),o&&$("#outlet_list_"+o).prop("checked",!0),$("#pencarian_idoutlet").val(o||"").trigger("change"),setTimeout(function(){$("#cari").click(),b=setTimeout(j,3e3)},200)}$(document).ajaxComplete(function(t,a,e){e.url&&e.url.indexOf("/produk_gudangs/lihat_stok/new")!==-1&&j(),e.url&&e.url.indexOf("/produk_gudangs/aktifitas_stok/new")!==-1&&setTimeout(ct,500)}),$(document).on("ajax:success","#form_pencarian_lihat_stok",function(){clearTimeout(b),b=setTimeout(j,300)});function J(){let t=$("#data_table_produk tbody tr");return/^\d+$/.test(A)&&(t=t.filter(function(){return $(this).find("td").eq(1).text().trim()===A})),t}function j(){$("#az_scan").prop("disabled",!1),clearTimeout(b);const t=J();if($("#data_table_produk tbody tr").length===0){b=setTimeout(j,800);return}let a=`<div id="az_info">Menampilkan <b>${t.length}</b> data</div>`;if(t.length===0){a+='<div id="az_info" style="color:#e63946">❌ Data tidak ditemukan.</div>',$("#az_hasil").html(a);return}a+=`<div style="overflow:auto;max-height:35vh;border:1px solid #ddd;border-radius:8px">
        <table id="az_tbl">
          <thead><tr>
            <th>Barcode</th><th>Nama</th><th>Harga Jual</th><th style="text-align:center">Total Stok</th><th>Umur</th><th>Merek</th>
          </tr></thead><tbody>`,t.each(function(){const i=$(this).find("td"),o=i.eq(1).text().trim(),r=i.eq(2).text().trim(),d=i.eq(3).clone().children("br").remove().end().text().trim().replace(/\s+/g," "),n=i.eq(4).text().trim(),s=i.eq(6).text().trim(),l=i.eq(7).text().trim(),f=parseFloat(n)<0?"az-minus":"az-plus",c=$(this).find("td.bt_dialog_aktifitas_stok"),p=c.data("prd")||"",u=c.data("otl")||"";a+=`<tr data-prd="${p}" data-otl="${u}">
                <td>${o}</td>
                <td class="az-nama">${r}</td>
                <td class="az-harga">${d}</td>
                <td class="az-stok-cell ${f}"><span class="az-stok-link" data-barcode="${o}">${n}</span></td>
                <td>${s}</td>
                <td>${l}</td>
            </tr>`}),a+="</tbody></table></div>",$("#az_hasil").html(a),$("#az_scan").hide(),nt();const e=$("#az_outlet").val();e&&e!=="all"?Q(_[e]||e):$("#az_analisa").html('<div class="az_analisa_box"><h4 style="color:#888;font-weight:normal">Mode semua outlet: pilih satu outlet di atas untuk analisa aktifitas gudang.</h4></div>')}const P={},it=15;function ot(t){const a=String(t||"").match(/-?[\d.,]+/);return a?parseFloat(a[0].replace(/\./g,"").replace(",",".")):NaN}async function K(t,a){const e=t+"|"+a;if(P[e])return P[e];const i=await $.ajax({url:"/produk_gudangs/detail_stok/new",dataType:"text",data:{idproduk:t,idgudang:"",idoutlet:a}}),o=$("<div>").html(i),r=[];let d="",n="";return o.find("label, a.bt_detail_stok_aktifitas").each(function(){const s=$(this);if(this.tagName==="LABEL"){const f=s.text().trim();/bold/i.test(s.attr("style")||"")||s.css("font-weight")==="bold"||s.css("font-weight")==="700"?(d=f,Z(d)):n=f;return}const l=s.data();r.push({id:l.gdn,nama:n||l.gudangNama||s.attr("data-gudang-nama")||"",outlet:d,stok:ot(s.text())}),n=""}),P[e]=r,r}function pt(t){if(!t.length)return'<span class="az-muted">(gudang tunggal)</span>';const a=$("#az_outlet").val(),e=!a||a==="all"?"":_[a]||a;if(e&&(t=t.filter(n=>n.outlet===e)),!t.length)return`<span class="az-muted">tidak ada gudang di ${e}</span>`;const i=e?t:t.filter(n=>!isNaN(n.stok)&&n.stok!==0);if(!i.length)return`<span class="az-muted">stok 0 di semua gudang (${t.length})</span>`;let o="",r=null;i.forEach(n=>{n.outlet!==r&&(o+=`<div class="az-outlet">${n.outlet||"-"}</div>`,r=n.outlet);const s=n.stok<0?"az-minus":"";o+=`<div class="az-gdn">${n.nama||n.id||"?"}: <b class="${s}">${n.stok}</b></div>`});const d=t.length-i.length;return d>0&&(o+=`<div class="az-muted">+${d} gudang stok 0</div>`),o}async function nt(){const t=$("#az_tbl tbody tr").toArray();for(let a=0;a<t.length&&!(a>=it);a++){const e=$(t[a]),i=e.data("prd"),o=e.data("otl");if(i){if(!e.closest("body").length)return;try{await K(i,o)}catch{}await w(150)}}}let L=!1;$(document).on("click",".az-stok-link",function(){const t=$(this).data("barcode"),a=$("#data_table_produk tbody tr").filter(function(){return $(this).find("td").eq(1).text().trim()===String(t)}).first().find("td.bt_dialog_aktifitas_stok");if(a.length===0){alert("Baris produk tidak ditemukan di tabel utama.");return}L=!0,$("#az_overlay").hide(),a.trigger("click")}),setInterval(function(){if(!L)return;const t=$("#div_pop_up_detail_stok").is(":hidden"),a=!$("#dialog_form_aktifitas_stok").is(":visible");t&&a&&(L=!1,$("#az_overlay").show())},500);function rt(t){const a=[];let e=t;for(;e&&e!==document.body;){const i=window.getComputedStyle(e);(i.overflowY==="auto"||i.overflowY==="scroll")&&e.scrollHeight>e.clientHeight&&a.push(e),e=e.parentElement}return a}async function dt(t,a){const e=t.get(0);if(!e)return;const i=rt(e);i.length===0&&i.push(e);const o=i.map(n=>n.scrollTop);let r=-1,d=0;for(let n=0;n<40;n++){const s=t.find("table tbody tr").length;if(s===r){if(d++,d>=4)break}else d=0,a&&(a.textContent="⏳ Memuat aktifitas... ("+s+" baris)");r=s,i.forEach(l=>{l.scrollTop=l.scrollHeight,l.dispatchEvent(new Event("scroll",{bubbles:!0}))}),await w(700)}i.forEach((n,s)=>{n.scrollTop=o[s]})}function st(t){return t.find("table tbody tr").filter(function(){const a=$(this);return a.attr("id")==="new_tr_tabel_aktifitas_produk"?!1:a.find("td").length>=7&&a.find(".dataTables_empty").length===0})}async function lt(t,a,e){const i=$("<table>").append($("<tbody>")),o=i.find("tbody");let r=1,d="",n="";for(let s=0;s<30;s++){let l;r===1?l=await $.ajax({url:"/produk_gudangs/aktifitas_stok/new",method:"GET",dataType:"text",data:{idproduk:t,idgudang:a,idoutlet:e,idproduk_harga:"",hide_stok_awal_stok_akhir:$("#hide_stok_awal_stok_akhir").val()||"false"}}):l=await $.ajax({url:"/produk_gudangs/aktifitas_stok/new",method:"POST",dataType:"text",data:{idproduk:t,idgudang:a,idproduk_harga:"",page:r,idproduk_harga_last:d,kode_transaksi_last:n,hide_stok_awal_stok_akhir:$("#hide_stok_awal_stok_akhir").val()||"false"}});const f=$("<div>").html(l),c=st(f);if(c.length===0)break;c.each(function(){o.append(this)});const p=c.last(),u=p.find("td").eq(1).text().trim(),h=p.find("td.for_debug"),k=h.length?h.text().trim():"";if(r>1&&u===n&&k===d)break;n=u,d=k,r++,await w(150)}return V(i)}function V(t){const a=t.find("table tbody tr").filter(function(){return $(this).find("td").length>=7&&$(this).find(".dataTables_empty").length===0});if(a.length===0)return null;let e=0,i=0,o=0,r=0,d=0;const n={},s=[];a.each(function(){const c=$(this).find("td"),p=c.eq(0).text().trim(),u=c.eq(1).text().trim(),h=c.eq(2).text().trim(),k=c.eq(4).text().trim(),Y=c.eq(6).text().trim(),O=c.eq(7).length?c.eq(7).text().trim():"",W=Y.split(/\s+/)[0]||"",g=W?h+" - "+W:h,E=k.match(/([+-])\s*([\d.,]+)/),v=E?parseFloat(E[2].replace(",",".")):0,H=E?E[1]==="-":!1;e++,H?i+=v:o+=v,n[g]||(n[g]={count:0,qty:0,operators:{}}),n[g].count++,n[g].qty+=H?-v:v,O&&(n[g].operators[O]=!0),/^penjualan$/i.test(h)&&(r++,d+=v),s.push({tanggal:p,kode:u,jenis:g,jmlText:k,keterangan:Y,operator:O,isKeluar:H})});const l=a.first().find("td").eq(5).text().trim();let f="";return t.find("label").each(function(){if(/Jumlah Total pada Gudang/i.test($(this).text())){const c=$(this).nextAll("label").first();return c.length&&(f=c.text().trim()),!1}}),{totalTrx:e,totalKeluar:i,totalMasuk:o,jualCount:r,jualQty:d,perJenis:n,listTrx:s,stokAkhir:l,totalGudang:f}}function F(t,a,e,i){let o=`<div class="az_analisa_box">
            <h4>📈 ${e} — ${a}</h4>`;return i&&(o=`<div class="az_analisa_box">
            <h4>📈 ${e} — ${i}<br><span style="font-weight:400;font-size:11px">${a}</span></h4>`),o+=`<div class="az_chips">
            <span class="az_chip">Transaksi: <b>${t.totalTrx}</b></span>
            <span class="az_chip az_chip_red">Keluar: <b>-${t.totalKeluar}</b></span>
            <span class="az_chip az_chip_green">Masuk: <b>+${t.totalMasuk}</b></span>
            <span class="az_chip">Stok Akhir: <b>${t.stokAkhir}</b></span>
            ${t.totalGudang?`<span class="az_chip">Total di Gudang: <b>${t.totalGudang}</b></span>`:""}
            <span class="az_chip">Penjualan: <b>${t.jualCount}x</b> (${t.jualQty} pcs)</span>
        </div>`,o+=`<div class="az_jenis_wrap"><table class="az_jenis_tbl">
            <thead><tr><th>Jenis</th><th style="width:44px;text-align:center">Jml Trx</th><th style="width:56px;text-align:right">Total Qty</th><th>Operator</th></tr></thead>
            <tbody>`,Object.keys(t.perJenis).forEach(r=>{const d=t.perJenis[r].qty,n=d<0?"az_out":d>0?"az_in":"",s=(d>0?"+":"")+d,l=Object.keys(t.perJenis[r].operators||{}).join(", ");o+=`<tr><td>${r}</td><td style="text-align:center">${t.perJenis[r].count}</td><td style="text-align:right" class="${n}">${s}</td><td>${l}</td></tr>`}),o+="</tbody></table></div>",o+=`<div class="az_trx_wrap"><table class="az_trx_tbl">
            <thead><tr><th style="width:60px">Tanggal</th><th style="width:50px">Kode</th><th>Jenis</th><th style="width:42px">Jml</th><th>Keterangan</th><th style="width:78px">Operator</th></tr></thead>
            <tbody>`,t.listTrx.forEach(r=>{const d=r.isKeluar?"az_out":"az_in";o+=`<tr>
                <td style="white-space:nowrap">${r.tanggal}</td>
                <td>${r.kode}</td>
                <td>${r.jenis}</td>
                <td class="${d}">${r.jmlText}</td>
                <td>${r.keterangan}</td>
                <td>${r.operator}</td>
            </tr>`}),o+="</tbody></table></div></div>",o}async function ct(){const t=$("#target_aktifitas_aktifitas_stok");if(t.length===0)return;await dt(t);const a=V(t);if(!a)return;const e=($("#gudang_aktifitas").text()||"").trim(),i=($("#barcode_produk_aktifitas").text()||"").trim(),o=($("#nama_produk_aktifitas").text()||"").trim();$("#az_analisa").html(F(a,e,i,o))}async function Q(t){const a=J();if(a.length===0)return;$("#az_analisa").html('<div class="az_analisa_box"><h4>⏳ Menganalisa aktifitas gudang...</h4></div>');const e=a.slice(0,3).toArray(),i=[];for(const o of e){const r=$(o),d=r.find("td"),n=d.eq(1).text().trim(),s=d.eq(2).text().trim(),l=r.find("td.bt_dialog_aktifitas_stok"),f=l.data("prd"),c=l.data("otl");try{let p=(await K(f,c)).slice();if(p.length===0&&p.push({id:l.data("gdn")||"",nama:"(gudang tunggal)"}),t&&(p=p.filter(u=>u.outlet===t),p.length===0))continue;for(const u of p){try{const h=await lt(f,u.id,c);h&&i.push(F(h,(u.outlet?u.outlet+" › ":"")+(u.nama||u.id),n,s))}catch{}await w(400)}}catch(p){console.log("autoAnalisa error:",p)}}if(i.length>0)$("#az_analisa").html(i.join(""));else{const o=t?"Tidak ada data aktifitas untuk outlet <b>"+t+"</b>.":"Tidak ada data aktifitas.";$("#az_analisa").html('<div class="az_analisa_box"><h4>ℹ️ '+o+"</h4></div>")}}$("#az_outlet").on("change",function(){const t=$(this).val();if(T(),!t){$("#az_analisa").html("");return}setTimeout(()=>$("#az_barcode").trigger("focus"),30),A&&$("#az_tbl").length&&(t==="all"?$("#az_analisa").html('<div class="az_analisa_box"><h4 style="color:#888;font-weight:normal">Mode semua outlet: pilih satu outlet di atas untuk analisa aktifitas gudang.</h4></div>'):Q(_[t]||t))})})();
