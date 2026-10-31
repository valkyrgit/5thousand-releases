// Sound for the browser version, through Web Audio. Browsers (iPhones especially) keep audio locked until the
// first tap, so the context is resumed on the first touch, click or key press.
(function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = AC ? new AC() : null;
  const buffers = {};
  // Music by scene ('menu', 'shop', 'table'): the menus and the shop loop one track, the table plays its tracks in turn,
  // starting on a random one. A track hands over to the next (or to itself, to loop) by starting it LOOP_FADE seconds
  // before its end and crossfading, so there's never a cut; a change of scene crossfades over SCENE_FADE.
  const SCENES = { menu: ['music_menu'], shop: ['music_shop'], table: ['music_table_1', 'music_table_2'] };
  const SCENE_FADE = 2.5, LOOP_FADE = 4;
  let musicScene = '', musicVolume = 0.5, current = null, tableTrack = 0, generation = 0;
  // Every track sounding goes through its own gain (its fade) into this one (the music volume).
  const master = ctx ? ctx.createGain() : null;
  if (master) { master.gain.value = musicVolume; master.connect(ctx.destination); }

  function load(name, ext) {
    if (!ctx) return Promise.resolve(null);
    if (!buffers[name]) {
      buffers[name] = fetch('sounds/' + name + '.' + (ext || 'wav'))
        .then(r => r.arrayBuffer())
        .then(b => new Promise((ok, fail) => ctx.decodeAudioData(b, ok, fail)))
        .catch(() => null);
    }
    return buffers[name];
  }
  ['sfx_shuffle', 'sfx_draw', 'sfx_meld', 'sfx_discard', 'sfx_snatch', 'sfx_turn', 'sfx_round', 'sfx_win', 'sfx_react',
    'sfx_react_cheer', 'sfx_react_ricochet', 'sfx_react_zap', 'sfx_react_bell', 'sfx_react_howl', 'sfx_react_fanfare', 'sfx_react_empress', 'sfx_react_founder', 'sfx_react_clash', 'sfx_react_foghorn', 'sfx_react_boo', 'sfx_react_sleigh', 'sfx_react_smitten', 'sfx_react_alien', 'sfx_react_blueprint', 'sfx_react_amethyst', 'sfx_react_black_hole', 'sfx_react_founding_seal', 'sfx_react_quasar', 'sfx_react_supernova', 'sfx_react_pulsar', 'sfx_react_abyss', 'sfx_react_coral_reef', 'sfx_react_kraken', 'sfx_react_synthwave', 'sfx_react_cyberpunk', 'sfx_react_vaporwave', 'sfx_react_fire_dragon', 'sfx_react_ice_dragon', 'sfx_react_jade_dragon', 'sfx_react_crimson_crown', 'sfx_react_sapphire_crown', 'sfx_react_emerald_crown', 'sfx_react_spring_grove', 'sfx_react_autumn_woods', 'sfx_react_moonlit_forest', 'sfx_react_brass_works', 'sfx_react_copper_works', 'sfx_react_cherry_blossom', 'sfx_react_night_sakura', 'sfx_react_golden_pharaoh', 'sfx_react_lapis_pharaoh', 'sfx_react_jolly_roger', 'sfx_react_ghost_ship', 'sfx_react_prismatic', 'sfx_react_moon_empress', 'sfx_react_faberge', 'sfx_react_peacock_throne', 'sfx_react_phoenix_queen', 'sfx_react_hall_of_mirrors', 'sfx_react_winter_palace', 'sfx_entrance'].forEach(load);

  function unlock() {
    if (ctx && ctx.state !== 'running' && !document.hidden) ctx.resume();
  }
  ['pointerdown', 'touchend', 'keydown'].forEach(e => window.addEventListener(e, unlock, { capture: true }));
  // Quiet while the tab is in the background, like the app when it's not on screen.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  function ramp(gain, to, seconds) {
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(to, t + seconds);
  }

  /** Fades [playing] out over [seconds], then stops it. */
  function fadeAway(playing, seconds) {
    if (!playing) return;
    playing.handedOver = true;
    ramp(playing.gain, 0, seconds);
    setTimeout(() => { try { playing.source.stop(); } catch (e) {} playing.source.disconnect(); }, seconds * 1000 + 50);
  }

  function trackName(scene, track) {
    const list = SCENES[scene];
    return list[(scene === 'table' ? track : 0) % list.length];
  }

  /** Starts [scene]'s current track, fading in over [seconds], and loads the one after it. */
  function start(scene, gen, seconds) {
    load(trackName(scene, tableTrack), 'ogg').then(buf => {
      if (!buf || gen !== generation) return;
      const source = ctx.createBufferSource();
      source.buffer = buf;
      const gain = ctx.createGain();
      source.connect(gain).connect(master);
      const t = ctx.currentTime;
      const playing = { scene, source, gain, gen, endAt: t + buf.duration, handedOver: false };
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(1, t + seconds);
      // Normally the next track has taken over by now; this covers a handover that never happened.
      source.onended = () => { if (current === playing && !playing.handedOver) handOver(playing); };
      current = playing;
      source.start(t);
      load(trackName(scene, tableTrack + 1), 'ogg');
    });
  }

  /** [playing] is nearly over: the next track (or the same one again) starts and they crossfade. */
  function handOver(playing) {
    if (playing.gen !== generation) return;
    const fade = Math.max(0.3, Math.min(LOOP_FADE, playing.endAt - ctx.currentTime));
    fadeAway(playing, fade);
    if (playing.scene === 'table') tableTrack = (tableTrack + 1) % SCENES.table.length;
    start(playing.scene, playing.gen, fade);
  }

  // Watches for the handover (by the audio clock, which stands still while the tab is hidden).
  setInterval(() => {
    if (!ctx || ctx.state !== 'running' || !current || current.handedOver) return;
    if (ctx.currentTime >= current.endAt - LOOP_FADE) handOver(current);
  }, 250);

  function updateMusic() {
    if (!ctx) return;
    if (!musicScene) {
      generation++;
      fadeAway(current, SCENE_FADE);
      current = null;
      return;
    }
    ramp(master, musicVolume, 0.1);
    if (current && current.scene === musicScene) return;
    const before = current ? current.scene : '';
    generation++;
    fadeAway(current, SCENE_FADE);
    current = null;
    if (musicScene === 'table' && before !== 'table') tableTrack = Math.floor(Math.random() * SCENES.table.length);
    start(musicScene, generation, SCENE_FADE);
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
    /** [scene]: 'menu', 'shop' or 'table', or '' for none. */
    music(scene, volume) {
      musicScene = scene;
      musicVolume = volume;
      updateMusic();
    },
  };
})();
