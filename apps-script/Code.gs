/**
 * Ruang Latihan: penyimpanan hasil latihan di Google Sheet (Google Apps Script).
 *
 * Cara pasang (sekali saja, dilakukan orang tua di akun Google sendiri):
 *  1. Buat Google Sheet baru, misalnya "Ruang Latihan - Data".
 *  2. Menu Ekstensi > Apps Script. Hapus isi Code.gs, tempel seluruh file ini.
 *  3. Ganti PIN_ORANG_TUA di bawah (4-8 angka). PIN ini TIDAK dimasukkan ke situs.
 *  4. Pilih fungsi "setup" lalu klik Jalankan. Izinkan akses. Lihat "Log eksekusi":
 *     catat KUNCI_SIMPAN yang tertulis di sana.
 *  5. Terapkan > Deployment baru > Jenis: Aplikasi web.
 *     Jalankan sebagai: Saya. Yang memiliki akses: Siapa saja.
 *     Salin URL aplikasi web (berakhiran /exec).
 *  6. Masukkan URL dan KUNCI_SIMPAN ke site/config.js.
 *  Jika kode ini diubah lagi: Terapkan > Kelola deployment > ikon pensil > Versi: Versi baru.
 *  JANGAN membuat "Deployment baru" lagi, karena URL-nya akan berubah.
 */

const PIN_ORANG_TUA = "GANTI-DENGAN-PIN-ANDA";

const SH_PERCOBAAN = "Percobaan";
const SH_SOAL = "Data_Soal";
const H_PERCOBAAN = ["id", "selesai", "paketId", "mapel", "bab", "judulBab", "paket", "percobaanKe", "uji", "nilai",
  "pgBenar", "pgTotal", "isBenar", "isTotal", "kosong", "durasiDetik", "perangkat", "miskonsepsi", "json"];
const H_SOAL = ["id_percobaan", "selesai", "mapel", "bab", "paket", "percobaanKe", "uji", "no", "id_soal", "tipe", "sub", "lv",
  "neg", "q", "jawaban", "awal", "kunci", "benar", "ejaan", "mk", "t", "ubah"];
const COL_ID = 1, COL_PAKET = 3, COL_KE = 8, COL_JSON = 19;
const MAX_SEL = 49000; // batas Google Sheet: 50.000 karakter per sel

/* ---------- pemasangan ---------- */
function setup() {
  const ss = SpreadsheetApp.getActive();
  [[SH_PERCOBAAN, H_PERCOBAAN], [SH_SOAL, H_SOAL]].forEach(function (x) {
    let sh = ss.getSheetByName(x[0]);
    if (!sh) sh = ss.insertSheet(x[0]);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, x[1].length).setValues([x[1]]).setFontWeight("bold");
      sh.setFrozenRows(1);
    }
  });
  const props = PropertiesService.getScriptProperties();
  let k = props.getProperty("KUNCI_SIMPAN");
  if (!k) { k = Utilities.getUuid().replace(/-/g, "").slice(0, 24); props.setProperty("KUNCI_SIMPAN", k); }
  Logger.log("KUNCI_SIMPAN: " + k);
  if (PIN_ORANG_TUA.indexOf("GANTI") === 0) Logger.log("PERHATIAN: PIN_ORANG_TUA belum diganti.");
}

/* ---------- pintu masuk web ---------- */
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === "ping") return out_({ ok: true, waktu: new Date().toISOString() });
    if (p.action === "summary") {
      if (!kunciOk_(p.key)) return out_({ ok: false, error: "key" });
      return out_({ ok: true, summary: ringkasan_() });
    }
    return out_({ ok: false, error: "action" });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (b.action === "save") return out_(simpan_(b));
    if (b.action === "list") return out_(daftar_(b));
    if (b.action === "import") {
      if (!pinOk_(b.pin)) return out_({ ok: false, error: "pin" });
      return out_(imporBanyak_(b.attempts || []));
    }
    return out_({ ok: false, error: "action" });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
}

/* ---------- logika ---------- */
function simpan_(b) {
  if (!kunciOk_(b.key)) return { ok: false, error: "key" };
  const a = b.attempt || {}, id = String(b.id || "");
  if (!/^[A-Za-z0-9_\-]{3,80}$/.test(id) || !a.paketId || !Array.isArray(a.items)) return { ok: false, error: "data" };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_(SH_PERCOBAAN);
    const ada = cariBaris_(sh, id);
    if (ada) return { ok: true, duplikat: true, percobaanKe: sh.getRange(ada, COL_KE).getValue() };
    a.percobaanKe = hitungPaket_(sh, a.paketId) + 1;
    tulis_(id, a);
    return { ok: true, percobaanKe: a.percobaanKe };
  } finally { lock.releaseLock(); }
}

function imporBanyak_(list) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = sheet_(SH_PERCOBAAN);
    const sudah = {};
    if (sh.getLastRow() > 1) sh.getRange(2, COL_ID, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { sudah[r[0]] = 1; });
    list.sort(function (x, y) { return String(x.selesai).localeCompare(String(y.selesai)); });
    let masuk = 0, lewat = 0;
    list.forEach(function (a) {
      const id = a._id; delete a._id;
      if (!id || sudah[id]) { lewat++; return; }
      if (!a.percobaanKe) a.percobaanKe = hitungPaket_(sh, a.paketId) + 1;
      tulis_(id, a); sudah[id] = 1; masuk++;
    });
    return { ok: true, masuk: masuk, dilewati: lewat };
  } finally { lock.releaseLock(); }
}

function daftar_(b) {
  if (!pinOk_(b.pin)) return { ok: false, error: "pin" };
  const sh = sheet_(SH_PERCOBAAN), n = sh.getLastRow() - 1;
  if (n < 1) return { ok: true, attempts: [] };
  const rows = sh.getRange(2, 1, n, H_PERCOBAAN.length).getValues();
  const since = b.since ? String(b.since) : "";
  const list = [];
  rows.forEach(function (r) {
    if (since && String(r[1]) < since) return;
    let a;
    try { a = JSON.parse(r[COL_JSON - 1]); } catch (e) { return; }
    a._id = r[0]; a.percobaanKe = r[COL_KE - 1];
    list.push(a);
  });
  return { ok: true, attempts: list };
}

function ringkasan_() {
  const sh = sheet_(SH_PERCOBAAN), n = sh.getLastRow() - 1, s = {};
  if (n < 1) return s;
  sh.getRange(2, 1, n, 10).getValues().forEach(function (r) {
    const pid = r[2], nilai = Number(r[9]);
    const x = s[pid] = s[pid] || { n: 0, last: null, lastAt: "", best: 0 };
    x.n++; x.best = Math.max(x.best, nilai);
    if (String(r[1]) >= x.lastAt) { x.lastAt = String(r[1]); x.last = nilai; }
  });
  return s;
}

function tulis_(id, a) {
  const shP = sheet_(SH_PERCOBAAN), shS = sheet_(SH_SOAL);
  let json = JSON.stringify(a);
  if (json.length > MAX_SEL) { // potong teks soal di salinan JSON; teks soal tetap ada di Data_Soal
    const c = JSON.parse(json); c.items.forEach(function (it) { it.q = String(it.q || "").slice(0, 60); }); json = JSON.stringify(c);
  }
  shP.appendRow([id, a.selesai, a.paketId, a.mapel, a.bab, a.judulBab, a.paket, a.percobaanKe, !!a.uji, a.nilai,
    a.pgBenar, a.pgTotal, a.isBenar, a.isTotal, a.kosong, a.durasiDetik, a.perangkat, Object.keys(a.mk || {}).join(", "), json].map(aman_));
  const rows = (a.items || []).map(function (it) {
    return [id, a.selesai, a.mapel, a.bab, a.paket, a.percobaanKe, !!a.uji, it.no, it.id, it.tipe, it.sub, it.lv, !!it.neg, it.q,
      it.jawaban, it.awal, it.kunci, it.benar ? 1 : 0, !!it.ejaan, it.mk || "", it.t, it.ubah || 0].map(aman_);
  });
  if (rows.length) shS.getRange(shS.getLastRow() + 1, 1, rows.length, H_SOAL.length).setValues(rows);
}

/* ---------- cadangan mingguan (opsional) ---------- */
function cadanganSekarang() {
  const ss = SpreadsheetApp.getActive();
  const nama = ss.getName() + " - cadangan " + Utilities.formatDate(new Date(), "Asia/Makassar", "yyyy-MM-dd");
  DriveApp.getFileById(ss.getId()).makeCopy(nama);
}
function pasangCadanganMingguan() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "cadanganSekarang") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("cadanganSekarang").timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(21).create();
}

/* ---------- pindahan data lama (sekali saja) ---------- */
// Unggah file attempts_lama_*.json ke Google Drive, lalu jalankan fungsi ini.
function imporDataLama() {
  const it = DriveApp.searchFiles("title contains 'attempts_lama_' and trashed = false");
  if (!it.hasNext()) { Logger.log("File attempts_lama_*.json tidak ditemukan di Drive."); return; }
  const f = it.next();
  const hasil = imporBanyak_(JSON.parse(f.getBlob().getDataAsString("UTF-8")));
  Logger.log("Impor dari " + f.getName() + ": " + JSON.stringify(hasil));
}

/* ---------- pembantu ---------- */
function sheet_(nama) {
  const sh = SpreadsheetApp.getActive().getSheetByName(nama);
  if (!sh) throw new Error("Sheet " + nama + " belum ada. Jalankan setup().");
  return sh;
}
function cariBaris_(sh, id) {
  if (sh.getLastRow() < 2) return 0;
  const c = sh.getRange(2, COL_ID, sh.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
  return c ? c.getRow() : 0;
}
function hitungPaket_(sh, pid) {
  if (sh.getLastRow() < 2) return 0;
  return sh.getRange(2, COL_PAKET, sh.getLastRow() - 1, 1).getValues().filter(function (r) { return r[0] === pid; }).length;
}
function kunciOk_(k) {
  const s = PropertiesService.getScriptProperties().getProperty("KUNCI_SIMPAN");
  return !!s && k === s;
}
function pinOk_(pin) {
  const cache = CacheService.getScriptCache();
  const gagal = Number(cache.get("pin_gagal") || 0);
  if (gagal >= 10) return false; // kunci 15 menit setelah 10 kali salah
  if (PIN_ORANG_TUA.indexOf("GANTI") !== 0 && String(pin) === PIN_ORANG_TUA) return true;
  cache.put("pin_gagal", String(gagal + 1), 900);
  return false;
}
function aman_(v) { // cegah teks jawaban dibaca sebagai rumus Sheet
  return (typeof v === "string" && /^[=+@]/.test(v)) ? "'" + v : (v == null ? "" : v);
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
