import {numSec, fadeLevel, stateText} from './logic.ts';
import {loadCards, putCard, deleteCard, type StoredCard} from './store.ts';
import {setLevel, listDevices, selectDevice, audioContext} from './audio.ts';

interface Runtime extends StoredCard {url: string; audio: HTMLAudioElement; el: HTMLElement; durationMs: number;}
declare global {interface Window {electronAPI?: {openFiles: () => Promise<{name: string; base64: string}[]>; openFolder: () => Promise<{folder: string; files: {name: string; base64: string}[]}>;}}}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const grid = $('grid'), empty = $('empty'), statusEl = $('status'), statusText = $('statusText');
const nowTitle = $('nowTitle'), nowArtist = $('nowArtist'), meterFill = $('meterFill'), pct = $('pct');
const output = $<HTMLSelectElement>('output'), muteBtn = $<HTMLButtonElement>('btnMute');
const fileInput = $<HTMLInputElement>('fileInput'), folderInput = $<HTMLInputElement>('folderInput');
const palets = $('palets'), paletTitle = $('paletTitle');
interface Palette {id: string; name: string}
let palettes: Palette[] = [], curPalette = 'utama';

let cards: Runtime[] = [];
let active = -1, level = 0, muted = false, raf = 0, pausedCard = -1, dragSeek: number | null = null;
let fading: 'out' | 'in' | null = null, fadeLeft = 0;
let lastTick = Date.now(), lastSave = 0;

function seedOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) & 0x7fffffff;
  return h || 7;
}
function bars(seed: number): string {
  let s = seed, out = '';
  for (let i = 0; i < 44; i++) {s = (s * 1103515245 + 12345) & 0x7fffffff; out += `<i style="height:${12 + ((s >> 7) % 68)}%"></i>`;}
  return out;
}
function setSlider(c: Runtime, v: number): void {
  const val = Math.round(Math.max(0, Math.min(100, v)));
  const input = c.el.querySelector<HTMLInputElement>('input[data-vol]')!;
  input.value = String(val);
  input.style.setProperty('--track', `linear-gradient(90deg,#FF7654 ${val}%,#2A332A ${val}%)`);
  c.el.querySelector('.volNum')!.textContent = val + '%';
}
function persist(c: Runtime): void {
  void putCard({id: c.id, name: c.name, blob: c.blob, vol: c.vol, fout: c.fout, fin: c.fin, playedMs: c.playedMs || 0, paletteId: c.paletteId, loop: !!c.loop}).catch(() => {});
}
function formatMs(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
function loadOrder(): string[] {return JSON.parse(localStorage.getItem('suara-cue-order') || '[]')}
function saveOrder(): void {
  localStorage.setItem('suara-cue-order', JSON.stringify(cards.map(c => c.id)));
}
function savePalettes(): void {localStorage.setItem('suara-cue-palettes', JSON.stringify(palettes))}
function visibleCards(): Runtime[] {return cards.filter(c => c.paletteId === curPalette)}
function ensurePalette(name: string): string {
  const found = palettes.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (found) return found.id;
  const p = {id: crypto.randomUUID(), name};
  palettes.push(p); savePalettes(); return p.id;
}
function switchPalette(id: string): void {
  curPalette = id; localStorage.setItem('suara-cue-cur', id); render();
}
function applyLevel(): void {
  if (active >= 0) setLevel(cards[active].audio, muted ? 0 : level);
}
function cancelRaf(): void {if (raf) cancelAnimationFrame(raf); raf = 0;}

function render(): void {
  const order = loadOrder();
  cards.sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  saveOrder();
  palets.innerHTML = '';
  palettes.forEach(p => {
    const b = document.createElement('button');
    b.className = 'palet' + (p.id === curPalette ? ' on' : '');
    const live = active >= 0 && cards[active]?.paletteId === p.id;
    b.innerHTML = (live ? '<span class="live-dot"></span>' : '') + p.name;
    b.onclick = () => switchPalette(p.id);
    palets.appendChild(b);
  });
  const add = document.createElement('button');
  add.className = 'palet new'; add.textContent = '+ PALET';
  add.onclick = () => {const id = ensurePalette('PALET ' + (palettes.length + 1)); switchPalette(id);};
  palets.appendChild(add);
  paletTitle.textContent = 'Papan Lagu — ' + (palettes.find(p => p.id === curPalette)?.name || '');
  const vis = visibleCards();
  grid.innerHTML = '';
  empty.style.display = vis.length ? 'none' : 'flex';
  vis.forEach((c, vi) => {
    const i = cards.indexOf(c);
    const art = document.createElement('article');
    art.className = 'card';
    art.dataset.i = String(i);
    art.innerHTML = `
      <div class="card-top"><span class="num">${String(vi + 1).padStart(2, '0')}</span>
        <span class="badge">${c.name.toLowerCase().endsWith('.wav') ? 'WAV' : 'AUDIO'}</span>
        <span class="dur">${c.durationMs ? formatMs(c.durationMs) : '--:--'}</span>
        <button class="mv" data-move-left="${i}" aria-label="Geser kiri" title="Geser kiri">‹</button><button class="mv" data-move-right="${i}" aria-label="Geser kanan" title="Geser kanan">›</button>
        <button class="x" data-remove="${i}" aria-label="Hapus Kartu" title="Hapus">×</button></div>
      <div class="title" title="${c.name.replace(/"/g, '&quot;')}">${c.name.replace(/\.[^.]+$/, '')}</div>
      <div class="artist">${c.name}</div>
      <div class="wave" aria-hidden="true">${bars(seedOf(c.id))}</div>
      <div class="time-row"><span>POS <b class="pos">00:00</b> / <b class="total">${c.durationMs ? formatMs(c.durationMs) : '--:--'}</b></span><span>TOTAL DIPUTAR <b class="played">${formatMs(c.playedMs || 0)}</b></span></div>
      <div class="seek" data-seek="${i}" role="slider" aria-label="Posisi lagu ${c.name}"><div class="seek-fill"></div></div>
      <div class="volhead"><span>VOLUME KARTU</span><b class="volNum">${c.vol}%</b></div>
      <div class="vrange"><input type="range" data-vol min="0" max="100" step="1" value="${c.vol}" aria-label="Volume ${c.name}"></div>
      <div class="durbox"><div class="cap">FADE — TERPISAH DARI VOLUME</div><div class="durrow">
        <label>KELUAR <input class="fout" type="number" min="0" max="30" step="0.5" value="${c.fout}" aria-label="Detik keluar ${c.name}">s</label>
        <label>MASUK <input class="fin" type="number" min="0" max="30" step="0.5" value="${c.fin}" aria-label="Detik masuk ${c.name}">s</label>
      </div></div>
      <div class="card-foot"><span class="card-state">SIAP</span>
        <button class="play" data-play="${i}"><span class="lab">PUTAR</span><kbd>${vi + 1}</kbd></button>
      </div><div class="level"><span></span></div>`;
    c.el = art;
    grid.appendChild(art);
  });
  updateUI();
}

function updateUI(): void {
  cards.forEach((c, i) => {
    if (!c.el.querySelector('.lab')) return;
    const on = i === active;
    c.el.classList.toggle('onair', on && level > 0);
    c.el.classList.toggle('silent', on && level <= 0);
    c.el.querySelector('.lab')!.textContent = on ? (i === pausedCard ? 'LANJUT' : 'JEDA') : 'PUTAR';
    c.el.querySelector('.card-state')!.textContent = on
      ? (i === pausedCard ? 'JEDA · ' + formatMs(c.audio.currentTime * 1000)
        : fading === 'out' ? 'HITUNG MUNDUR ' + fadeLeft.toFixed(1) + 's'
        : fading === 'in' ? 'FADE MASUK ' + fadeLeft.toFixed(1) + 's'
        : level <= 0 ? 'VOLUME 0%' : c.loop ? 'ON AIR ↻' : 'ON AIR')
      : c.loop ? 'SIAP ↻' : 'SIAP';
    (c.el.querySelector('.level span') as HTMLElement).style.width = (on ? level : 0) + '%';
    setSlider(c, on ? level : c.vol);
  });
  const c = active >= 0 ? cards[active] : null;
  nowTitle.textContent = c ? c.name.replace(/\.[^.]+$/, '') : '— belum ada lagu —';
  nowArtist.textContent = c
    ? (fading === 'out' ? 'hitung mundur ' + fadeLeft.toFixed(1) + 's · ' + Math.round(level) + '%'
      : fading === 'in' ? 'naik ke ' + c.vol + '% · ' + Math.round(level) + '%'
      : (palettes.find(p => p.id === c.paletteId)?.name || '') + ' · volume ' + c.vol + '%')
    : 'pilih kartu untuk memulai';
  meterFill.style.width = (muted ? 0 : level) + '%';
  pct.textContent = Math.round(muted ? 0 : level) + '%';
  const s = {muted, active: active >= 0 && pausedCard < 0, fading, level, left: fadeLeft, src: 'MUSIC', volume: level};
  statusText.textContent = pausedCard >= 0 && !muted ? 'JEDA · ' + formatMs(cards[pausedCard].audio.currentTime * 1000) : stateText(s);
  statusEl.className = 'status' + (muted ? ' muted' : pausedCard >= 0 ? ' spot' : !s.active ? '' : fading || level <= 0 ? ' spot' : ' live');
  muteBtn.classList.toggle('on', muted);
  muteBtn.setAttribute('aria-pressed', String(muted));
  const loopBtn = $<HTMLButtonElement>('btnLoop');
  const looping = active >= 0 && !!cards[active].loop;
  loopBtn.classList.toggle('on', looping);
  loopBtn.setAttribute('aria-pressed', String(looping));
}

function ramp(to: number, secs: number, done: () => void): void {
  const from = level, t0 = performance.now(), dur = Math.max(16, secs * 1000);
  const step = (now: number): void => {
    const p = Math.min(1, (now - t0) / dur);
    level = fadeLevel(from, to, p);
    fadeLeft = Math.max(0, (1 - p) * secs);
    applyLevel();
    updateUI();
    if (p < 1) raf = requestAnimationFrame(step);
    else {raf = 0; done();}
  };
  raf = requestAnimationFrame(step);
}
function finishStop(): void {
  cancelRaf();
  if (active >= 0) {const c = cards[active]; c.audio.pause(); c.audio.currentTime = 0; setLevel(c.audio, 0); persist(c);}
  active = -1; level = 0; fading = null; fadeLeft = 0; pausedCard = -1;
  updateUI();
}
function play(i: number): void {
  if (i < 0 || i >= cards.length) return;
  cancelRaf();
  if (active >= 0 && active !== i) {const prev = cards[active]; prev.audio.pause(); prev.audio.currentTime = 0; setLevel(prev.audio, 0);}
  const resume = pausedCard === i;
  active = i; fading = null; fadeLeft = 0;
  const c = cards[i];
  if (!resume) c.audio.currentTime = 0;
  pausedCard = -1;
  void audioContext().resume();
  void c.audio.play().catch(() => { /* blocked until user gesture */ });
  const fin = numSec(c.fin);
  if (fin > 0) {level = 0; fading = 'in'; applyLevel(); updateUI(); ramp(c.vol, fin, () => {fading = null; fadeLeft = 0; updateUI();});}
  else {level = c.vol; applyLevel(); updateUI();}
}
function pauseHere(): void {
  cancelRaf();
  if (active < 0) return;
  const c = cards[active];
  c.audio.pause();
  setLevel(c.audio, 0);
  level = 0; fading = null; fadeLeft = 0; pausedCard = active;
  c.el.querySelector('.pos')!.textContent = formatMs(c.audio.currentTime * 1000);
  updateUI();
}
function stop(): void {
  if (active < 0) return;
  if (pausedCard === active) {play(active); return;}
  if (fading) {pauseHere(); return;}
  const fout = numSec(cards[active].fout);
  if (fout > 0) {fading = 'out'; ramp(0, fout, pauseHere);}
  else pauseHere();
}
function seekTo(i: number, clientX: number): void {
  const c = cards[i];
  if (!c || c.durationMs <= 0) return;
  const bar = c.el.querySelector('.seek') as HTMLElement;
  if (!bar) return;
  const r = bar.getBoundingClientRect();
  if (r.width <= 0) return;
  c.audio.currentTime = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * c.durationMs / 1000;
  bar.querySelector<HTMLElement>('.seek-fill')!.style.width = (c.audio.currentTime * 1000 / c.durationMs * 100) + '%';
  c.el.querySelector('.pos')!.textContent = formatMs(c.audio.currentTime * 1000);
  if (i === pausedCard) c.el.querySelector('.card-state')!.textContent = 'JEDA · ' + formatMs(c.audio.currentTime * 1000);
}
function stepVolume(d: number): void {
  if (active < 0) return;
  const c = cards[active];
  c.vol = Math.max(0, Math.min(100, c.vol + d));
  persist(c);
  cancelRaf(); fading = null; fadeLeft = 0; level = c.vol;
  applyLevel(); updateUI();
}
function makeRuntime(s: StoredCard): Runtime {
  const url = URL.createObjectURL(s.blob);
  const audio = new Audio(url);
  audio.preload = 'metadata';
  const c: Runtime = {...s, url, audio, el: document.createElement('article'), durationMs: 0};
  audio.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(audio.duration)) {
      c.durationMs = audio.duration * 1000;
      const d = c.el.querySelector('.dur'), t = c.el.querySelector('.total');
      if (d) d.textContent = formatMs(c.durationMs);
      if (t) t.textContent = formatMs(c.durationMs);
    }
  });
  audio.addEventListener('ended', () => {
    if (cards[active] !== c) return;
    if (!c.loop) {if (fading === 'out') pauseHere(); else finishStop(); return;}
    c.audio.currentTime = 0;
    void c.audio.play().catch(() => {});
    const fin = numSec(c.fin);
    if (fin > 0) {level = 0; fading = 'in'; ramp(c.vol, fin, () => {fading = null; fadeLeft = 0; updateUI();});}
    else {level = c.vol; updateUI();}
  });
  return c;
}
const AUDIO_RE = /\.(mp3|m4a|aac|ogg|opus|flac|wav)$/i;
async function addFiles(files: File[], paletteId?: string): Promise<void> {
  const pid = paletteId || curPalette;
  for (const f of files.filter(f => AUDIO_RE.test(f.name) || f.type.startsWith('audio/'))) {
    const s: StoredCard = {id: crypto.randomUUID(), name: f.name, blob: f, vol: 80, fout: 3, fin: 0, paletteId: pid};
    cards.push(makeRuntime(s));
    await putCard(s);
  }
  render();
}
function move(i: number, dir: number): void {
  const vis = visibleCards(), vi = vis.findIndex(c => c.id === cards[i]?.id);
  if (vi < 0 || vi + dir < 0 || vi + dir >= vis.length) return;
  if (active >= 0) finishStop();
  const a = vis[vi].id, b = vis[vi + dir].id;
  const order = loadOrder(), ia = order.indexOf(a), ib = order.indexOf(b);
  if (ia >= 0 && ib >= 0) {[order[ia], order[ib]] = [order[ib], order[ia]]; localStorage.setItem('suara-cue-order', JSON.stringify(order));}
  render();
}
async function removeCard(i: number): Promise<void> {
  if (i < 0 || i >= cards.length) return;
  if (active === i) finishStop();
  const [c] = cards.splice(i, 1);
  URL.revokeObjectURL(c.url);
  await deleteCard(c.id);
  render();
}
async function initDevices(): Promise<void> {
  const devices = await listDevices();
  output.innerHTML = '';
  devices.forEach((d, i) => {
    const o = document.createElement('option');
    o.value = d.deviceId;
    o.textContent = d.label || 'Output ' + (i + 1);
    output.appendChild(o);
  });
  if (!devices.length) {const o = document.createElement('option'); o.textContent = 'Default'; output.appendChild(o);}
  const saved = localStorage.getItem('suara-cue-device');
  if (saved && [...output.options].some(o => o.value === saved)) output.value = saved;
}

grid.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const i = Number((t.closest('.card') as HTMLElement)?.dataset.i);
  if (Number.isNaN(i)) return;
  if (t.closest('.seek')) return;
  if (t.closest('[data-play]')) {if (i === active) stop(); else play(i);}
  else if (t.closest('[data-move-left]')) move(i, -1);
  else if (t.closest('[data-move-right]')) move(i, 1);
  else if (t.closest('[data-remove]')) void removeCard(i);
});
grid.addEventListener('pointerdown', e => {
  const bar = (e.target as HTMLElement).closest('.seek') as HTMLElement;
  if (!bar) return;
  const i = Number((bar.closest('.card') as HTMLElement).dataset.i);
  dragSeek = i;
  try {bar.setPointerCapture(e.pointerId);} catch { /* older WebView */ }
  seekTo(i, e.clientX);
  e.preventDefault();
});
grid.addEventListener('pointermove', e => {if (dragSeek !== null) seekTo(dragSeek, e.clientX);});
grid.addEventListener('pointerup', e => {
  if (dragSeek === null) return;
  const bar = (e.target as HTMLElement).closest('.seek') as HTMLElement;
  try {if (bar?.hasPointerCapture(e.pointerId)) bar.releasePointerCapture(e.pointerId);} catch { /* ignore */ }
  dragSeek = null;
});
grid.addEventListener('pointercancel', () => {dragSeek = null;});
grid.addEventListener('input', e => {
  const t = e.target as HTMLInputElement;
  const cardEl = t.closest('.card') as HTMLElement;
  if (!cardEl) return;
  const i = Number(cardEl.dataset.i), c = cards[i];
  if (!c) return;
  if (t.matches('[data-vol]')) {
    c.vol = Math.max(0, Math.min(100, Number(t.value)));
    persist(c);
    if (active === i) {cancelRaf(); fading = null; fadeLeft = 0; level = c.vol; applyLevel();}
    updateUI();
  } else if (t.classList.contains('fout')) {c.fout = numSec(t.value); persist(c);}
  else if (t.classList.contains('fin')) {c.fin = numSec(t.value); persist(c);}
});
$('addBtn').addEventListener('click', async () => {
  if (window.electronAPI) {
    const picked = await window.electronAPI.openFiles();
    await addFiles(picked.map(p => new File([Uint8Array.from(atob(p.base64), ch => ch.charCodeAt(0))], p.name, {type: 'audio/*'})));
  } else fileInput.click();
});
$('emptyAdd').addEventListener('click', () => $('addBtn').click());
fileInput.addEventListener('change', () => {void addFiles([...fileInput.files!]); fileInput.value = '';});
$('folderBtn').addEventListener('click', async () => {
  if (window.electronAPI?.openFolder) {
    const picked = await window.electronAPI.openFolder();
    if (!picked.files.length) return;
    const pid = ensurePalette(picked.folder || 'FOLDER');
    switchPalette(pid);
    await addFiles(picked.files.map(p => new File([Uint8Array.from(atob(p.base64), ch => ch.charCodeAt(0))], p.name, {type: 'audio/*'})), pid);
  } else if ('webkitdirectory' in folderInput) folderInput.click();
  else $('addBtn').click();
});
folderInput.addEventListener('change', () => {
  const files = [...folderInput.files!].sort((a, b) => a.webkitRelativePath.localeCompare(b.webkitRelativePath));
  const folder = files[0]?.webkitRelativePath.split('/')[0] || 'FOLDER';
  const pid = ensurePalette(folder);
  switchPalette(pid);
  void addFiles(files, pid);
  folderInput.value = '';
});
output.addEventListener('change', () => {
  localStorage.setItem('suara-cue-device', output.value);
  cards.forEach(c => void selectDevice(c.audio, output.value));
});
$('btnVolDown').addEventListener('click', () => stepVolume(-5));
$('btnVolUp').addEventListener('click', () => stepVolume(5));
function toggleLoop(): void {
  if (active < 0) return;
  const c = cards[active];
  c.loop = !c.loop; persist(c); updateUI();
}
$('btnLoop').addEventListener('click', toggleLoop);
muteBtn.addEventListener('click', () => {muted = !muted; applyLevel(); updateUI();});
document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
  if (/^[1-8]$/.test(e.key)) {const vc = visibleCards()[Number(e.key) - 1]; if (vc) play(cards.indexOf(vc));}
  else if (e.key === 'ArrowDown') stepVolume(-5);
  else if (e.key === 'ArrowUp') stepVolume(5);
  else if (e.key.toLowerCase() === 'x') stop();
  else if (e.key.toLowerCase() === 'l') toggleLoop();
  else if (e.key.toLowerCase() === 'm') {muted = !muted; applyLevel(); updateUI();}
});
window.addEventListener('pagehide', () => {if (active >= 0) persist(cards[active]);});
setInterval(() => {$('clock').textContent = new Date().toLocaleTimeString('id-ID', {hour12: false});}, 1000);
setInterval(() => {
  const now = Date.now();
  if (active >= 0 && pausedCard < 0 && level > 0 && !muted) {
    const c = cards[active];
    c.playedMs = (c.playedMs || 0) + (now - lastTick);
    c.el.querySelector('.played')!.textContent = formatMs(c.playedMs);
    if (now - lastSave > 5000) {persist(c); lastSave = now;}
    c.el.querySelector('.pos')!.textContent = formatMs(c.audio.currentTime * 1000);
    const fill = c.el.querySelector<HTMLElement>('.seek-fill')!;
    fill.style.width = (c.durationMs > 0 ? Math.min(100, c.audio.currentTime * 1000 / c.durationMs * 100) : 0) + '%';
  }
  lastTick = now;
}, 250);
void (async () => {
  const savedPalettes: Palette[] = JSON.parse(localStorage.getItem('suara-cue-palettes') || '[]');
  palettes = savedPalettes.length ? savedPalettes : [{id: 'utama', name: 'UTAMA'}];
  const savedCur = localStorage.getItem('suara-cue-cur');
  curPalette = savedCur && palettes.some(p => p.id === savedCur) ? savedCur : palettes[0].id;
  const stored = await loadCards();
  for (const s of stored) {
    if (!s.paletteId || !palettes.some(p => p.id === s.paletteId)) {
      s.paletteId = palettes[0].id;
      void putCard(s);
    }
  }
  cards = stored.map(makeRuntime);
  render();
  await initDevices();
})();
