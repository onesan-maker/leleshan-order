const ctx = new (window.AudioContext || window.webkitAudioContext)();

/**
 * 🔴 警告音1：逼~~~~ (1秒 × 3次)
 */
function playBeep() {
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = 800;

      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);

      osc.start();
      osc.stop(ctx.currentTime + 1);
    }, i * 1200);
  }
}

/**
 * 🟢 警告音2：心跳聲
 */
function playHeartbeat() {
  let beat = () => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.value = 60;

    osc.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  };

  beat();
  setTimeout(beat, 300);
}

/**
 * 🟡 警告音4：新單鈴聲（雙音）
 */
function playNewOrderBell() {
  const now = ctx.currentTime;
  playTone(ctx, 880, now, 0.15, 0.3);
  playTone(ctx, 660, now + 0.18, 0.15, 0.35);
}

function playTone(audioCtx, freq, startTime, duration, volume) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain).connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * 🔵 警告音3：強烈提醒（5秒）
 */
function playAlert() {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(600, ctx.currentTime);

  // 節奏變化（像警報）
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.setValueAtTime(900, ctx.currentTime + 0.5);
  osc.frequency.setValueAtTime(600, ctx.currentTime + 1);
  osc.frequency.setValueAtTime(900, ctx.currentTime + 1.5);

  osc.connect(gain);
  gain.connect(ctx.destination);

  gain.gain.setValueAtTime(1.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 5);

  osc.start();
  osc.stop(ctx.currentTime + 5);
}
