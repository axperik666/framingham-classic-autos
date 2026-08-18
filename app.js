(function () {
  "use strict";
  const inventory = Array.isArray(window.INVENTORY) ? window.INVENTORY : [];
  const config = window.SITE_CONFIG || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  let activeVehicle = null;
  let lastTrackedVehicleId = null;
  let lastDeliveryKey = "";
  let lastDeliveryAt = 0;
  const pathVehicleMatch = location.pathname.match(/\/cars\/([^/]+)\/?$/i);
  const requestedVehicleId = (pathVehicleMatch && decodeURIComponent(pathVehicleMatch[1])) || new URLSearchParams(location.search).get("vehicle");
  const campaignVehicle = inventory.find((vehicle) => vehicle.id === requestedVehicleId) || null;

  function isPreview() {
    return Boolean(config.demoMode) || location.protocol === "file:" || ["localhost", "127.0.0.1"].includes(location.hostname);
  }

  function loadMetaPixel() {
    if (isPreview() || !config.metaPixelId || window.fbq) return;
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = true; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", config.metaPixelId);
    window.fbq("track", "PageView");
  }

  function loadLiveChat() {
    if (isPreview() || !config.liveChatLicense) return;
    window.__lc = window.__lc || {};
    window.__lc.license = Number(config.liveChatLicense);
    window.__lc.integration_name = "manual_channels";
    window.__lc.product_name = "livechat";
    (function (n, t, c) {
      function i(args) { return e._h ? e._h.apply(null, args) : e._q.push(args); }
      const e = { _q: [], _h: null, _v: "2.0", on() { i(["on", c.call(arguments)]); }, once() { i(["once", c.call(arguments)]); }, off() { i(["off", c.call(arguments)]); }, get() { if (!e._h) throw new Error("LiveChat not ready"); return i(["get", c.call(arguments)]); }, call() { i(["call", c.call(arguments)]); }, init() { const script = t.createElement("script"); script.async = true; script.src = "https://cdn.livechatinc.com/tracking.js"; t.head.appendChild(script); } };
      if (!n.__lc.asyncInit) e.init();
      n.LiveChatWidget = n.LiveChatWidget || e;
    })(window, document, [].slice);
  }

  function attribution() {
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];
    const params = new URLSearchParams(location.search);
    let saved = {};
    try { saved = JSON.parse(sessionStorage.getItem("framingham_attribution") || "{}"); } catch { saved = {}; }
    keys.forEach((key) => { if (params.get(key)) saved[key] = params.get(key).slice(0, 500); });
    if (!saved.landingUrl) saved.landingUrl = location.href.slice(0, 2000);
    sessionStorage.setItem("framingham_attribution", JSON.stringify(saved));
    return saved;
  }

  function updateVehicleMetadata(vehicle) {
    const title = `${vehicle.title} for Sale — ${money.format(vehicle.price)} | Framingham Motors`;
    const description = `${vehicle.title}, stock ${vehicle.stock || "available listing"}, offered at ${money.format(vehicle.price)} by Framingham Motors. View ten real photos and ask about this exact vehicle.`;
    document.title = title;
    const descriptionMeta = document.querySelector('meta[name="description"]');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    const ogImage = document.querySelector('meta[property="og:image"]');
    const vehicleMeta = document.querySelector('meta[name="vehicle-id"]');
    if (descriptionMeta) descriptionMeta.content = description;
    if (ogTitle) ogTitle.content = title;
    if (ogDescription) ogDescription.content = description;
    if (ogImage) ogImage.content = new URL(vehicle.images[0], document.baseURI).href;
    if (vehicleMeta) vehicleMeta.content = vehicle.id;
  }

  function trackVehicleView(vehicle) {
    if (!window.fbq || lastTrackedVehicleId === vehicle.id) return;
    lastTrackedVehicleId = vehicle.id;
    window.fbq("track", "ViewContent", { content_name: vehicle.title, content_ids: [vehicle.id], content_type: "vehicle", vehicle_stock: vehicle.stock || "", value: vehicle.price, currency: "USD" });
  }

  function setupSectionLinks() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest('a[href^="#"]');
      const hash = link && link.getAttribute("href");
      if (!hash || hash === "#") return;
      const target = document.querySelector(hash);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      const url = new URL(location.href);
      url.hash = hash;
      history.replaceState(history.state, "", url);
    });
  }

  function setVehicleUrl(vehicle) {
    const current = new URL(location.href);
    const url = new URL(`cars/${encodeURIComponent(vehicle.id)}/`, document.baseURI);
    current.searchParams.forEach((value, key) => { if (key !== "vehicle") url.searchParams.append(key, value); });
    history.replaceState({ vehicle: vehicle.id }, "", url);
  }

  function vehicleHref(vehicle) {
    const current = new URL(location.href);
    const url = new URL(`cars/${encodeURIComponent(vehicle.id)}/`, document.baseURI);
    current.searchParams.forEach((value, key) => { if (key !== "vehicle") url.searchParams.append(key, value); });
    return url.href;
  }

  function renderCampaignProof(vehicle) {
    document.documentElement.classList.add("vehicle-landing");
    $("#campaign-proof").hidden = false;
    $("#campaign-proof-title").textContent = vehicle.title;
    $("#campaign-proof-price").textContent = `${money.format(vehicle.price)} asking price${vehicle.stock ? ` · Stock ${vehicle.stock}` : ""}`;
    $("#campaign-proof-mood").textContent = vehicle.mood;
    $("#campaign-proof-specs").innerHTML = [["Engine", vehicle.engine], ["Transmission", vehicle.transmission], ["Mileage", vehicle.mileage], ["Body", vehicle.body], ["Exterior", vehicle.exterior], ["Interior", vehicle.interior]].filter(([, value]) => value).map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
    $("#campaign-proof-photos").innerHTML = vehicle.images.map((src, index) => `<img src="${src}" alt="${vehicle.title}, listing photo ${index + 1} of ${vehicle.images.length}" width="1200" height="800"${index ? ' loading="lazy"' : ""}>`).join("");
    $("#hero-headline").textContent = `${vehicle.title}. Look it over before you call.`;
    $("#hero-lede").textContent = `${money.format(vehicle.price)} asking price${vehicle.stock ? `, stock ${vehicle.stock}` : ""}. The photos, facts, and inquiry below stay tied to this exact car.`;
    $("#inventory-heading-title").textContent = "Other current classics from Framingham Motors";
  }

  function applyCampaignVehicle() {
    if (!campaignVehicle) return;
    if (!pathVehicleMatch) setVehicleUrl(campaignVehicle);
    $("#hero-vehicle-image").src = campaignVehicle.images[0];
    $("#hero-vehicle-image").alt = `${campaignVehicle.title} shown as the exact current listing`;
    $("#hero-vehicle-kicker").textContent = "THE VEHICLE YOU CAME TO SEE";
    $("#hero-vehicle-title").textContent = campaignVehicle.title;
    $("#hero-vehicle-meta").textContent = `${money.format(campaignVehicle.price)}${campaignVehicle.stock ? ` · STOCK ${campaignVehicle.stock}` : ""}`;
    $("#hero-primary-label").textContent = "Check Availability";
    $("#hero-secondary-label").textContent = "Request Walk-Around Video";
    $$("[data-vehicle]", $(".road-hero")).forEach((button) => button.dataset.vehicle = campaignVehicle.id);
    $("#vehicle-select").value = campaignVehicle.id;
    $("#inquiry-title").textContent = `Ask about the ${campaignVehicle.title}.`;
    $("#inquiry-context").textContent = `${money.format(campaignVehicle.price)} asking price${campaignVehicle.stock ? ` · Stock ${campaignVehicle.stock}` : ""}. This request will stay tied to that exact vehicle.`;
    renderCampaignProof(campaignVehicle);
    updateVehicleMetadata(campaignVehicle);
    trackVehicleView(campaignVehicle);
  }

  function populateVehicles() {
    [$("#vehicle-select"), $("#chat-vehicle-select")].filter(Boolean).forEach((select) => {
      inventory.forEach((vehicle) => {
        const option = document.createElement("option");
        option.value = vehicle.id;
        option.textContent = `${vehicle.title} — ${money.format(vehicle.price)}`;
        select.appendChild(option);
      });
    });
  }

  function filteredRows() {
    const price = $("#price-filter").value;
    const rows = inventory.filter((vehicle) => price === "all" || vehicle.price <= Number(price));
    if (campaignVehicle) rows.sort((a, b) => Number(b.id === campaignVehicle.id) - Number(a.id === campaignVehicle.id));
    return rows;
  }

  function card(vehicle, index) {
    return `<article class="car-card ${index === 0 ? "featured" : ""} ${campaignVehicle && campaignVehicle.id === vehicle.id ? "campaign-match" : ""}"><a href="${vehicleHref(vehicle)}" data-vehicle="${vehicle.id}" aria-label="View ${vehicle.title}"><div class="car-image"><img src="${vehicle.images[0]}" alt="${vehicle.title}" loading="lazy" width="1200" height="800"><span class="car-status">${campaignVehicle && campaignVehicle.id === vehicle.id ? "FROM YOUR AD" : "CURRENT LISTING"}</span><span class="car-label">${vehicle.year} / ${vehicle.body}</span></div><div class="car-heading"><h3>${vehicle.title}</h3><p class="car-price">${money.format(vehicle.price)}</p></div><p class="car-spec-line">${vehicle.engine} · ${vehicle.transmission} · ${vehicle.mileage} miles${vehicle.stock ? ` · Stock ${vehicle.stock}` : ""}</p><span class="car-more">Open vehicle page · ${vehicle.images.length} photos <i data-lucide="arrow-up-right" aria-hidden="true"></i></span></a></article>`;
  }

  function render() {
    const rows = filteredRows();
    $("#collection-grid").innerHTML = rows.length ? rows.map(card).join("") : `<div class="empty"><h3>No exact match</h3><p>Clear the selection to see the full collection.</p></div>`;
    $("#result-count").textContent = `${rows.length} vehicle${rows.length === 1 ? "" : "s"} shown`;
    if (window.lucide) window.lucide.createIcons();
  }

  function openVehiclePage(id) {
    const vehicle = inventory.find((row) => row.id === id);
    if (!vehicle) return;
    if (pathVehicleMatch && campaignVehicle && campaignVehicle.id === vehicle.id) {
      $("#campaign-proof").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    location.assign(vehicleHref(vehicle));
  }

  function openInquiry(id = activeVehicle && activeVehicle.id, requestType = "Availability and details") {
    const vehicle = inventory.find((row) => row.id === id) || campaignVehicle || inventory.find((row) => row.id === "1955-chevrolet-bel-air") || inventory[0];
    if (!vehicle) {
      $("#collection").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    activeVehicle = vehicle;
    $("#vehicle-select").value = vehicle.id;
    $("#request-type").value = requestType;
    $("#inquiry-title").textContent = `Ask about the ${vehicle.title}.`;
    $("#inquiry-context").textContent = `${money.format(vehicle.price)} asking price${vehicle.stock ? ` · Stock ${vehicle.stock}` : ""}. This request will stay tied to that exact vehicle.`;
    $("#inquiry").scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => $("#inquiry-form input[name='firstName']").focus(), 450);
  }

  function openChat() {
    if (window.LiveChatWidget && typeof window.LiveChatWidget.call === "function") {
      window.LiveChatWidget.call("maximize");
      if (window.fbq) window.fbq("trackCustom", "LiveChatOpen");
      return;
    }
    const vehicle = activeVehicle || campaignVehicle;
    if (vehicle) $("#chat-vehicle-select").value = vehicle.id;
    $("#chat-drawer").removeAttribute("inert"); $("#chat-drawer").classList.add("open"); $(".drawer-scrim").classList.add("open"); $("#chat-drawer").setAttribute("aria-hidden", "false"); setTimeout(() => $("#chat-vehicle-select").focus(), 250);
  }
  function closeChat() { $("#chat-drawer").classList.remove("open"); $(".drawer-scrim").classList.remove("open"); $("#chat-drawer").setAttribute("aria-hidden", "true"); $("#chat-drawer").setAttribute("inert", ""); }

  function newLeadId() {
    return window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `lead-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  async function postLeadToRouter(payload) {
    const requestPayload = { ...payload, leadSource: "LANDING", leadId: payload.leadId || newLeadId(), receivedAt: new Date().toISOString() };
    const options = { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify(requestPayload), redirect: "follow" };
    try {
      const response = await fetch(config.leadEndpoint, options);
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) {
        const error = new Error(body.message || "The request could not be sent.");
        error.routerRejected = true;
        throw error;
      }
      return body;
    } catch (error) {
      if (error.routerRejected) throw error;
      await fetch(config.leadEndpoint, { ...options, mode: "no-cors" });
      return { ok: true, deliveryConfirmedByBrowser: false };
    }
  }

  async function deliver(payload, status, successMessage) {
    status.className = "form-status";
    const deliveryKey = JSON.stringify([payload.type, payload.phone, payload.email, payload.vehicleSlug, payload.requestType, payload.message]);
    if (deliveryKey === lastDeliveryKey && Date.now() - lastDeliveryAt < 5000) {
      status.classList.add("error");
      status.textContent = "Your request is already being processed. Please wait a moment.";
      return false;
    }
    lastDeliveryKey = deliveryKey;
    lastDeliveryAt = Date.now();
    status.textContent = "Sending…";
    const preview = isPreview();
    if (preview || !config.leadEndpoint) {
      localStorage.setItem("framingham_pending_lead", JSON.stringify({ ...payload, savedAt: new Date().toISOString() }));
      status.classList.add(preview ? "success" : "error");
      status.textContent = preview ? "Preview mode: form validated and saved in this browser. Connect the lead router before traffic." : `Online delivery is not connected yet. Please call ${config.phone}.`;
      return false;
    }
    try {
      const body = await postLeadToRouter(payload);
      status.classList.add("success");
      status.textContent = body.message || successMessage;
      if (window.fbq) window.fbq("track", "Lead");
      return true;
    } catch (error) {
      status.classList.add("error");
      status.textContent = `${error.message} Please call ${config.phone}.`;
      return false;
    }
  }

  async function submitInquiry(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const vehicle = inventory.find((row) => row.id === data.get("vehicleSlug"));
    const payload = { type: "vehicle-inquiry", dealerId: config.dealerId, dealerName: config.brand, landingId: config.landingId, requestType: data.get("requestType"), firstName: data.get("firstName"), lastName: data.get("lastName"), phone: data.get("phone"), email: data.get("email"), vehicleSlug: data.get("vehicleSlug"), vehicle: vehicle ? vehicle.title : "", vehicleStock: vehicle ? vehicle.stock : "", vehiclePrice: vehicle ? vehicle.price : null, purchaseMethod: data.get("purchaseMethod"), deliveryNeeded: Boolean(data.get("deliveryNeeded")), contactConsent: Boolean(data.get("contactConsent")), pageUrl: location.href, attribution: attribution() };
    const sent = await deliver(payload, $(".form-status", form), "Request received. Framingham Motors will use these details to follow up.");
    if (sent) form.reset();
  }

  async function submitChat(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const vehicle = inventory.find((row) => row.id === data.get("vehicleSlug"));
    const payload = { type: "chat-question", dealerId: config.dealerId, dealerName: config.brand, landingId: config.landingId, vehicleSlug: data.get("vehicleSlug"), vehicle: vehicle ? vehicle.title : "", vehicleStock: vehicle ? vehicle.stock : "", name: data.get("name"), phone: data.get("phone"), message: data.get("message"), contactConsent: Boolean(data.get("contactConsent")), pageUrl: location.href, attribution: attribution() };
    const sent = await deliver(payload, $(".form-status", form), "Question received. The team will follow up using your number.");
    if (sent) form.reset();
  }

  function setupMotion() {
    if (!window.gsap || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    window.gsap.registerPlugin(window.ScrollTrigger);
    window.gsap.utils.toArray(".reveal").forEach((element) => window.gsap.from(element, { y: 24, opacity: 0, duration: .72, ease: "power2.out", scrollTrigger: { trigger: element, start: "top 89%", once: true } }));
  }

  function init() {
    attribution(); setupSectionLinks(); loadMetaPixel(); loadLiveChat(); populateVehicles(); applyCampaignVehicle(); render();
    $$('[data-vehicle]').filter((button) => !button.closest("#collection-grid")).forEach((button) => button.addEventListener("click", () => openVehiclePage(button.dataset.vehicle)));
    $("#price-filter").addEventListener("change", render);
    $("#clear-filter").addEventListener("click", () => { $("#price-filter").value = "all"; render(); });
    $$('[data-chat-open]').forEach((button) => button.addEventListener("click", openChat));
    $$('[data-hero-request]').forEach((button) => button.addEventListener("click", () => openInquiry((campaignVehicle || inventory.find((row) => row.id === "1955-chevrolet-bel-air") || inventory[0]).id, button.dataset.heroRequest)));
    $$('[data-campaign-request]').forEach((button) => button.addEventListener("click", () => openInquiry(campaignVehicle && campaignVehicle.id, button.dataset.campaignRequest)));
    const campaignGallery = $('[data-campaign-gallery]');
    if (campaignGallery && campaignVehicle) campaignGallery.addEventListener("click", () => $("#campaign-proof-photos").scrollIntoView({ behavior: "smooth", block: "start" }));
    $$('[data-chat-close]').forEach((button) => button.addEventListener("click", closeChat));
    $("#inquiry-form").addEventListener("submit", submitInquiry);
    $("#chat-form").addEventListener("submit", submitChat);
    if (window.IMask) $$("input[type='tel']").forEach((input) => window.IMask(input, { mask: "(000) 000-0000" }));
    if (window.lucide) window.lucide.createIcons();
    setupMotion();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
