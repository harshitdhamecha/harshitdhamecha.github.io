/* turntable.js — interactive vinyl deck.
   Drag the record: angular velocity drives a filtered-noise scratch synth
   ("chik chik" bursts fire on direction reversals). Release after a real
   scratch: plays assets/shady.mp3 from SONG_START if the owner has dropped
   that file in, otherwise falls back to a fully synthesized beat loop.
   No copyrighted audio ships with this site. */
(() => {
  const root = document.querySelector('[data-turntable]');
  if (!root) return;

  const vinyl = root.querySelector('[data-vinyl]');
  const playBtn = root.querySelector('[data-tt-play]');
  const status = root.querySelector('[data-tt-status]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Owner-supplied track (optional). Tweak SONG_START to taste — set it to
     the timestamp (seconds) where the chika-chika section begins in YOUR file. */
  const SONG_SRC = './assets/shady.mp3';
  const SONG_START = 4;

  /* Deck screen: YouTube embed of Without Me (owner-chosen upload).
     Note: not the official EminemVEVO upload — if it gets taken down the
     deck degrades gracefully to the synth beat via the onError fallback.
     Official alternative: YT_ID 'YVkUvmDQ3HY', YT_START ~47. */
  const YT_ID = 'CuFbDZfUUk4';
  const YT_START = 111;
  let yt = null;
  let ytReady = false;
  let ytFailed = false;
  let ytStarted = false;

  const loadYT = () => {
    if (document.querySelector('#yt-api')) return;
    window.onYouTubeIframeAPIReady = () => {
      yt = new YT.Player('yt-deck', {
        videoId: YT_ID,
        playerVars: { start: YT_START, rel: 0, playsinline: 1, controls: 1 },
        events: {
          onReady: () => { ytReady = true; },
          onError: () => { ytFailed = true; },
          onStateChange: (e) => { if (e.data === YT.PlayerState.ENDED) { ytStarted = false; stop(); } }
        }
      });
    };
    const s = document.createElement('script');
    s.id = 'yt-api';
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.append(s);
  };
  /* lazy: only pull the YT payload once the deck approaches the viewport */
  new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => { if (entry.isIntersecting) { loadYT(); obs.disconnect(); } });
  }, { rootMargin: '600px' }).observe(root);

  let ctx = null;            // AudioContext, created on first gesture (autoplay policy)
  let scratchSrc = null;     // looping noise buffer while dragging
  let scratchGain = null;
  let beatTimer = null;      // synth beat scheduler
  let beatStep = 0;
  let playing = false;
  let dragging = false;
  let rotation = 0;          // accumulated deg
  let lastAngle = 0;
  let lastTime = 0;
  let lastDir = 0;
  let dragDistance = 0;
  let spinFrame = null;
  let song = null;
  let songReady = false;

  /* -------- optional song probe --------
     Fetched as a blob so currentTime seeks work even on dev servers without
     HTTP Range support (python -m http.server serves 200s only — Chrome
     cannot seek a streamed mp3 without Range, so seeks snap back to 0). */
  fetch(SONG_SRC)
    .then((res) => { if (!res.ok) throw new Error('no track'); return res.blob(); })
    .then((blob) => {
      song = new Audio(URL.createObjectURL(blob));
      song.addEventListener('canplaythrough', () => { songReady = true; }, { once: true });
      song.load();
      window.__ttSong = song; // debug handle
    })
    .catch(() => { songReady = false; });

  const audioCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  /* -------- scratch synthesis -------- */
  const noiseBuffer = (ac, seconds) => {
    const buf = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  };

  const startScratchBed = () => {
    const ac = audioCtx();
    if (scratchSrc) return;
    scratchSrc = ac.createBufferSource();
    scratchSrc.buffer = noiseBuffer(ac, 1);
    scratchSrc.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 1.4;
    scratchGain = ac.createGain();
    scratchGain.gain.value = 0;
    scratchSrc.connect(filter).connect(scratchGain).connect(ac.destination);
    scratchSrc.start();
  };

  const stopScratchBed = () => {
    if (!scratchSrc) return;
    try { scratchSrc.stop(); } catch { /* already stopped */ }
    scratchSrc.disconnect();
    scratchSrc = null;
    scratchGain = null;
  };

  /* the "chik": short bandpass noise burst with a falling sweep */
  const chik = (strength = 1) => {
    const ac = audioCtx();
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac, 0.12);
    src.playbackRate.value = 1.4 + strength * 0.8;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.2;
    filter.frequency.setValueAtTime(2100, ac.currentTime);
    filter.frequency.exponentialRampToValueAtTime(500, ac.currentTime + 0.1);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.65 * Math.min(strength, 1.4), ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.11);
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start();
    src.stop(ac.currentTime + 0.13);
  };

  /* -------- synth beat fallback (~112 BPM, 8-step) -------- */
  const kick = (ac, t) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.14);
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain).connect(ac.destination);
    osc.start(t); osc.stop(t + 0.24);
  };
  const hat = (ac, t) => {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac, 0.06);
    const filter = ac.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6500;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(t); src.stop(t + 0.06);
  };
  const clap = (ac, t) => {
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac, 0.14);
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1600;
    filter.Q.value = 0.9;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(t); src.stop(t + 0.14);
  };

  const startBeat = () => {
    const ac = audioCtx();
    const stepDur = 60 / 112 / 2; // 8th notes at 112 BPM
    beatStep = 0;
    const tick = () => {
      const t = ac.currentTime + 0.05;
      if (beatStep % 8 === 0 || beatStep % 8 === 5) kick(ac, t);
      if (beatStep % 8 === 4) clap(ac, t);
      hat(ac, t);
      beatStep += 1;
    };
    tick();
    beatTimer = setInterval(tick, stepDur * 1000);
  };
  const stopBeat = () => { clearInterval(beatTimer); beatTimer = null; };

  /* -------- transport -------- */
  const setStatus = (text) => { status.textContent = text; vinyl.setAttribute('aria-valuetext', text.toLowerCase()); };

  const idleSpin = () => {
    if (reducedMotion) return;
    let prev = performance.now();
    const frame = (now) => {
      if (!playing || dragging) { spinFrame = null; return; }
      rotation += ((now - prev) / 1000) * 130; // stylized ~21 RPM
      prev = now;
      vinyl.style.setProperty('--tt-rot', `${rotation}deg`);
      spinFrame = requestAnimationFrame(frame);
    };
    if (!spinFrame) spinFrame = requestAnimationFrame(frame);
  };

  const play = () => {
    playing = true;
    root.classList.add('is-playing');
    playBtn.textContent = 'Cut the beat';
    if (ytReady && !ytFailed) {
      if (!ytStarted) { yt.seekTo(YT_START, true); ytStarted = true; }
      yt.playVideo();
      setStatus('Spinning. Watch the deck screen.');
    } else if (songReady && song) {
      if (song.currentTime < SONG_START || song.ended) song.currentTime = SONG_START;
      song.onended = stop;
      song.play();
      setStatus('Spinning your record.');
    } else {
      startBeat();
      setStatus('Synth beat live. Scratch away.');
    }
    idleSpin();
  };

  const stop = () => {
    playing = false;
    root.classList.remove('is-playing');
    playBtn.textContent = 'Drop the beat';
    if (ytReady && !ytFailed && yt) yt.pauseVideo();
    if (song) song.pause();
    stopBeat();
    setStatus('Standing by.');
  };

  playBtn.addEventListener('click', () => (playing ? stop() : play()));

  /* -------- drag to scratch -------- */
  const angleAt = (event) => {
    const rect = vinyl.getBoundingClientRect();
    return (Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)) * 180) / Math.PI;
  };

  vinyl.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    try { vinyl.setPointerCapture(event.pointerId); } catch { /* synthetic pointer */ }
    dragging = true;
    dragDistance = 0;
    lastAngle = angleAt(event);
    lastTime = performance.now();
    lastDir = 0;
    startScratchBed();
    if (playing) {
      if (ytReady && !ytFailed && yt) yt.pauseVideo();
      if (song) song.pause();
    }
    if (beatTimer) stopBeat();
    setStatus('Scratching…');
  });

  vinyl.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const now = performance.now();
    const angle = angleAt(event);
    let delta = angle - lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const dt = Math.max(now - lastTime, 1);
    const velocity = Math.abs(delta) / dt; // deg per ms

    rotation += delta;
    dragDistance += Math.abs(delta);
    vinyl.style.setProperty('--tt-rot', `${rotation}deg`);

    if (scratchGain && scratchSrc) {
      scratchGain.gain.value = Math.min(velocity * 1.15, 0.5);
      scratchSrc.playbackRate.value = 0.55 + Math.min(velocity * 2.4, 2.4);
    }
    const dir = Math.sign(delta);
    if (dir !== 0 && lastDir !== 0 && dir !== lastDir && velocity > 0.08) chik(velocity * 3);
    if (dir !== 0) lastDir = dir;

    lastAngle = angle;
    lastTime = now;
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    stopScratchBed();
    if (dragDistance > 120) {
      /* a real scratch — drop the beat */
      play();
    } else if (playing) {
      if (ytReady && !ytFailed) { yt.playVideo(); setStatus('Spinning. Watch the deck screen.'); }
      else if (songReady && song) { song.play(); setStatus('Spinning your record.'); }
      else { startBeat(); setStatus('Synth beat live.'); }
      idleSpin();
    } else {
      setStatus('Standing by.');
    }
  };
  vinyl.addEventListener('pointerup', endDrag);
  vinyl.addEventListener('pointercancel', endDrag);

  /* -------- draggable tonearm: drop the needle to play, lift to stop -------- */
  const arm = root.querySelector('[data-arm]');
  if (arm) {
    const armBase = arm.querySelector('.tt-arm-base');
    let armDragging = false;
    const armAngleAt = (event) => {
      const b = armBase.getBoundingClientRect();
      const px = b.left + b.width / 2;
      const py = b.top + b.height / 2;
      /* arm hangs straight down at 0deg; pointer angle relative to that */
      const deg = (Math.atan2(event.clientY - py, event.clientX - px) * 180) / Math.PI - 90;
      return Math.max(-32, Math.min(20, deg));
    };
    arm.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      try { arm.setPointerCapture(event.pointerId); } catch { /* synthetic pointer */ }
      armDragging = true;
      arm.classList.add('is-dragging');
      arm.style.setProperty('--arm-rot', `${armAngleAt(event)}deg`);
    });
    arm.addEventListener('pointermove', (event) => {
      if (!armDragging) return;
      arm.style.setProperty('--arm-rot', `${armAngleAt(event)}deg`);
    });
    const armRelease = (event) => {
      if (!armDragging) return;
      armDragging = false;
      arm.classList.remove('is-dragging');
      const angle = armAngleAt(event);
      /* let the class-driven pose take over and animate to it */
      arm.style.removeProperty('--arm-rot');
      if (angle > 2) {
        if (!playing) play();
        setStatus(songReady ? 'Needle down. Spinning your record.' : 'Needle down. Synth beat live.');
      } else if (playing) {
        stop();
        setStatus('Needle up. Standing by.');
      }
    };
    arm.addEventListener('pointerup', armRelease);
    arm.addEventListener('pointercancel', armRelease);
  }

  /* -------- keyboard scratch -------- */
  vinyl.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const dir = event.key === 'ArrowRight' ? 1 : -1;
      rotation += dir * 22;
      vinyl.style.setProperty('--tt-rot', `${rotation}deg`);
      chik(1);
      dragDistance += 22;
      if (dragDistance > 120 && !playing) play();
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      playing ? stop() : play();
    }
  });
})();
