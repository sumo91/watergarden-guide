export function makeAudio() {
  let context,
    output,
    muted = false;
  function unlock() {
    if (!context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      context = new Audio();
      output = context.createGain();
      output.gain.value = muted ? 0 : 0.18;
      output.connect(context.destination);
    }
    context.resume().catch(() => {});
  }
  function note(frequency, delay = 0, duration = 1.2, volume = 0.35) {
    if (!context || muted) return;
    const oscillator = context.createOscillator(),
      gain = context.createGain(),
      start = context.currentTime + delay;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  return {
    unlock,
    bell() {
      note(659);
      note(988, 0.06, 1.5, 0.2);
      note(1318, 0, 0.55, 0.1);
    },
    restored() {
      [392, 494, 587, 784].forEach((f, i) => note(f, i * 0.18, 2, 0.3));
    },
    ending() {
      [392, 494, 587, 784, 988, 1175].forEach((f, i) =>
        note(f, i * 0.25, 3, 0.3),
      );
    },
    setMuted(value) {
      muted = value;
      if (output) output.gain.value = value ? 0 : 0.18;
    },
  };
}
