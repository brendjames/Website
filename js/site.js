// site.js — shared behaviour: scroll reveals, count-up stats, print buttons, contact form.
(function () {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ----- Scroll reveals (staggered per sibling group) -----
  const revealed = document.querySelectorAll('.reveal');
  if (revealed.length) {
    const siblingIndex = new Map();
    revealed.forEach((el) => {
      const i = siblingIndex.get(el.parentElement) || 0;
      el.style.setProperty('--stagger', Math.min(i, 6));
      siblingIndex.set(el.parentElement, i + 1);
    });
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealed.forEach((el) => io.observe(el));
  }

  // ----- Count-up stats ([data-count] spans) -----
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length && !prefersReduced) {
    const cio = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        cio.unobserve(en.target);
        const el = en.target;
        const target = parseFloat(el.getAttribute('data-count'));
        if (!isFinite(target)) continue;
        const t0 = performance.now();
        const dur = 1200;
        const step = (t) => {
          const p = Math.min((t - t0) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 4); // ease-out quart
          el.textContent = Math.round(target * eased).toLocaleString('en-US');
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.4 });
    counters.forEach((el) => cio.observe(el));
  }

  // ----- Print / save-as-PDF buttons -----
  for (const b of document.querySelectorAll('[data-print]')) {
    b.addEventListener('click', () => window.print());
  }

  // ----- Hero photo: cursor tilt with counter-parallax on the image -----
  const tiltWrap = document.querySelector('[data-tilt]');
  if (tiltWrap && !prefersReduced &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const frame = tiltWrap.querySelector('.frame');
    const img = tiltWrap.querySelector('img');
    let raf = 0;
    tiltWrap.addEventListener('mousemove', (e) => {
      const r = tiltWrap.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        frame.style.transform = 'rotateX(' + (-y * 5).toFixed(2) + 'deg) rotateY(' + (x * 6).toFixed(2) + 'deg)';
        img.style.translate = (-x * 10).toFixed(1) + 'px ' + (-y * 10).toFixed(1) + 'px';
      });
    });
    tiltWrap.addEventListener('mouseleave', () => {
      cancelAnimationFrame(raf);
      frame.style.transform = '';
      img.style.translate = '';
    });
  }

  // ----- Contact form: real submission via FormSubmit, inline success, honeypot -----
  const form = document.querySelector('form[data-contact]');
  if (form) {
    form.addEventListener('submit', (e) => {
      const hp = form.querySelector('input[name="_honey"]');
      if (hp && hp.value) { e.preventDefault(); return; } // honeypot tripped
      if (!form.checkValidity()) return; // browser shows validation
      e.preventDefault();

      const ok = document.querySelector('.form-success');
      const btn = form.querySelector('button[type="submit"]');
      const btnLabel = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

      fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      })
        .then((res) => {
          if (!res.ok) throw new Error('Request failed');
          if (ok) ok.classList.add('show');
          form.reset();
        })
        .catch(() => {
          // network hiccup or endpoint unreachable — fall back to a real mail client
          const name = encodeURIComponent(form.querySelector('#name').value);
          const email = encodeURIComponent(form.querySelector('#email').value);
          const msg = encodeURIComponent(form.querySelector('#message').value);
          const subject = encodeURIComponent('Hello from brendonjameskirk.com');
          const body = msg + '%0A%0A%E2%80%94 ' + name + ' (' + email + ')';
          window.location.href = 'mailto:brendonkirk86@gmail.com?subject=' + subject + '&body=' + body;
          if (ok) ok.classList.add('show');
          form.reset();
        })
        .finally(() => {
          if (btn) { btn.disabled = false; btn.textContent = btnLabel; }
        });
    });
  }
})();
