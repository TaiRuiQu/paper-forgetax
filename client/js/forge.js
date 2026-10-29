// The normalized 3:2 rig uses the anvil bitmap's coordinates. At -65deg,
// the hammer's left steel face meets the blade at (60%, 8%) of this rig.
const REST = 'rotate(-26deg)';
const CONTACT = 'rotate(-65deg)';
let activeStrike = null;

export function finishForgeStrike(quiet = true) {
  activeStrike?.finish(quiet);
}

export function swingForgeHammer({ interval, reduced, onImpact }) {
  finishForgeStrike();
  const rig = document.getElementById('forge-rig');
  const hammer = document.getElementById('hammer-art');
  const duration = Math.min(560, interval * 0.9);
  let impacted = false;
  let impactTimer;
  let settleTimer;
  let animation;
  function rest() {
    if (rig) rig.dataset.strikePhase = 'idle';
    if (hammer?.style && document.getElementById('anvil-sword')?.style?.opacity === '0') hammer.style.opacity = '0';
  }
  const strike = {
    finish(quiet = true) {
      clearTimeout(impactTimer);
      clearTimeout(settleTimer);
      animation?.cancel();
      impact(quiet);
      if (activeStrike === strike) {
        rest();
        activeStrike = null;
      }
    },
  };
  function impact(quiet = false) {
    if (impacted) return;
    impacted = true;
    if (rig) rig.dataset.strikePhase = 'impact';
    onImpact(quiet || document.hidden);
  }
  activeStrike = strike;
  if (reduced || !hammer?.animate) {
    impact();
    rest();
    activeStrike = null;
    return;
  }
  rig.dataset.strikePhase = 'windup';
  // Slow lift, accelerated fall, 45ms of contact, then a restrained rebound.
  // The whole pose settles before the existing engine cooldown expires.
  animation = hammer.animate([
    { transform: REST, offset: 0, easing: 'cubic-bezier(.18,.65,.3,1)' },
    { transform: 'rotate(24deg)', offset: .26, easing: 'ease-out' },
    { transform: 'rotate(30deg)', offset: .32, easing: 'cubic-bezier(.6,0,1,.3)' },
    { transform: CONTACT, offset: .42, easing: 'linear' },
    { transform: CONTACT, offset: .50, easing: 'cubic-bezier(.12,.7,.25,1)' },
    { transform: 'rotate(-42deg)', offset: .64, easing: 'ease-out' },
    { transform: 'rotate(-29deg)', offset: .82, easing: 'ease-out' },
    { transform: REST, offset: 1 },
  ], { duration, fill: 'none' });
  impactTimer = setTimeout(() => impact(), duration * .42);
  settleTimer = setTimeout(() => {
    if (activeStrike === strike) rig.dataset.strikePhase = 'recovery';
  }, duration * .5);
  animation.finished.then(() => {
    if (activeStrike === strike) {
      rest();
      activeStrike = null;
    }
  }).catch(() => {});
}
