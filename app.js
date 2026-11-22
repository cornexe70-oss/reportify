(() => {
  const cfg = window.REPORTIFY_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("PASTE_") && !cfg.SUPABASE_ANON_KEY.includes("PASTE_");
  const supabase = configured && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  let activeOrderId = null;
  let currentAdmin = null;
  let cachedOrders = [];
  const toast = msg => { const el=$("#toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2800); };
  const escapeHtml = (v="") => String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const formatDate = value => new Date(value).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"});
  const setMessage=(id,msg,isError=false)=>{const el=$(id);el.textContent=msg;el.style.color=isError?"#b64d4d":"#26865f";};

  $("#year").textContent=new Date().getFullYear();
  $("#menuToggle").addEventListener("click",()=>{const nav=$("#mainNav");const open=nav.classList.toggle("open");$("#menuToggle").setAttribute("aria-expanded",String(open));});
  $$("#mainNav a").forEach(a=>a.addEventListener("click",()=>$("#mainNav").classList.remove("open")));

  const orderModal=$("#orderModal"), loginModal=$("#loginModal"), adminPanel=$("#adminPanel"), detailModal=$("#detailModal");
  function showModal(el){el.classList.add("show");el.setAttribute("aria-hidden","false");document.body.style.overflow="hidden";}
  function hideModal(el){el.classList.remove("show");el.setAttribute("aria-hidden","true");document.body.style.overflow="";}
  const openOrder=plan=>{if(plan)$("#planSelect").value=plan;showModal(orderModal);};
  $$("[data-open-order]").forEach(b=>b.addEventListener("click",()=>openOrder()));
  $$("[data-plan]").forEach(b=>b.addEventListener("click",()=>openOrder(b.dataset.plan)));
  $$("[data-close-order]").forEach(b=>b.addEventListener("click",()=>hideModal(orderModal)));
  orderModal.addEventListener("click",e=>{if(e.target===orderModal)hideModal(orderModal);});
  $("#closeLogin").addEventListener("click",()=>hideModal(loginModal));

  $("#orderForm").addEventListener("submit",async e=>{
    e.preventDefault();
    if(!supabase){setMessage("#formMessage","Sistem belum dikonfigurasi. Admin perlu mengisi URL dan anon key Supabase di config.js.",true);return;}
    const button=e.submitter;button.disabled=true;button.textContent="Mengirim...";
    const d=Object.fromEntries(new FormData(e.currentTarget).entries());
    const payload={customer_name:d.name,phone:d.phone,school:d.school,major:d.major||null,package_name:d.plan,notes:d.notes,status:"Baru"};
    const {error}=await supabase.from("orders").insert(payload);
    button.disabled=false;button.innerHTML='Kirim permintaan <span>↗</span>';
    if(error){setMessage("#formMessage","Belum berhasil mengirim. Periksa koneksi atau konfigurasi database, lalu coba lagi.",true);console.error(error);return;}
    e.currentTarget.reset();$("#planSelect").value="Belum tahu";hideModal(orderModal);toast("Permintaan berhasil dikirim ke REPORTIFY.");
  });

  async function openAdmin(){
    if(!supabase){showModal(loginModal);setMessage("#loginMessage","Hubungkan project Supabase terlebih dahulu dengan mengisi config.js.",true);return;}
    const {data:{session}}=await supabase.auth.getSession();
    if(session){const ok=await verifyAdmin(session.user);if(ok){showModal(adminPanel);await renderAdmin();return;}}
    showModal(loginModal);
  }
  $("#adminLink").addEventListener("click",openAdmin);
  $("#loginForm").addEventListener("submit",async e=>{
    e.preventDefault();
    if(!supabase){setMessage("#loginMessage","Supabase belum dikonfigurasi.",true);return;}
    const b=e.submitter;b.disabled=true;b.textContent="Memeriksa...";
    const fd=new FormData(e.currentTarget);
    const {data,error}=await supabase.auth.signInWithPassword({email:fd.get("email"),password:fd.get("password")});
    b.disabled=false;b.innerHTML='Login <span>↗</span>';
    if(error){setMessage("#loginMessage","Login gagal. Periksa email dan password.",true);return;}
    const ok=await verifyAdmin(data.user);
    if(!ok){await supabase.auth.signOut();setMessage("#loginMessage","Akun ini belum diberi akses admin.",true);return;}
    hideModal(loginModal);showModal(adminPanel);await renderAdmin();
  });
  async function verifyAdmin(user){
    const {data,error}=await supabase.from("admin_users").select("user_id").eq("user_id",user.id).maybeSingle();
    if(error||!data)return false;currentAdmin=user;return true;
  }
  $("#closeAdmin").addEventListener("click",async()=>{hideModal(adminPanel);if(supabase)await supabase.auth.signOut();currentAdmin=null;});
  async function fetchOrders(){
    const {data,error}=await supabase.from("orders").select("*").order("created_at",{ascending:false});
    if(error){toast("Gagal memuat pesanan. Periksa izin database.");console.error(error);return [];}
    cachedOrders=data||[];return cachedOrders;
  }
  async function renderAdmin(){
    if(!currentAdmin)return;
    const orders=await fetchOrders(),counts={Baru:0,Diproses:0,Selesai:0,Dibatalkan:0};
    orders.forEach(o=>counts[o.status]=(counts[o.status]||0)+1);
    $("#statTotal").textContent=orders.length;$("#statNew").textContent=counts.Baru;$("#statProgress").textContent=counts.Diproses;$("#statDone").textContent=counts.Selesai;
    const q=$("#searchOrders").value.toLowerCase(),filter=$("#filterStatus").value;
    const filtered=orders.filter(o=>(!filter||o.status===filter)&&[o.customer_name,o.school,o.phone,o.id].join(" ").toLowerCase().includes(q));
    $("#ordersBody").innerHTML=filtered.map(o=>`<tr><td><strong>${escapeHtml(o.customer_name)}</strong><small>${escapeHtml(o.school)} · ${escapeHtml(o.id.slice(0,8))}</small></td><td>${escapeHtml(o.package_name)}</td><td>${formatDate(o.created_at)}</td><td><span class="status status-${o.status.toLowerCase()}">${escapeHtml(o.status)}</span></td><td><button class="table-action" data-detail="${o.id}">Detail ↗</button></td></tr>`).join("");
    $("#emptyOrders").style.display=filtered.length?"none":"block";
    $$("[data-detail]").forEach(b=>b.addEventListener("click",()=>showDetail(b.dataset.detail)));
  }
  $("#searchOrders").addEventListener("input",()=>{if(currentAdmin)renderAdmin();});
  $("#filterStatus").addEventListener("change",()=>{if(currentAdmin)renderAdmin();});
  function showDetail(id){
    const o=cachedOrders.find(x=>x.id===id);if(!o)return;activeOrderId=id;$("#detailName").textContent=o.customer_name;
    const fields=[["ID Pesanan",o.id],["Nomor WhatsApp",o.phone],["Sekolah",o.school],["Jurusan",o.major||"-"],["Paket",o.package_name],["Tanggal",formatDate(o.created_at)],["Kebutuhan / progres",o.notes,true]];
    $("#detailContent").innerHTML=fields.map(([label,val,wide])=>`<div class="detail-item ${wide?"wide":""}"><span>${label}</span><b>${escapeHtml(val)}</b></div>`).join("");
    $("#detailStatus").value=o.status;showModal(detailModal);
  }
  $("#closeDetail").addEventListener("click",()=>hideModal(detailModal));
  detailModal.addEventListener("click",e=>{if(e.target===detailModal)hideModal(detailModal);});
  $("#saveStatus").addEventListener("click",async()=>{
    if(!activeOrderId||!currentAdmin)return;
    const status=$("#detailStatus").value;
    const {error}=await supabase.from("orders").update({status}).eq("id",activeOrderId);
    if(error){toast("Status gagal diperbarui.");console.error(error);return;}
    hideModal(detailModal);await renderAdmin();toast("Status pesanan diperbarui.");
  });
  $("#exportCsv").addEventListener("click",()=>{
    if(!cachedOrders.length){toast("Belum ada data untuk diekspor.");return;}
    const cols=["id","customer_name","phone","school","major","package_name","notes","status","created_at"];
    const csv=[cols.join(","),...cachedOrders.map(o=>cols.map(k=>`"${String(o[k]??"").replace(/"/g,'""')}"`).join(","))].join("\n");
    const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="reportify-pesanan.csv";a.click();URL.revokeObjectURL(url);
  });
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){[orderModal,loginModal,detailModal,adminPanel].forEach(hideModal);}});
  if(supabase){supabase.auth.onAuthStateChange((_event,session)=>{if(!session)currentAdmin=null;});}
})();
