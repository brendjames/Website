// site.js — shared behaviour: mobile nav, glow tracking, scroll reveals, typewriter.
(function () {
  'use strict';

  // ----- Mobile nav overlay -----
  const burger = document.querySelector('.nav-burger');
  const overlay = document.querySelector('.mobile-nav');
  if (burger && overlay) {
    const close = overlay.querySelector('.close');
    burger.addEventListener('click', () => {
      overlay.classList.add('open');
      burger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    });
    const shut = () => {
      overlay.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    };
    if (close) close.addEventListener('click', shut);
    overlay.addEventListener('click', (e) => { if (e.target.tagName === 'A') shut(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') shut(); });
  }

  // ----- Glow-on-hover: track cursor as CSS vars on .glow cards -----
  document.addEventListener('mousemove', (e) => {
    for (const el of document.querySelectorAll('.glow')) {
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left - 80 || e.clientX > r.right + 80 ||
          e.clientY < r.top - 80 || e.clientY > r.bottom + 80) continue;
      el.style.setProperty('--mouse-x', (e.clientX - r.left) + 'px');
      el.style.setProperty('--mouse-y', (e.clientY - r.top) + 'px');
    }
  }, { passive: true });

  // ----- Scroll reveals -----
  const revealed = document.querySelectorAll('.reveal');
  if (revealed.length) {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealed.forEach((el) => io.observe(el));
  }

  // ----- Typewriter (index hero) -----
  const tw = document.querySelector('[data-typewriter]');
  if (tw) {
    const text = tw.getAttribute('data-typewriter');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      tw.textContent = text;
    } else {
      tw.textContent = '';
      let i = 0;
      const tick = () => {
        if (i <= text.length) {
          tw.textContent = text.slice(0, i);
          i++;
          setTimeout(tick, i < 4 ? 220 : 55 + Math.random() * 50);
        }
      };
      setTimeout(tick, 350);
    }
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
