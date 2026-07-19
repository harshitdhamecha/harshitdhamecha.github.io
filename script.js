const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const meter = document.querySelector('.scroll-meter span');
const parallaxItems = [...document.querySelectorAll('[data-speed]')];

const gsapActive = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

if (!reducedMotion) {
  // GSAP (motion.js) owns .reveal animations when available; IntersectionObserver is the no-CDN fallback.
  if (!gsapActive) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
  }

  let frameQueued = false;
  const updateScrollEffects = () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    meter.style.width = `${progress * 100}%`;
    parallaxItems.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const offset = (window.innerHeight * 0.5 - (rect.top + rect.height * 0.5)) * Number(item.dataset.speed);
      item.style.transform = `translate3d(var(--mx, 0px), ${offset}px, 0) rotate(8deg)`;
    });
    frameQueued = false;
  };
  const requestUpdate = () => {
    if (!frameQueued) { frameQueued = true; requestAnimationFrame(updateScrollEffects); }
  };
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  requestUpdate();
} else {
  meter.style.width = '100%';
}

const contactDialog = document.querySelector('[data-contact-dialog]');
const certDialog = document.querySelector('[data-cert-dialog]');
const backdrop = document.querySelector('[data-dialog-backdrop]');
const dialogs = [contactDialog, certDialog];
const email = 'harshitdhamecha@gmail.com';
const certDetails = {
  ai: {
    provider: 'IIM Mumbai · Certificate',
    title: 'Generative AI for Data-Driven Business Decision-Making',
    description: 'A focused exploration of how generative AI can support sharper, more data-aware business decisions.'
  },
  business: {
    provider: 'Microsoft · Certificate',
    title: 'Career Essentials in Business Analysis',
    description: 'Training in the foundations of business analysis, requirements thinking, and turning ambiguity into a plan.'
  },
  product: {
    provider: 'Forage × Electronic Arts · Job simulation',
    title: 'Product Management Job Simulation',
    description: 'A practical product exercise covering performance metrics, project planning, and structured problem solving.'
  }
};

let activeDialog = null;
let lastFocused = null;
let closeTimer = null;
const setDialog = (dialog, open) => {
  if (open) {
    clearTimeout(closeTimer);
    backdrop.classList.remove('is-closing');
    lastFocused = document.activeElement;
    dialogs.forEach((item) => { item.hidden = item !== dialog; item.classList.remove('is-closing'); });
    dialog.classList.remove('is-open');
    requestAnimationFrame(() => dialog.classList.add('is-open'));
    backdrop.hidden = false;
    activeDialog = dialog;
    document.body.style.overflow = 'hidden';
    dialog.querySelector('[data-close-dialog]').focus();
  } else {
    const closing = activeDialog;
    activeDialog = null;
    const finish = () => {
      dialogs.forEach((item) => { item.hidden = true; item.classList.remove('is-open', 'is-closing'); });
      backdrop.hidden = true;
      backdrop.classList.remove('is-closing');
      document.body.style.overflow = '';
      if (lastFocused) lastFocused.focus();
    };
    if (reducedMotion || !closing) { finish(); return; }
    closing.classList.remove('is-open');
    closing.classList.add('is-closing');
    backdrop.classList.add('is-closing');
    closeTimer = setTimeout(finish, 220);
  }
};

document.querySelectorAll('[data-open-contact]').forEach((trigger) => trigger.addEventListener('click', () => setDialog(contactDialog, true)));
/* certificate files: probed once at load. Drop assets/cert-<key>.(pdf|png|jpg)
   into the repo and the dialog swaps its "ask me" note for a View link. */
const certFiles = {};
Object.keys(certDetails).forEach(async (key) => {
  for (const ext of ['pdf', 'jpeg', 'jpg', 'png']) {
    try {
      const url = `./assets/cert-${key}.${ext}`;
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) { certFiles[key] = url; break; }
    } catch { /* offline */ }
  }
});

document.querySelectorAll('[data-cert]').forEach((card) => card.addEventListener('click', () => {
  const detail = certDetails[card.dataset.cert];
  certDialog.querySelector('[data-cert-provider]').textContent = detail.provider;
  certDialog.querySelector('[data-cert-title]').textContent = detail.title;
  certDialog.querySelector('[data-cert-description]').textContent = detail.description;
  const file = certFiles[card.dataset.cert];
  const img = certDialog.querySelector('[data-cert-img]');
  const isImage = file && /\.(jpe?g|png)$/i.test(file);
  img.hidden = !isImage;
  img.src = isImage ? file : '';
  certDialog.querySelector('[data-cert-actions]').hidden = !file;
  certDialog.querySelector('[data-cert-note]').hidden = !!file;
  if (file) certDialog.querySelector('[data-cert-view]').href = file;
  setDialog(certDialog, true);
}));
document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => setDialog(activeDialog, false)));
backdrop.addEventListener('click', () => setDialog(activeDialog, false));
document.addEventListener('keydown', (event) => {
  if (!activeDialog) return;
  if (event.key === 'Escape') setDialog(activeDialog, false);
  if (event.key === 'Tab') {
    const focusable = [...activeDialog.querySelectorAll('button, a[href]')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

document.querySelector('[data-copy-email]').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(email);
    document.querySelector('[data-copy-status]').textContent = 'Copied — see you in your preferred mail client.';
  } catch {
    document.querySelector('[data-copy-status]').textContent = email;
  }
});
