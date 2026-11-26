// All sound is synthesised in the browser with WebAudio — no audio files,
// no network. Engine hum follows RPM, wind follows speed, and rings,
// landings and crashes each get their own short phrase.
export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(context.destination);
      engineOsc.start();

      const length = context.sampleRate * 2;
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      windSource = context.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      windFilter = context.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windGain = context.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(context.destination);
      windSource.start();
    } catch {
      context = null;
    }
  }

  /** Call every frame: engine and wind follow throttle and speed. */
  function update(throttle, speedKts, flying) {
    ensure();
    if (!context) return;
    if (context.state === 'suspended') void context.resume();
    const target = muted || !flying ? 0 : 0.05 + throttle * 0.06;
    engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(48 + throttle * 62 + speedKts * 0.12, context.currentTime, 0.1);
    windGain.gain.setTargetAtTime(muted || !flying ? 0 : Math.min(0.09, speedKts * 0.0006), context.currentTime, 0.15);
    windFilter.frequency.setTargetAtTime(500 + speedKts * 4, context.currentTime, 0.2);
  }

  function tone(freq, startAt, duration, type, volume) {
    if (!context || muted) return;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime + startAt);
    gain.gain.linearRampToValueAtTime(volume, context.currentTime + startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + startAt + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(context.currentTime + startAt);
    osc.stop(context.currentTime + startAt + duration + 0.05);
  }

  function ringChime() {
    ensure();
    tone(880, 0, 0.35, 'sine', 0.16);
    tone(1318, 0.09, 0.4, 'sine', 0.14);
    tone(1760, 0.18, 0.5, 'sine', 0.1);
  }

  function fanfare() {
    ensure();
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((freq, i) => tone(freq, i * 0.14, 0.5, 'triangle', 0.16));
  }

  function thud() {
    ensure();
    tone(70, 0, 0.5, 'sine', 0.3);
    tone(48, 0.05, 0.6, 'sawtooth', 0.12);
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  return { update, ringChime, fanfare, thud, toggleMute, ensure };
}
