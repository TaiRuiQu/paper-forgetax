// Touch interactions. HTML drag and drop is unreliable on phones, so swords are
// picked up with a long press or a sideways swipe and dropped on any [data-drop]
// zone, including the dock tabs. Long-pressing anything else with a tooltip
// previews it.
//
// The browser hands a moving finger to its own scrolling as soon as the move
// passes a few pixels, and from that moment touch events are no longer
// cancelable. A held thumb that drifts — nearly every real long press — thus
// lost the sword before the long press could fire, which is why only a
// two-finger gesture (never a pan) ever seemed to drag anything. Swords
// therefore opt out of native panning (touch-action: none in mobile.css) and
// this handler owns the gesture: sideways becomes a drag at once, vertical
// scrolls the list under the finger itself.
const LONG_PRESS_MS = 360;
const MOVE_TOLERANCE = 10;
const DRAG_INTENT = 6;
const TAB_SPRING_MS = 550;
const HOLD_REPEAT_MS = 90;

const scrollerFor = el => {
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    if (node.scrollHeight > node.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
};

// Whether a vertical finger movement still has somewhere to scroll to.
const scrolls = (scroller, dy) => dy < 0
  ? scroller.scrollTop < scroller.scrollHeight - scroller.clientHeight - 1
  : scroller.scrollTop > 1;

export function wireTouch({ canDrag, onDrop, onSpringTab, onHammer, canRepeatHammer, haptic }) {
  const ghost = document.getElementById('drag-ghost');
  const tipEl = document.getElementById('tooltip');
  let press = null;
  let drag = null;
  let pan = null;
  let tipTimer = null;
  let suppressUntil = 0;
  const undraggable = new Set();

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

  // The HTML5 drag-and-drop path is for mice. Leaving a sword draggable lets a
  // held finger start a native drag instead of ours, so switch it off for the
  // duration of the touch and give it back when the finger lifts.
  function disarmNativeDrag(el) {
    if (!el || !el.draggable) return;
    el.draggable = false;
    undraggable.add(el);
  }

  function rearmNativeDrag() {
    for (const el of undraggable) if (el.isConnected) el.draggable = true;
    undraggable.clear();
  }

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
    clearTimeout(p.timer);
    p.fired = true;
    drag = { id, source: p.swordEl, zone: null, zoneSince: 0, x: p.x, y: p.y, moved: 0 };
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
    drag.springTimer = setInterval(springTabs, 100);
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
    const { id, zone, source, moved } = drag;
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
    return { committed: Boolean(commit && zone), moved };
  }

  function cancelPress() {
    if (!press) return;
    clearTimeout(press.timer);
    press = null;
  }

  function trackDrag(x, y) {
    drag.x = x;
    drag.y = y;
    drag.moved = Math.max(drag.moved, Math.hypot(x - drag.startX, y - drag.startY));
    moveGhost(x, y);
    updateZone(x, y);
  }

  document.addEventListener('touchstart', e => {
    const swordEl = e.target.closest?.('[data-sword-id]') || null;
    disarmNativeDrag(swordEl);
    if (e.touches.length !== 1) {
      // The gesture stopped being a single finger. Keep a drag already in hand
      // (touchmove still tracks touches[0]) but drop the press.
      cancelPress();
      return;
    }
    hideTip();
    const t = e.touches[0];
    const draggable = canDrag() ? swordEl : null;
    const tip = e.target.closest('[data-tip]');
    if (!draggable && !tip) return;
    pan = null;
    press = { x: t.clientX, y: t.clientY, swordEl: draggable, tip, scroller: draggable ? scrollerFor(draggable) : null };
    press.timer = setTimeout(() => {
      if (!press) return;
      if (press.swordEl) startDrag(press);
      else {
        press.fired = true;
        showTip(press.tip, press.x, press.y);
        haptic('tap');
      }
    }, LONG_PRESS_MS);
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    const t = e.touches[0];
    if (!t) return;
    if (drag) {
      e.preventDefault();
      trackDrag(t.clientX, t.clientY);
      return;
    }
    if (pan) {
      e.preventDefault();
      pan.scroller.scrollTop = pan.scrollTop - (t.clientY - pan.y);
      return;
    }
    if (!press) return;
    const dx = t.clientX - press.x;
    const dy = t.clientY - press.y;
    if (!press.swordEl) {
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE) cancelPress();
      return;
    }
    // The sword owns this gesture: the page never starts a native pan, so both
    // a drag and a scroll are ours to decide.
    e.preventDefault();
    if (press.fired || Math.hypot(dx, dy) < DRAG_INTENT) return;
    if (press.scroller && Math.abs(dy) > Math.abs(dx) && scrolls(press.scroller, dy)) {
      pan = { scroller: press.scroller, y: t.clientY, scrollTop: press.scroller.scrollTop };
      cancelPress();
      return;
    }
    startDrag(press);
    if (drag) {
      drag.startX = press.x;
      drag.startY = press.y;
      trackDrag(t.clientX, t.clientY);
    }
  }, { passive: false });

  document.addEventListener('touchend', e => {
    pan = null;
    // With a finger still down this is only one of several lifting.
    if (e.touches.length > 0) return;
    const hadPress = press;
    const ended = endDrag(true);
    cancelPress();
    rearmNativeDrag();
    if (ended) {
      // A drag that barely moved is a tap on the sword; let its click through.
      if (ended.committed || ended.moved > MOVE_TOLERANCE) {
        e.preventDefault();
        suppressClicks();
      }
      return;
    }
    if (hadPress?.fired) {
      // The preview was the whole gesture: do not also activate the element.
      e.preventDefault();
      suppressClicks();
      tipTimer = setTimeout(hideTip, 1400);
    }
  }, { passive: false });

  document.addEventListener('touchcancel', () => {
    pan = null;
    cancelPress();
    endDrag(false);
    rearmNativeDrag();
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

  return { cancel: () => { pan = null; cancelPress(); endDrag(false); rearmNativeDrag(); stopHold(); } };
}
