import * as Api from './api.js';
import { AudioEngine } from './audio.js';
import { FX } from './fx.js';
import { swingForgeHammer, finishForgeStrike } from './forge.js';
import * as UI from './ui.js';
import * as Modals from './modals.js';
import { tutorialObjective } from '../shared/engine/tutorial.js';
import {
  E, TUTORIAL_STEPS, fmt, compact, esc, mergedCodex,
} from './helpers.js';
import { RELIC_BY_ID } from '../shared/data/relics.js';
import { ACHIEVEMENTS, CONSUMABLES, ACHIEVEMENT_BY_ID } from '../shared/data/gameData.js';
import { hammerDisabledReason, consumeDisabledReason, bestSword } from './helpers.js';
import * as Device from './device.js';
import { wireTouch } from './touch.js';

const CONSUMABLE_ORDER = ['cracked_dragon_scale', 'regret_clockwork', 'red_chalk', 'powder_pouch', 'cold_star_shard'];
const SAVE_DELAY = 200;
const UNCLOSABLE_MODALS = ['startRelic', 'daySummary', 'victory', 'death'];

const settingsDefaults = { sound: true, volume: 0.65, reduceMotion: false, haptics: true, autoFullscreen: true };

const app = {
  user: null,
  profile: null,
  saves: [],
  state: null,
  activeSlot: null,
  screen: 'landing',
  authMode: 'login',
  selectedSwordId: null,
  rightTab: 'shop',
  mobileTab: 'forge',
  sync: 'idle',
  settings: { ...settingsDefaults },
  tutorialStep: 0,
  modal: null,
  modalPaused: false,
  saveTimer: null,
  savingPromise: null,
  apiBase: Api.API_BASE,
  audio: new AudioEngine(),
  fx: null,
  toast: (...args) => UI.toast(app, ...args),
  renderTutorial: () => UI.renderTutorial(app),
  pauseClock: () => pauseClock(),
  resumeClock: () => resumeClock(),
  _clockPaused: false,
  _frenzyRemain: null,
  _cooldownRemain: 0,
  _modalPaused: false,
  _interrupts: new Set(),
  _interruptPaused: false,
  haptic: pattern => Device.vibrate(app.settings.haptics, pattern),
};

window.__forgetax = app;

// ---------------------------------------------------------------- settings
function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem('forgetax.settings') || '{}');
    app.settings = { ...settingsDefaults, ...raw };
  } catch {
    app.settings = { ...settingsDefaults };
  }
}

function persistSettings() {
  localStorage.setItem('forgetax.settings', JSON.stringify(app.settings));
}

function applySettings() {
  app.audio.setEnabled(app.settings.sound);
  app.audio.setVolume(app.settings.volume);
  const reduced = app.settings.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (app.fx) app.fx.setReduced(reduced);
  document.body.classList.toggle('reduce-motion', Boolean(reduced));
}

// ---------------------------------------------------------------- navigation
function clearModalDom() {
  app.modal = null;
  document.getElementById('app').inert = false;
  app._modalPaused = false;
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
  document.body.classList.remove('modal-open');
}

function navigate(name) {
  UI.setScreen(app, name);
  app.fx?.setAmbient(name === 'game');
  if (name !== 'game') app.audio.stopAmbience();
  syncRotationHint();
  if (name === 'game') armBackTrap();
}

// ---------------------------------------------------------------- mobile shell
// On touch devices the system back gesture behaves like Esc inside the workshop
// instead of leaving the page mid-run.
function armBackTrap() {
  if (app._backArmed || !Device.isTouchDevice()) return;
  app._backArmed = true;
  history.pushState({ forgetax: 'game' }, '');
}

function handleBack() {
  if (app.modal) {
    if (!UNCLOSABLE_MODALS.includes(app.modal.type) && app.modal.options?.closable !== false) Modals.closeModal(app);
    return true;
  }
  if (app.screen === 'game') {
    Modals.openMenu(app);
    return true;
  }
  return false;
}

function onPopState() {
  if (!app._backArmed) return;
  app._backArmed = false;
  if (handleBack() && app.screen === 'game') armBackTrap();
}

function renderFullscreenButtons() {
  const available = Device.fullscreenSupported() && !Device.isStandalone();
  const active = Device.isFullscreen();
  document.querySelectorAll('[data-action="toggle-fullscreen"]').forEach(btn => {
    btn.classList.toggle('hidden', !available);
    btn.classList.toggle('is-active', active);
    btn.title = active ? '退出全屏' : '全屏';
    const img = btn.querySelector('img');
    if (img) img.src = `./assets/ui/${active ? 'fullscreen-exit' : 'fullscreen'}.svg`;
  });
}

// Called from the tap that opens a contract, so the browser accepts the request.
function enterGameFullscreen() {
  if (!Device.isTouchDevice() || Device.isStandalone()) return;
  if (app.settings.autoFullscreen && Device.fullscreenSupported()) {
    Device.enterFullscreen();
    return;
  }
  if (Device.isIOS() && !Device.fullscreenSupported() && !localStorage.getItem('forgetax.iosHint')) {
    localStorage.setItem('forgetax.iosHint', '1');
    setTimeout(() => UI.toast(app, '想要全屏横屏？', '在 Safari 分享菜单里选择「添加到主屏幕」，从桌面图标进入即可全屏游玩。', 'info', 7000), 1200);
  }
}

function onLayoutChange() {
  syncRotationHint();
  // Unfolding or folding swaps between the fold layout and the phone layouts,
  // whose tabs mean different things; start again from the anvil.
  const fold = Device.isFold();
  if (fold !== app._foldLayout) {
    app._foldLayout = fold;
    app.mobileTab = 'forge';
    if (Device.isFullscreen() && Device.isTouchDevice()) Device.lockLandscape();
  }
  if (app.screen === 'game' && app.state) {
    UI.renderAll(app);
    UI.renderTutorial(app);
  }
}

function showLanding() {
  document.body.classList.remove('modal-open');
  UI.setScreen(app, 'landing');
  UI.setAuthMode(app, 'login');
  document.getElementById('boot')?.classList.add('done');
}

function showMenu() {
  syncProfile();
  UI.renderMenu(app);
  navigate('menu');
}

async function refreshSaves() {
  const slots = await Api.getSaves();
  app.saves = slots;
  return slots;
}

function showGame() {
  syncProfile();
  UI.renderAll(app);
  UI.renderTutorial(app);
  navigate('game');
  if (app.settings.sound) {
    app.audio.startAmbience();
  }
}

// ---------------------------------------------------------------- save / profile
function syncAchievements() {
  if (!app.state) return [];
  const p = app.profile || (app.profile = E.emptyProfile());
  p.achievements = p.achievements || {};
  const newly = [];
  for (const id of app.state.unlockedAchievements || []) {
    if (!p.achievements[id]) {
      p.achievements[id] = new Date().toISOString();
      newly.push(id);
    }
  }
  p.codex = E.mergeCodex(p.codex || {}, app.state.codex);
  for (const id of newly) {
    const a = ACHIEVEMENT_BY_ID[id];
    if (!a) continue;
    const reward = a.unlock && RELIC_BY_ID[a.unlock] ? ` · 解锁遗物「${RELIC_BY_ID[a.unlock].zh}」` : '';
    UI.toast(app, '成就解锁', `${a.zh} · ${a.en}${reward}`, 'achievement', 4800);
    app.audio.play('achievement');
    app.fx?.burstAt('#hud', 'gold', { count: 20, y: 0.7 });
  }
  return newly;
}

function recordRunStats() {
  if (!app.state) return;
  const s = app.state;
  const p = app.profile || (app.profile = E.emptyProfile());
  p.stats = p.stats || { runs: 0, bestDay: 0, bestGold: 0, contracts: 0, deaths: 0, plays: 0 };
  p.stats.bestDay = Math.max(p.stats.bestDay || 0, s.day || 0);
  p.stats.bestGold = Math.max(p.stats.bestGold || 0, s.gold || 0, s.run?.goldEarned || 0);
  if (s.phase === 'victory' && !s.statsVictory) {
    s.statsVictory = true;
    p.stats.contracts = (p.stats.contracts || 0) + 1;
  }
  if (s.phase === 'dead' && !s.statsDeath) {
    s.statsDeath = true;
    p.stats.deaths = (p.stats.deaths || 0) + 1;
  }
}

function syncProfile() {
  if (!app.state) return;
  const p = app.profile || (app.profile = E.emptyProfile());
  p.codex = E.mergeCodex(p.codex || {}, app.state.codex);
  p.stats = p.stats || {};
  p.stats.bestDay = Math.max(p.stats.bestDay || 0, app.state.day || 0);
  p.stats.bestGold = Math.max(p.stats.bestGold || 0, app.state.gold || 0, app.state.run?.goldEarned || 0);
  if (app.state.tutorial && !app.state.tutorial.active) p.tutorialDone = true;
  syncAchievements();
  recordRunStats();
}

function setSync(status) {
  app.sync = status;
  UI.renderSyncBadge(app);
}

function scheduleSave(delay = SAVE_DELAY) {
  if (!app.state || !app.activeSlot) return;
  syncProfile();
  setSync('saving');
  if (app.saveTimer !== null) return;
  app.saveTimer = setTimeout(() => flushSave({ silent: true }), delay);
}

async function flushSave({ silent = false } = {}) {
  clearTimeout(app.saveTimer);
  app.saveTimer = null;
  if (!app.state || !app.activeSlot || !Api.getToken()) return false;
  while (app.savingPromise) {
    await app.savingPromise.catch(() => false);
  }
  if (!app.state || !app.activeSlot || !Api.getToken()) return false;
  clearTimeout(app.saveTimer);
  app.saveTimer = null;
  syncProfile();
  const slot = app.activeSlot;
  const state = E.prepareSave(app.state);
  const profile = JSON.parse(JSON.stringify(app.profile));
  setSync('saving');
  const promise = Api.putSave(slot, state, profile)
    .then(res => {
      // Progress can change while a request is in flight.
      if (res.profile) app.profile = E.mergeProfile(app.profile, res.profile);
      setSync('saved');
      const found = app.saves.find(s => s.slot === slot);
      if (found) { found.meta = res.meta; found.updatedAt = res.updatedAt; }
      return true;
    })
    .catch(err => {
      setSync('offline');
      if (!silent) UI.toast(app, '云端同步失败', err.message || '请检查后端是否运行。', 'error');
      return false;
    })
    .finally(() => {
      app.savingPromise = null;
    });
  app.savingPromise = promise;
  return promise;
}

// ---------------------------------------------------------------- clocks
function pauseClock() {
  if (!app.state || app._clockPaused) return;
  app._clockPaused = true;
  const now = Date.now();
  app._frenzyRemain = app.state.frenzy?.active ? Math.max(0, app.state.frenzy.endsAt - now) : null;
  app._cooldownRemain = Math.max(0, (app.state.cooldownUntil || 0) - now);
}

function resumeClock() {
  if (!app._clockPaused) return;
  if (app._interrupts.size) {
    // A modal closed while the app is hidden or waiting to be rotated.
    app._interruptPaused = true;
    return;
  }
  app._clockPaused = false;
  const now = Date.now();
  if (app._frenzyRemain != null && app.state?.frenzy?.active) {
    app.state.frenzy.endsAt = now + app._frenzyRemain;
  }
  if (app._cooldownRemain > 0 && app.state && app.state.cooldownUntil > 0) {
    app.state.cooldownUntil = now + app._cooldownRemain;
  }
  app._frenzyRemain = null;
  app._cooldownRemain = 0;
}

// Backgrounding the app or rotating a phone upright must not eat the frenzy window.
function setInterrupt(reason, on) {
  if (on) app._interrupts.add(reason);
  else app._interrupts.delete(reason);
  if (app._interrupts.size) {
    if (!app._clockPaused && app.state) {
      pauseClock();
      app._interruptPaused = true;
    }
  } else if (app._interruptPaused) {
    app._interruptPaused = false;
    if (!app._modalPaused) resumeClock();
  }
}

function syncRotationHint() {
  const blocked = app.screen === 'game' && Device.needsRotation();
  document.body.classList.toggle('needs-rotation', blocked);
  setInterrupt('rotation', blocked);
}

// ---------------------------------------------------------------- actions: helpers
function afterChange() {
  if (app.selectedSwordId && !E.getSword(app.state, app.selectedSwordId)) {
    app.selectedSwordId = null;
  }
  syncAchievements();
  recordRunStats();
  UI.renderAll(app);
  UI.renderTutorial(app);
  scheduleSave();
}

function failToast(res) {
  if (!res || res.ok !== false) return false;
  UI.toast(app, '无法操作', res.message || '这一步不可行。', 'error');
  app.audio.play('error');
  return true;
}

// ---------------------------------------------------------------- boot / auth
async function boot() {
  loadSettings();
  app.fx = new FX(document.getElementById('fx-canvas'));
  applySettings();
  wireEvents();
  try {
    if (Api.getToken()) {
      const data = await Api.me();
      app.user = data.user;
      app.profile = data.profile;
      await refreshSaves();
      setSync('saved');
      showMenu();
    } else {
      showLanding();
    }
  } catch (err) {
    Api.logout();
    showLanding();
    if (err.code === 'network') {
      UI.toast(app, '云端没有响应', '请先启动后端服务器，再登录云端工坊。', 'error', 6000);
    }
  } finally {
    const bootEl = document.getElementById('boot');
    if (bootEl) {
      setTimeout(() => {
        bootEl.classList.add('done');
        setTimeout(() => bootEl.remove(), 500);
      }, 280);
    }
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const mode = app.authMode;
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const confirm = document.getElementById('auth-confirm').value;
  UI.showAuthError('');
  if (username.length < 3 || username.length > 20) { UI.showAuthError('铁匠名需要 3–20 个字符。'); return; }
  if (password.length < 6) { UI.showAuthError('工坊口令至少 6 个字符。'); return; }
  if (mode === 'register' && password !== confirm) { UI.showAuthError('两次输入的口令不一样。'); return; }
  const btn = document.getElementById('auth-submit');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = mode === 'register' ? '正在刻下名字…' : '正在推开门…';
  try {
    const data = mode === 'register' ? await Api.register(username, password) : await Api.login(username, password);
    app.user = data.user;
    app.profile = data.profile;
    await refreshSaves();
    setSync('saved');
    app.audio.ensure();
    app.audio.play('bell');
    UI.toast(app, mode === 'register' ? '契约签订' : '欢迎回到工坊', `铁匠 ${username}，云端已连接。`, 'success');
    showMenu();
  } catch (err) {
    UI.showAuthError(err.message || '登录失败。');
    UI.toast(app, '未能进入工坊', err.message || '', 'error');
    app.audio.play('error');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function logout() {
  if (app.state && app.activeSlot) {
    const ok = await flushSave({ silent: false });
    if (!ok) {
      UI.toast(app, '还不能退出', '云端保存失败。请确认后端正在运行，再试一次。', 'error');
      return;
    }
  }
  Api.logout();
  app.user = null;
  app.profile = null;
  app.state = null;
  app.activeSlot = null;
  app.saves = [];
  app.selectedSwordId = null;
  clearModalDom();
  navigate('landing');
  UI.setAuthMode(app, 'login');
  UI.toast(app, '已退出工坊', '云端存档仍然保留。', 'info');
}

// ---------------------------------------------------------------- slot flows
async function loadSlot(slot) {
  try {
    let save = null;
    try {
      save = await Api.getSave(slot);
    } catch (err) {
      const cached = app.saves.find(s => s.slot === slot);
      if (cached?.state) save = cached;
      else throw err;
    }
    if (!save?.state) { UI.toast(app, '空存档', '这个契约槽还没有内容。', 'error'); return; }
    const state = E.hydrateState(save.state);
    if (!state) throw new Error('存档损坏');
    const unlocked = new Set([...(state.unlockedAchievements || []), ...Object.keys(app.profile?.achievements || {})]);
    state.unlockedAchievements = Array.from(unlocked);
    if (app.profile?.tutorialDone) state.tutorial.active = false;
    app.state = state;
    app.activeSlot = slot;
    app.selectedSwordId = state.anvilSwordId || bestSword(state)?.id || null;
    app.rightTab = 'shop';
    app.mobileTab = 'forge';
    app.tutorialStep = 0;
    clearModalDom();
    showGame();
    if (state.phase === 'select') {
      if (!state.tutorial.introSeen) Modals.openIntro(app);
      else Modals.openStartRelic(app);
    } else if (state.phase === 'victory') {
      Modals.openVictory(app, state.lastDaySummary || {});
    } else if (state.phase === 'dead') {
      Modals.openDeath(app, state.lastDaySummary || {});
    }
  } catch (err) {
    UI.toast(app, '读取失败', err.message || '云端存档读取失败。', 'error');
  }
}

async function startNewRun(slot) {
  if (!app.user || !app.profile) { showLanding(); return; }
  try { Modals.closeModal(app); } catch { /* ignore */ }
  app.state = E.createRun({ profile: app.profile });
  app.activeSlot = slot;
  app.selectedSwordId = null;
  app.rightTab = 'shop';
  app.mobileTab = 'forge';
  app.tutorialStep = 0;
  clearModalDom();
  app.profile.stats = app.profile.stats || { runs: 0, bestDay: 0, bestGold: 0, contracts: 0, deaths: 0, plays: 0 };
  app.profile.stats.runs = (app.profile.stats.runs || 0) + 1;
  if (app.profile.tutorialDone) app.state.tutorial.active = false;
  showGame();
  Modals.openIntro(app);
  app.audio.play('day');
  await flushSave({ silent: true });
}

async function chooseStartRelic(id) {
  const res = E.chooseStartingRelic(app.state, id);
  if (!res.ok) { failToast(res); return; }
  Modals.closeModal(app);
  app.audio.play('buy');
  app.fx?.burstAt(['#anvil-stage', '.hud-quota'], 'gold', { count: 30, y: 0.5 });
  UI.toast(app, '遗物已入袋', `${RELIC_BY_ID[id].zh}：${RELIC_BY_ID[id].desc}`, 'success', 4600);
  syncAchievements();
  UI.renderAll(app);
  app.tutorialStep = 0;
  applyTutorialTab();
  UI.renderTutorial(app);
  scheduleSave();
}

async function leaveToMenu() {
  if (app.state) {
    const ok = await flushSave({ silent: false });
    if (!ok) {
      UI.toast(app, '还不能离开', '云端保存失败。请确认后端正在运行，再试一次。', 'error');
      return;
    }
  }
  Modals.closeModal(app);
  try { await refreshSaves(); } catch { /* keep cached */ }
  showMenu();
}

async function deleteSlot(slot) {
  try {
    await Api.deleteSave(slot);
    if (app.activeSlot === slot) { app.state = null; app.activeSlot = null; }
    Modals.closeModal(app);
    await refreshSaves();
    showMenu();
    UI.toast(app, '存档已删除', '图鉴与成就仍然保留。', 'info');
  } catch (err) {
    UI.toast(app, '删除失败', err.message || '', 'error');
  }
}

async function abandonRun() {
  if (!app.activeSlot) return;
  try {
    await Api.deleteSave(app.activeSlot);
    app.state = null;
    app.activeSlot = null;
    Modals.closeModal(app);
    await refreshSaves();
    showMenu();
    UI.toast(app, '契约作废', '本局存档已删除，长期进度保留。', 'info');
  } catch (err) {
    UI.toast(app, '删除失败', err.message || '', 'error');
  }
}

// ---------------------------------------------------------------- game actions
function doHammer() {
  if (!app.state || app.modal || app._strikeInFlight) return;
  const reason = hammerDisabledReason(app);
  if (reason && reason !== '锤子回气中') { UI.toast(app, '现在不能挥锤', reason, 'error'); return; }
  const res = E.hammer(app.state, { now: Date.now() });
  if (!res.ok) {
    if (res.error !== 'cooldown') { failToast(res); UI.renderAll(app); }
    return;
  }
  const r = app.state.lastHammer;
  app._strikeInFlight = true;
  if (app.settings.sound) app.audio.ensure();
  animateHammer(r);
}

function animateHammer(r) {
  if (!app.fx?.reduced) app.audio.play('hammer-windup');
  swingForgeHammer({
    interval: E.hammerInterval(app.state, r.inFrenzy),
    reduced: app.fx?.reduced,
    onImpact: quiet => {
      app._strikeInFlight = false;
      syncAchievements();
      recordRunStats();
      UI.renderAll(app);
      UI.renderTutorial(app);
      scheduleSave();
      if (quiet) return;
      const stage = document.getElementById('anvil-stage');
      if (!stage) return;
      const rect = document.getElementById('forge-flash').getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      // A hidden anvil (another phone tab) has no box; its numbers would land at 0,0.
      const onStage = rect.width > 0 && rect.height > 0;
      let sound = r.result;
      if (r.trueBreak) sound = 'break';
      else if (r.protectedBy) sound = 'protect';
      app.audio.play('hammer');
      app.audio.play(sound);
      if (r.frenzyStarted) app.audio.play('frenzy');
      app.haptic(r.frenzyStarted ? 'frenzy' : r.trueBreak ? 'break' : ['great', 'success', 'damage'].includes(r.result) ? r.result : 'hammer');
      const colorMap = { break: '#e05a4f', damage: '#ff9a4c', hold: '#a89d8b', success: '#78c69c', great: '#ffdc92' };
      app.fx?.forgeImpact({ broken: r.trueBreak, great: r.result === 'great' });
      const delta = r.levelAfter - r.levelBefore;
      const valueDelta = r.valueAfter - r.valueBefore;
      if (!r.trueBreak) {
        const bits = [];
        if (delta) bits.push(`${delta > 0 ? '+' : ''}${delta}级`);
        if (valueDelta) bits.push(`${valueDelta > 0 ? '+' : ''}${compact(valueDelta)} G`);
        if (bits.length && onStage) app.fx?.floatText(x, y, bits.join(' · '), colorMap[r.result] || '#ffdc92', true);
      } else if (onStage) {
        app.fx?.floatText(x, y, '剑碎了', '#e05a4f', true);
      }
      showResultBanner(r);
      if (r.frenzyStarted) {
        UI.toast(app, '入神启动', `安全窗口 ${((E.frenzyDuration(app.state)) / 1000).toFixed(0)} 秒：期间不会破碎。`, 'success', 3600);
        app.fx?.burstAt(['#anvil-stage', '.hud-quota'], 'great', { count: 40 });
      }
      if (r.trueBreak) {
        UI.toast(app, '剑碎了', '如果还有悔恨发条，可以回溯这一锤。', 'error', 4200);
      } else if (r.protectedBy) {
        UI.toast(app, '碎剑被挡下', r.triggers.find(t => t.type === 'protect')?.text || '', 'success', 3800);
      }
    },
  });
}

function showResultBanner(r) {
  const banner = document.getElementById('result-banner');
  if (!banner) return;
  let label = E.RESULT_LABEL[r.result];
  if (r.convertedFromBreak) label = '破碎 → 损伤';
  else if (r.protectedBy && r.result === 'break') label = '破碎被挡下';
  else if (r.trueBreak) label = '破碎';
  const bits = [label];
  if (r.trueBreak) bits.push('剑没了');
  else if (r.result === 'great') bits.push('价值 ×2.5');
  else if (r.levelAfter !== r.levelBefore) bits.push(`${r.levelAfter > r.levelBefore ? '+' : ''}${r.levelAfter - r.levelBefore} 级`);
  banner.className = `result-banner show ${r.trueBreak ? 'break' : r.result}`;
  banner.textContent = bits.join(' · ');
  clearTimeout(showResultBanner._t);
  showResultBanner._t = setTimeout(() => { banner.classList.remove('show'); }, 1200);
}

function doHeat() {
  const res = E.heatAnvilSword(app.state);
  if (failToast(res)) return;
  app.audio.play('heat');
  app.fx?.burstAt(['#forge-card', '#anvil-sword', '#mab-heat'], 'ember', { count: 20, y: 0.6 });
  afterChange();
}

function doTakeAnvil() {
  if (!app.state || app._strikeInFlight) return;
  const sword = E.getAnvilSword(app.state);
  const res = E.takeAnvilSword(app.state, Date.now());
  if (failToast(res)) return;
  app.audio.play('click');
  if (sword) app.selectedSwordId = sword.id;
  afterChange();
}

function doRewind() {
  const res = E.rewindHammer(app.state);
  if (failToast(res)) return;
  if (app.modal?.type === 'kit') Modals.closeModal(app);
  app.audio.play('rewind');
  app.fx?.burstAt(['#anvil-stage', '.hud-quota'], 'gold', { count: 26, y: 0.5 });
  UI.toast(app, '回溯完成', '上一锤连同金币、充能与遗物副作用一起撤回。', 'success');
  afterChange();
}

function doUseConsumable(key) {
  const reason = consumeDisabledReason(app, key);
  if (reason) { UI.toast(app, '现在不能用', reason, 'error'); app.audio.play('error'); return; }
  if (key === 'regret_clockwork') { doRewind(); return; }
  const res = E.useConsumable(app.state, key, Date.now());
  if (failToast(res)) return;
  if (app.modal?.type === 'kit') Modals.closeModal(app);
  app.audio.play('buy');
  const c = CONSUMABLES[key];
  app.fx?.burstAt(['#consume-row', '#anvil-sword', '#anvil-stage'], 'ember', { count: 14 });
  UI.toast(app, `使用了${c.zh}`, '', 'info', 2200);
  afterChange();
}

function doPlaceOnAnvil(id) {
  const res = E.placeOnAnvil(app.state, id);
  if (failToast(res)) return;
  app.selectedSwordId = id;
  app.audio.play('click');
  afterChange();
}

function doMove(id, where) {
  const res = E.moveSwordTo(app.state, id, where);
  if (failToast(res)) return;
  app.selectedSwordId = id;
  app.audio.play('click');
  afterChange();
}

function doTributeRemove(id) {
  const res = E.takeFromTribute(app.state, id);
  if (failToast(res)) return;
  app.selectedSwordId = id;
  app.audio.play('click');
  afterChange();
}

function doClaimOverflow() {
  const res = E.claimOverflow(app.state);
  if (failToast(res)) return;
  app.audio.play('coin');
  afterChange();
}

function sellSword(id) {
  const sw = E.getSword(app.state, id);
  if (!sw) return;
  const value = E.swordValue(app.state, sw);
  if (value > 3000 || sw.level >= 4) {
    Modals.openConfirm(app, {
      title: '把剑投进售卖机？',
      eyebrow: 'SELL SWORD',
      danger: true,
      body: `<div class="relic-detail-desc">这把 <b>${esc(E.swordDisplayName(sw))}</b>（+${sw.level}，价值 <b>${fmt(value)} G</b>）将被永久交出，只换 <b>1 剑币</b>。高价值贡品也会失去。<br><br>售卖机只认剑，不认剑的价值。</div>`,
      confirmLabel: '投入售卖机',
      kind: 'sell-sword',
      id,
    });
    return;
  }
  const res = E.sellSword(app.state, id);
  if (failToast(res)) return;
  app.audio.play('coin');
  UI.toast(app, `获得 ${res.coins} 剑币`, res.hook ? '收账人的钩子：这把 +0 未锻造剑多换 1 枚。' : '', 'success', 2600);
  afterChange();
}

function doBuyRelic(index) {
  const res = E.buyRelic(app.state, index);
  if (!res.ok) {
    if (res.error === 'slots-full') { Modals.openDiscardPick(app, index); return; }
    failToast(res);
    return;
  }
  app.audio.play('buy');
  UI.toast(app, `购得 ${res.relic.zh}`, res.relic.desc, 'success', 3600);
  afterChange();
}

function doDiscardAndBuy(id, index) {
  const d = E.discardRelic(app.state, id);
  if (failToast(d)) return;
  Modals.closeModal(app);
  const b = E.buyRelic(app.state, index);
  if (!b.ok) { failToast(b); afterChange(); return; }
  app.audio.play('buy');
  UI.toast(app, `丢弃后购得 ${b.relic.zh}`, b.relic.desc, 'success', 3600);
  afterChange();
}

function doDiscardRelic(id) {
  const res = E.discardRelic(app.state, id);
  if (failToast(res)) return;
  const r = RELIC_BY_ID[id];
  Modals.closeModal(app);
  app.audio.play('error');
  UI.toast(app, `丢弃了 ${r.zh}`, '持续效果已移除，不退款。已获得的永久签保留。', 'info', 3800);
  afterChange();
}

function doReroll() {
  const res = E.rerollShop(app.state);
  if (failToast(res)) return;
  app.audio.play('coin');
  UI.toast(app, '商亭已刷新', res.free ? '磨旧的兑换券生效。' : `花费 ${fmt(res.cost)} G。`, 'info', 2600);
  afterChange();
}

function doBuyMerchant(index) {
  const res = E.buyMerchantItem(app.state, index);
  if (failToast(res)) return;
  app.audio.play('buy');
  UI.toast(app, '交易完成', '', 'success', 2000);
  if (res.soldOut) UI.toast(app, '买空库存', '“我全都要。”', 'achievement', 4600);
  syncAchievements();
  recordRunStats();
  UI.renderAll(app);
  Modals.refreshModal(app);
  scheduleSave();
}

function openRingConfirm() {
  const s = app.state;
  const total = E.tributeTotal(s);
  const quota = E.currentQuota(s);
  const short = total < quota;
  const swords = E.tributeSwords(s);
  const angerAfter = short ? s.anger + 1 : s.anger;
  const pardon = E.hasRelic(s, 'dragons-pardon') && !s.flags.pardonUsed;
  const lethal = short && angerAfter >= 3;
  const body = `<div class="summary-hero" style="padding-top:0">
      <div class="summary-total" style="font-size:24px">${fmt(total)} G</div>
      <div class="summary-vs">贡台总额 / 今日需求</div>
      <div class="summary-quota">${fmt(quota)} G</div>
      <div class="summary-stamp ${short ? 'fail' : 'ok'}">${short ? '欠贡' : '足额'}</div>
    </div>
    <div class="summary-rows">
      <div class="summary-row"><span>贡台上的剑</span><b>${swords.length} 把</b></div>
      <div class="summary-row"><span>敲铃后转化为金币</span><b>+${fmt(total)} G</b></div>
      <div class="summary-row ${short ? 'bad' : 'good'}"><span>怒气变化</span><b>${s.anger} → ${Math.min(3, angerAfter)} / 3</b></div>
    </div>
    ${short ? `<div class="modal-lore" style="color:${lethal ? 'var(--red)' : 'var(--ember-2)'}">${lethal ? (pardon ? '这一声铃会让怒气到达第三档；巨龙赦免状会救你一次，随后遗物消失。' : '这一声铃会让怒气到达第三档。你会死。') : '欠贡会提升一档怒气，但次日仍会收到三把基础剑。'}</div>` : '<div class="modal-lore" style="color:var(--green)">贡品足额。敲铃后这些剑会被巨龙收走。</div>'}
    <div class="modal-lore" style="margin-top:8px;font-size:9px">敲铃前可以取回贡台上的剑。敲铃之后无法反悔。</div>`;
  Modals.openConfirm(app, {
    title: '敲响贡铃？',
    eyebrow: 'RING THE BELL',
    danger: short,
    body,
    confirmLabel: '敲响贡铃',
    kind: 'ring-bell',
  });
}

function confirmRing() {
  Modals.closeModal(app);
  const res = E.ringBell(app.state);
  if (!res.ok) { failToast(res); return; }
  app.audio.play('bell');
  app.haptic('bell');
  app.fx?.burstAt(['#tribute-bar', '.hud-quota'], 'gold', { count: 44, y: 0.4 });
  syncAchievements();
  recordRunStats();
  UI.renderAll(app);
  scheduleSave();
  const summary = res.summary;
  if (summary.pardonUsed) UI.toast(app, '巨龙赦免状燃尽', '死亡被阻止，怒气回到两档。', 'achievement', 4600);
  if (summary.death) {
    app.audio.play('death');
    Modals.openDeath(app, summary);
  } else if (summary.contractComplete) {
    app.audio.play('victory');
    Modals.openVictory(app, summary);
  } else {
    app.audio.play('day');
    Modals.openDaySummary(app, summary);
  }
}

function continueEndless() {
  const res = E.continueEndless(app.state);
  if (failToast(res)) return;
  Modals.closeModal(app);
  app.audio.play('day');
  UI.toast(app, `第 ${app.state.day} 天`, `贡额 ${fmt(E.currentQuota(app.state))} G。契约延长了。`, 'success', 4200);
  syncAchievements();
  recordRunStats();
  UI.renderAll(app);
  UI.renderTutorial(app);
  scheduleSave();
}

function tutorialMobileTab(step) {
  return tutorialObjective(app.state)?.tab || 'forge';
}

function applyTutorialTab() {
  if (Device.isCompact() && app.state?.tutorial?.active) {
    app.mobileTab = tutorialMobileTab(app.tutorialStep);
    UI.applyMobileTab(app);
  }
}

function finishTutorial() {
  if (!app.state) return;
  app.state.tutorial.active = false;
  app.profile.tutorialDone = true;
  app.tutorialStep = 0;
  UI.renderTutorial(app);
  scheduleSave();
  UI.toast(app, app.state.day > (app.state.tutorial.startDay || 1) ? '第一堂课：活下来' : '已跳过引导', '可在设置中重新开启实操引导。', 'success');
}

function skipTutorial() {
  if (!app.state?.tutorial?.active) return;
  finishTutorial();
}

// ---------------------------------------------------------------- modal actions
function confirmDialog() {
  const payload = app.modal?.payload || {};
  switch (payload.kind) {
    case 'ring-bell':
      confirmRing();
      break;
    case 'overwrite-slot':
      enterGameFullscreen();
      Modals.closeModal(app);
      startNewRun(payload.slot);
      break;
    case 'delete-slot':
      deleteSlot(payload.slot);
      break;
    case 'discard-relic':
      doDiscardRelic(payload.id);
      break;
    case 'sell-sword': {
      Modals.closeModal(app);
      const res = E.sellSword(app.state, payload.id);
      if (failToast(res)) return;
      app.audio.play('coin');
      UI.toast(app, `获得 ${res.coins} 剑币`, '', 'success', 2400);
      afterChange();
      break;
    }
    case 'abandon-run':
      abandonRun();
      break;
    case 'restart-run':
      Modals.closeModal(app);
      startNewRun(app.activeSlot);
      break;
    default:
      Modals.closeModal(app);
  }
}

// ---------------------------------------------------------------- action router
async function handleAction(action, el) {
  const id = el.dataset.id;
  switch (action) {
    case 'open-howto': Modals.openHowTo(app); break;
    case 'open-codex': Modals.openCodex(app, 'swords'); break;
    case 'codex-tab': Modals.openCodex(app, el.dataset.tab || 'swords'); break;
    case 'open-achievements': Modals.openAchievements(app); break;
    case 'open-calendar': Modals.openCalendar(app); break;
    case 'open-log': Modals.openLog(app); break;
    case 'open-kit': Modals.openKit(app); break;
    case 'open-settings': Modals.openSettings(app); break;
    case 'open-menu': Modals.openMenu(app); break;
    case 'close-modal': Modals.closeModal(app); break;
    case 'confirm-dialog': confirmDialog(); break;
    case 'open-relic': Modals.openRelicDetail(app, id); break;
    case 'open-merchant': if (app.state?.merchant) Modals.openMerchant(app); else UI.toast(app, '商人不在', '他在第 3、6、9、12、15、18、21 天到访。', 'info'); break;
    case 'buy-merchant': doBuyMerchant(Number(el.dataset.index)); break;
    case 'slot-load': enterGameFullscreen(); await loadSlot(Number(el.dataset.slot)); break;
    case 'slot-new': {
      const slot = Number(el.dataset.slot);
      const existing = app.saves.find(s => s.slot === slot && s.state);
      if (!existing) enterGameFullscreen();
      if (existing) {
        Modals.openConfirm(app, {
          title: `覆盖存档槽 ${slot}？`,
          eyebrow: 'NEW CONTRACT',
          danger: true,
          body: `<div class="relic-detail-desc">这个槽位已经有一份第 <b>${existing.meta?.day || '?'}</b> 天的契约。签订新契约会永久覆盖它。<br><br>图鉴、成就与已解锁遗物不会丢失。</div>`,
          confirmLabel: '签订新契约',
          kind: 'overwrite-slot',
          slot,
        });
      } else {
        await startNewRun(slot);
      }
      break;
    }
    case 'slot-delete': {
      const slot = Number(el.dataset.slot);
      Modals.openConfirm(app, {
        title: `删除存档槽 ${slot}？`,
        eyebrow: 'DELETE SAVE',
        danger: true,
        body: `<div class="relic-detail-desc">这个云端存档会被删除，无法恢复。图鉴与成就是独立保存的，不会被删除。</div>`,
        confirmLabel: '删除存档',
        kind: 'delete-slot',
        slot,
      });
      break;
    }
    case 'save-exit': await leaveToMenu(); break;
    case 'return-menu': await leaveToMenu(); break;
    case 'restart-confirm':
      Modals.openConfirm(app, {
        title: '再签一份契约？',
        eyebrow: 'NEW CONTRACT',
        body: '<div class="relic-detail-desc">当前已阵亡的存档会被新的开局覆盖。图鉴与成就保留。</div>',
        confirmLabel: '开始新契约',
        kind: 'restart-run',
      });
      break;
    case 'abandon-confirm':
      Modals.openConfirm(app, {
        title: '放弃本局？',
        eyebrow: 'ABANDON RUN',
        danger: true,
        body: '<div class="relic-detail-desc">这会删除当前云端存档。本局已经获得的图鉴发现、成就和解锁仍会保留。</div>',
        confirmLabel: '放弃并删除',
        kind: 'abandon-run',
      });
      break;
    case 'logout': await logout(); break;
    case 'toggle-fullscreen':
      if (Device.isFullscreen()) await Device.exitFullscreen();
      else await Device.enterFullscreen();
      break;
    case 'heat': doHeat(); break;
    case 'hammer': doHammer(); break;
    case 'take-anvil': doTakeAnvil(); break;
    case 'rewind': doRewind(); break;
    case 'use-consumable': doUseConsumable(el.dataset.key); break;
    case 'select-sword':
      // On the fold layout a selected sword is "in hand"; tapping it again puts it down.
      app.selectedSwordId = Device.isFold() && app.selectedSwordId === id ? null : id;
      app.audio.play('click');
      UI.renderLeft(app);
      UI.renderCenter(app);
      UI.renderTribute(app);
      break;
    case 'place-anvil': doPlaceOnAnvil(id); break;
    case 'to-rack': doMove(id, 'rack'); break;
    case 'to-floor': doMove(id, 'floor'); break;
    case 'to-tribute': doMove(id, 'tribute'); break;
    case 'from-tribute': doTributeRemove(id); break;
    case 'sell-sword': sellSword(id); break;
    case 'claim-overflow': doClaimOverflow(); break;
    case 'tab-right': app.rightTab = el.dataset.tab; UI.renderRight(app); break;
    case 'mobile-tab': app.mobileTab = el.dataset.tab; UI.applyMobileTab(app); app.haptic('tap'); break;
    case 'buy-relic': doBuyRelic(Number(el.dataset.index)); break;
    case 'reroll-shop': doReroll(); break;
    case 'discard-relic-confirm':
      Modals.openConfirm(app, {
        title: '丢弃这件遗物？',
        eyebrow: 'DISCARD RELIC',
        danger: true,
        body: `<div class="relic-detail-desc">「${esc(RELIC_BY_ID[id]?.zh || '')}」会从遗物架移除。<br>没有退款。依赖它的持续效果会立刻消失。</div>`,
        confirmLabel: '丢弃',
        kind: 'discard-relic',
        id,
      });
      break;
    case 'discard-for-buy':
      doDiscardAndBuy(id, Number(el.dataset.index));
      break;
    case 'ring-bell': openRingConfirm(); break;
    case 'intro-enter':
      app.state.tutorial.introSeen = true;
      Modals.closeModal(app);
      Modals.openStartRelic(app);
      scheduleSave();
      break;
    case 'tutorial-do': {
      const objective = tutorialObjective(app.state);
      if (!objective) break;
      switch (objective.action) {
        case 'claim': doClaimOverflow(); break;
        case 'place': doPlaceOnAnvil(objective.swordId); break;
        case 'heat': doHeat(); break;
        case 'hammer': doHammer(); break;
        case 'tribute': doMove(objective.swordId, 'tribute'); break;
        case 'ring': openRingConfirm(); break;
        case 'kit': Modals.openKit(app); break;
        case 'finish': finishTutorial(); break;
      }
      break;
    }
    case 'choose-start-relic': await chooseStartRelic(id); break;
    case 'close-day-summary':
      Modals.closeModal(app);
      UI.renderAll(app);
      UI.renderTutorial(app);
      scheduleSave();
      break;
    case 'continue-endless': continueEndless(); break;
    case 'tutorial-next': {
      if (tutorialObjective(app.state)?.key === 'complete') finishTutorial();
      break;
    }
    case 'tutorial-skip': skipTutorial(); break;
    case 'toggle-setting': {
      const key = el.dataset.key;
      app.settings[key] = !app.settings[key];
      persistSettings();
      applySettings();
      if (key === 'sound' && app.settings.sound) { app.audio.ensure(); app.audio.play('click'); }
      if (key === 'haptics') app.haptic('tap');
      Modals.refreshModal(app);
      break;
    }
    case 'replay-tutorial':
      if (!app.state) { UI.toast(app, '进入契约后才能重看教程', '', 'info'); break; }
      Modals.closeModal(app);
      app.state.tutorial.active = true;
      app.state.tutorial.startDay = app.state.day;
      app.tutorialStep = 0;
      UI.renderTutorial(app);
      scheduleSave();
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------- drag & drop
function wireDragDrop() {
  const anvil = document.getElementById('anvil-stage');
  if (anvil) anvil.dataset.drop = 'anvil';
  const right = document.querySelector('.right-panel');
  if (right) right.dataset.drop = 'vending';

  document.addEventListener('dragstart', e => {
    if (e.defaultPrevented) return;
    if (app._strikeInFlight) { e.preventDefault(); return; }
    const el = e.target.closest('[data-sword-id]');
    if (!el) return;
    e.dataTransfer.setData('text/plain', el.dataset.swordId);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
    if (!app.state) { e.preventDefault(); return; }
    const img = el.querySelector('img');
    if (img) { try { e.dataTransfer.setDragImage(img, 60, 24); } catch { /* ignore */ } }
  });
  document.addEventListener('dragend', e => {
    document.querySelectorAll('.dragging').forEach(x => x.classList.remove('dragging'));
    document.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over'));
  });
  const acceptDrop = e => {
    const zone = e.target.closest('[data-drop]');
    if (!zone) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('[data-drop].drag-over').forEach(x => { if (x !== zone) x.classList.remove('drag-over'); });
    zone.classList.add('drag-over');
  };
  document.addEventListener('dragenter', acceptDrop);
  document.addEventListener('dragover', acceptDrop);
  document.addEventListener('dragleave', e => {
    const zone = e.target.closest('[data-drop]');
    if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
  });
  document.addEventListener('drop', e => {
    if (app._strikeInFlight) { e.preventDefault(); return; }
    const zone = e.target.closest('[data-drop]');
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove('drag-over');
    dropSword(e.dataTransfer.getData('text/plain'), zone.dataset.drop);
  });
}

// Fold layout: with a sword in hand, tapping the empty anvil, the tribute
// table or the rack puts it there, so the two thumbs can work together
// instead of dragging across a wide screen.
const TAP_TARGETS = ['anvil', 'tribute', 'rack'];
function tapToPlace(e) {
  if (!Device.isFold() || app.screen !== 'game' || app.modal || !app.state || app._strikeInFlight) return;
  const sw = heldSword();
  const zone = e.target.closest('[data-drop]');
  if (!sw || !zone || !TAP_TARGETS.includes(zone.dataset.drop)) return;
  if (zone.dataset.drop === 'anvil' && E.getAnvilSword(app.state)) return;
  app.haptic('drop');
  dropSword(sw.id, zone.dataset.drop);
  // A racked sword is put away, not still in hand.
  if (zone.dataset.drop === 'rack' && app.selectedSwordId === sw.id) {
    app.selectedSwordId = null;
    UI.renderAll(app);
  }
}

function heldSword() {
  const sw = app.selectedSwordId ? E.getSword(app.state, app.selectedSwordId) : null;
  return sw && (sw.location === 'floor' || sw.location === 'rack') ? sw : null;
}

function dropSword(id, target) {
  if (!app.state || app._strikeInFlight || !id || !E.getSword(app.state, id)) return;
  if (E.getSword(app.state, id).location === target) return;
  if (target === 'anvil') doPlaceOnAnvil(id);
  else if (target === 'tribute') doMove(id, 'tribute');
  else if (target === 'rack') doMove(id, 'rack');
  else if (target === 'floor') doMove(id, 'floor');
  else if (target === 'vending') sellSword(id);
}

// ---------------------------------------------------------------- tooltips
function wireTooltips() {
  const tipEl = document.getElementById('tooltip');
  let current = null;
  const position = (x, y) => {
    if (!tipEl) return;
    const pad = 14;
    const w = tipEl.offsetWidth;
    const h = tipEl.offsetHeight;
    let left = x + 18;
    let top = y + 18;
    if (left + w > window.innerWidth - 8) left = Math.max(8, x - w - 18);
    if (top + h > window.innerHeight - 8) top = Math.max(8, y - h - 18);
    tipEl.style.left = `${left}px`;
    tipEl.style.top = `${top}px`;
  };
  // Touch devices preview tooltips with a long press instead (touch.js).
  document.addEventListener('pointerover', e => {
    if (e.pointerType === 'touch') return;
    const el = e.target.closest?.('[data-tip]');
    if (!el) return;
    if (current === el) return;
    current = el;
    tipEl.innerHTML = el.getAttribute('data-tip') || '';
    tipEl.classList.remove('hidden');
    position(e.clientX, e.clientY);
  });
  document.addEventListener('pointerout', e => {
    const el = e.target.closest?.('[data-tip]');
    if (!el || el !== current) return;
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    current = null;
    tipEl.classList.add('hidden');
  });
  document.addEventListener('pointermove', e => {
    if (current) position(e.clientX, e.clientY);
  });
  document.addEventListener('contextmenu', e => {
    // Long-pressing on a phone raises contextmenu too; only a real right-click takes the sword.
    if (app._lastPointerType !== 'mouse') return;
    if (app.screen === 'game' && !app.modal && e.target.closest('#anvil-stage')) {
      e.preventDefault();
      doTakeAnvil();
    }
  });
  document.addEventListener('pointerdown', e => {
    app._lastPointerType = e.pointerType;
    current = null;
    tipEl.classList.add('hidden');
  }, true);
}

// ---------------------------------------------------------------- events
function wireEvents() {
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applySettings);
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) { tapToPlace(e); return; }
    if (el.disabled) return;
    if (e.target.closest('input, textarea, select')) return;
    const action = el.dataset.action;
    if (app._strikeInFlight) return;
    app.audio.play('click');
    handleAction(action, el).catch(err => {
      console.error(err);
      UI.toast(app, '出错了', err.message || '操作失败。', 'error');
    });
  });
  document.getElementById('auth-form')?.addEventListener('submit', handleAuthSubmit);
  document.querySelectorAll('[data-auth-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      app.audio.play('click');
      UI.setAuthMode(app, btn.dataset.authTab);
    });
  });
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea, select') || e.target.isContentEditable) return;
    if (app._strikeInFlight) {
      if (e.code === 'Space') e.preventDefault();
      return;
    }
    if (e.key === 'Escape') {
      handleBack();
      return;
    }
    if (app.screen !== 'game' || app.modal) return;
    if (e.code === 'Space') { e.preventDefault(); doHammer(); }
    else if (e.key === 'h' || e.key === 'H') doHeat();
    else if (e.key === 'e' || e.key === 'E') doTakeAnvil();
    else if (e.key === 'r' || e.key === 'R') doRewind();
    else if (e.key >= '1' && e.key <= '5') {
      const key = CONSUMABLE_ORDER[Number(e.key) - 1];
      if (key) doUseConsumable(key);
    } else if (e.key === 'p' || e.key === 'P') skipTutorial();
    else if (e.key === 'x' || e.key === 'X') Modals.openDiscardOwned(app);
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'setting-volume') {
      app.settings.volume = Number(e.target.value) / 100;
      persistSettings();
      app.audio.setVolume(app.settings.volume);
    }
  });
  document.addEventListener('pointerdown', () => {
    app.audio.init();
    app.audio.setEnabled(app.settings.sound);
    app.audio.setVolume(app.settings.volume);
    if (app.screen === 'game' && app.settings.sound) app.audio.startAmbience();
  }, { once: true });
  window.addEventListener('beforeunload', () => {
    if (app.state && app.activeSlot) {
      try { flushSave({ silent: true }); } catch { /* ignore */ }
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      finishForgeStrike(true);
      if (app.state && app.activeSlot) flushSave({ silent: true });
      app.audio.ctx?.suspend?.().catch(() => {});
    } else if (app.settings.sound) {
      app.audio.ensure();
    }
    setInterrupt('hidden', document.hidden);
  });
  // iOS keeps WebAudio locked until a touchend; resume it there as well.
  document.addEventListener('touchend', () => { if (app.settings.sound) app.audio.ensure(); }, { once: true });
  window.addEventListener('popstate', onPopState);
  app._foldLayout = Device.isFold();
  Device.onLayoutChange(onLayoutChange);
  Device.onFullscreenChange(renderFullscreenButtons);
  renderFullscreenButtons();
  // Pinch-zoom only gets in the way of a fixed game screen on iOS.
  document.addEventListener('gesturestart', e => { if (app.screen === 'game') e.preventDefault(); });
  wireDragDrop();
  wireTooltips();
  wireTouch({
    canDrag: () => Boolean(app.state) && app.screen === 'game' && !app.modal && !app._strikeInFlight,
    onDrop: dropSword,
    onSpringTab: tab => { app.mobileTab = tab; UI.applyMobileTab(app); },
    onHammer: () => { if (app.screen === 'game' && !app.modal) doHammer(); },
    canRepeatHammer: () => Boolean(app.state?.frenzy?.active) && !app.modal,
    haptic: app.haptic,
  });
}

// ---------------------------------------------------------------- ticks
let lastTick = 0;
function tickLoop() {
  const now = Date.now();
  if (now - lastTick < 120) return;
  lastTick = now;
  if (!app.state || app.screen !== 'game' || app.modal || app._strikeInFlight || app._clockPaused) return;
  const wasFrenzy = app.state.frenzy.active;
  E.tick(app.state, now);
  if (wasFrenzy && !app.state.frenzy.active) {
    app.audio.play('frenzy-end');
    syncAchievements();
    recordRunStats();
    UI.renderAll(app);
    UI.renderTutorial(app);
    scheduleSave();
    UI.toast(app, '入神结束', '安全窗口关闭，常规风险恢复。', 'info', 3000);
  } else {
    UI.updateTimers(app);
  }
}
setInterval(tickLoop, 100);

// expose a few helpers for QA / automation
window.__forgetax_api = {
  hammer: () => doHammer(),
  setState: st => { app.state = st; UI.renderAll(app); },
  app,
};

boot();
