/* Painel de Apoios — engine (layer 1). Knows neither the language (layer 2: ui.*.json)
   nor the programmes (layer 3: data/*.json). Shared by every surface.
   © SeedWave · Igor Kartuzov */
(function () {
  "use strict";
  var LANGS = ["pt", "en", "ru", "es", "de"];
  var LNAME = { pt: "Português", en: "English", ru: "Русский", es: "Español", de: "Deutsch" };
  var LOCALE = { pt: "pt-PT", en: "en-GB", ru: "ru-RU", es: "es-ES", de: "de-DE" };
  var PROFILES = ["todos", "horeca", "micro", "energia", "digital"];
  var qs = new URLSearchParams(location.search);
  var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ---------- config: registry + subscriber (all in the URL, no backend) ---------- */
  var REG = window.PAINEL_REG || {};
  function slug(s) {
    return (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  }
  function hexOk(c) { return /^[0-9a-fA-F]{6}$/.test(c || "") ? "#" + c : null; }
  var SUB = {
    name: (qs.get("n") || "").slice(0, 60),
    profile: PROFILES.indexOf(qs.get("p")) >= 0 ? qs.get("p") : "todos",
    color: hexOk(qs.get("c")),
    src: slug(qs.get("src") || qs.get("n") || "")
  };

  function detectLang() {
    var q = qs.get("l") || qs.get("lang");
    if (LANGS.indexOf(q) >= 0) return q;
    if (window.PAINEL_LANG) return window.PAINEL_LANG;
    var s = store.get("painel.lang");
    if (LANGS.indexOf(s) >= 0) return s;
    var n = (navigator.language || "pt").slice(0, 2).toLowerCase();
    return LANGS.indexOf(n) >= 0 ? n : "pt";
  }
  var lang = detectLang();
  /* prerendered pages live at their own address per language: route there instead of repainting */
  (function autoRoute() {
    if (window.PAINEL_PAGE == null || !window.PAINEL_LANG || navigator.webdriver) return;
    var want = null, q = qs.get("l") || qs.get("lang"), s = store.get("painel.lang");
    if (LANGS.indexOf(q) >= 0) want = q;
    else if (LANGS.indexOf(s) >= 0 && window.PAINEL_LANG === "pt") want = s;
    else if (window.PAINEL_LANG === "pt") {
      var n = (navigator.language || "pt").slice(0, 2).toLowerCase();
      if (LANGS.indexOf(n) >= 0) { want = n; store.set("painel.lang", n); }
    }
    if (want && want !== window.PAINEL_LANG) {
      lang = window.PAINEL_LANG;
      setTimeout(function () { goLang(want); }, 0);
    }
  })();

  function detectTheme() {
    var t = qs.get("theme");
    if (t === "light" || t === "dark") return t;
    var s = store.get("painel.theme");
    return s === "light" || s === "dark" ? s : "dark";
  }
  var theme = detectTheme();
  function applyTheme() {
    if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
    if (SUB.color) document.documentElement.style.setProperty("--accent", SUB.color);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", theme === "light" ? "#F5F7FB" : "#0B1220");
  }
  applyTheme();

  /* ---------- layer 2: dictionary ---------- */
  var UI = {};
  function t(key, vars) {
    var v = key.split(".").reduce(function (o, k) { return o && o[k] != null ? o[k] : null; }, UI);
    if (v == null) return key;
    if (vars) Object.keys(vars).forEach(function (k) { v = String(v).split("{" + k + "}").join(vars[k]); });
    return v;
  }
  var PLR = { one: "One", few: "Few", many: "Many", other: "Many" };
  function tp(key, n, vars) {
    var cat = "other";
    try { cat = new Intl.PluralRules(LOCALE[lang]).select(n); } catch (e) {}
    var suf = PLR[cat] || "Many", v = t(key + suf, vars);
    if (v !== key + suf) return v;
    v = t(key + "Many", vars);
    return v !== key + "Many" ? v : t(key, vars);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- data (layer 3) with offline fallback ---------- */
  var DATA = { programs: [], seminars: [], meta: {}, fetchedAt: null, offline: false };
  function getJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }
  function base() { return REG.root || ""; }
  function loadAll() {
    var ui = getJSON(base() + "ui." + lang + ".json").then(function (d) { UI = d; });
    var data = Promise.all([
      getJSON(base() + "data/programs.json"),
      getJSON(base() + "data/seminars.json"),
      getJSON(base() + "data/meta.json")
    ]).then(function (r) {
      DATA.programs = r[0].programs; DATA.seminars = r[1].seminars; DATA.meta = r[2];
      DATA.fetchedAt = new Date();
      store.set("painel.fetchedAt", DATA.fetchedAt.toISOString());
      DATA.offline = !navigator.onLine;
    });
    return Promise.all([ui, data]);
  }

  /* ---------- dates & statuses ---------- */
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function parseDay(s) { var p = s.slice(0, 10).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function daysTo(s) { return Math.round((parseDay(s) - today()) / 864e5); }
  function fmtDate(s, opt) {
    var d = s.length > 10 ? new Date(s) : parseDay(s);
    return d.toLocaleDateString(LOCALE[lang], opt || { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  function fmtDay(s) { return fmtDate(s, { day: "numeric", month: "short" }); }
  function status(p) {
    if (p.status === "closed") return "closed";
    if (p.status === "unverified") return "unv";
    if (p.deadline) {
      var d = daysTo(p.deadline);
      if (d < 0) return "closed";
      if (d <= 14) return "soon";
    }
    if (p.status === "new") return "new";
    return "open";
  }
  function flapText(p) {
    var s = status(p);
    if (s === "soon") {
      var d = daysTo(p.deadline);
      return d === 0 ? t("flap.today") : d === 1 ? t("flap.tomorrow") : tp("flap.soon", d, { n: d });
    }
    return t("flap." + s);
  }
  function byProfile(list, prof) {
    prof = prof || SUB.profile;
    return prof === "todos" ? list : list.filter(function (p) { return (p.profiles || []).indexOf(prof) >= 0; });
  }
  function openPrograms(prof) {
    return byProfile(DATA.programs, prof).filter(function (p) { return status(p) !== "closed"; })
      .sort(function (a, b) {
        var da = a.deadline ? daysTo(a.deadline) : 9999, db = b.deadline ? daysTo(b.deadline) : 9999;
        return da - db;
      });
  }
  function closingSoon(prof, days) {
    days = days || 14;
    return openPrograms(prof).filter(function (p) { return p.deadline && daysTo(p.deadline) <= days; });
  }
  function nextDeadlines(prof) { return openPrograms(prof).filter(function (p) { return p.deadline; }); }
  function changes() {
    return DATA.programs.filter(function (p) {
      return p.lastStatus && p.lastStatus !== p.status && (!p.changed || daysTo(p.changed) >= -7);
    });
  }
  function seminarsAhead(days) {
    return DATA.seminars.filter(function (s) {
      var end = s.end || s.start;
      var d0 = daysTo(s.start), d1 = daysTo(end);
      return d1 >= 0 && (days == null || d0 <= days);
    }).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
  }
  function seminarWhen(s) {
    if (s.end && s.end.slice(0, 10) !== s.start.slice(0, 10)) return fmtDay(s.start) + " – " + fmtDay(s.end);
    var w = fmtDate(s.start, { weekday: "short", day: "numeric", month: "short" });
    if (s.start.length > 10) {
      w += " · " + new Date(s.start).toLocaleTimeString(LOCALE[lang], { hour: "2-digit", minute: "2-digit", timeZone: "Atlantic/Madeira" });
    }
    return w;
  }

  /* ---------- links: bridges only through the Hub (route-archive §1) ---------- */
  function tag() { return "painel" + (SUB.src ? "-" + SUB.src : ""); }
  function hubLink(id) {
    return REG.hubProject + "?id=" + id + "&lang=" + lang + "&theme=" + theme + "&src=" + tag();
  }
  function hubHome() { return REG.hub + "?lang=" + lang + "&theme=" + theme; }
  function langPath(l, page) { return (l === "pt" ? "" : l + "/") + (page || ""); }
  function siteUrl(l, page) { return REG.site + langPath(l || lang, page); }
  function phoneUrl() {
    var q = [];
    if (SUB.src) q.push("src=" + encodeURIComponent(SUB.src));
    if (SUB.profile !== "todos") q.push("p=" + SUB.profile);
    return siteUrl(lang, "") + (q.length ? "?" + q.join("&") : "");
  }

  /* ---------- split-flap board (signature mechanic) ---------- */
  var FLAP_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ÃÉÇÕÍ";
  var flapJobs = [], flapRunning = false;
  function flapTick(now) {
    var alive = false;
    for (var i = 0; i < flapJobs.length; i++) {
      var j = flapJobs[i];
      if (j.done) continue;
      alive = true;
      if (now < j.next) continue;
      j.next = now + 58;
      if (j.left > 0) {
        j.left--;
        j.ch.textContent = j.left === 0 ? j.target : FLAP_POOL[(Math.random() * FLAP_POOL.length) | 0];
        j.cell.classList.remove("f"); void j.cell.offsetWidth; j.cell.classList.add("f");
        if (j.left === 0) j.done = true;
      }
    }
    if (alive) requestAnimationFrame(flapTick);
    else { flapJobs = []; flapRunning = false; }
  }
  function flap(el, text, opt) {
    opt = opt || {};
    var chars = Array.from(String(text).toUpperCase());
    if (opt.pad) while (chars.length < opt.pad) chars.push(" ");
    el.classList.add("flap");
    el.setAttribute("aria-label", text);
    /* cells are grouped by word so a line never breaks inside a word */
    var html = '<span class="fw">';
    chars.forEach(function (c, i) {
      var sp = c === " ";
      if (sp && i > 0 && chars[i - 1] !== " ") html += "</span>";
      html += '<span class="fc' + (sp ? " sp" : "") + '" aria-hidden="true"><span class="fch">' +
        (REDUCED || opt.instant ? esc(c) : "&nbsp;") + "</span></span>";
      if (sp && i < chars.length - 1 && chars[i + 1] !== " ") html += '<span class="fw">';
    });
    el.innerHTML = html + "</span>";
    if (REDUCED || opt.instant) return;
    var start = performance.now() + (opt.delay || 0);
    Array.prototype.forEach.call(el.querySelectorAll(".fc"), function (cell, i) {
      var c = chars[i];
      if (c === " ") { cell.firstChild.textContent = " "; return; }
      flapJobs.push({ cell: cell, ch: cell.firstChild, target: c, left: 3 + ((Math.random() * 6) | 0),
        next: start + i * 22, done: false });
    });
    if (!flapRunning) { flapRunning = true; requestAnimationFrame(flapTick); }
  }

  /* ---------- odometer (counts programmes, not euros) ---------- */
  function odometer(el, n) {
    var digits = String(n).split("");
    el.classList.add("odo");
    el.setAttribute("aria-label", String(n));
    el.innerHTML = digits.map(function () {
      var col = ""; for (var k = 0; k <= 9; k++) col += "<span>" + k + "</span>";
      return '<span class="odo-d" aria-hidden="true"><span class="odo-c">' + col + "</span></span>";
    }).join("");
    var cols = el.querySelectorAll(".odo-c");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        digits.forEach(function (d, i) { cols[i].style.transform = "translateY(-" + (+d * 10) + "%)"; });
      });
    });
  }

  /* ---------- countdown ring ---------- */
  function ring(days, windowDays) {
    windowDays = windowDays || 14;
    var r = 42, c = 2 * Math.PI * r, f = Math.max(0.04, Math.min(1, 1 - days / windowDays));
    var hot = days < 7;
    return '<svg class="ring' + (hot ? " hot" : "") + '" viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle cx="50" cy="50" r="' + r + '" class="ring-bg"/>' +
      '<circle cx="50" cy="50" r="' + r + '" class="ring-fg" style="--c:' + c.toFixed(1) + ";--f:" + (c * (1 - f)).toFixed(1) + '"/>' +
      '<text x="50" y="50" class="ring-n">' + days + "</text>" +
      '<text x="50" y="70" class="ring-u">' + esc(tp("unit.days", days)) + "</text></svg>";
  }

  /* ---------- map: approved outline from ikartuzov-hub/ndm (not redrawn) ---------- */
  var MAP_PATHS = {
    madeira: "M39,156 C40,150 48,146 57,144 C67,143 77,143 86,145 C93,146 99,148 105,150 L116,155 C113,157 107,159 100,161 C91,163 79,165 67,164 C56,163 46,162 41,160 C38,159 37,158 38,157 Z",
    portoSanto: "M124,127 C128,125 133,125 136,127 C137,129 134,131 130,132 C126,132 123,130 124,127 Z"
  };
  var PULSES = [[82, 158], [104, 155], [66, 147], [49, 156], [130, 128.6]];
  function mapSVG(label) {
    return '<svg class="map" viewBox="30 116 114 56" role="img" aria-label="' + esc(label || "Madeira · Porto Santo") + '">' +
      '<path class="isle" d="' + MAP_PATHS.madeira + '"/><path class="isle" d="' + MAP_PATHS.portoSanto + '"/>' +
      PULSES.map(function (p, i) {
        return '<g class="pulse" style="--i:' + i + '"><circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.1"/>' +
          '<circle class="pr" cx="' + p[0] + '" cy="' + p[1] + '" r="1.1"/></g>';
      }).join("") + "</svg>";
  }
  function drawMap(root) {
    (root || document).querySelectorAll(".map .isle").forEach(function (p) {
      var L = p.getTotalLength ? p.getTotalLength() : 300;
      p.style.setProperty("--len", L.toFixed(1));
      p.classList.remove("go"); void p.getBoundingClientRect(); p.classList.add("go");
    });
    (root || document).querySelectorAll(".map").forEach(function (m) { m.classList.add("lit"); });
  }

  /* ---------- QR (local library, offline) ---------- */
  function qrSVG(text, cls) {
    var q = window.qrcode(0, "M"); q.addData(text); q.make();
    var n = q.getModuleCount(), d = "";
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (q.isDark(y, x)) d += "M" + x + " " + y + "h1v1h-1z";
    return '<svg class="' + (cls || "qr") + '" viewBox="-2 -2 ' + (n + 4) + " " + (n + 4) + '" shape-rendering="crispEdges" role="img" aria-label="QR">' +
      '<rect x="-2" y="-2" width="' + (n + 4) + '" height="' + (n + 4) + '" fill="#fff"/><path d="' + d + '" fill="#0B1220"/></svg>';
  }

  /* ---------- share ---------- */
  function share(text, url, btn) {
    var full = text + " " + url;
    if (navigator.share) { navigator.share({ title: t("name"), text: text, url: url }).catch(function () {}); return; }
    var done = function () {
      if (!btn) return;
      var old = btn.textContent; btn.textContent = t("share.copied");
      setTimeout(function () { btn.textContent = old; }, 1800);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(full).then(done, done);
    else { var ta = document.createElement("textarea"); ta.value = full; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {} ta.remove(); done(); }
  }

  /* ---------- brand, top bar, footer ---------- */
  var MARK = '<svg class="mark" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M36 66 L36 16 L54 16 C66 16 72 24 72 33 C72 42 66 50 54 50 L36 50"/><path d="M14 84 Q26 78 38 84 Q50 90 62 84 Q74 78 86 84"/></g></svg>';
  function topbar(el, opt) {
    opt = opt || {};
    el.innerHTML =
      '<a class="brand" href="' + (opt.home || langPath(lang, "")) + '">' + MARK + '<span class="wm">' + esc(t("name")) + "</span></a>" +
      '<div class="topctrl"><div class="langwrap"><button class="rnd" id="langBtn" aria-haspopup="true" aria-expanded="false" aria-label="' +
      esc(t("a11y.lang")) + '">' + lang.toUpperCase() + '</button><div class="menu" id="langMenu" hidden></div></div>' +
      '<button class="rnd" id="themeBtn" aria-label="' + esc(t("a11y.theme")) + '">' + (theme === "light" ? "☾" : "☀") + "</button></div>";
    var menu = el.querySelector("#langMenu"), btn = el.querySelector("#langBtn");
    menu.innerHTML = LANGS.map(function (l) {
      return '<button data-l="' + l + '" class="' + (l === lang ? "on" : "") + '"><b>' + l.toUpperCase() + "</b> " + LNAME[l] + "</button>";
    }).join("");
    btn.onclick = function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute("aria-expanded", String(!menu.hidden)); };
    document.addEventListener("click", function () { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") menu.hidden = true; });
    menu.onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var l = b.getAttribute("data-l"); store.set("painel.lang", l);
      if (opt.onLang) opt.onLang(l); else goLang(l);
    };
    el.querySelector("#themeBtn").onclick = function () {
      theme = theme === "light" ? "dark" : "light"; store.set("painel.theme", theme); applyTheme();
      this.textContent = theme === "light" ? "☾" : "☀";
    };
  }
  function goLang(l) {
    if (window.PAINEL_PAGE != null) {
      var u = new URL(langPath(l, window.PAINEL_PAGE), document.baseURI);
      u.search = location.search.replace(/([?&])(l|lang)=[a-z]{2}&?/g, "$1").replace(/[?&]$/, "");
      location.href = u.href;
    } else {
      var p = new URLSearchParams(location.search); p.set("l", l); location.search = p.toString();
    }
  }
  function footer(el) {
    el.innerHTML = '<p class="disc">' + esc(t("disclaimer")) + "</p>" +
      '<p class="copy">© ' + new Date().getFullYear() + ' <a href="' + hubHome() + '">SeedWave</a> · <a href="' +
      REG.linkedin + '" rel="author">Igor Kartuzov</a></p>';
  }
  function stamp(p) { return t("verified", { d: fmtDate(p.verified) }); }
  function levelLabel(p) { return t("level." + p.level); }
  function audLabel(p) { return (p.audience || []).map(function (a) { return t("aud." + a); }).join(" · "); }
  function descOf(p) { return (p.desc && (p.desc[lang] || p.desc.pt)) || ""; }

  window.Painel = {
    LANGS: LANGS, LNAME: LNAME, PROFILES: PROFILES, REDUCED: REDUCED, SUB: SUB, REG: REG, DATA: DATA,
    get lang() { return lang; }, get theme() { return theme; }, store: store,
    t: t, tp: tp, esc: esc, slug: slug, loadAll: loadAll, getJSON: getJSON, base: base,
    daysTo: daysTo, fmtDate: fmtDate, fmtDay: fmtDay, status: status, flapText: flapText,
    byProfile: byProfile, openPrograms: openPrograms, closingSoon: closingSoon, nextDeadlines: nextDeadlines,
    changes: changes, seminarsAhead: seminarsAhead, seminarWhen: seminarWhen,
    hubLink: hubLink, hubHome: hubHome, langPath: langPath, siteUrl: siteUrl, phoneUrl: phoneUrl, tag: tag,
    flap: flap, odometer: odometer, ring: ring, mapSVG: mapSVG, drawMap: drawMap, qrSVG: qrSVG, share: share,
    MARK: MARK, topbar: topbar, footer: footer, goLang: goLang, stamp: stamp,
    levelLabel: levelLabel, audLabel: audLabel, descOf: descOf, applyTheme: applyTheme
  };
})();
