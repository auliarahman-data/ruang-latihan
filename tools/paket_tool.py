#!/usr/bin/env python3
"""
Alat paket Ruang Latihan (versi situs mandiri). Paket = satu file JSON di site/paket/.

  python3 paket_tool.py check  <folder_site>                 # validasi semua paket
  python3 paket_tool.py list   <folder_site>                 # daftar paket
  python3 paket_tool.py add    <folder_site> baru1.json ...  # tambah/ganti paket (berdasarkan id), lalu validasi

Alur dari foto buku: susun paket JSON (format Playbook [HT-06]) -> add -> commit & push ke repo
-> GitHub Pages memperbarui situs dalam 1-2 menit -> paket muncul di iPad.
Aturan validasi sama dengan paket_tool versi artifact.
"""
import json, os, re, sys, hashlib

def validate(p):
    err = []
    for f in ["id", "mapel", "bab", "judulBab", "paket", "pg", "isian"]:
        if f not in p: err.append("field hilang: " + f)
    if not re.fullmatch(r"[A-Za-z0-9_\-]{2,60}", str(p.get("id", ""))): err.append("id paket tidak valid (huruf, angka, - dan _ saja)")
    mk = p.get("mk", {})
    ids = set()
    for i, m in enumerate(p.get("pg", [])):
        tag = f"{p['id']} PG{i+1}"
        if len(m.get("o", [])) < 2: err.append(tag + ": opsi < 2")
        if len(set(m["o"])) != len(m["o"]): err.append(tag + ": opsi kembar")
        if "m" in m and len(m["m"]) != len(m["o"]): err.append(tag + ": panjang m != o")
        for c in (m.get("m") or []):
            if c and c not in mk: err.append(tag + ": kode miskonsepsi tak terdaftar " + c)
        if m.get("m") and m["m"][0]: err.append(tag + ": opsi benar diberi kode miskonsepsi")
        if not m.get("e"): err.append(tag + ": penjelasan kosong")
        if m.get("id") in ids: err.append(tag + ": id kembar")
        ids.add(m.get("id"))
    for i, s in enumerate(p.get("isian", [])):
        tag = f"{p['id']} isian{i+1}"
        if ("k" in s) == ("n" in s): err.append(tag + ": harus punya tepat salah satu k (kata) atau n (angka)")
        for c in list((s.get("w") or {}).values()) + ([s["mk"]] if s.get("mk") else []):
            if c not in mk: err.append(tag + ": kode miskonsepsi tak terdaftar " + c)
        if not s.get("e"): err.append(tag + ": penjelasan kosong")
        if s.get("id") in ids: err.append(tag + ": id kembar")
        ids.add(s.get("id"))
    if re.search(r"(sulit|mudah|susah)", json.dumps([p.get("judulBab"), p.get("paket")]).lower()): err.append(p["id"] + ": label tingkat terlihat anak")
    return err

def load(site):
    d = os.path.join(site, "paket")
    daftar = json.load(open(os.path.join(d, "daftar.json"), encoding="utf-8"))
    return d, daftar, [json.load(open(os.path.join(d, x["file"]), encoding="utf-8")) for x in daftar]

def check_all(data):
    errs, seen = [], set()
    for p in data:
        if p["id"] in seen: errs.append("id paket kembar " + p["id"])
        seen.add(p["id"]); errs += validate(p)
    return errs

def main():
    cmd, site = sys.argv[1], sys.argv[2]
    d, daftar, data = load(site)
    if cmd == "list":
        for p in data:
            print(p["id"], "|", p["mapel"], "Bab", p["bab"], p["judulBab"], "| Paket", p["paket"], "|", len(p["pg"]), "PG +", len(p["isian"]), "isian", "| uji" if p.get("uji") else "")
        return
    if cmd == "add":
        for f in sys.argv[3:]:
            p = json.load(open(f, encoding="utf-8"))
            data = [x for x in data if x["id"] != p["id"]] + [p]
    errs = check_all(data)
    if errs:
        print("GAGAL:"); print("\n".join(errs)); sys.exit(1)
    if cmd == "add":
        daftar = []
        for p in data:
            body = json.dumps(p, ensure_ascii=False, separators=(",", ":"))
            open(os.path.join(d, p["id"] + ".json"), "w", encoding="utf-8").write(body)
            daftar.append({"file": p["id"] + ".json", "v": hashlib.sha1(body.encode()).hexdigest()[:8]})
        json.dump(daftar, open(os.path.join(d, "daftar.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print("OK:", len(data), "paket valid")

if __name__ == "__main__":
    main()
