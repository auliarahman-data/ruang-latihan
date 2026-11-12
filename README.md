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
