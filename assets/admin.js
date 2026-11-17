/* Boombastis admin dashboard. Talks to Supabase Auth + RPC with plain fetch (no library).
   All values from the database are rendered with textContent only (visitors control that data). */
(function () {
  "use strict";
  var AN = window.BB_AN;
  var $ = function (id) { return document.getElementById(id); };
  var SKEY = "bb_admin_sess", sess = null, timer = null, loading = false;
  var NF = new Intl.NumberFormat("id-ID");

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined && txt !== null) e.textContent = txt;
    return e;
  }
  function show(id) { ["vLogin", "vOff", "vDash"].forEach(function (v) { $(v).hidden = v !== id; }); }

  /* ---------- session ---------- */
  function loadSess() { try { sess = JSON.parse(localStorage.getItem(SKEY) || "null"); } catch (e) { sess = null; } }
  function saveSess(s) {
    sess = s;
    try { if (s) localStorage.setItem(SKEY, JSON.stringify(s)); else localStorage.removeItem(SKEY); } catch (e) {}
  }
  function token(grant, body) {
    return fetch(AN.url + "/auth/v1/token?grant_type=" + grant, {
      method: "POST", headers: { apikey: AN.key, "Content-Type": "application/json" }, body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error_description || j.msg || j.message || ("HTTP " + r.status));
        saveSess({ a: j.access_token, r: j.refresh_token, exp: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600) });
      });
    });
  }
  function fresh() {
    if (!sess) return Promise.reject(new Error("login"));
    if (sess.exp - 60 > Date.now() / 1000) return Promise.resolve();
    return token("refresh_token", { refresh_token: sess.r }).catch(function () { saveSess(null); throw new Error("login"); });
  }
  function rpc(name, args, retried) {
    return fresh().then(function () {
      return fetch(AN.url + "/rest/v1/rpc/" + name, {
        method: "POST",
        headers: { apikey: AN.key, Authorization: "Bearer " + sess.a, "Content-Type": "application/json" },
        body: JSON.stringify(args)
      });
    }).then(function (r) {
      if (r.status === 401) {
        if (retried) { saveSess(null); throw new Error("login"); }
        sess.exp = 0; return rpc(name, args, true);
      }
      return r.json().catch(function () { return null; }).then(function (j) {
        if (!r.ok) { var e = new Error((j && j.message) || ("HTTP " + r.status)); e.code = j && j.code; throw e; }
        return j;
      });
    });
  }

  /* ---------- formatting ---------- */
  var REG = null;
  try { REG = new Intl.DisplayNames(["id"], { type: "region" }); } catch (e) {}
  function flag(c) {
    if (!/^[A-Z]{2}$/.test(c)) return "🌐";
    return String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65, 0x1F1E6 + c.charCodeAt(1) - 65);
  }
  function countryName(c) {
    if (c === "??") return "Tidak diketahui";
    if (c === "T1") return "Tor (disembunyikan)";
    try { return (REG && REG.of(c)) || c; } catch (e) { return c; }
  }
  function pct(a, b) { return b ? Math.round((a / b) * 1000) / 10 : 0; }
  function ago(iso) {
    var s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return s + " dtk";
    if (s < 3600) return Math.floor(s / 60) + " mnt";
    if (s < 86400) return Math.floor(s / 3600) + " jam";
    return Math.floor(s / 86400) + " hari";
  }
  function delta(node, cur, prev) {
    node.className = ""; node.textContent = "";
    if (!prev) { node.textContent = cur ? "baru" : ""; return; }
    var d = Math.round(((cur - prev) / prev) * 100);
    node.className = d >= 0 ? "up" : "down";
    node.textContent = (d >= 0 ? "▲ " : "▼ ") + Math.abs(d) + "% vs periode lalu";
  }

  /* ---------- rendering ---------- */
  function rows(id, list, total, label) {
    var box = $(id); box.textContent = "";
    if (!list || !list.length) { box.appendChild(el("p", "empty", "Belum ada data.")); return; }
    var max = list.reduce(function (m, x) { return Math.max(m, x.views); }, 1);
    list.forEach(function (x) {
      var rw = el("div", "rw");
      var l = el("div", "rl", label ? label(x.k) : x.k); l.title = l.textContent;
      var n = el("div", "rn", NF.format(x.views));
      n.appendChild(el("small", null, pct(x.views, total) + "%"));
      var bar = el("div", "rb"), fill = el("i");
      fill.style.width = Math.max(2, Math.round((x.views / max) * 100)) + "%";
      bar.appendChild(fill);
      rw.appendChild(l); rw.appendChild(n); rw.appendChild(bar);
      box.appendChild(rw);
    });
  }

  function chart(series, bucket) {
    var svg = $("chart"), NS = "http://www.w3.org/2000/svg";
    svg.textContent = "";
    function s(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
    var W = 640, H = 220, L = 38, R = 8, T = 10, B = 24, n = series.length;
    if (!n) return;
    var max = 1; series.forEach(function (p) { if (p.views > max) max = p.views; });
    var step = Math.pow(10, Math.floor(Math.log10(max))); max = Math.ceil(max / step) * step;
    if (max / step < 3) { step = step / 2; max = Math.ceil(max / step) * step; }
    var ph = H - T - B, pw = W - L - R, bw = pw / n;
    for (var i = 0; i <= 4; i++) {
      var y = T + ph - (ph * i) / 4;
      svg.appendChild(s("line", { x1: L, x2: W - R, y1: y, y2: y, class: "g" }));
      var t = s("text", { x: L - 6, y: y + 4, "text-anchor": "end", class: "t" }); t.textContent = NF.format(Math.round((max * i) / 4)); svg.appendChild(t);
    }
    var pts = [];
    series.forEach(function (p, idx) {
      var h = (p.views / max) * ph, x = L + idx * bw;
      var r = s("rect", { x: x + bw * 0.15, y: T + ph - h, width: Math.max(1, bw * 0.7), height: Math.max(h, 0), rx: Math.min(3, bw * 0.2), class: "bx" });
      var d = new Date(p.t);
      var lab = bucket === "hour" ? d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
      var tt = s("title", {}); tt.textContent = lab + ": " + p.views + " pageviews, " + p.visitors + " pengunjung"; r.appendChild(tt);
      svg.appendChild(r);
      pts.push((x + bw / 2).toFixed(1) + "," + (T + ph - (p.visitors / max) * ph).toFixed(1));
    });
    svg.appendChild(s("polyline", { points: pts.join(" "), class: "ln" }));
    var every = Math.max(1, Math.ceil(n / 7));
    series.forEach(function (p, idx) {
      if (idx % every) return;
      var d = new Date(p.t);
      var tx = s("text", { x: L + idx * bw + bw / 2, y: H - 6, "text-anchor": "middle", class: "t" });
      tx.textContent = bucket === "hour" ? String(d.getHours()).padStart(2, "0") + ":00" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      svg.appendChild(tx);
    });
  }

  function feed(list) {
    var ul = $("feed"); ul.textContent = "";
    if (!list || !list.length) { var li0 = el("li"); li0.appendChild(el("span", "empty", "Belum ada kunjungan masuk.")); ul.appendChild(li0); return; }
    list.forEach(function (x) {
      var li = el("li");
      li.appendChild(el("span", "ft", ago(x.t)));
      li.appendChild(el("span", "fp", x.path));
      var c = x.country || "??";
      var meta = flag(c) + " " + countryName(c) + " · " + x.device + " · " + (x.browser || "?") + "/" + (x.os || "?") + " · " + (x.referrer || "langsung");
      li.appendChild(el("span", "fm", meta));
      ul.appendChild(li);
    });
  }

  function render(d, bucket) {
    var t = d.totals, p = d.prev;
    $("kViews").textContent = NF.format(t.views); delta($("dViews"), t.views, p.views);
    $("kVis").textContent = NF.format(t.visitors); delta($("dVis"), t.visitors, p.visitors);
    $("kSes").textContent = NF.format(t.sessions); delta($("dSes"), t.sessions, p.sessions);
    $("kLive").textContent = NF.format(d.live || 0);
    $("cLegend").textContent = bucket === "hour" ? "per jam" : "per hari";
    chart(d.series || [], bucket);
    rows("tCountry", d.countries, t.views, function (k) { return flag(k) + "  " + countryName(k) + (k === "??" || k === "T1" ? "" : " (" + k + ")"); });
    rows("tPage", d.pages, t.views);
    rows("tRef", d.referrers, t.views, function (k) { return k === "(direct)" ? "Langsung / tidak diketahui" : k; });
    rows("tDev", d.devices, t.views);
    rows("tBr", d.browsers, t.views);
    rows("tOs", d.os, t.views);
    rows("tLang", d.langs, t.views, function (k) { return k === "??" ? "Tidak diketahui" : k; });
  }

  /* ---------- data loading ---------- */
  function rangeArgs() {
    var v = $("range").value, now = new Date();
    var d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()), n = v === "today" ? 1 : parseInt(v, 10);
    var from = new Date(d0); from.setDate(from.getDate() - (n - 1));
    var to = new Date(d0); to.setDate(to.getDate() + 1);
    var tz = "UTC"; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) {}
    return { p_from: from.toISOString(), p_to: to.toISOString(), p_tz: tz, p_bucket: n === 1 ? "hour" : "day" };
  }
  function refresh() {
    if (loading) return; loading = true;
    var a = rangeArgs(), btn = $("bRef"); btn.disabled = true; $("eDash").textContent = "";
    Promise.all([rpc("analytics_summary", a), rpc("analytics_recent", { p_limit: 50 })]).then(function (r) {
      render(r[0], a.p_bucket); feed(r[1]);
      $("upd").textContent = "Diperbarui " + new Date().toLocaleTimeString("id-ID");
    }).catch(function (e) {
      if (e.message === "login") { stop(); show("vLogin"); return; }
      if (e.code === "42501") { $("eDash").textContent = "Akun ini belum terdaftar sebagai admin analitik. Jalankan langkah 2 di supabase/analytics.sql."; return; }
      if (e.code === "PGRST202" || e.code === "42P01") { $("eDash").textContent = "Fungsi/tabel analitik belum ada. Jalankan supabase/analytics.sql di project Supabase ini."; return; }
      $("eDash").textContent = "Gagal memuat data: " + e.message;
    }).then(function () { loading = false; btn.disabled = false; });
  }
  function start() {
    stop(); show("vDash"); refresh();
    timer = setInterval(function () { if (!document.hidden && $("auto").checked) refresh(); }, 15000);
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }

  /* ---------- events ---------- */
  function init() {
    if (!AN || !AN.url || !AN.key) { show("vOff"); return; }
    $("fLogin").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var b = $("bLogin"); b.disabled = true; $("eLogin").textContent = "";
      token("password", { email: $("em").value.trim(), password: $("pw").value }).then(function () {
        $("pw").value = ""; start();
      }).catch(function (e) {
        $("eLogin").textContent = /invalid/i.test(e.message) ? "Email atau kata sandi salah." : e.message;
      }).then(function () { b.disabled = false; });
    });
    $("bRef").addEventListener("click", refresh);
    $("range").addEventListener("change", refresh);
    $("bOut").addEventListener("click", function () {
      var a = sess && sess.a; stop(); saveSess(null); show("vLogin");
      if (a) fetch(AN.url + "/auth/v1/logout", { method: "POST", headers: { apikey: AN.key, Authorization: "Bearer " + a } }).catch(function () {});
    });
    loadSess();
    if (sess) start(); else show("vLogin");
  }
  init();
})();
