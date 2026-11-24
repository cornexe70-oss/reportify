(() => {
  "use strict";

  // =========================================
  // KONFIGURASI
  // =========================================
  const cfg = window.REPORTIFY_CONFIG || {};
  const configured = Boolean(
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    !String(cfg.SUPABASE_URL).includes("PASTE_") &&
    !String(cfg.SUPABASE_ANON_KEY).includes("PASTE_")
  );

  const supabaseClient =
    configured && window.supabase
      ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
      : null;

  const WHATSAPP_NUMBER = "6285846805011";

  const PACKAGES = {
    STARTER: "STARTER — 15 halaman — Rp30.000",
    BASIC: "BASIC — 20 halaman — Rp38.000",
    PRO: "PRO — 25 halaman — Rp45.000",
    ULTIMATE: "ULTIMATE — 30 halaman — Rp51.000"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  let activeOrderId = null;
  let currentAdmin = null;
  let cachedOrders = [];

  // =========================================
  // UTILITAS & NOTIFIKASI
  // =========================================
  function toast(message, type = "success") {
    const element = $("#toast");

    if (!element) {
      window.alert(message);
      return;
    }

    element.textContent = message;
    element.className = `toast show ${type}`;

    window.clearTimeout(toast.timer);

    toast.timer = window.setTimeout(() => {
      element.classList.remove("show");
    }, 3200);
  }

  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = String(value ?? "");
  }

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function setModalState(modal, open) {
    if (!modal) return;

    modal.classList.toggle("show", open);
    modal.setAttribute("aria-hidden", String(!open));

    const anyModalOpen = Boolean(
      $(".modal-backdrop.show, .admin-backdrop.show")
    );

    document.body.classList.toggle(
      "modal-open",
      open || anyModalOpen
    );
  }

  function openModal(selector) {
    setModalState($(selector), true);
  }

  function closeModal(selector) {
    setModalState($(selector), false);
  }

  // =========================================
  // NAVIGASI MOBILE
  // =========================================
  const menuToggle = $("#menuToggle");
  const navMenu = $("#mainNav");

  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", () => {
      const isOpen = navMenu.classList.toggle("active");

      menuToggle.classList.toggle("active", isOpen);
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute(
        "aria-label",
        isOpen ? "Tutup menu" : "Buka menu"
      );
    });

    $$("a", navMenu).forEach(link => {
      link.addEventListener("click", () => {
        navMenu.classList.remove("active");
        menuToggle.classList.remove("active");

        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Buka menu");
      });
    });

    document.addEventListener("click", event => {
      if (
        !navMenu.contains(event.target) &&
        !menuToggle.contains(event.target)
      ) {
        navMenu.classList.remove("active");
        menuToggle.classList.remove("active");

        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Buka menu");
      }
    });
  }

  // =========================================
  // MODAL PEMESANAN
  // =========================================
  $$("[data-open-order], .open-order, #openOrder").forEach(button => {
    button.addEventListener("click", () => {
      openModal("#orderModal");
    });
  });

  $$("[data-close-order], #closeOrder").forEach(button => {
    button.addEventListener("click", () => {
      closeModal("#orderModal");
    });
  });

  $$(".modal-backdrop").forEach(modal => {
    modal.addEventListener("click", event => {
      if (event.target === modal) {
        closeModal(`#${modal.id}`);
      }
    });
  });

  // =========================================
  // PILIH PAKET
  // =========================================
  $$("[data-plan]").forEach(button => {
    button.addEventListener("click", () => {
      const plan = PACKAGES[button.dataset.plan];
      const planSelect = $("#plan") || $('[name="plan"]');

      if (plan && planSelect) {
        planSelect.value = plan;
      }

      openModal("#orderModal");
    });
  });

  // =========================================
  // TOMBOL WHATSAPP ADMIN
  // =========================================
  $$("[data-whatsapp], .ask-admin, #askAdmin").forEach(button => {
    button.addEventListener("click", () => {
      const message =
        "Halo Admin REPORTIFY, saya ingin bertanya tentang layanan laporan PKL.";

      const url =
        `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

      window.open(url, "_blank", "noopener,noreferrer");
    });
  });

  // =========================================
  // FORM PEMESANAN
  // =========================================
  const orderForm = $("#orderForm");

  if (orderForm) {
    orderForm.addEventListener("submit", async event => {
      event.preventDefault();

      if (!supabaseClient) {
        toast(
          "Koneksi database belum tersedia. Periksa config.js terlebih dahulu.",
          "error"
        );

        setText(
          "#formMessage",
          "Koneksi database belum tersedia. Silakan hubungi admin."
        );

        return;
      }

      const submitButton = orderForm.querySelector(
        'button[type="submit"]'
      );

      const originalText =
        submitButton?.textContent || "Kirim Permintaan ↗";

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Mengirim permintaan...";
      }

      try {
        const formData = new FormData(orderForm);

        const name = String(formData.get("name") || "").trim();
        const school = String(formData.get("school") || "").trim();
        const major = String(formData.get("major") || "").trim();
        const plan = String(formData.get("plan") || "").trim();
        const notes = String(formData.get("notes") || "").trim();

        const selectedServices = formData
          .getAll("services")
          .map(value => String(value).trim())
          .filter(Boolean);

        if (!name || !school || !major || !notes) {
          toast(
            "Lengkapi nama, sekolah, jurusan, dan kebutuhan laporan.",
            "error"
          );

          return;
        }

        const packageAndServices = [
          plan || "Tidak memilih paket utama",
          selectedServices.length
            ? `Layanan tambahan: ${selectedServices.join(", ")}`
            : "Layanan tambahan: Tidak ada"
        ].join("\n");

        const payload = {
          name,
          phone: "",
          school,
          major,
          package_name: packageAndServices,
          notes,
          status: "Baru"
        };

        const { error } = await supabaseClient
          .from("orders")
          .insert([payload]);

        if (error) throw error;

        const whatsappMessage = [
          "Halo Admin REPORTIFY!",
          "",
          "Saya sudah mengirim formulir pemesanan melalui website.",
          "",
          `Nama: ${name}`,
          `Sekolah: ${school}`,
          `Jurusan: ${major}`,
          `Paket: ${plan || "Belum memilih paket"}`,
          `Layanan tambahan: ${
            selectedServices.length
              ? selectedServices.join(", ")
              : "Tidak ada"
          }`,
          "",
          `Kebutuhan: ${notes || "-"}`,
          "",
          "Mohon informasi langkah selanjutnya. Terima kasih!"
        ].join("\n");

        orderForm.reset();

        setText("#formMessage", "");

        closeModal("#orderModal");

        toast(
          "Permintaan berhasil dikirim. Mengalihkan ke WhatsApp..."
        );

        const whatsappURL =
          `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;

        window.setTimeout(() => {
          window.location.href = whatsappURL;
        }, 900);

      } catch (error) {
        console.error("Kesalahan pemesanan:", error);

        toast(
          "Pesanan gagal dikirim. Silakan coba lagi.",
          "error"
        );

        setText(
          "#formMessage",
          "Pesanan gagal dikirim. Silakan coba kembali."
        );

      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        }
      }
    });
  }

  // =========================================
  // LOGIN ADMIN
  // =========================================
  const adminButton = $("#adminLogin");
  const loginForm = $("#loginForm");

  if (adminButton) {
    adminButton.addEventListener("click", event => {
      event.preventDefault();
      openModal("#loginModal");
    });
  }

  $("#closeLogin")?.addEventListener("click", () => {
    closeModal("#loginModal");
  });

  if (loginForm) {
    loginForm.addEventListener("submit", async event => {
      event.preventDefault();

      if (!supabaseClient) {
        setText(
          "#loginMessage",
          "Koneksi database belum tersedia. Periksa config.js."
        );

        return;
      }

      const email = String(
        loginForm.querySelector('[name="email"]')?.value || ""
      ).trim();

      const password = String(
        loginForm.querySelector('[name="password"]')?.value || ""
      );

      const message = $("#loginMessage");

      const submitButton = loginForm.querySelector(
        'button[type="submit"]'
      );

      setText("#loginMessage", "Memeriksa akun...");

      if (submitButton) {
        submitButton.disabled = true;
      }

      try {
        const { data, error } =
          await supabaseClient.auth.signInWithPassword({
            email,
            password
          });

        if (error) throw error;

        const user = data.user;

        const { data: adminData, error: adminError } =
          await supabaseClient
            .from("admin_users")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (adminError || !adminData) {
          await supabaseClient.auth.signOut();

          throw new Error(
            "Akun ini tidak memiliki akses admin."
          );
        }

        currentAdmin = user;

        closeModal("#loginModal");
        loginForm.reset();

        if (message) {
          message.textContent = "";
        }

        await loadOrders();

        openAdminPanel();

        toast("Login admin berhasil!");

      } catch (error) {
        console.error("Login admin gagal:", error);

        setText(
          "#loginMessage",
          error.message || "Login gagal. Periksa email dan password."
        );

      } finally {
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    });
  }

  // =========================================
  // PANEL ADMIN
  // =========================================
  function openAdminPanel() {
    const panel = $("#adminPanel");

    if (!panel) return;

    panel.classList.add("show");
    panel.setAttribute("aria-hidden", "false");

    document.body.classList.add("modal-open");
  }

  function closeAdminPanel() {
    const panel = $("#adminPanel");

    if (!panel) return;

    panel.classList.remove("show");
    panel.setAttribute("aria-hidden", "true");

    document.body.classList.remove("modal-open");
  }

  $("#closeAdmin")?.addEventListener("click", closeAdminPanel);

  // =========================================
  // STATISTIK DASHBOARD
  // =========================================
  function updateDashboardStats() {
    const total = cachedOrders.length;

    const baru = cachedOrders.filter(
      order => order.status === "Baru"
    ).length;

    const proses = cachedOrders.filter(
      order => order.status === "Diproses"
    ).length;

    const selesai = cachedOrders.filter(
      order => order.status === "Selesai"
    ).length;

    setText("#totalOrders", total);
    setText("#newOrders", baru);
    setText("#processingOrders", proses);
    setText("#completedOrders", selesai);

    setText("#statTotal", total);
    setText("#statNew", baru);
    setText("#statProcess", proses);
    setText("#statDone", selesai);
  }

  // =========================================
  // MEMUAT DATA PESANAN
  // =========================================
  async function loadOrders() {
    if (!supabaseClient || !currentAdmin) return;

    const tbody = $("#ordersBody");

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">Memuat data pesanan...</td>
        </tr>
      `;
    }

    try {
      const { data, error } = await supabaseClient
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      cachedOrders = data || [];

      renderOrders();
      updateDashboardStats();

    } catch (error) {
      console.error("Gagal memuat pesanan:", error);

      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6">Gagal memuat data pesanan.</td>
          </tr>
        `;
      }

      toast("Gagal mengambil data pesanan.", "error");
    }
  }

  // =========================================
  // MENAMPILKAN DATA PESANAN
  // =========================================
  function renderOrders() {
    const tbody = $("#ordersBody");
    const emptyState = $("#emptyOrders");

    if (!tbody) return;

    const searchValue = String(
      $("#searchOrders")?.value || ""
    ).toLowerCase().trim();

    const filterValue =
      $("#statusFilter")?.value || "Semua";

    const filteredOrders = cachedOrders.filter(order => {
      const searchableText = [
        order.name,
        order.school,
        order.major,
        order.package_name
      ].join(" ").toLowerCase();

      return (
        searchableText.includes(searchValue) &&
        (
          filterValue === "Semua" ||
          !filterValue ||
          order.status === filterValue
        )
      );
    });

    if (emptyState) {
      emptyState.hidden = filteredOrders.length > 0;
    }

    if (!filteredOrders.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">Belum ada pesanan yang sesuai.</td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML = filteredOrders.map(order => {
      const statusClass = String(order.status || "Baru")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");

      return `
        <tr>
          <td>${escapeHTML(order.name || "-")}</td>
          <td>${escapeHTML(order.school || "-")}</td>
          <td>${escapeHTML(order.package_name || "-").replace(/\n/g, "<br>")}</td>
          <td>
            <span class="status-badge status-${statusClass}">
              ${escapeHTML(order.status || "Baru")}
            </span>
          </td>
          <td>${escapeHTML(formatDate(order.created_at))}</td>
          <td>
            <button
              type="button"
              class="detail-button"
              data-detail-id="${escapeHTML(order.id)}"
            >
              Detail
            </button>
          </td>
        </tr>
      `;
    }).join("");

    $$("[data-detail-id]", tbody).forEach(button => {
      button.addEventListener("click", () => {
        showOrderDetail(button.dataset.detailId);
      });
    });
  }

  $("#searchOrders")?.addEventListener("input", renderOrders);
  $("#statusFilter")?.addEventListener("change", renderOrders);

  // =========================================
  // DETAIL PESANAN
  // =========================================
  function showOrderDetail(id) {
    const order = cachedOrders.find(
      item => String(item.id) === String(id)
    );

    if (!order) {
      toast("Data pesanan tidak ditemukan.", "error");
      return;
    }

    activeOrderId = order.id;

    setText(
      "#detailName",
      order.name || "Detail Pesanan"
    );

    const content = $("#detailContent");

    if (content) {
      content.innerHTML = `
        <div class="detail-item">
          <strong>Nama</strong>
          <span>${escapeHTML(order.name || "-")}</span>
        </div>

        <div class="detail-item">
          <strong>Sekolah</strong>
          <span>${escapeHTML(order.school || "-")}</span>
        </div>

        <div class="detail-item">
          <strong>Jurusan</strong>
          <span>${escapeHTML(order.major || "-")}</span>
        </div>

        <div class="detail-item">
          <strong>Paket dan layanan</strong>
          <span>${escapeHTML(order.package_name || "-").replace(/\n/g, "<br>")}</span>
        </div>

        <div class="detail-item">
          <strong>Kebutuhan tambahan</strong>
          <span>${escapeHTML(order.notes || "-")}</span>
        </div>

        <div class="detail-item">
          <strong>Nomor WhatsApp</strong>
          <span>Tidak dikumpulkan melalui formulir</span>
        </div>

        <div class="detail-item">
          <strong>Tanggal pesanan</strong>
          <span>${escapeHTML(formatDate(order.created_at))}</span>
        </div>
      `;
    }

    const statusSelect = $("#detailStatus");

    if (statusSelect) {
      statusSelect.value = order.status || "Baru";
    }

    openModal("#detailModal");
  }

  $("#closeDetail")?.addEventListener("click", () => {
    closeModal("#detailModal");
    activeOrderId = null;
  });

  // =========================================
  // UPDATE STATUS PESANAN
  // =========================================
  const saveStatusButton = $("#saveStatus");

  if (saveStatusButton) {
    saveStatusButton.addEventListener("click", async () => {
      if (!supabaseClient || !currentAdmin || !activeOrderId) {
        toast("Tidak dapat memperbarui status.", "error");
        return;
      }

      const newStatus = $("#detailStatus")?.value;

      if (!newStatus) {
        toast("Pilih status pesanan terlebih dahulu.", "error");
        return;
      }

      saveStatusButton.disabled = true;

      try {
        const { error } = await supabaseClient
          .from("orders")
          .update({ status: newStatus })
          .eq("id", activeOrderId);

        if (error) throw error;

        closeModal("#detailModal");
        activeOrderId = null;

        await loadOrders();

        toast("Status pesanan berhasil diperbarui!");

      } catch (error) {
        console.error("Gagal memperbarui status:", error);

        toast(
          "Gagal memperbarui status pesanan.",
          "error"
        );

      } finally {
        saveStatusButton.disabled = false;
      }
    });
  }

  // =========================================
  // EXPORT DATA CSV
  // =========================================
  const exportButton = $("#exportCsv");

  if (exportButton) {
    exportButton.addEventListener("click", () => {
      if (!cachedOrders.length) {
        toast("Belum ada data untuk diekspor.", "error");
        return;
      }

      const headers = [
        "Nama",
        "Sekolah",
        "Jurusan",
        "Paket dan Layanan",
        "Kebutuhan",
        "Status",
        "Tanggal"
      ];

      const rows = cachedOrders.map(order => [
        order.name,
        order.school,
        order.major,
        order
