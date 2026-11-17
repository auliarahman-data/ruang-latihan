#!/usr/bin/env node
/* Uji aturan penilaian isian di index.html.
   node tools/uji_isian.js          -> menjalankan semua kasus uji, keluar dengan kode 1 bila ada yang gagal
   Setiap kasus: [jawaban, kunci, ketat, jawaban keliru (w), hasil yang diharapkan 2/1/0, alasan] */
var fs = require("fs"), path = require("path");
var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
var a = html.indexOf("/* ===== Penilaian isian"), b = html.indexOf("function wrongTag(");
if (a < 0 || b < 0) { console.error("Blok penilaian isian tidak ditemukan di index.html"); process.exit(1); }
var E = new Function(html.slice(a, b) + "\nreturn { checkWord: checkWord, checkNum: checkNum, norm: norm };")();

var KATA = [
  // diterima: makna sama
  ["sosial", ["sosial"], 0, [], 2, "persis"],
  ["Sosial.", ["sosial"], 0, [], 2, "huruf besar dan titik diabaikan"],
  ["makhluk sosial", ["sosial"], 0, [], 2, "mengulang kata sebelum titik-titik"],
  ["karena manusia adalah makhluk sosial", ["sosial"], 0, [], 2, "kalimat jawaban pendek"],
  ["di pasar ikan", ["pasar ikan"], 0, [], 2, "kata depan"],
  ["lingkungan keluarga", ["keluarga"], 0, ["masyarakat", "sekolah"], 2, "kata sebelum titik-titik"],
  ["tertib dan aman", ["aman dan tertib"], 0, [], 2, "urutan dua jawaban dibalik"],
  ["Allah Swt.", ["allah swt"], 0, [], 2, "singkatan dan tanda baca"],
  ["aba-aba", ["aba aba"], 0, [], 2, "tanda hubung"],
  ["aba2", ["aba aba"], 0, [], 2, "angka 2 untuk kata ulang"],
  ["ayah atau ibu", ["orang tua", "ayah", "ibu"], 0, [], 2, "dua jawaban, keduanya benar"],
  ["kerja bakti", ["bakti", "kerja bakti"], 0, [], 2, "frasa utuh"],
  ["tidak langsung", ["tidak langsung"], 0, ["langsung"], 2, "kunci yang memang berisi 'tidak'"],
  // salah ketik kecil (nilai tetap benar, anak diberi tahu tulisan yang benar)
  ["toleransy", ["toleransi"], 0, ["empati"], 1, "salah ketik 1 huruf"],
  ["keluagra", ["keluarga"], 0, [], 1, "dua huruf bertukar tempat"],
  ["perpustkan", ["perpustakaan"], 0, [], 1, "kata panjang, kurang 2 huruf"],
  ["lingkungan keluaga", ["keluarga"], 0, [], 1, "salah ketik dalam frasa"],
  // tetap salah
  ["rumah", ["keluarga"], 0, ["masyarakat", "sekolah"], 0, "istilah buku berbeda"],
  ["lisan atau tertulis", ["tertulis", "tulisan"], 0, ["lisan", "nonverbal"], 0, "menebak dua jawaban"],
  ["lisan dan tertulis", ["tertulis", "tulisan"], 0, ["lisan", "nonverbal"], 0, "memuat jawaban keliru"],
  ["toleransi atau saling membantu", ["toleransi"], 0, [], 0, "pilihan lain dengan 'atau'"],
  ["tidak tertulis", ["tertulis"], 0, ["lisan"], 0, "kunci diingkari"],
  ["langsung", ["tidak langsung"], 0, ["langsung"], 0, "setengah jawaban"],
  ["setelah salat zuhur, hasna pergi ke perpustakaan sekolah. tempat untuk menyimpan buku, dibaca dan dipinjam", ["perpustakaan"], 0, [], 0, "menyalin seluruh kalimat, kata yang diminta tidak ditunjuk"],
  ["mencuci", ["dicuci"], 0, ["mencuci"], 0, "awalan me- vs di- adalah konsep yang diuji"],
  ["dicuci", ["dicuci"], 0, ["mencuci"], 2, "awalan di- benar"],
  ["dcuci", ["dicuci"], 0, ["mencuci"], 1, "salah ketik 1 huruf, bukan awalan lain"],
  ["menendang", ["ditendang"], 0, ["menendang"], 0, "bentuk aktif bukan pasif"],
  ["aktif", ["pasif"], 0, ["aktif"], 0, "lawan kata"],
  ["ayah", ["ibu"], 0, ["ayah"], 0, "peran tertukar"],
  ["ibi", ["ibu"], 0, ["ayah"], 0, "kata pendek (<5 huruf) harus tepat"],
  ["rapi", ["rata", "datar"], 0, [], 0, "makna berbeda"],
  ["soleh", ["tangguh", "pantang menyerah"], 0, [], 0, "makna berbeda"],
  ["perhatian", ["tujuan", "suatu tujuan"], 0, [], 0, "makna berbeda"],
  ["", ["sosial"], 0, [], 0, "kosong"],
  // Bahasa Inggris (ketat): ejaan diuji, huruf besar dan apostrof diabaikan
  ["Do", ["do"], 1, ["does"], 2, "huruf besar diabaikan"],
  ["doesnt", ["doesn't", "does not"], 1, ["don't"], 2, "apostrof boleh tidak ditulis"],
  ["does not", ["doesn't", "does not"], 1, ["don't"], 2, "bentuk panjang"],
  ["tim", ["time"], 1, ["taim", "tim"], 0, "ejaan salah"],
  ["techer", ["teacher"], 1, [], 0, "ketat: tanpa toleransi salah ketik"],
  ["on time", ["time"], 1, [], 0, "ketat: harus satu kata (belum diubah, menunggu keputusan)"]
];
var ANGKA = [
  ["16", 16, 2], ["16 buku", 16, 2], ["1.000", 1000, 2], ["enam belas", 16, 2], ["Enam belas buku", 16, 2],
  ["dua puluh lima", 25, 2], ["seratus delapan puluh tiga", 183, 2], ["seribu", 1000, 2], ["sebelas", 11, 2],
  ["empat puluh dua", 42, 2], ["tiga ratus", 300, 2], ["15", 16, 0], ["lima belas", 16, 0], ["banyak", 16, 0], ["", 16, 0]
];
var gagal = 0;
KATA.forEach(function (c) {
  var r = E.checkWord(c[0], c[1], !!c[2], c[3]);
  if (r !== c[4]) { gagal++; console.log("GAGAL  " + JSON.stringify(c[0]) + " kunci " + JSON.stringify(c[1]) + " -> " + r + " (harus " + c[4] + ") " + c[5]); }
});
ANGKA.forEach(function (c) {
  var r = E.checkNum(c[0], c[1]);
  if (r !== c[2]) { gagal++; console.log("GAGAL  angka " + JSON.stringify(c[0]) + " kunci " + c[1] + " -> " + r + " (harus " + c[2] + ")"); }
});
/* semua paket: setiap kunci diterima, setiap jawaban keliru (w) ditolak */
var dir = path.join(__dirname, "..", "paket"), nPaket = 0, nCek = 0;
fs.readdirSync(dir).filter(function (f) { return /\.json$/.test(f) && f !== "daftar.json"; }).forEach(function (f) {
  var p = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); nPaket++;
  (p.isian || []).forEach(function (s) {
    if (s.n != null) { nCek++; if (E.checkNum(String(s.n), s.n) !== 2) { gagal++; console.log("GAGAL  " + f + " " + s.id + " kunci angka ditolak"); } return; }
    var w = s.w ? Object.keys(s.w) : [];
    (s.k || []).concat([s.a]).forEach(function (k) { nCek++; if (E.checkWord(k, s.k || [], !!s.ketat, w) !== 2) { gagal++; console.log("GAGAL  " + f + " " + s.id + " kunci ditolak: " + k); } });
    w.forEach(function (x) { nCek++; if (E.checkWord(x, s.k || [], !!s.ketat, w) !== 0) { gagal++; console.log("GAGAL  " + f + " " + s.id + " jawaban keliru diterima: " + x); } });
  });
});
console.log(nPaket + " paket, " + nCek + " kunci/jawaban keliru diperiksa");
console.log((KATA.length + ANGKA.length - gagal) + " / " + (KATA.length + ANGKA.length) + " kasus lolos");
process.exit(gagal ? 1 : 0);
