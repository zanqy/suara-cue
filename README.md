# Suara — Cue Desk

Pemutar cue manual untuk operator sound. Satu lagu ON AIR, volume per kartu, fade keluar/masuk dengan hitung mundur. Jalan di Windows, Linux, dan Android.

## Stack
TypeScript + Vite + Web Audio API + IndexedDB. Desktop: Electron. Android: Capacitor.
UI mengikuti preview yang sudah disetujui: https://zanqy.github.io/preview/suara-cue/

## Develop
```bash
npm install
npm test
npm run dev
```

## Build desktop (Linux)
```bash
npm run dist:linux
```
Hasil: `dist-electron/*.tar.gz` (atau `dist/*.tar.gz` pada build lama).

## Build Android
```bash
export JAVA_HOME=~/jdk21
export ANDROID_HOME=~/Android/Sdk
npm run cap:add   # sekali
npm run cap:sync
cd android && ./gradlew assembleDebug
```
Hasil: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Kontrol
- `1`–`8` pilih kartu, `↑`/`↓` volume kartu aktif (±5%), `X` stop, `M` mute semua.
- `KELUAR [N]s`: STOP → slider turun + hitung mundur, mati di nol. STOP lagi = mati seketika.
- `MASUK [N]s`: `0` = langsung; `>0` = slider naik dari nol selama N detik.
- File dan setting tersimpan lokal di IndexedDB.
