/* eggs.js — hidden treats. Konami code, triple-click logo, console note. */
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const toast = (text) => {
    document.querySelectorAll('.egg-toast').forEach((t) => t.remove());
    const el = document.createElement('div');
    el.className = 'egg-toast';
    el.setAttribute('role', 'status');
    el.textContent = text;
    document.body.append(el);
    setTimeout(() => el.remove(), 3200);
  };

  /* ---------- konami → shady mode ---------- */
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let progress = 0;

  const confetti = () => {
    if (reducedMotion) return;
    const colors = ['#d9ff38', '#ff725e', '#4059d9', '#f5f0e8'];
    const words = ['HRD.', 'SHIP IT', 'LLMS', 'NODE.JS', 'SQL', 'POC → PROD', 'PRODUCT', 'AI'];
    for (let i = 0; i < 16; i += 1) {
      const bit = document.createElement('span');
      bit.className = 'egg-confetti';
      bit.textContent = words[i % words.length];
      bit.style.left = `${Math.random() * 92}vw`;
      bit.style.background = colors[i % colors.length];
      bit.style.color = i % colors.length === 2 ? '#f5f0e8' : '#0b0d12';
      bit.style.transform = `rotate(${Math.random() * 40 - 20}deg)`;
      const fall = bit.animate(
        [
          { transform: `translateY(0) rotate(${Math.random() * 40 - 20}deg)`, opacity: 1 },
          { transform: `translateY(105vh) rotate(${Math.random() * 220 - 110}deg)`, opacity: 0.9 }
        ],
        { duration: 1800 + Math.random() * 1600, easing: 'cubic-bezier(.3,.6,.4,1)' }
      );
      document.body.append(bit);
      fall.addEventListener('finish', () => bit.remove());
    }
  };

  document.addEventListener('keydown', (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    progress = key === KONAMI[progress] ? progress + 1 : (key === KONAMI[0] ? 1 : 0);
    if (progress === KONAMI.length) {
      progress = 0;
      const on = document.documentElement.classList.toggle('shady-mode');
      confetti();
      toast(on ? 'Guess who’s back. Shady mode: ON.' : 'Back to daylight. Shady mode: OFF.');
    }
  });

  /* ---------- triple-click the logo ---------- */
  const brand = document.querySelector('.brand');
  if (brand) {
    let clicks = 0;
    let timer = null;
    brand.addEventListener('click', () => {
      clicks += 1;
      clearTimeout(timer);
      timer = setTimeout(() => { clicks = 0; }, 550);
      if (clicks >= 3) {
        clicks = 0;
        if (!reducedMotion) {
          brand.classList.remove('is-spinning');
          void brand.offsetWidth; // restart animation
          brand.classList.add('is-spinning');
        }
        toast('Still standing. ↻');
      }
    });
  }

  /* ---------- console note ---------- */
  /* eslint-disable no-console */
  console.log(
    '%cHRD.%c\n\nHi, curious one. Two secrets:\n  1. ↑ ↑ ↓ ↓ ← → ← → B A\n  2. The vinyl at the bottom actually scratches.\n\n— Harshit',
    'font: 700 42px "Space Grotesk", sans-serif; color: #d9ff38; background: #0b0d12; padding: 8px 16px;',
    'font: 13px monospace; color: inherit;'
  );
})();

/* ---------- eggs round two: type-words, dot ball, selection, rage clicks ---------- */
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toast = (text) => {
    document.querySelectorAll('.egg-toast').forEach((t) => t.remove());
    const el = document.createElement('div');
    el.className = 'egg-toast';
    el.setAttribute('role', 'status');
    el.textContent = text;
    document.body.append(el);
    setTimeout(() => el.remove(), 3400);
  };

  /* --- typed words: "ship" and "sql" --- */
  let buffer = '';
  document.addEventListener('keydown', (e) => {
    if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;
    buffer = (buffer + e.key.toLowerCase()).slice(-12);
    if (buffer.endsWith('ship')) {
      buffer = '';
      toast('shipped.');
      if (!reducedMotion) {
        const rocket = document.createElement('div');
        rocket.style.cssText = 'position:fixed;left:-70px;bottom:9vh;z-index:58;pointer-events:none;font:700 15px "Space Grotesk",sans-serif;background:#0b0d12;color:#d9ff38;border:3px solid #000;padding:8px 12px;box-shadow:5px 5px 0 #ff725e;transform:rotate(-4deg)';
        rocket.textContent = 'SHIP IT →';
        document.body.append(rocket);
        const fly = rocket.animate(
          [
            { transform: 'translateX(0) rotate(-4deg)' },
            { transform: `translateX(${window.innerWidth + 160}px) rotate(-4deg)` }
          ],
          { duration: 2200, easing: 'cubic-bezier(.45,0,.7,1)' }
        );
        fly.addEventListener('finish', () => rocket.remove());
      }
    }
    if (buffer.endsWith('sql')) {
      buffer = '';
      toast('SELECT * FROM problems WHERE solved = false; — 0 rows');
    }
  });

  /* --- coral dot: 5 clicks, dot becomes a ball and bounces away --- */
  const dot = document.querySelector('.brand-dot');
  if (dot) {
    let dotClicks = 0;
    let dotTimer = null;
    let launched = false;
    dot.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); /* don't trigger the brand spin/navigation */
      if (launched) return;
      dotClicks += 1;
      clearTimeout(dotTimer);
      dotTimer = setTimeout(() => { dotClicks = 0; }, 1600);
      if (dotClicks < 5) return;
      launched = true;
      toast('The dot has left the building.');
      if (reducedMotion) return;
      const r = dot.getBoundingClientRect();
      dot.style.visibility = 'hidden';
      const ball = document.createElement('div');
      ball.style.cssText = `position:fixed;z-index:58;left:${r.left}px;top:${r.top}px;width:11px;height:11px;border-radius:50%;background:#ff725e;pointer-events:none`;
      document.body.append(ball);
      let x = r.left, y = r.top, vx = 3.2, vy = -2;
      const g = 0.55, floor = window.innerHeight - 14;
      let frames = 0;
      const step = () => {
        vy += g; x += vx; y += vy;
        if (y > floor) { y = floor; vy *= -0.68; vx *= 0.99; }
        ball.style.left = `${x}px`;
        ball.style.top = `${y}px`;
        frames += 1;
        if (frames < 300 && x < window.innerWidth + 20) requestAnimationFrame(step);
        else ball.remove();
      };
      requestAnimationFrame(step);
    });
  }

  /* --- select the manifesto lead: good taste (headings are unselectable) --- */
  let tasteShown = false;
  document.addEventListener('selectionchange', () => {
    if (tasteShown) return;
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed || sel.toString().length < 6) return;
    const lead = document.querySelector('.lead');
    if (lead && sel.anchorNode && lead.contains(sel.anchorNode)) {
      tasteShown = true;
      toast('good taste.');
    }
  });

  /* --- rage clicks: 10 fast clicks on empty space --- */
  let rage = 0;
  let rageTimer = null;
  let rageShown = false;
  document.addEventListener('click', (e) => {
    if (rageShown) return;
    if (e.target.closest('a, button, [data-vinyl], input, textarea')) { rage = 0; return; }
    rage += 1;
    clearTimeout(rageTimer);
    rageTimer = setTimeout(() => { rage = 0; }, 2600);
    if (rage >= 10) {
      rageShown = true;
      rage = 0;
      toast('Easy. The vinyl is at the bottom.');
      window.scrollBy({ top: 420, behavior: reducedMotion ? 'instant' : 'smooth' });
    }
  });
})();
