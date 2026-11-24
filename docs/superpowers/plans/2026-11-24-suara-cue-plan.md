# Suara Cue Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved cue-desk UI into one web codebase packaged as Windows/Linux desktop apps and an Android APK.

**Architecture:** Vanilla TypeScript + Vite frontend using Web Audio API. Electron wraps the web build for desktop; Capacitor wraps the same build for Android. Card files and settings persist in IndexedDB.

**Tech Stack:** TypeScript, Vite, Web Audio API, IndexedDB, Electron + electron-builder, Capacitor + Android Gradle, node:test.

**Spec:** `docs/superpowers/specs/2026-11-24-suara-cue-design.md`

## Global Constraints
- UI tokens and layout follow the approved preview exactly; no redesign.
- One track audible at a time; microphone is never touched.
- Volume is manual per card; fade seconds are per card.
- No network calls or uploads; all files stay local.
- Build with JDK 21 (`~/jdk21`) and Android SDK (`~/Android/Sdk`).

## Review Focus
- File missing after restart → Blob persisted in IndexedDB and object URL recreated on load.
- Fade duration wrong → audio gain and slider share the same `level` value and real elapsed time.
- Second STOP during countdown → immediate stop, no lingering audio.
- Switching cards must not change another card's saved volume.
- Android back/resume must restore cards and settings.

---

### Task 1: Scaffold project and approved UI shell
**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/styles.css`, `src/types.ts`
- Interface: `CardData` with `id: string; name: string; vol: number; fout: number; fin: number`.
- Copy the approved preview markup/tokens into `index.html` + `src/styles.css`; add `+ PILIH FILE` and per-card remove button.

### Task 2: Pure logic helpers and tests
**Files:** Create `src/logic.ts`, `tests/logic.test.ts`
- `numSec(v: unknown): number` — finite positive seconds clamped to 30, else 0.
- `clampPct(v: number): number` — 0..100 integer.
- `fadeLevel(from: number, to: number, progress: number): number` — linear interpolation.
- Tests assert 0/'abc'/negative → 0; 45 → 30; clamp; interpolation endpoints.

### Task 3: Audio engine, cards, persistence
**Files:** Create `src/main.ts`, `src/store.ts`, `src/audio.ts`
- `createCard(file: File): Promise<CardData>`; `loadCards(): Promise<CardData[]>`; `saveCards(cards: CardData[]): Promise<void>`.
- `playCard(i)`, `stopCard()`, `rampLevel(to, secs, onDone)`, hotkeys, output device enumeration, status text.
- STOP uses per-card `fout`; START uses per-card `fin`; slider follows `level`; restore saved volume after stop.

### Task 4: Electron desktop shell
**Files:** Create `electron/main.cjs`, `electron/preload.cjs`, build config in `package.json`
- Expose `openFileDialog()` and device list through `contextBridge`; electron-builder targets AppImage, deb, nsis.

### Task 5: Capacitor Android shell
**Files:** Create `capacitor.config.ts`, `android/` via `npx cap add android`
- Build debug APK with JDK 21 + Android SDK; verify installable file.

### Task 6: Verify and deliver
- Run `npm test`, `npm run build`, browser smoke test on built web output, build APK, upload release artifacts, report verified links/files.
