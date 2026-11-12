/* ===== Database: Google Sheet lewat Google Apps Script ===== */
/* Hasil disimpan dulu di perangkat (rl-pending), lalu dikirim saat ada internet. Server menolak kiriman ganda (id sama). */
var db = null, dbState = "connecting", ATTEMPTS = [], attemptsLoaded = false, SUMMARY = {}, pinError = "";
function setStatus(state, text) {
  dbState = state;
  var el = $("stHome"); el.className = "status " + (state === "ok" ? "ok" : state === "connecting" ? "" : state === "pending" ? "warn" : "bad");
  el.lastElementChild.textContent = text;
}
function refreshStatus() {
  var pend = lsGet("rl-pending", []).length;
  if (!CFG.API_URL) { setStatus("off", "Nilai hanya tersimpan di perangkat ini"); return; }
  if (!db) { setStatus(dbState === "connecting" ? "connecting" : (pend ? "pending" : "off"), dbState === "connecting" ? "Menyambungkan…" : (pend ? pend + " hasil menunggu internet" : "Belum tersambung. Nilai tetap tersimpan di perangkat ini")); return; }
  if (pend) setStatus("pending", pend + " hasil menunggu disimpan");
  else setStatus("ok", "Nilai tersimpan otomatis");
}
function api(params, body) {
  var url = CFG.API_URL + "?" + Object.keys(params).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); }).join("&");
  var ctrl = window.AbortController ? new AbortController() : null;
  var tm = setTimeout(function () { if (ctrl) ctrl.abort(); }, 25000);
  var opt = { redirect: "follow", signal: ctrl ? ctrl.signal : undefined };
  if (body) { opt.method = "POST"; opt.body = JSON.stringify(body); opt.headers = { "Content-Type": "text/plain;charset=utf-8" }; }
  return fetch(url, opt).then(function (r) { return r.json(); }).then(function (j) {
    clearTimeout(tm); if (!j || !j.ok) throw (j || { error: "kosong" }); return j;
  }, function (e) { clearTimeout(tm); throw { error: "jaringan", detail: String(e) }; });
}
function connect() {
  if (!CFG.API_URL) { dbState = "off"; refreshStatus(); return; }
  api({ action: "summary", key: CFG.WRITE_KEY }).then(function (j) {
    db = true; SUMMARY = j.summary || {}; refreshStatus(); renderHome();
    return flushPending().then(function () { if (parentPin() && !$("vRekap").hidden) loadAttempts(); });
  }).catch(function () { db = null; dbState = "off"; refreshStatus(); });
}
function parentPin() { return lsGet("rl-pin", ""); }
function pinForm() {
  $("rNote").textContent = "Rekap ini untuk orang tua. Masukkan PIN orang tua.";
  $("rBody").innerHTML = '<div class="card"><form class="pinf" id="pinF"><input id="pinIn" type="password" inputmode="numeric" autocomplete="off" aria-label="PIN orang tua">' +
    '<button class="btn" type="submit">Buka rekap</button></form>' + (pinError ? '<p class="note" style="color:var(--bad)">' + esc(pinError) + "</p>" : "") + "</div>";
  $("pinF").onsubmit = function (e) {
    e.preventDefault(); var v = $("pinIn").value.trim(); if (!v) return;
    lsSet("rl-pin", v); pinError = ""; attemptsLoaded = false; $("rNote").textContent = "Memeriksa PIN…"; $("rBody").innerHTML = "";
    if (!db) connect(); else loadAttempts();
  };
}
function bindPinOut() {
  var b = $("pinOut"); if (!b) return;
  b.onclick = function () { lsSet("rl-pin", ""); ATTEMPTS = []; attemptsLoaded = false; renderRekap(); };
}
function loadAttempts() {
  if (!db) return Promise.resolve();
  if (!parentPin()) return api({ action: "summary", key: CFG.WRITE_KEY }).then(function (j) { SUMMARY = j.summary || {}; renderHome(); }).catch(function () {});
  return api({ action: "list" }, { action: "list", pin: parentPin() }).then(function (j) {
    ATTEMPTS = j.attempts || []; attemptsLoaded = true; renderHome(); if (!$("vRekap").hidden) renderRekap();
  }).catch(function (e) {
    attemptsLoaded = false;
    if (e && e.error === "pin") { lsSet("rl-pin", ""); pinError = "PIN salah. Coba lagi."; }
    if (!$("vRekap").hidden) { if (!parentPin()) pinForm(); else $("rNote").textContent = "Data belum bisa dimuat. Coba lagi nanti."; }
  });
}

var flushing = false;
function flushPending() {
  if (!CFG.API_URL || flushing) return Promise.resolve();
  var q = lsGet("rl-pending", []); if (!q.length) { refreshStatus(); return Promise.resolve(); }
  flushing = true;
  var a = q[0];
  var body = JSON.parse(JSON.stringify(a)); var id = body._docId; delete body._docId;
  return api({ action: "save" }, { action: "save", key: CFG.WRITE_KEY, id: id, attempt: body }).then(function (j) {
    db = true;
    a.percobaanKe = j.percobaanKe;
    var rest = lsGet("rl-pending", []).filter(function (x) { return x._docId !== id; });
    lsSet("rl-pending", rest);
    var last = lsGet("rl-last", {}); last[a.paketId] = { nilai: a.nilai, ke: a.percobaanKe }; lsSet("rl-last", last);
    if (!j.duplikat) {
      var s = SUMMARY[a.paketId] = SUMMARY[a.paketId] || { n: 0, best: 0 }; s.n++; s.last = a.nilai; s.best = Math.max(s.best || 0, a.nilai);
      if (attemptsLoaded) { body._id = id; body.percobaanKe = j.percobaanKe; ATTEMPTS.push(body); }
    }
    if (currentSaveId === id) showSave("Tersimpan ✓ (percobaan ke-" + a.percobaanKe + ")");
    flushing = false; return flushPending();
  }).catch(function (e) {
    flushing = false;
    if (e && e.error === "jaringan") { db = null; dbState = "off"; }
    refreshStatus();
    if (currentSaveId === a._docId) showSave(e && e.error === "key" ? "Kunci penyimpanan salah. Beri tahu orang tua." : "Belum tersimpan. Nilai aman di perangkat ini dan akan dikirim otomatis saat ada internet.");
  }).then(function () { refreshStatus(); });
}
window.addEventListener("online", function () { if (!db) connect(); else flushPending(); });
document.addEventListener("visibilitychange", function () { if (!document.hidden) { if (!db) connect(); else flushPending(); } });
setInterval(function () { if (lsGet("rl-pending", []).length) { if (!db) connect(); else flushPending(); } }, 60000);
