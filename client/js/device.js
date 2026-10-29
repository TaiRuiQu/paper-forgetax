// Layout modes, fullscreen and haptics for touch devices.
// Keep these queries in sync with the media queries in style.css,
// workshop.css and mobile.css.
export const PORTRAIT_COMPACT_QUERY = '(max-width: 800px) and (min-height: 541px), (max-width: 800px) and (orientation: portrait)';
export const LANDSCAPE_COMPACT_QUERY = '(orientation: landscape) and (max-height: 540px)';
export const PORTRAIT_PHONE_QUERY = '(orientation: portrait) and (max-width: 540px) and (pointer: coarse)';
const TOUCH_QUERY = '(pointer: coarse)';

const mq = query => window.matchMedia(query);

// Tabbed workshop: the portrait column on narrow windows or the landscape phone layout.
export function isCompact() {
  return mq(PORTRAIT_COMPACT_QUERY).matches || mq(LANDSCAPE_COMPACT_QUERY).matches;
}

export function isTouchDevice() {
  return mq(TOUCH_QUERY).matches || navigator.maxTouchPoints > 0;
}

// Phones held upright: the game asks to be rotated.
export function needsRotation() {
  return mq(PORTRAIT_PHONE_QUERY).matches;
}

export function onLayoutChange(callback) {
  for (const query of [PORTRAIT_COMPACT_QUERY, LANDSCAPE_COMPACT_QUERY, PORTRAIT_PHONE_QUERY]) {
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

async function lockLandscape() {
  try {
    await screen.orientation?.lock?.('landscape');
    return true;
  } catch {
    return false;
  }
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
