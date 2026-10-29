// Touch interactions. HTML drag and drop is unreliable on phones, so swords are
// picked up with a long press and dropped on any [data-drop] zone, including
// the dock tabs. Long-pressing anything else with a tooltip previews it.
const LONG_PRESS_MS = 360;
const MOVE_TOLERANCE = 10;
const TAB_SPRING_MS = 550;
const HOLD_REPEAT_MS = 90;

export function wireTouch({ canDrag, onDrop, onSpringTab, onHammer, canRepeatHammer, haptic }) {
  const ghost = document.getElementById('drag-ghost');
  const tipEl = document.getElementById('tooltip');
  let press = null;
  let drag = null;
  let tipTimer = null;
  let suppressUntil = 0;

  const suppressClicks = (ms = 450) => { suppressUntil = performance.now() + ms; };

  // A gesture we already handled must not also fire the tap underneath it.
  document.addEventListener('click', e => {
    if (performance.now() < suppressUntil) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  // Native drag on touch competes with ours and, on Android, steals the touch.
  document.addEventListener('dragstart', e => {
    if (press || drag) e.preventDefault();
  }, true);

  document.addEventListener('contextmenu', e => {
    if (press || drag || e.pointerType === 'touch') e.preventDefault();
  }, true);

  function hideTip() {
    clearTimeout(tipTimer);
    tipEl?.classList.add('hidden');
  }

  function showTip(el, x, y) {
    if (!tipEl) return;
    tipEl.innerHTML = el.getAttribute('data-tip') || '';
    tipEl.classList.remove('hidden');
    const w = tipEl.offsetWidth;
    const h = tipEl.offsetHeight;
    const left = Math.min(window.innerWidth - w - 8, Math.max(8, x - w / 2));
    let top = y - h - 28;
    if (top < 8) top = Math.min(window.innerHeight - h - 8, y + 28);
    tipEl.style.left = `${left}px`;
    tipEl.style.top = `${top}px`;
  }

  function zoneAt(x, y) {
    return document.elementFromPoint(x, y)?.closest('[data-drop]') || null;
  }

  function moveGhost(x, y) {
    ghost.style.transform = `translate(${x - 55}px, ${y - 78}px) rotate(-8deg)`;
  }

  function startDrag(p) {
    const id = p.swordEl.dataset.swordId;
    const img = p.swordEl.querySelector('img');
    if (!id || !ghost) return;
    drag = { id, source: p.swordEl, zone: null, zoneSince: 0, x: p.x, y: p.y };
    ghost.innerHTML = img ? `<img src="${img.getAttribute('src')}" alt="">` : '';
    ghost.style.left = '0';
    ghost.style.top = '0';
    ghost.classList.remove('hidden');
    moveGhost(p.x, p.y);
    p.swordEl.classList.add('dragging');
    document.body.classList.add('touch-dragging');
    hideTip();
    haptic('pickup');
    updateZone(p.x, p.y);
  }

  function updateZone(x, y) {
    const zone = zoneAt(x, y);
    if (zone !== drag.zone) {
      drag.zone?.classList.remove('drag-over');
      zone?.classList.add('drag-over');
      drag.zone = zone;
      drag.zoneSince = performance.now();
      drag.sprung = false;
    }
  }

  function springTabs() {
    if (!drag?.zone || drag.sprung) return;
    const tab = drag.zone.dataset.tab;
    if (tab && drag.zone.classList.contains('mobile-dock-btn') && performance.now() - drag.zoneSince > TAB_SPRING_MS) {
      drag.sprung = true;
      onSpringTab(tab);
      haptic('tap');
    }
  }

  function endDrag(commit) {
    if (!drag) return;
    const { id, zone, source } = drag;
    clearInterval(drag.springTimer);
    zone?.classList.remove('drag-over');
    source?.classList.remove('dragging');
    document.body.classList.remove('touch-dragging');
    ghost?.classList.add('hidden');
    if (ghost) ghost.innerHTML = '';
    drag = null;
    if (commit && zone) {
      haptic('drop');
      onDrop(id, zone.dataset.drop);
    }
  }

  function cancelPress() {
    if (!press) return;
    clearTimeout(press.timer);
    if (press.swordEl && press.wasDraggable) press.swordEl.draggable = true;
    press = null;
  }

  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { cancelPress(); endDrag(false); return; }
    hideTip();
    const t = e.touches[0];
    const swordEl = canDrag() ? e.target.closest('[data-sword-id]') : null;
    const tip = e.target.closest('[data-tip]');
    if (!swordEl && !tip) return;
    press = { x: t.clientX, y: t.clientY, swordEl, tip, wasDraggable: swordEl?.draggable };
    if (swordEl) swordEl.draggable = false;
    press.timer = setTimeout(() => {
      if (!press) return;
      press.fired = true;
      if (press.swordEl) {
        startDrag(press);
        if (drag) drag.springTimer = setInterval(springTabs, 100);
      } else {
        showTip(press.tip, press.x, press.y);
        haptic('tap');
      }
    }, LONG_PRESS_MS);
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    const t = e.touches[0];
    if (drag) {
      e.preventDefault();
      drag.x = t.clientX;
      drag.y = t.clientY;
      moveGhost(t.clientX, t.clientY);
      updateZone(t.clientX, t.clientY);
      return;
    }
    if (press && !press.fired && Math.hypot(t.clientX - press.x, t.clientY - press.y) > MOVE_TOLERANCE) cancelPress();
  }, { passive: false });

  document.addEventListener('touchend', e => {
    if (drag) {
      e.preventDefault();
      suppressClicks();
      cancelPress();
      endDrag(true);
      return;
    }
    if (press?.fired) {
      // The preview was the whole gesture: do not also activate the element.
      e.preventDefault();
      suppressClicks();
      tipTimer = setTimeout(hideTip, 1400);
    }
    cancelPress();
  }, { passive: false });

  document.addEventListener('touchcancel', () => {
    cancelPress();
    endDrag(false);
    hideTip();
  });

  // Hammer buttons react on touch-down; holding keeps striking while frenzy
  // removes the break risk, matching held-Space on a keyboard.
  let hold = null;
  const stopHold = () => {
    if (!hold) return;
    clearInterval(hold.timer);
    hold.el.classList.remove('pressed');
    hold = null;
  };
  document.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    const el = e.target.closest('[data-hammer-button]');
    if (!el || el.disabled) return;
    stopHold();
    el.classList.add('pressed');
    suppressClicks(700);
    onHammer();
    hold = { el, pointerId: e.pointerId, timer: setInterval(() => { if (canRepeatHammer()) onHammer(); }, HOLD_REPEAT_MS) };
  });
  for (const type of ['pointerup', 'pointercancel']) {
    document.addEventListener(type, e => { if (hold && e.pointerId === hold.pointerId) { stopHold(); suppressClicks(350); } });
  }
  window.addEventListener('blur', stopHold);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopHold(); });

  return { cancel: () => { cancelPress(); endDrag(false); stopHold(); } };
}
