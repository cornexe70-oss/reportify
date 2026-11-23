(() => {
  const cfg = window.REPORTIFY_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("PASTE_") &&
    !cfg.SUPABASE_ANON_KEY.includes("PASTE_");

  const supabase = configured && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  let activeOrderId = null;
  let currentAdmin = null;
  let cachedOrders = [];

  const WHATSAPP_NUMBER = "6285846805011";

  const PACKAGES = {
    STARTER: "STARTER — 15 halaman — Rp30.000",
    BASIC: "BASIC — 20 halaman — Rp38.000",
    PRO: "PRO — 25 halaman — Rp45.000",
    ULTIMATE: "ULTIMATE — 30 halaman — Rp51.000"
  };

  const toast = msg => {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2800);
  };

  const escapeHtml = (v = "") =>
    String(v).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));

  const formatDate = value =>
    new Date(value).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

  const setMessage = (id, msg, isError = false) => {
    const el = $(id);
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? "#b64d4d" : "#26865f";
  };

  // Tahun footer
  if ($("#year")) {
    $("#year").textContent = new Date().getFullYear();
  }

  // Menu mobile
  if ($("#menuToggle")) {
    $("#menuToggle").addEventListener("click", () => {
      const nav = $("#mainNav");
      const open = nav.classList.toggle("open");
      $("#menuToggle").setAttribute("aria-expanded", String(open));
    });
  }

  $$("#mainNav a").forEach(a => {
    a.addEventListener("click", () => {
      $("#mainNav").classList.remove("open");
    });
  });

  // Modal
  const orderModal = $("#orderModal");
  const loginModal = $("#loginModal");
  const adminPanel = $("#adminPanel");
  const detailModal = $("#detailModal");

  function showModal(el) {
    if (!el) return;
    el.classList.add("show");
    el.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function hideModal(el) {
    if (!el) return;
    el.classList.remove("show");
    el.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // Memilih paket dari kartu harga
  const openOrder = plan => {
    if (plan && PACKAGES[plan]) {
      $("#planSelect").value = PACKAGES[plan];
    }
    showModal(orderModal);
  };

  $$("[data-open-order]").forEach(b => {
    b.addEventListener("click", () => openOrder());
  });

  $$("[data-plan]").forEach(b => {
    b.addEventListener("click", () => openOrder(b.dataset.plan));
  });

  $$("[data-close-order]").forEach(b => {
    b.addEventListener("click", () => hideModal(orderModal));
  });

  orderModal?.addEventListener("click", e => {
    if (e.target === orderModal) hideModal(orderModal);
  });

  $("#closeLogin")?.addEventListener("click", () => {
    hideModal(loginModal);
  });

  // FORM PESANAN
  $("#orderForm").addEventListener("submit", async e => {
    e.preventDefault();

    if (!supabase) {
      setMessage(
        "#formMessage",
        "Sistem belum terhubung ke Supabase. Periksa config.js.",
        true
      );
      return;
    }

    const form = e.currentTarget;
    const button = e.submitter;

    if (!button) return;

    button.disabled = true;
    button.textContent = "Mengirim...";

    try {
      const fd = new FormData(form);

      const name = fd.get("name")?.toString().trim() || "";
      const school = fd.get("school")?.toString().trim() || "";
      const major = fd.get("major")?.toString().trim() || "";
      const plan = fd.get("plan")?.toString() || "Tidak memilih paket utama";
      const notes = fd.get("notes")?.toString().trim() || "";

      // Checkbox layanan tambahan
      const services = fd.getAll("services").map(v => v.toString());

      // Simpan paket dan layanan tambahan dalam kolom yang sudah tersedia
      const packageAndServices = [
        plan,
        services.length
          ? "Layanan tambahan: " + services.join(", ")
          : ""
      ].filter(Boolean).join(" | ");

      const payload = {
        customer_name: name,
        phone: "",
        school: school,
        major: major || null,
        package_name: packageAndServices,
        notes: notes,
        status: "Baru"
      };

      // Simpan ke Supabase
      const { error } = await supabase
        .from("orders")
        .insert(payload);

      if (error) {
        console.error(error);
        setMessage(
          "#formMessage",
          "Pesanan belum berhasil disimpan. Coba lagi beberapa saat.",
          true
        );
        return;
      }

      // Susun pesan WhatsApp
      const message = [
        "Halo REPORTIFY! Saya ingin konsultasi pesanan.",
        "",
        "*DATA PEMESAN*",
        "Nama: " + name,
        "Sekolah: " + school,
        "Jurusan: " + (major || "-"),
        "",
        "*PAKET UTAMA*",
        plan,
        "",
        "*LAYANAN TAMBAHAN*",
        services.length ? services.map(s => "• " + s).join("\n") : "Tidak memilih layanan tambahan",
        "",
        "*KEBUTUHAN / PROGRES*",
        notes,
        "",
        "Mohon informasi langkah selanjutnya dan rincian biaya. Terima kasih!"
      ].join("\n");

      const whatsappURL =
        "https://wa.me/" +
        WHATSAPP_NUMBER +
        "?text=" +
        encodeURIComponent(message);

      form.reset();

      $("#planSelect").value = "Tidak memilih paket utama";

      setMessage(
        "#formMessage",
        "Pesanan berhasil disimpan! Mengarahkan ke WhatsApp..."
      );

      // Arahkan pelanggan ke WhatsApp REPORTIFY
      window.location.href = whatsappURL;

    } catch (error) {
      console.error(error);
      setMessage(
        "#formMessage",
        "Terjadi kesalahan. Silakan coba kembali.",
        true
      );
    } finally {
      button.disabled = false;
      button.innerHTML = 'Kirim permintaan <span>↗</span>';
    }
  });

  // LOGIN ADMIN
  async function openAdmin() {
    if (!supabase) {
      showModal(loginModal);
      setMessage(
        "#loginMessage",
        "Supabase belum dikonfigurasi.",
        true
      );
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      const ok = await verifyAdmin(session.user);

      if (ok) {
        showModal(adminPanel);
        await renderAdmin();
        return;
      }
    }

    showModal(loginModal);
  }

  $("#adminLink").addEventListener("click", openAdmin);

  $("#loginForm").addEventListener("submit", async e => {
    e.preventDefault();

    if (!supabase) {
      setMessage("#loginMessage", "Supabase belum dikonfigurasi.", true);
      return;
    }

    const button = e.submitter;
    button.disabled = true;
    button.textContent = "Memeriksa...";

    try {
      const fd = new FormData(e.currentTarget);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: fd.get("email"),
        password: fd.get("password")
      });

      if (error) {
        setMessage(
          "#loginMessage",
          "Login gagal. Periksa email dan password.",
          true
        );
        return;
      }

      const ok = await verifyAdmin(data.user);

      if (!ok) {
        await supabase.auth.signOut();
        setMessage(
          "#loginMessage",
          "Akun ini belum diberi akses admin.",
          true
        );
        return;
      }

      hideModal(loginModal);
      showModal(adminPanel);
      await renderAdmin();

    } catch (error) {
      console.error(error);
      setMessage("#loginMessage", "Terjadi kesalahan saat login.", true);
    } finally {
      button.disabled = false;
      button.innerHTML = 'Login <span>↗</span>';
    }
  });

  async function verifyAdmin(user) {
    const { data, error } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) return false;

    currentAdmin = user;
    return true;
  }

  // Keluar dashboard
  $("#closeAdmin").addEventListener("click", async () => {
    hideModal(adminPanel);

    if (supabase) {
      await supabase.auth.signOut();
    }

    currentAdmin = null;
  });

  // AMBIL DATA PESANAN
  async function fetchOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast("Gagal memuat pesanan. Periksa izin database.");
      console.error(error);
      return [];
    }

    cachedOrders = data || [];
    return cachedOrders;
  }

  // TAMPILKAN DASHBOARD
  async function renderAdmin() {
    if (!currentAdmin) return;

    const orders = await fetchOrders();

    const counts = {
      Baru: 0,
      Diproses: 0,
      Selesai: 0,
      Dibatalkan: 0
    };

    orders.forEach(o => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });

    $("#statTotal").textContent = orders.length;
    $("#statNew").textContent = counts.Baru;
    $("#statProgress").textContent = counts.Diproses;
    $("#statDone").textContent = counts.Selesai;

    const q = $("#searchOrders").value.toLowerCase();
    const filter = $("#filterStatus").value;

    const filtered = orders.filter(o =>
      (!filter || o.status === filter) &&
      [
        o.customer_name,
        o.school,
        o.phone,
        o.id
      ].join(" ").toLowerCase().includes(q)
    );

    $("#ordersBody").innerHTML = filtered.map(o => `
      <tr>
        <td>
          <strong>${escapeHtml(o.customer_name)}</strong>
          <small>
            ${escapeHtml(o.school)} · ${escapeHtml(o.id.slice(0, 8))}
          </small>
        </td>
        <td>${escapeHtml(o.package_name)}</td>
        <td>${formatDate(o.created_at)}</td>
        <td>
          <span class="status status-${escapeHtml(o.status.toLowerCase())}">
            ${escapeHtml(o.status)}
          </span>
        </td>
        <td>
          <button class="table-action" data-detail="${escapeHtml(o.id)}">
            Detail ↗
          </button>
        </td>
      </tr>
    `).join("");

    $("#emptyOrders").style.display = filtered.length ? "none" : "block";

    $$("[data-detail]").forEach(b => {
      b.addEventListener("click", () => showDetail(b.dataset.detail));
    });
  }

  $("#searchOrders").addEventListener("input", () => {
    if (currentAdmin) renderAdmin();
  });

  $("#filterStatus").addEventListener("change", () => {
    if (currentAdmin) renderAdmin();
  });

  // DETAIL PESANAN
  function showDetail(id) {
    const o = cachedOrders.find(x => x.id === id);
    if (!o) return;

    activeOrderId = id;
    $("#detailName").textContent = o.customer_name;

    const fields = [
      ["ID Pesanan", o.id],
      ["Nomor WhatsApp", o.phone || "Tidak dikumpulkan"],
      ["Sekolah", o.school],
      ["Jurusan", o.major || "-"],
      ["Paket / layanan", o.package_name],
      ["Tanggal", formatDate(o.created_at)],
      ["Kebutuhan / progres", o.notes, true]
    ];

    $("#detailContent").innerHTML = fields.map(([label, val, wide]) => `
      <div class="detail-item ${wide ? "wide" : ""}">
        <span>${escapeHtml(label)}</span>
        <b>${escapeHtml(val)}</b>
      </div>
    `).join("");

    $("#detailStatus").value = o.status;
    showModal(detailModal);
  }

  $("#closeDetail").addEventListener("click", () => {
    hideModal(detailModal);
  });

  detailModal.addEventListener("click", e => {
    if (e.target === detailModal) hideModal(detailModal);
  });

  // UPDATE STATUS
  $("#saveStatus").addEventListener("click", async () => {
    if (!activeOrderId || !currentAdmin) return;

    const status = $("#detailStatus").value;

    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", activeOrderId);

    if (error) {
      toast("Status gagal diperbarui.");
      console.error(error);
      return;
    }

    hideModal(detailModal);
    await renderAdmin();
    toast("Status pesanan diperbarui.");
  });

  // EXPORT CSV
  $("#exportCsv").addEventListener("click", () => {
    if (!cachedOrders.length) {
      toast("Belum ada data untuk diekspor.");
      return;
    }

    const cols = [
      "id",
      "customer_name",
      "phone",
      "school",
      "major",
      "package_name",
      "notes",
      "status",
      "created_at"
    ];

    const csv = [
      cols.join(","),
      ...cachedOrders.map(o =>
        cols.map(k =>
          `"${String(o[k] ?? "").replace(/"/g, '""')}"`
        ).join(",")
      )
    ].join("\n");

    const blob = new Blob(
      ["\ufeff" + csv],
      { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "reportify-pesanan.csv";
    a.click();

    URL.revokeObjectURL(url);
  });

  // Tutup modal dengan tombol Escape
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      [orderModal, loginModal, detailModal, adminPanel]
        .forEach(hideModal);
    }
  });

  if (supabase) {
    supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) currentAdmin = null;
    });
  }

})();
                                      
