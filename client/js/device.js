// Layout modes, fullscreen and haptics for touch devices.
// Keep these queries in sync with the media queries in style.css,
// workshop.css, mobile.css and fold.css.
export const PORTRAIT_COMPACT_QUERY = '(max-width: 599px) and (min-height: 541px), (max-width: 599px) and (orientation: portrait), (max-width: 800px) and (min-height: 541px) and (pointer: fine), (max-width: 800px) and (orientation: portrait) and (pointer: fine)';
export const LANDSCAPE_COMPACT_QUERY = '(orientation: landscape) and (max-height: 540px)';
export const PORTRAIT_PHONE_QUERY = '(orientation: portrait) and (max-width: 540px) and (pointer: coarse)';
// Unfolded foldables, dual-screen phones and small tablets: near-square touch
// screens big enough to show the whole workshop at once.
export const FOLD_QUERY = '(pointer: coarse) and (min-width: 600px) and (min-height: 541px) and (max-width: 1180px)';
// Half-folded: the hinge splits the viewport into two segments.
const BOOK_QUERY = '(horizontal-viewport-segments: 2)';
const TABLETOP_QUERY = '(vertical-viewport-segments: 2)';
const TOUCH_QUERY = '(pointer: coarse)';

const mq = query => window.matchMedia(query);

// Tabbed workshop: the portrait column on narrow windows, the landscape phone
// layout, or the fold layout (whose ledger panel switches between tribute and shop).
export function isCompact() {
  return mq(PORTRAIT_COMPACT_QUERY).matches || mq(LANDSCAPE_COMPACT_QUERY).matches || isFold();
}

export function isFold() {
  return mq(FOLD_QUERY).matches;
}

// 'book' (hinge runs top to bottom), 'tabletop' (hinge runs side to side) or 'flat'.
export function foldPosture() {
  if (mq(BOOK_QUERY).matches) return 'book';
  if (mq(TABLETOP_QUERY).matches) return 'tabletop';
  return 'flat';
}

export function isTouchDevice() {
  return mq(TOUCH_QUERY).matches || navigator.maxTouchPoints > 0;
}

// Phones held upright: the game asks to be rotated.
export function needsRotation() {
  return mq(PORTRAIT_PHONE_QUERY).matches;
}

export function onLayoutChange(callback) {
  for (const query of [PORTRAIT_COMPACT_QUERY, LANDSCAPE_COMPACT_QUERY, PORTRAIT_PHONE_QUERY, FOLD_QUERY, BOOK_QUERY, TABLETOP_QUERY]) {
    mq(query).addEventListener('change', callback);
  }
}

// Launched from the home screen. The Fullscreen API also matches
// display-mode: fullscreen, so that case is excluded here.
export function isStandalone() {
  if (navigator.standalone === true || mq('(display-mode: standalone)').matches) return true;
  return mq('(display-mode: fullscreen)').matches && !isFullscreen();
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function fullscreenSupported() {
  return Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
}

export function isFullscreen() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

// Must run inside a user gesture. Failures are silent: the game stays playable.
export async function enterFullscreen() {
  if (!fullscreenSupported() || isFullscreen()) return lockLandscape();
  const root = document.documentElement;
  try {
    if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
    else root.webkitRequestFullscreen?.();
  } catch {
    return false;
  }
  return lockLandscape();
}

export async function exitFullscreen() {
  if (!isFullscreen()) return;
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else document.webkitExitFullscreen?.();
  } catch { /* ignore */ }
}

// Phones play in landscape. Unfolded screens work either way round, so they stay free.
export async function lockLandscape() {
  if (isFold()) {
    unlockOrientation();
    return true;
  }
  try {
    await screen.orientation?.lock?.('landscape');
    return true;
  } catch {
    return false;
  }
}

export function unlockOrientation() {
  try { screen.orientation?.unlock?.(); } catch { /* ignore */ }
}

export function onFullscreenChange(callback) {
  document.addEventListener('fullscreenchange', callback);
  document.addEventListener('webkitfullscreenchange', callback);
}

export function canVibrate() {
  return typeof navigator.vibrate === 'function';
}

export const HAPTICS = {
  tap: 8,
  pickup: 12,
  drop: 16,
  hammer: 14,
  success: [10, 30, 14],
  great: [18, 40, 30, 40, 40],
  damage: [30, 20, 18],
  break: [70, 40, 110],
  frenzy: [20, 30, 20, 30, 50],
  bell: [40, 60, 40],
};

export function vibrate(enabled, pattern) {
  if (!enabled || !canVibrate()) return;
  try { navigator.vibrate(HAPTICS[pattern] ?? pattern); } catch { /* ignore */ }
}
