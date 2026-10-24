// Sound for the browser version, through Web Audio. Browsers (iPhones especially) keep audio locked until the
// first tap, so the context is resumed on the first touch, click or key press.
(function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = AC ? new AC() : null;
  const buffers = {};
  let musicWanted = false, musicVolume = 0.5, musicSource = null, musicGain = null, musicLoading = false;

  function load(name) {
    if (!ctx) return Promise.resolve(null);
    if (!buffers[name]) {
      buffers[name] = fetch('sounds/' + name + '.wav')
        .then(r => r.arrayBuffer())
        .then(b => new Promise((ok, fail) => ctx.decodeAudioData(b, ok, fail)))
        .catch(() => null);
    }
    return buffers[name];
  }
  ['sfx_shuffle', 'sfx_draw', 'sfx_meld', 'sfx_discard', 'sfx_snatch', 'sfx_turn', 'sfx_round', 'sfx_win', 'sfx_react',
    'sfx_react_cheer', 'sfx_react_ricochet', 'sfx_react_zap', 'sfx_react_bell', 'sfx_react_howl', 'sfx_react_fanfare', 'sfx_react_empress', 'sfx_react_founder', 'sfx_react_clash', 'sfx_react_foghorn', 'sfx_react_boo', 'sfx_react_sleigh', 'sfx_react_smitten', 'sfx_react_alien', 'sfx_react_blueprint', 'sfx_react_amethyst', 'sfx_entrance'].forEach(load);

  function unlock() {
    if (ctx && ctx.state !== 'running' && !document.hidden) ctx.resume();
  }
  ['pointerdown', 'touchend', 'keydown'].forEach(e => window.addEventListener(e, unlock, { capture: true }));
  // Quiet while the tab is in the background, like the app when it's not on screen.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  function updateMusic() {
    if (!ctx) return;
    if (musicWanted) {
      if (musicGain) { musicGain.gain.value = musicVolume; return; }
      if (musicLoading) return;
      musicLoading = true;
      load('music_loop').then(buf => {
        musicLoading = false;
        if (!buf || !musicWanted || musicGain) return;
        musicSource = ctx.createBufferSource();
        musicSource.buffer = buf;
        musicSource.loop = true;
        musicGain = ctx.createGain();
        musicGain.gain.value = musicVolume;
        musicSource.connect(musicGain).connect(ctx.destination);
        musicSource.start();
      });
    } else if (musicSource) {
      musicSource.stop();
      musicSource.disconnect();
      musicSource = null;
      musicGain = null;
    }
  }

  window.fkAudio = {
    play(name, volume) {
      if (!ctx || ctx.state !== 'running' || !buffers[name]) return;
      buffers[name].then(buf => {
        if (!buf) return;
        const source = ctx.createBufferSource();
        source.buffer = buf;
        const gain = ctx.createGain();
        gain.gain.value = volume;
        source.connect(gain).connect(ctx.destination);
        source.start();
      });
    },
    music(on, volume) {
      musicWanted = on;
      musicVolume = volume;
      updateMusic();
    },
  };
})();
