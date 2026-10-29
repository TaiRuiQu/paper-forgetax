import * as E from '../shared/engine/engine.js';
import { RELIC_BY_ID, RELICS } from '../shared/data/relics.js';
import {
  SWORD_FAMILIES, RARITIES, ACHIEVEMENT_BY_ID, ACHIEVEMENTS, CONSUMABLES,
  SWORD_STAGE_LEVELS, FAMILY_ORDER, TUTORIAL_STEPS, RELIC_SLOTS,
} from '../shared/data/gameData.js';

export { E, RELIC_BY_ID, RELICS, SWORD_FAMILIES, RARITIES, ACHIEVEMENTS, ACHIEVEMENT_BY_ID, CONSUMABLES, SWORD_STAGE_LEVELS, FAMILY_ORDER, TUTORIAL_STEPS, RELIC_SLOTS };

export const fmt = n => Math.round(Number(n) || 0).toLocaleString('en-US');

export function compact(n) {
  const v = Math.round(Number(n) || 0);
  if (Math.abs(v) >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e7) return `${(v / 1e6).toFixed(1)}M`;
  return fmt(v);
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function tip(html) {
  return `data-tip="${esc(html)}"`;
}

export function relicTip(id) {
  const r = RELIC_BY_ID[id];
  if (!r) return '';
  return `<div class="tt-title">${esc(r.zh)} <span>${esc(r.en)}</span></div><div class="tt-desc">${esc(r.desc)}</div><div class="tt-meta">${RARITIES[r.rarity].zh} · 费用 ${r.cost} 剑币 · 最早第 ${r.minDay} 天</div>`;
}

export function consumableTip(key) {
  const c = CONSUMABLES[key];
  return `<div class="tt-title">${esc(c.zh)} <span>${esc(c.en)}</span></div><div class="tt-desc">${esc(c.desc)}</div>`;
}

export function swordTip(app, s) {
  const state = app.state;
  return `<div class="tt-title">${esc(E.swordDisplayName(s))} <span>+${s.level}</span></div>
    <div class="tt-desc">${esc(s.remnant ? '圣杯从碎剑中留下的残骸，可以放上贡台。' : swordFamilyLabel(s))}</div>
    <div class="tt-meta">价值 <b>${fmt(E.swordValue(state, s))} G</b> · 充能 ${s.charge}/10 · ${s.heat ? '已加热' : '未加热'}</div>`;
}

export function relicIcon(id) { return `./assets/relics/${id}.svg`; }
export function consumableIcon(key) { return `./assets/consumables/${key}.svg`; }
export function achievementIcon(id) { return `./assets/achievements/${id}.svg`; }
export function swordArtPath(s) { return `./assets/swords/${E.swordArtKey(s)}.svg`; }

export function rarityOf(id) { return RELIC_BY_ID[id]?.rarity || 'common'; }
export function rarityZh(id) { return RARITIES[rarityOf(id)].zh; }

export function swordFamilyLabel(s) {
  if (s.remnant) return '残骸';
  if (s.merchant || s.historyMaxLevel >= 10) {
    const f = SWORD_FAMILIES[s.family];
    return `${f.zh} · ${f.en}`;
  }
  return `未揭示剑系 · ${['壁垒路线', '狂暴路线', '奥术路线'][s.route]}`;
}

export function phaseLabel(phase) {
  return { select: '选择初始遗物', playing: '契约进行中', victory: '契约完成', dead: '铁匠已阵亡' }[phase] || phase;
}

export function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(then).toLocaleDateString('zh-CN');
}

export function mergedCodex(app) {
  const base = JSON.parse(JSON.stringify(app.profile?.codex || {}));
  return E.mergeCodex(base, app.state?.codex);
}

export function achievementMap(app) {
  const map = {};
  for (const [id, at] of Object.entries(app.profile?.achievements || {})) map[id] = at || true;
  for (const id of app.state?.unlockedAchievements || []) if (!map[id]) map[id] = true;
  return map;
}

export function bestSword(state) {
  if (!state?.swords?.length) return null;
  return state.swords.slice().sort((a, b) => (b.historyMaxLevel || 0) - (a.historyMaxLevel || 0))[0];
}

export function hateReasonForHammer(app) {
  const state = app.state;
  if (!state || state.phase !== 'playing') return '现在无法挥锤';
  const s = E.getAnvilSword(state);
  if (!s) return '先把一把剑放上铁砧';
  if (s.remnant) return '残骸不能锻造';
  if (!s.heat && !E.hasRelic(state, 'lifetime-contract')) return '先加热这把剑';
  if (state.cooldownUntil > Date.now()) return '锤子回气中';
  return '';
}

export function hammerDisabledReason(app) { return hateReasonForHammer(app); }

export function consumeDisabledReason(app, key) {
  const state = app.state;
  const s = E.getAnvilSword(state);
  if (!state || state.phase !== 'playing') return '现在无法使用';
  if ((state.consumables[key] || 0) <= 0) return '没有这件物品';
  if (key === 'regret_clockwork') {
    if (!state.hammerSnapshot) return '还没有可撤回的一锤';
    return '';
  }
  if (!s) return '先去铁砧';
  if (s.remnant) return '残骸用不上';
  if (key === 'cracked_dragon_scale') {
    if (state.frenzy.active) return '入神中不能预置';
    if (s.charge >= 10) return '满充能即将入神';
    if (state.anvilBuffs.protectBreak) return '已预置';
    return '';
  }
  if (key === 'red_chalk') return state.anvilBuffs.redChalk ? '已预置' : '';
  if (key === 'powder_pouch') {
    if (state.frenzy.active) return '入神中不能使用';
    if (state.anvilBuffs.powder) return '已预置';
    return '';
  }
  if (key === 'cold_star_shard') {
    if (state.frenzy.active) return '入神中不能使用';
    if (s.charge >= 10) return '充能已满';
    return '';
  }
  return '';
}

export function tutorialTarget(step) {
  return [null, '#forge-card', '#btn-hammer', '#charge-block', '#tribute-bar', '#right-panel', null][step] || null;
}

export function allRelicIds() { return RELICS.map(r => r.id); }
