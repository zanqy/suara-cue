let ctx: AudioContext | null = null;
const gains = new WeakMap<HTMLAudioElement, GainNode>();

export function audioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function attach(audio: HTMLAudioElement): GainNode {
  let gain = gains.get(audio);
  if (!gain) {
    gain = audioContext().createGain();
    audioContext().createMediaElementSource(audio).connect(gain);
    gain.connect(audioContext().destination);
    gains.set(audio, gain);
  }
  return gain;
}

export function setLevel(audio: HTMLAudioElement, level: number): void {
  attach(audio).gain.value = Math.max(0, Math.min(1, level / 100));
}

export async function listDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'audiooutput');
  } catch {
    return [];
  }
}

export async function selectDevice(audio: HTMLAudioElement, deviceId: string): Promise<void> {
  const el = audio as HTMLAudioElement & {setSinkId?: (id: string) => Promise<void>};
  if (typeof el.setSinkId === 'function') {
    try { await el.setSinkId(deviceId); } catch { /* device unavailable: keep default */ }
  }
}
