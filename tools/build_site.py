#!/usr/bin/env python3
"""
Membuat situs Ruang Latihan versi mandiri dari halaman artifact yang sekarang.

  python3 build_site.py <index_artifact.html> <folder_site>

- Paket di dalam <script id="paketData"> dipindah ke site/paket/<id>.json + daftar.json.
- Penyimpanan window.claude (db) diganti dengan Google Apps Script (lihat apps-script/Code.gs).
- Ditambah manifest + service worker (bisa dipakai saat internet putus, bisa "Tambah ke Layar Utama").
Setiap penggantian diperiksa; skrip berhenti bila teks yang dicari tidak ditemukan.
"""
import json, os, re, sys, hashlib

src, site = sys.argv[1], sys.argv[2]
html = open(src, encoding="utf-8").read()

def rep(old, new, count=1):
    global html
    n = html.count(old)
    if n != count:
        sys.exit(f"Teks tidak ditemukan tepat {count}x (ketemu {n}): {old[:80]!r}")
    html = html.replace(old, new)

# 1. pindahkan paket ke file JSON
m = re.search(r'(<script type="application/json" id="paketData">)(.*?)(</script>)', html, re.S)
pakets = json.loads(m.group(2).replace("<\\/", "</"))
os.makedirs(os.path.join(site, "paket"), exist_ok=True)
daftar = []
for p in pakets:
    body = json.dumps(p, ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(site, "paket", p["id"] + ".json"), "w", encoding="utf-8").write(body)
    daftar.append({"file": p["id"] + ".json", "v": hashlib.sha1(body.encode()).hexdigest()[:8]})
json.dump(daftar, open(os.path.join(site, "paket", "daftar.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
html = html[:m.start(2)] + "[]" + html[m.end(2):]

# 2. kepala halaman: PWA
rep('<meta name="claude:viewport-fit-sides" content="cover">',
    '<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icon-180.png">\n'
    '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="Ruang Latihan">\n'
    '<meta name="theme-color" content="#6a3fd6">\n<script src="config.js"></script>')

# 3. muat paket dari file
rep('try { PAKETS = JSON.parse(document.getElementById("paketData").textContent); } catch (e) { PAKETS = []; }\n'
    'var BYID = {}; PAKETS.forEach(function (p) { BYID[p.id] = p; });',
    '''var BYID = {};
function loadPakets() {
  return fetch("paket/daftar.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (list) {
    return Promise.all(list.map(function (f) {
      return fetch("paket/" + f.file + "?v=" + encodeURIComponent(f.v || "")).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }));
  }).then(function (arr) {
    PAKETS = arr.filter(Boolean); BYID = {}; PAKETS.forEach(function (p) { BYID[p.id] = p; });
  }).catch(function () { PAKETS = []; });
}''')
rep('var DRIVE_URL = "https://drive.google.com/drive/folders/1MjvmhHNrERyZF-gNippPi6oOYxo2-w85";',
    'var CFG = window.RL_CONFIG || {};\nvar DRIVE_URL = CFG.SHEET_URL || "https://drive.google.com/drive/folders/1MjvmhHNrERyZF-gNippPi6oOYxo2-w85";')

# 4. ganti blok database
a = html.index("/* ===== Database ===== */")
b = html.index("/* ===== Home ===== */")
html = html[:a] + open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "db_block.js"), encoding="utf-8").read() + "\n" + html[b:]

# 5. statistik beranda: pakai ringkasan server bila rekap lengkap belum dimuat
rep('function statsFor(pid) {\n  var list = ATTEMPTS.filter',
    '''function statsFor(pid) {
  if (!attemptsLoaded) {
    var pq = lsGet("rl-pending", []).filter(function (a) { return a.paketId === pid; });
    var sm = SUMMARY[pid] || { n: 0 }, nn = (sm.n || 0) + pq.length;
    if (!nn) { var l0 = lsGet("rl-last", {})[pid]; return l0 ? { n: l0.ke || 1, last: l0.nilai } : { n: 0 }; }
    return { n: nn, last: pq.length ? pq[pq.length - 1].nilai : sm.last };
  }
  var list = ATTEMPTS.filter''')

# 6. rekap: gerbang PIN orang tua
rep('''  if (!db) { $("rNote").textContent = "Data belum bisa dibaca (tidak tersambung). Buka halaman ini saat masuk ke akun Claude Anda."; $("rBody").innerHTML = ""; return; }''',
    '''  if (!CFG.API_URL) { $("rNote").textContent = "Penyimpanan belum disambungkan (config.js masih kosong)."; $("rBody").innerHTML = ""; return; }
  if (!parentPin()) { pinForm(); return; }
  if (!db) { $("rNote").textContent = "Data belum bisa dibaca karena tidak tersambung ke internet. Coba lagi nanti."; $("rBody").innerHTML = ""; return; }''')
rep('"Rekap ini dihitung langsung dari setiap jawaban. Analisis lengkap ada di Google Sheet yang diperbarui otomatis setiap malam: " +\n'
    '    \'<a href="\' + DRIVE_URL + \'" target="_blank" rel="noopener">folder Rekap Belajar Anak</a>.\'',
    '"Rekap ini dihitung langsung dari setiap jawaban. Data mentah setiap soal tersimpan di " +\n'
    '    \'<a href="\' + DRIVE_URL + \'" target="_blank" rel="noopener">Google Sheet Ruang Latihan</a>.\' +\n'
    '    \' <button class="linkbtn" type="button" id="pinOut">Kunci rekap</button>\'')
rep('  $("rBody").innerHTML = h + historyHtml(ATTEMPTS);\n}',
    '  $("rBody").innerHTML = h + historyHtml(ATTEMPTS);\n  bindPinOut();\n}')

# 7. awal: muat paket dulu, lalu sambungkan
rep('refreshStatus(); route();\n</script>',
    '''refreshStatus();
loadPakets().then(function () { route(); connect(); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
</script>''')

# 8. sedikit gaya untuk form PIN
rep('\n</style>\n', '\n.pinf{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.pinf input{font:inherit;font-size:20px;padding:10px 12px;border:2px solid var(--line);border-radius:12px;width:160px;letter-spacing:4px}'
    '.linkbtn{background:none;border:0;color:var(--pri);font:inherit;text-decoration:underline;cursor:pointer;padding:0}\n</style>\n')

assert "window.claude" not in html, "masih ada window.claude"
open(os.path.join(site, "index.html"), "w", encoding="utf-8").write(html)
print("OK:", len(pakets), "paket ->", os.path.join(site, "paket"), "| index.html", len(html), "bita")
