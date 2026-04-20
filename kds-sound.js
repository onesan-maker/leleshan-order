// Singleton AudioContext — 避免快速連響時超過瀏覽器 context 限制
var _bellCtx = null;

function getBellContext() {
  if (_bellCtx && _bellCtx.state !== "closed") return _bellCtx;
  try {
    var Ctor = window.AudioContext || window.webkitAudioContext;
    _bellCtx = Ctor ? new Ctor() : null;
  } catch (e) { _bellCtx = null; }
  return _bellCtx;
}

function playNewOrderBell() {
  var ctx = getBellContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
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
