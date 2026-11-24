# Suara Cue Desk — Design

## Intent
Aplikasi cue desk untuk operator sound: satu papan kartu lagu, satu lagu bunyi, kontrol manual volume dan hitung mundur saat stop/start. Jalan di Windows, Linux, dan Android. UI sudah disetujui pada preview `zanqy/preview/suara-cue/` dan **tidak diubah**.

## Goals
- Kartu lagu dibuat dari file audio yang dipilih pengguna (file picker / drag-drop), bukan scan library.
- Satu lagu ON AIR; kartu lain tetap terlihat dan siap dipencet.
- Volume kartu murni manual, tersimpan per kartu, tidak terpengaruh kartu lain.
- STOP: slider kartu turun bertahap selama detik `KELUAR` per kartu, hitung mundur terlihat, audio mati benar-benar di nol. STOP lagi saat masih turun = mati seketika.
- START: detik `MASUK` per kartu; 0 = langsung, >0 = slider naik dari nol ke volume kartu.
- Setelah fade-out selesai, slider kembali ke volume tersimpan agar putar ulang memakai nilai itu.
- Hotkeys: 1–8 pilih kartu, ↑↓ ubah volume kartu aktif (5%), X stop, M mute semua.
- Status: SIAP / ON AIR / FADE MASUK / HITUNG MUNDUR / SUNYI / MUTE SEMUA + detik & persen.
- Output musik bisa dipilih; mic tetap jalur terpisah dan tidak pernah disentuh aplikasi.
- File + setting tersimpan lokal per perangkat.

## Non-goals
Musik latar otomatis, playlist berurutan, streaming, edit tag, dua lagu bunyi bersamaan, remote laptop↔HP, koneksi jaringan.

## Constraints
- Token visual Suara: bg #0B0D0B, surface #171B17, ink #F3F0E7, muted #B7BFB4, line #333B33, coral #FF7654, amber #F3C45C, mint #7CE0B4; Fraunces + IBM Plex Mono + DM Sans.
- Java 21 di `~/jdk21`, Android SDK di `~/Android/Sdk`; Windows tidak bisa di-build di Linux → GitHub Actions.
- Tidak ada server/backend; semua lokal.

## Approaches
A. Flutter — native sejati, satu kode Dart, tetapi UI harus ditulis ulang (risiko drift visual).
B. Web frontend + Electron (Windows/Linux) + Capacitor (Android) — **dipilih**: UI yang disetujui dipakai apa adanya, Web Audio memberi fade presisi, satu desain untuk tiga platform. Trade-off: Electron besar, background audio HP lewat WebView kurang solid.
C. PWA — paling cepat, tapi tab harus terbuka dan output device terbatas.

## Design
`src/main.ts` mengelola model kartu dan Web Audio. Tiap kartu: `<audio>` → `GainNode` → destination; nilai gain mengikuti variabel `level` yang sama dengan slider UI. File disimpan sebagai Blob di IndexedDB supaya object URL bisa dibuat ulang setelah restart. `src/logic.ts` berisi helper murni (`numSec`, `clampPct`, perhitungan level fade) yang diuji dengan `node:test`.

## Assumptions
HP memutar file sendiri (bukan remote). Jumlah kartu dinamis mengikuti file yang dipilih. Tidak ada autoplay latar.

## Left to builder
Detail implementasi UI, pemilihan ikon, dan strategi pengemasan release mengikuti standar stack yang dipilih.
