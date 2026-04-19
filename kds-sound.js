function playNewOrderBell() {
  var ctx = new (window.AudioContext || window.webkitAudioContext)();
  var now = ctx.currentTime;

  // 第一聲：高音（880Hz）
  playTone(ctx, 880, now, 0.15, 0.3);

  // 第二聲：低音（660Hz）
  playTone(ctx, 660, now + 0.18, 0.15, 0.35);
}

function playTone(ctx, freq, startTime, duration, volume) {
  if (volume === undefined) volume = 0.3;
  var osc  = ctx.createOscillator();
  var gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = freq;

  // ADSR 避免爆音
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain).connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}
