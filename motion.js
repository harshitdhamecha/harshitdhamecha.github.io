/* motion.js — GSAP scroll choreography (round two).
   Loads after gsap + ScrollTrigger CDN scripts; script.js falls back to
   IntersectionObserver reveals when the CDN is unreachable.
   Rules honored: transform/opacity only, play-once reveals (content never
   re-hides on upward scroll), reduced-motion exits entirely. */
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || typeof window.gsap === 'undefined' || typeof window.ScrollTrigger === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add('gsap-on');

  const desktop = window.matchMedia('(min-width: 761px)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  /* ================= hero: char-split headline ================= */
  const heroTitle = document.querySelector('.hero-title');
  if (heroTitle) {
    heroTitle.setAttribute('aria-label', heroTitle.textContent.replace(/\s+/g, ' ').trim());
    heroTitle.querySelectorAll('.title-line').forEach((line) => {
      line.setAttribute('aria-hidden', 'true');
      const split = (node) => {
        [...node.childNodes].forEach((child) => {
          if (child.nodeType === Node.TEXT_NODE) {
            const frag = document.createDocumentFragment();
            child.textContent.split(/(\s+)/).forEach((token) => {
              if (!token) return;
              if (/^\s+$/.test(token)) { frag.append(' '); return; }
              /* word wrapper keeps chars together so lines never break mid-word */
              const word = document.createElement('span');
              word.className = 'word';
              [...token].forEach((ch) => {
                const span = document.createElement('span');
                span.className = 'char';
                span.textContent = ch;
                word.append(span);
              });
              frag.append(word);
            });
            node.replaceChild(frag, child);
          } else if (child.nodeType === Node.ELEMENT_NODE) split(child);
        });
      };
      split(line);
    });

    gsap.from('.hero-title .char', {
      opacity: 0, y: 46, rotateX: -50,
      duration: 0.7, stagger: 0.014, ease: 'expo.out', delay: 0.15
    });
  }

  gsap.from(['.hero-kicker', '.hero-pretitle'], { opacity: 0, y: 14, duration: 0.5, stagger: 0.08, ease: 'power2.out' });
  gsap.from('.hero-bottom', { opacity: 0, y: 22, duration: 0.6, delay: 0.55, ease: 'power2.out' });
  gsap.from('.orbital-card', {
    opacity: 0, scale: 0.7, rotate: 30, duration: 0.9, delay: 0.65, ease: 'back.out(1.6)',
    /* leave no inline transform behind: it blocks the CSS --mx mouse-follow
       until the first scroll overwrites it */
    onComplete: () => gsap.set('.orbital-card', { clearProps: 'transform' })
  });

  /* hero scrub: layers drift apart on the way out */
  gsap.timeline({
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.8 }
  })
    .to('.hero-grid', { yPercent: 18, opacity: 0.1 }, 0)
    .to('.hero-copy', { yPercent: -8 }, 0)
    .to('.hero-title .char', { y: (i) => -(i % 5) * 6 }, 0);

  /* hero mouse parallax: signal field + orbital card follow the pointer */
  if (desktop && finePointer) {
    const field = document.querySelector('.signal-field');
    const orb = document.querySelector('.orbital-card');
    const fieldX = field && gsap.quickTo(field, 'x', { duration: 0.9, ease: 'power3.out' });
    const fieldY = field && gsap.quickTo(field, 'y', { duration: 0.9, ease: 'power3.out' });
    const hero = document.querySelector('.hero');
    hero.addEventListener('pointermove', (e) => {
      const nx = (e.clientX / window.innerWidth) - 0.5;
      const ny = (e.clientY / window.innerHeight) - 0.5;
      if (fieldX) { fieldX(nx * -34); fieldY(ny * -22); }
      if (orb) orb.style.setProperty('--mx', `${nx * 18}px`);
    }, { passive: true });
  }

  /* ================= generic reveals: play ONCE ================= */
  document.querySelectorAll('.reveal').forEach((el) => {
    /* cards + certs have dedicated entrance tweens — a second tween on the
       same element fights it and causes a visible double-settle.
       Hero elements are owned by the load timeline: a second from() on them
       captures opacity 0 as its END value and locks them invisible. */
    if (el.matches('.cap-card, .cert') || el.closest('.hero')) return;
    gsap.from(el, {
      opacity: 0, y: 26, duration: 0.6, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });

  /* section number badges spin in */
  document.querySelectorAll('.section-label span').forEach((badge) => {
    gsap.from(badge, {
      rotate: -180, scale: 0.4, duration: 0.7, ease: 'back.out(1.8)',
      scrollTrigger: { trigger: badge, start: 'top 90%', once: true }
    });
  });

  /* ================= capabilities: pinned card deal (desktop) ================= */
  if (desktop) {
    const cards = gsap.utils.toArray('.cap-card');
    if (cards.length === 3) {
      /* NO pin (sticky header) and NO sideways travel (cards were crossing
         over the heading). Cards rise from BELOW at staggered depths and
         straighten as they land — scrubbed, starting only once the card row
         itself is actually entering the viewport. */
      /* time-based staggered rise, triggered once on entry. Scrubbing was
         re-litigated twice: any scrub leaves a visible catch-up settle after
         fast wheel flicks. A triggered tween plays the same at every scroll
         speed and always lands before the eye can call it late. */
      gsap.from(cards, {
        y: (i) => [130, 190, 160][i],
        rotate: (i) => [-6, 4, -4][i],
        opacity: 0,
        duration: 1.4,
        stagger: 0.22,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.capability-cards', start: 'top 80%', once: true },
        onComplete: () => {
          cards.forEach((c) => c.classList.add('is-settled'));
          gsap.set(cards, { clearProps: 'all' });
        }
      });
      /* resting crookedness lives in CSS `rotate:` per card — survives clearProps */
    }
  }

  /* ================= experience: line draw + jobs slide ================= */
  const timeline = document.querySelector('.timeline');
  if (timeline) {
    const line = document.createElement('span');
    line.className = 'timeline-line';
    line.setAttribute('aria-hidden', 'true');
    timeline.append(line);
    gsap.from(line, {
      scaleY: 0, ease: 'none',
      scrollTrigger: { trigger: timeline, start: 'top 80%', end: 'bottom 60%', scrub: 0.6 }
    });
  }
  document.querySelectorAll('.job').forEach((job, i) => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: job, start: 'top 82%', once: true } });
    tl.from(job.querySelector('.job-core'), { opacity: 0, x: i % 2 ? 24 : -24, duration: 0.6, ease: 'power2.out' }, 0)
      .from(job.querySelector('.job-company'), { opacity: 0, y: 12, duration: 0.45, ease: 'power2.out' }, 0.1)
      .from(job.querySelector('.job-detail p'), { opacity: 0, y: 18, duration: 0.55, ease: 'power2.out' }, 0.15)
      .from(job.querySelectorAll('.tag-row span'), {
        opacity: 0, scale: 0.7, y: 8, duration: 0.4, stagger: 0.07, ease: 'back.out(1.8)'
      }, 0.3);
  });

  /* ================= skill cloud: pop once, then drift ================= */
  const cloud = document.querySelector('.skill-cloud');
  if (cloud) {
    gsap.from(cloud.children, {
      opacity: 0, scale: 0.6, y: 20,
      duration: 0.55, ease: 'back.out(1.7)',
      stagger: { each: 0.05, from: 'center' },
      clearProps: 'all', /* hand transforms back to the CSS hover styles */
      scrollTrigger: { trigger: cloud, start: 'top 85%', once: true }
    });
    gsap.to('.sphere-section', {
      yPercent: -4, ease: 'none',
      scrollTrigger: { trigger: '.skill-sphere', start: 'top bottom', end: 'bottom top', scrub: 1 }
    });
  }

  /* ================= certs: scattered settle ================= */
  const certCards = gsap.utils.toArray('.cert');
  if (certCards.length) {
    gsap.from(certCards, {
      y: (i) => [120, 170, 140][i % 3],
      rotate: (i) => [-8, 6, -7][i % 3],
      scale: 0.94,
      opacity: 0,
      duration: 0.85,
      stagger: 0.12,
      ease: 'expo.out',
      scrollTrigger: { trigger: '.cert-grid', start: 'top 85%', once: true },
      onComplete: () => {
        certCards.forEach((c) => c.classList.add('is-settled'));
        gsap.set(certCards, { clearProps: 'all' });
      }
    });
  }

  /* ================= ticker: velocity-reactive marquee ================= */
  const track = document.querySelector('[data-ticker]');
  if (track) {
    const loop = gsap.to(track, { xPercent: -50, ease: 'none', duration: 22, repeat: -1 });
    ScrollTrigger.create({
      onUpdate: (self) => {
        const v = self.getVelocity();
        loop.timeScale(gsap.utils.clamp(-4, 4, v / 260) || 1);
        gsap.to(loop, { timeScale: v < 0 ? -1 : 1, duration: 1.1, ease: 'power2.out', overwrite: 'auto' });
      }
    });
  }

  /* ================= deck: vinyl rolls in ================= */
  const plinth = document.querySelector('.tt-plinth');
  if (plinth) {
    gsap.from(plinth, {
      y: 120, rotate: -7, scale: 0.92, ease: 'none',
      scrollTrigger: { trigger: '.turntable', start: 'top 100%', end: 'top 55%', scrub: 0.7 }
    });
  }

  /* ================= footer: orbit reacts to velocity ================= */
  const orbit = document.querySelector('.footer-orbit');
  if (orbit) {
    orbit.style.animation = 'none'; /* GSAP takes over the CSS spin */
    const spin = gsap.to(orbit, { rotate: 360, ease: 'none', duration: 24, repeat: -1 });
    ScrollTrigger.create({
      onUpdate: (self) => {
        spin.timeScale(gsap.utils.clamp(1, 3, Math.abs(self.getVelocity()) / 600));
        /* always decay back to normal speed after scrolling stops */
        gsap.to(spin, { timeScale: 1, duration: 1.4, ease: 'power2.out', delay: 0.2, overwrite: 'auto' });
      }
    });
  }

  /* ================= magnetic buttons (desktop, fine pointer) ================= */
  if (desktop && finePointer) {
    document.querySelectorAll('.nav-contact, .round-link i, .tt-btn, .footer-email').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.28);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ================= velocity skew on big headlines ================= */
  const skewTargets = document.querySelectorAll('.display');
  const skewSetter = gsap.quickSetter(skewTargets, 'skewY', 'deg');
  const clampSkew = gsap.utils.clamp(-2.5, 2.5);
  ScrollTrigger.create({
    onUpdate: (self) => {
      const skew = clampSkew(self.getVelocity() / -420);
      if (Math.abs(skew) > 0.05) {
        skewSetter(skew);
        gsap.to(skewTargets, { skewY: 0, duration: 0.7, ease: 'power3.out', overwrite: 'auto' });
      }
    }
  });

  /* recalc after fonts/images settle */
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
