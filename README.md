# Ruang Latihan versi mandiri (prototipe, belum dipakai anak)

Artifact lama (https://claude.ai/artifact/ByiexDQnKSEV2fFddbE7aC) TIDAK diubah. Versi ini dibangun paralel.

## Isi folder
- `site/` : situs statis (index.html, paket/*.json, sw.js untuk offline, manifest untuk "Tambah ke Layar Utama", config.js).
- `apps-script/Code.gs` : penyimpanan hasil di Google Sheet (tab Percobaan + Data_Soal), PIN orang tua untuk rekap, impor data lama, cadangan mingguan.
- `tools/paket_tool.py` : tambah/validasi paket (aturan sama dengan versi artifact).
- `tools/build_site.py` + `db_block.js` : membuat site/ dari halaman artifact.
- `tools/mock_server.py` : server uji lokal yang meniru Apps Script.
- `backup/attempts_lama_2026-11-12.json` : cadangan 8 percobaan dari artifact (6 latihan + 2 uji coba), diambil 12 Nov 2026.

## Langkah pindah (setelah disetujui Aulia)
1. Aulia: buat repo GitHub `ruang-latihan` (boleh kosong), tambahkan ke project; pasang Code.gs di Google Sheet baru (petunjuk di kepala file), kirim URL /exec + KUNCI_SIMPAN.
2. Claude: isi config.js, push site/ ke repo, aktifkan GitHub Pages, uji UJI-01 dari iPad.
3. Ekspor ulang data artifact pada hari pindah (agar hasil terbaru ikut), unggah ke Drive, jalankan `imporDataLama()`; cocokkan jumlah baris.
4. iPad: buka URL baru di Safari > Bagikan > Tambah ke Layar Utama. Artifact lama tetap ada sebagai cadangan.

## Alur paket baru
Foto buku -> Claude menyusun paket JSON -> `paket_tool.py add` -> commit & push -> GitHub Pages memperbarui dalam 1-2 menit.

## Penilaian isian (17 Nov 2026)
Aturan ada di `index.html` (blok "Penilaian isian") dan diuji dengan `node tools/uji_isian.js` (kasus contoh + semua kunci di paket/).
- Diterima: huruf besar/kecil, tanda baca, tanda hubung, "aba2" = "aba-aba", kata tambahan pendek (maks. 4 kata, mis. "makhluk sosial", "di pasar ikan"), urutan "A dan B" dibalik, dua jawaban dengan "atau" bila keduanya benar, angka ditulis dengan kata ("enam belas").
- Salah ketik kecil dihitung benar (anak diberi tahu tulisan yang benar): 1 huruf untuk kata 5-9 huruf, 2 huruf untuk kata ≥ 10 huruf, huruf bertukar tempat = 1. Kata < 5 huruf harus tepat. Tidak berlaku bila jawabannya lebih dekat ke jawaban keliru (`w`).
- Tetap salah: istilah lain yang maknanya berbeda, jawaban yang memuat jawaban keliru (`w`) atau menebak dengan "atau", kunci yang diingkari ("tidak tertulis"), menyalin kalimat panjang.
- `"ketat": true` (Bahasa Inggris): ejaan harus tepat; hanya huruf besar dan apostrof yang diabaikan.
