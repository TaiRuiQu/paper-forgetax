import {
  CONTRACT_DAYS, RELIC_SLOTS, MAX_LEVEL, STARTING_RELIC_POOL, TRIBUTE_DAYS,
  SWORD_FAMILIES, SWORD_ROUTES, ALL_FAMILIES, FAMILY_ORDER, CONSUMABLES,
  ACHIEVEMENTS, ACHIEVEMENT_BY_ID, ACHIEVEMENT_BY_UNLOCK_RELIC, MERCHANT_PRICE,
  baseQuotaForDay, dayInfo, familyStage, familyForSword,
} from '../data/gameData.js';
import { RELICS, RELIC_BY_ID, RECOVERY_RELICS } from '../data/relics.js';
import { random, randomInt, pick, shuffle, chance, makeSeed } from './rng.js';

export { random, randomInt, pick, shuffle, chance, makeSeed };

export const FLOOR_CAP = 24;
export const TRIBUTE_CAP = 8;
export const RACK_CAP = 3;
export const CHARGE_MAX = 10;
export const BASE_SIGNS = { break: 9, damage: 2, hold: 5, success: 12, great: 2 };
export const SIGN_ORDER = ['break', 'damage', 'hold', 'success', 'great'];
export const RESULT_LABEL = { break: '破碎', damage: '损伤', hold: '不变', success: '成功', great: '大成功' };
export const RESULT_COLOR = { break: '#e5544b', damage: '#e08a4a', hold: '#a8a394', success: '#6fbf8a', great: '#f0c250' };

export const ROUTE_EARLY_NAMES = [
  ['厚铁剑', '铁门雏形', '铁壁重刃', '铁门重刃'],
  ['狂暴铁块', '锯齿铁片', '咬刃铁块', '机械锯剑'],
  ['魔力碎片', '铭文铁剑', '觉醒刃', '符文剑'],
];

const P0_TABLE = [
  [0, 0], [1, 1.8], [2, 5.9], [3, 12.9], [4, 24.8], [5, 29.7], [6, 34.7],
  [7, 38.3], [8, 41.8], [9, 44.3], [10, 46.7], [12, 50.5], [15, 54.5],
  [20, 63.0], [25, 67.5], [30, 72.0],
];

export function breakChanceBase(level) {
  if (level <= 0) return 0;
  if (level >= 30) return 72;
  for (let i = 0; i < P0_TABLE.length - 1; i++) {
    const [l0, p0] = P0_TABLE[i];
    const [l1, p1] = P0_TABLE[i + 1];
    if (level >= l0 && level <= l1) {
      return p0 + (p1 - p0) * (level - l0) / (l1 - l0);
    }
  }
  return 72;
}

export function difficultyLevelWeight(level) {
  const p = breakChanceBase(level) / 100;
  if (p <= 0) return 0;
  if (p >= 1) return Infinity;
  return (p * 21) / (9 * (1 - p));
}

export function emptyProfile() {
  return {
    version: 2,
    codex: { relics: {}, consumables: {}, merchant: {}, swords: {}, routes: {} },
    achievements: {},
    tutorialDone: false,
    stats: { runs: 0, bestDay: 0, bestGold: 0, contracts: 0, deaths: 0, plays: 0 },
  };
}

export function mergeCodex(target, source) {
  const t = target || { relics: {}, consumables: {}, merchant: {}, swords: {}, routes: {} };
  const unsafe = new Set(['__proto__', 'constructor', 'prototype']);
  for (const bucket of ['relics', 'consumables', 'merchant', 'swords']) {
    t[bucket] = t[bucket] || {};
    // Older merchant purchases recorded swords under a missing consumable key.
    const itemBucket = bucket === 'consumables' || bucket === 'merchant';
    if (itemBucket) delete t[bucket].undefined;
    for (const [k, v] of Object.entries(source?.[bucket] || {})) {
      if (unsafe.has(k) || k.length > 80) continue;
      if (itemBucket && k === 'undefined') continue;
      if (typeof v === 'number') t[bucket][k] = Math.max(t[bucket][k] || 0, v);
      else if (v) t[bucket][k] = true;
    }
  }
  t.routes = t.routes || {};
  for (const [k, v] of Object.entries(source?.routes || {})) {
    if (unsafe.has(k) || k.length > 40) continue;
    t.routes[k] = Math.max(t.routes[k] || 0, Number(v) || 0);
  }
  return t;
}

export function mergeProfile(profile, patch) {
  const p = profile || emptyProfile();
  p.codex = mergeCodex(p.codex, patch?.codex);
  for (const [id, at] of Object.entries(patch?.achievements || {})) {
    if (!ACHIEVEMENT_BY_ID[id]) continue;
    if (!p.achievements[id]) p.achievements[id] = typeof at === 'string' ? at : new Date().toISOString();
  }
  if (patch?.tutorialDone) p.tutorialDone = true;
  if (patch?.stats) {
    p.stats = p.stats || {};
    for (const [k, v] of Object.entries(patch.stats)) {
      if (['__proto__', 'constructor', 'prototype'].includes(k)) continue;
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      p.stats[k] = Math.max(p.stats[k] || 0, v);
    }
  }
  p.version = 2;
  return p;
}

// ---------------------------------------------------------------- state / run

export function createRun(options = {}) {
  const seed = options.seed ?? makeSeed();
  const profile = options.profile || emptyProfile();
  const achievements = Object.keys(profile.achievements || {});
  const state = {
    version: 2,
    phase: 'select', // select | playing | victory | dead
    seed,
    rng: seed >>> 0,
    nextSwordId: 1,
    day: 1,
    quotaBase: 1800,
    royalChangeCarry: 0,
    gold: 0,
    coins: 0,
    anger: 0,
    swords: [],
    anvilSwordId: null,
    relics: [],
    startingChoices: [],
    runSigns: { break: 0, damage: 0, hold: 0, success: 0, great: 0 },
    pendingGreatSigns: 0,
    consumables: { cracked_dragon_scale: 0, regret_clockwork: 0, red_chalk: 0, powder_pouch: 0, cold_star_shard: 0 },
    anvilBuffs: { protectBreak: false, redChalk: false, powder: false },
    hammerSnapshot: null,
    lastHammer: null,
    shop: { day: 0, items: [], freeRerollUsed: false, paidRerolls: 0, firstRerollDone: false },
    merchant: null,
    daily: { wireboundUsed: false, collectorHookUsed: false, ledgerExtra: 0 },
    run: {
      breaks: 0, frenzies: 0, fullTributes: 0, extraFullTributes: 0,
      goldEarned: 0, maxLevel: 0, pocketHearthBonus: 0, bestSwordValue: 0,
    },
    pending: { supplyExtra: 0, supplyMinLevel: 0, inheritLevels: 0, inheritCharge: 0, hungrySigns: 0, smithLevels: 0 },
    frenzy: { active: false, endsAt: 0, remainingMs: 0, swordId: null },
    cooldownUntil: 0,
    codex: { relics: {}, consumables: {}, merchant: {}, swords: {}, routes: {} },
    unlockedAchievements: achievements,
    contractCompleted: false,
    lastDaySummary: null,
    brokenSwords: [],
    log: [],
    flags: { incenseUsed: false, pardonUsed: false },
    tutorial: { active: !profile.tutorialDone, startDay: 1, introSeen: false },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.startingChoices = shuffle(state, STARTING_RELIC_POOL).slice(0, 3);
  for (const id of state.startingChoices) markSeenRelic(state, id);
  addLog(state, '工坊的大门在身后合拢。三个遗物在灰尘中发亮。', 'lore');
  return state;
}

export function chooseStartingRelic(state, relicId) {
  if (state.phase !== 'select') return fail('bad-phase', '本局已经开始。');
  if (!state.startingChoices.includes(relicId)) return fail('bad-choice', '这件遗物不在初始候选里。');
  state.relics.push(relicId);
  markSeenRelic(state, relicId);
  state.phase = 'playing';
  addLog(state, `获得初始遗物：${RELIC_BY_ID[relicId].zh}。`, 'relic');
  setupDay(state, 1, { first: true });
  return { ok: true };
}

export function setupDay(state, number, options = {}) {
  state.day = number;
  state.phase = 'playing';
  state.quotaBase = baseQuotaForDay(number);
  state.cooldownUntil = 0;
  state.frenzy = { active: false, endsAt: 0, remainingMs: 0, swordId: null };
  state.anvilBuffs = { protectBreak: false, redChalk: false, powder: false };
  state.hammerSnapshot = null;
  state.lastHammer = null;
  state.daily = { wireboundUsed: false, collectorHookUsed: false, ledgerExtra: 0 };
  state.shop = { day: number, items: [], freeRerollUsed: false, paidRerolls: 0, firstRerollDone: false };
  state.merchant = null;

  if (number >= 2) generateShop(state);
  if (dayInfo(number).merchant) generateMerchant(state);

  const permit = hasRelic(state, 'supply-permit') ? 1 : 0;
  const extra = state.pending.supplyExtra || 0;
  const count = 3 + permit + extra;
  const supplyMinLevel = Math.max(state.pending.supplyMinLevel || 0, hasRelic(state, 'lifetime-contract') ? 7 : 0);
  state.pending.supplyExtra = 0;
  state.pending.supplyMinLevel = 0;

  const routes = shuffle(state, [0, 1, 2]);
  const fresh = [];
  for (let i = 0; i < count; i++) {
    const route = i < routes.length ? routes[i] : randomInt(state, 3);
    const s = makeSword(state, { route, level: supplyMinLevel });
    fresh.push(s);
  }
  if (state.pending.smithLevels > 0 && fresh.length) {
    const s = fresh[0];
    addLevelsDirect(state, s, state.pending.smithLevels);
    addLog(state, `铁匠遗言：一把新剑继承了 ${state.pending.smithLevels} 级。`, 'relic');
    state.pending.smithLevels = 0;
    refreshSwordMeta(state, s);
  }
  if (number === 1) addLog(state, '第 1 天。巨龙索要 1,800 G 的贡品。先加热，再挥锤。', 'day');
  else addLog(state, `第 ${number} 天（${dayInfo(number).date}）。今日贡额 ${currentQuota(state).toLocaleString()} G。`, 'day');
  if (dayInfo(number).merchant) addLog(state, '幽灵商人来访了。', 'merchant');
  state.run.bestSwordValue = bestInventoryValue(state);
  return { ok: true };
}

export function currentQuota(state) {
  const base = state.quotaBase;
  let q = hasRelic(state, 'sealed-rebate') ? Math.round(base * 0.9) : base;
  if (state.royalChangeCarry > 0) {
    q = Math.max(0, q - Math.min(state.royalChangeCarry, Math.round(base * 0.3)));
  }
  return q;
}

export function nextQuotaPreview(state) {
  const nextDay = state.day + 1;
  const info = dayInfo(nextDay);
  let base = info.quota;
  let q = hasRelic(state, 'sealed-rebate') ? Math.round(base * 0.9) : base;
  let carry = 0;
  const total = tributeTotal(state);
  const quota = currentQuota(state);
  if (hasRelic(state, 'royal-change') && total > quota) {
    carry = Math.min(Math.floor((total - quota) * 0.3), Math.round(q * 0.3));
    q -= carry;
  }
  return { day: nextDay, date: info.date, quota: q, base, carry, merchant: info.merchant };
}

// ---------------------------------------------------------------- swords

let idCounter = 1;
function uid(state, prefix) {
  return `${prefix}${state.nextSwordId++}_${(idCounter++).toString(36)}`;
}

export function makeSword(state, opts = {}) {
  const family = opts.family || null;
  let route = opts.route;
  let branch = opts.branch;
  if (family) {
    route = SWORD_FAMILIES[family].route;
    branch = SWORD_FAMILIES[family].branch;
  } else if (route == null) {
    route = randomInt(state, 3);
  }
  if (branch == null) branch = randomInt(state, 2);
  const resolvedFamily = family || familyForSword(route, branch);
  const level = Math.min(MAX_LEVEL, Math.max(0, opts.level || 0));
  const s = {
    id: uid(state, 'sw'),
    route,
    branch,
    family: resolvedFamily,
    merchant: Boolean(family),
    remnant: false,
    level,
    historyMaxLevel: level,
    baseValue: SWORD_FAMILIES[resolvedFamily].baseValue,
    flat: 0,
    mult: 1,
    greatMult: 1,
    valueHistoryMax: 0,
    location: 'floor',
    heat: false,
    forgedOnce: false,
    forgeCount: 0,
    charge: Math.min(CHARGE_MAX, opts.charge || 0),
    createdDay: state.day,
    createdByCopy: Boolean(opts.createdByCopy),
    lastResult: null,
    sameStreak: 0,
    lastValueBonus: 0,
    layers: { successSigns: 0, greatSigns: 0, splice: 0, scorched: 0 },
    store: { successLevels: 0, sealedGreatLevels: 0, defeatedGreatLevels: 0 },
    counters: {
      successChain: 0, holdChain: 0, normalSuccesses: 0, damages: 0,
      idolMilestones: [], spineCounter: 0,
    },
    protections: { phoenixUsed: false, cornerstoneUsed: false, pearlBlocks: 0, spineCharges: 0 },
  };
  if (s.level === 0 && state.pending.inheritLevels > 0) {
    s.level = Math.min(MAX_LEVEL, state.pending.inheritLevels);
    s.historyMaxLevel = s.level;
    s.charge = Math.min(CHARGE_MAX, s.charge + (state.pending.inheritCharge || 0));
    addLog(state, `继承：新剑带着 +${s.level} 与 ${state.pending.inheritCharge} 点充能出现。`, 'relic');
    state.pending.inheritLevels = 0;
    state.pending.inheritCharge = 0;
  }
  if (s.level === 0 && state.pending.hungrySigns > 0) {
    s.layers.successSigns += state.pending.hungrySigns;
    addLog(state, `饥饿臼齿：新剑获得 ${state.pending.hungrySigns} 张持续成功签。`, 'relic');
    state.pending.hungrySigns = 0;
  }
  addSwordToInventory(state, s);
  markSwordCodex(state, s);
  refreshSwordMeta(state, s);
  return s;
}

function makeRemnant(state, value) {
  const s = {
    id: uid(state, 'rm'),
    route: null, branch: null, family: 'funerary', merchant: true, remnant: true,
    level: 0, historyMaxLevel: 0, baseValue: 0, flat: 0, mult: 1, greatMult: 1,
    valueHistoryMax: value, remnantValue: value,
    location: 'floor', heat: false, forgedOnce: true, forgeCount: 0, charge: 0,
    createdDay: state.day, lastResult: null, sameStreak: 0, lastValueBonus: 0,
    layers: { successSigns: 0, greatSigns: 0, splice: 0, scorched: 0 },
    store: { successLevels: 0, sealedGreatLevels: 0, defeatedGreatLevels: 0 },
    counters: { successChain: 0, holdChain: 0, normalSuccesses: 0, damages: 0, idolMilestones: [], spineCounter: 0 },
    protections: { phoenixUsed: true, cornerstoneUsed: true, pearlBlocks: 0, spineCharges: 0 },
  };
  addSwordToInventory(state, s);
  return s;
}

export function addSwordToInventory(state, s) {
  const floorCount = state.swords.filter(x => x.location === 'floor').length;
  if (floorCount >= FLOOR_CAP) s.location = 'overflow';
  state.swords.push(s);
  return s;
}

export function swordValue(state, s) {
  if (!s) return 0;
  if (s.remnant) return s.remnantValue || 0;
  let baseBonus = 0;
  if (hasRelic(state, 'charcoal-pouch')) baseBonus += 80;
  baseBonus += state.run.pocketHearthBonus || 0;
  let v = ((s.baseValue + baseBonus) * Math.pow(1.5, s.level) + s.flat) * s.mult * s.greatMult;
  if (hasRelic(state, 'iron-signet')) v *= 1.15;
  if (hasRelic(state, 'thorn-weight')) v *= 1.10;
  if (hasRelic(state, 'black-iron-stone') && s.level >= 8) v *= 1.30;
  if (hasRelic(state, 'dragon-signet') && s.level >= 12) v *= 1.50;
  return Math.max(1, Math.round(v));
}

export function swordRevealed(s) {
  return s.merchant || s.historyMaxLevel >= 10;
}

export function swordStage(s) {
  return familyStage(s.historyMaxLevel);
}

export function swordDisplayName(s) {
  if (!s) return '空';
  if (s.remnant) return '圣杯残骸';
  const stage = familyStage(s.historyMaxLevel);
  if (s.merchant || s.historyMaxLevel >= 10) {
    return SWORD_FAMILIES[s.family].stages[stage];
  }
  const routeNameIndex = s.historyMaxLevel >= 6 ? 3 : s.historyMaxLevel >= 4 ? 2 : s.historyMaxLevel >= 2 ? 1 : 0;
  return ROUTE_EARLY_NAMES[s.route][routeNameIndex];
}

export function swordArtKey(s) {
  if (s.remnant) return 'remnant';
  const stage = familyStage(s.historyMaxLevel);
  if (s.merchant || s.historyMaxLevel >= 10) {
    return `${s.family}_s${stage}`;
  }
  if (s.historyMaxLevel >= 6) return `route${s.route}_s3`;
  const baseFamily = ['citadel', 'sawblade', 'runeblade'][s.route];
  return `${baseFamily}_s${stage}`;
}

export function getAnvilSword(state) {
  return state.swords.find(s => s.id === state.anvilSwordId) || null;
}

export function getSword(state, id) {
  return state.swords.find(s => s.id === id) || null;
}

export function inventorySwords(state) {
  return state.swords.filter(s => s.location === 'floor');
}

export function rackSwords(state) {
  return state.swords.filter(s => s.location === 'rack');
}

export function tributeSwords(state) {
  return state.swords.filter(s => s.location === 'tribute');
}

export function overflowSwords(state) {
  return state.swords.filter(s => s.location === 'overflow');
}

export function tributeTotal(state) {
  return tributeSwords(state).reduce((sum, s) => sum + swordValue(state, s), 0);
}

export function bestInventoryValue(state) {
  return state.swords.reduce((m, s) => Math.max(m, swordValue(state, s)), 0);
}

function refreshSwordMeta(state, s) {
  s.valueHistoryMax = Math.max(s.valueHistoryMax || 0, swordValue(state, s));
  state.run.maxLevel = Math.max(state.run.maxLevel || 0, s.level);
  state.run.bestSwordValue = Math.max(state.run.bestSwordValue || 0, s.valueHistoryMax);
  if (s.historyMaxLevel >= 20) grantAchievement(state, `mastery_${s.family}`);
  markSwordCodex(state, s);
}

export function refreshAllValues(state) {
  for (const s of state.swords) refreshSwordMeta(state, s);
}

function addLevelsDirect(state, s, delta) {
  const old = s.level;
  s.level = Math.min(MAX_LEVEL, s.level + delta);
  if (s.level > s.historyMaxLevel) s.historyMaxLevel = s.level;
  if (hasRelic(state, 'bound-idol')) {
    for (let lv = old + 1; lv <= s.level; lv++) {
      if (lv % 4 === 0 && !s.counters.idolMilestones.includes(lv)) {
        s.counters.idolMilestones.push(lv);
        s.mult *= 1.15;
      }
    }
  }
  markSwordCodex(state, s);
  return s.level - old;
}

function markSwordCodex(state, s) {
  if (!s || s.remnant) return;
  if (s.merchant || s.historyMaxLevel >= 10) {
    const stage = familyStage(s.historyMaxLevel);
    state.codex.swords[s.family] = Math.max(state.codex.swords[s.family] || 0, stage);
  } else {
    const rs = s.historyMaxLevel >= 6 ? 3 : s.historyMaxLevel >= 4 ? 2 : s.historyMaxLevel >= 2 ? 1 : 0;
    state.codex.routes[s.route] = Math.max(state.codex.routes[s.route] || 0, rs);
  }
}

export function markSeenRelic(state, id) {
  state.codex.relics[id] = true;
}
export function markSeenConsumable(state, id) {
  if (!Object.hasOwn(CONSUMABLES, id)) return;
  state.codex.consumables[id] = true;
}
export function markSeenMerchantItem(state, id) {
  if (id !== 'base-sword' && id !== 'special-sword' && !Object.hasOwn(CONSUMABLES, id)) return;
  state.codex.merchant[id] = true;
}

// ---------------------------------------------------------------- probability

export function hasRelic(state, id) {
  return state.relics.includes(id);
}

function relicSignAdds(state, s, inFrenzy) {
  const counts = { break: 0, damage: 0, hold: 0, success: 0, great: 0 };
  const add = (k, n) => { if (n) counts[k] += n; };
  if (hasRelic(state, 'bent-nail')) add('success', 4);
  if (hasRelic(state, 'lucky-coal')) add('great', 1);
  if (hasRelic(state, 'patient-weight')) add('hold', 3);
  if (hasRelic(state, 'sealing-stone')) add('hold', 2);
  if (hasRelic(state, 'golden-nail')) add('great', 2);
  if (hasRelic(state, 'royal-spike')) add('success', 6);
  if (hasRelic(state, 'oracle-die')) add('great', 4);
  if (hasRelic(state, 'butterfingers')) { add('break', 3); add('great', 5); }
  if (hasRelic(state, 'abyssal-pearl')) add('damage', 3);
  if (hasRelic(state, 'eternal-seed')) add('hold', 6);
  if (hasRelic(state, 'perfect-mana-core') && inFrenzy) add('great', 6);
  if (hasRelic(state, 'blind-die') && (s.lastResult === 'damage' || s.lastResult === 'hold')) add('great', 3);
  if (hasRelic(state, 'closed-third-eye') && s.lastResult === 'hold') add('success', 4);
  return counts;
}

export function computeDistribution(state, s, opts = {}) {
  const inFrenzy = opts.inFrenzy ?? state.frenzy.active;
  const counts = { ...BASE_SIGNS };
  if (hasRelic(state, 'sickle-and-hammer')) {
    for (const k of SIGN_ORDER) counts[k] = 5;
  }
  for (const k of SIGN_ORDER) {
    counts[k] += state.runSigns[k] || 0;
    counts[k] += s.layers[k === 'success' ? 'successSigns' : k === 'great' ? 'greatSigns' : k] || 0;
  }
  const relicAdds = relicSignAdds(state, s, inFrenzy);
  for (const k of SIGN_ORDER) counts[k] += relicAdds[k];
  counts.great += state.pendingGreatSigns || 0;
  if (hasRelic(state, 'worn-whetstone')) {
    const n = Math.min(2, counts.hold);
    counts.hold -= n;
    counts.success += n;
  }
  if (hasRelic(state, 'blunt-mallet') && counts.damage > 0) {
    counts.damage -= 1;
    counts.success += 1;
  }
  if (hasRelic(state, 'thorn-weight')) {
    const n = Math.min(2, counts.hold);
    counts.hold -= n;
    counts.damage += n;
  }
  if (hasRelic(state, 'obsidian-eye') && s.level >= 8) {
    const n = Math.min(2, counts.success);
    counts.success -= n;
    counts.great += n;
  }
  if (hasRelic(state, 'iron-hoop')) counts.break = Math.max(1, counts.break - 2);
  if (counts.break < 0) counts.break = 0;
  if (opts.redChalk) counts.great *= 2;

  const k = difficultyLevelWeight(s.level);
  const rawBreakWeight = counts.break * k;
  let breakRel = 1;
  if (hasRelic(state, 'black-knot')) breakRel *= 0.9;
  if (hasRelic(state, 'dragonscale-tongs') && s.level >= 6) breakRel *= 0.75;
  breakRel *= Math.max(0.4, 1 - Math.min(0.6, (s.layers.splice || 0) * 0.15));
  breakRel *= Math.max(0.82, 1 - Math.min(0.18, (s.layers.scorched || 0) * 0.03));
  if (hasRelic(state, 'red-thread') && s.lastResult === 'hold') breakRel *= 0.8;
  if (hasRelic(state, 'lightning-mark') && s.lastResult === 'great' && !inFrenzy) breakRel *= 0.6;
  // Relative reduction is applied to the break probability itself (40% * 0.85 = 34%),
  // then converted back into a weight beside the other outcomes.
  const otherWeight = counts.damage + counts.hold + counts.success + counts.great;
  const baseBreakProbability = rawBreakWeight + otherWeight > 0 ? rawBreakWeight / (rawBreakWeight + otherWeight) : 0;
  let finalBreakProbability = inFrenzy ? 0 : baseBreakProbability * breakRel;
  finalBreakProbability = Math.max(0, Math.min(0.9999, finalBreakProbability));
  const breakWeight = finalBreakProbability <= 0 ? 0 : (finalBreakProbability * otherWeight) / (1 - finalBreakProbability);

  const weights = {
    break: breakWeight,
    damage: counts.damage,
    hold: counts.hold,
    success: counts.success,
    great: counts.great,
  };
  const total = SIGN_ORDER.reduce((a, k2) => a + Math.max(0, weights[k2]), 0) || 1;
  let acc = 0;
  let prev = 0;
  const slots = {};
  const boundaries = [];
  for (const key of SIGN_ORDER) {
    acc += (Math.max(0, weights[key]) / total) * 1000;
    const edge = Math.round(acc);
    slots[key] = edge - prev;
    boundaries.push(edge);
    prev = edge;
  }
  const fix = 1000 - prev;
  slots.great += fix;
  boundaries[boundaries.length - 1] = 1000;
  const percents = {};
  for (const key of SIGN_ORDER) percents[key] = slots[key] / 10;
  return { counts, weights, slots, boundaries, percents, breakRel, baseChance: breakChanceBase(s.level), inFrenzy };
}

function rollResult(state, dist) {
  const r = randomInt(state, 1000);
  let idx = 0;
  while (idx < dist.boundaries.length - 1 && r >= dist.boundaries[idx]) idx++;
  return { result: SIGN_ORDER[idx], roll: r };
}

export function previewDistribution(state) {
  const s = getAnvilSword(state);
  if (!s || s.remnant) return null;
  return computeDistribution(state, s, {
    inFrenzy: state.frenzy.active,
    redChalk: state.anvilBuffs.redChalk,
  });
}

// ---------------------------------------------------------------- result helpers

function addLog(state, text, type = 'info') {
  state.log.unshift({ day: state.day, text, type, at: Date.now() });
  if (state.log.length > 80) state.log.length = 80;
}

export function grantAchievement(state, id) {
  if (!ACHIEVEMENT_BY_ID[id]) return false;
  if (state.unlockedAchievements.includes(id)) return false;
  state.unlockedAchievements.push(id);
  addLog(state, `成就解锁：${ACHIEVEMENT_BY_ID[id].zh}（${ACHIEVEMENT_BY_ID[id].en}）`, 'achievement');
  return true;
}

function gainLevels(state, s, delta, triggers, fromHammer = true) {
  if (delta <= 0) return 0;
  const before = s.level;
  addLevelsDirect(state, s, delta);
  const gained = s.level - before;
  if (gained > 0) triggers.push({ text: `等级 +${gained}`, type: 'level' });
  if (hasRelic(state, 'bound-idol')) {
    for (const lv of s.counters.idolMilestones) {
      if (lv > before && lv <= s.level) triggers.push({ text: `缚神像：达到 +${lv}，剑值 ×1.15`, type: 'relic' });
    }
  }
  if (fromHammer && s.level >= 10) grantAchievement(state, 'one_more_hit');
  if (s.level >= 20) {
    grantAchievement(state, `mastery_${s.family}`);
    triggers.push({ text: `剑系掌握 +${s.level}`, type: 'achievement' });
  }
  markSwordCodex(state, s);
  return gained;
}

function triggerName(id) {
  return RELIC_BY_ID[id]?.zh || id;
}

function hasAny(state, ids) {
  return ids.some(id => hasRelic(state, id));
}

// ---------------------------------------------------------------- hammer

function fail(code, message) {
  return { ok: false, error: code, message };
}

function snapshotOf(state) {
  const copy = JSON.parse(JSON.stringify({ ...state, hammerSnapshot: null }));
  return copy;
}

function startAnvilSession(state) {
  state.hammerSnapshot = null;
  state.lastHammer = null;
}

function leaveAnvilSession(state, now = Date.now()) {
  if (state.frenzy.active) endFrenzy(state, now, { applyHeadless: true });
  state.hammerSnapshot = null;
  state.anvilBuffs = { protectBreak: false, redChalk: false, powder: false };
  state.cooldownUntil = 0;
}

export function placeOnAnvil(state, swordId) {
  const s = getSword(state, swordId);
  if (!s) return fail('no-sword', '找不到这把剑。');
  if (s.remnant) return fail('remnant', '残骸不能放到铁砧上锻造。');
  if (!['floor', 'rack'].includes(s.location)) return fail('bad-location', '只能把库存中的剑放上铁砧。');
  if (state.anvilSwordId && state.anvilSwordId !== s.id) {
    const cur = getAnvilSword(state);
    if (cur) cur.location = 'floor';
    leaveAnvilSession(state);
  }
  s.location = 'anvil';
  state.anvilSwordId = s.id;
  startAnvilSession(state);
  addLog(state, `${swordDisplayName(s)} 被放上铁砧。`, 'anvil');
  return { ok: true };
}

export function takeAnvilSword(state, now = Date.now()) {
  const s = getAnvilSword(state);
  if (!s) return fail('no-sword', '铁砧上什么都没有。');
  leaveAnvilSession(state, now);
  s.location = 'floor';
  state.anvilSwordId = null;
  addLog(state, `取下 ${swordDisplayName(s)}。`, 'anvil');
  return { ok: true };
}

export function heatAnvilSword(state) {
  const s = getAnvilSword(state);
  if (!s) return fail('no-sword', '先把剑放上铁砧。');
  if (s.remnant) return fail('remnant', '残骸无法加热。');
  if (s.heat) return fail('already-hot', '这把剑已经加热过了。');
  if (hasRelic(state, 'lifetime-contract')) {
    s.heat = true;
    addLog(state, '终身契约让火焰自行依附，无需加热。', 'relic');
    return { ok: true, waived: true };
  }
  s.heat = true;
  addLog(state, `${swordDisplayName(s)} 被烧得通红。`, 'heat');
  return { ok: true };
}

function endFrenzy(state, now, opts = {}) {
  if (!state.frenzy.active) return;
  const s = getAnvilSword(state);
  state.frenzy = { active: false, endsAt: 0, remainingMs: 0, swordId: null };
  if (s) s.charge = 0;
  if (opts.applyHeadless && s && hasRelic(state, 'headless-bell')) {
    const triggers = [];
    gainLevels(state, s, 1, triggers, false);
    addLog(state, '无首之钟在入神结束时敲响：等级 +1。', 'relic');
    refreshSwordMeta(state, s);
  }
  addLog(state, '入神结束，常规风险回来了。', 'frenzy');
}

export function tick(state, now = Date.now()) {
  if (state.frenzy.active && now >= state.frenzy.endsAt) {
    endFrenzy(state, now, { applyHeadless: true });
    refreshAllValues(state);
  }
  return { ok: true };
}

export function frenzyDuration(state) {
  let ms = 4000;
  if (hasRelic(state, 'red-hourglass')) ms += 1000;
  if (hasRelic(state, 'undying-wick')) ms += 2000;
  return ms;
}

export function hammerInterval(state, inFrenzy) {
  let speed = 1;
  if (hasRelic(state, 'worn-grip')) speed += 0.15;
  if (!inFrenzy && hasRelic(state, 'leather-loop')) speed += 0.20;
  if (inFrenzy && hasRelic(state, 'possessed-bellows')) speed += 0.30;
  return Math.round(640 / speed);
}

export function hammer(state, opts = {}) {
  if (state.phase !== 'playing') return fail('bad-phase', '现在无法挥锤。');
  const s = getAnvilSword(state);
  if (!s) return fail('no-sword', '先把一把剑放上铁砧。');
  if (s.remnant) return fail('remnant', '残骸不能锻造。');
  if (!s.heat && !hasRelic(state, 'lifetime-contract')) return fail('not-heated', '这把剑还没有加热。');
  const now = opts.now ?? Date.now();
  tick(state, now);
  if (state.phase !== 'playing') return fail('bad-phase', '现在无法挥锤。');
  if (!opts.ignoreCooldown && state.cooldownUntil > now) {
    return fail('cooldown', '锤子还在回气。');
  }

  // full transaction snapshot for rewind (costs a Regret Clockwork to use)
  state.hammerSnapshot = snapshotOf(state);

  const triggers = [];
  const prevResult = s.lastResult;
  const preLevel = s.level;
  const preValue = swordValue(state, s);
  let inFrenzy = state.frenzy.active;
  let frenzyStarted = false;
  if (!inFrenzy && s.charge >= CHARGE_MAX) {
    inFrenzy = true;
    frenzyStarted = true;
    state.frenzy = { active: true, endsAt: now + frenzyDuration(state), remainingMs: 0, swordId: s.id };
    s.charge = 0;
    state.run.frenzies += 1;
    addLog(state, '入神启动！破碎结果暂时消失。', 'frenzy');
    triggers.push({ text: '入神启动', type: 'frenzy' });
    if (state.run.frenzies >= 5) grantAchievement(state, 'no_rest');
    if (!state.tutorial.active) grantAchievement(state, 'hammer_time');
  }

  const dist = computeDistribution(state, s, {
    inFrenzy,
    redChalk: state.anvilBuffs.redChalk,
  });
  let raw = rollResult(state, dist).result;
  if (opts.forceRaw) raw = opts.forceRaw;
  if (state.anvilBuffs.powder && !inFrenzy) {
    raw = (raw === 'success' || raw === 'great') ? 'great' : 'break';
    triggers.push({ text: '粉末袋改写结果', type: 'consumable' });
  }
  if (state.anvilBuffs.redChalk) triggers.push({ text: '红粉笔：大成功签翻倍', type: 'consumable' });
  const scaleProtect = state.anvilBuffs.protectBreak;
  state.anvilBuffs = { protectBreak: false, redChalk: false, powder: false };

  let result = raw;
  let convertedFromBreak = false;
  let protection = null;
  if (result === 'break') {
    const prot = chooseBreakProtection(state, s, scaleProtect);
    if (prot.kind === 'prevent') {
      protection = prot;
      triggers.push({ text: prot.text, type: 'protect' });
    } else if (prot.kind === 'damage') {
      protection = prot;
      convertedFromBreak = true;
      result = 'damage';
      triggers.push({ text: prot.text, type: 'protect' });
    }
  }

  const damagesFromSpine = convertedFromBreak && protection?.source === 'spine';
  let levelBefore = s.level;
  let flatGained = 0;
  let trueBreak = false;
  let duplication = false;
  let extraCharge = 0;

  const wasFirstForge = !s.forgedOnce;
  if (result === 'damage') {
    s.counters.damages += 1;
    let blocked = false;
    if (hasRelic(state, 'abyssal-pearl') && s.protections.pearlBlocks < 2 && s.level > 0) {
      s.protections.pearlBlocks += 1;
      blocked = true;
      triggers.push({ text: '深海之珠：抵御掉级', type: 'relic' });
    }
    if (!blocked) {
      const oldLevel = s.level;
      s.level = Math.max(0, s.level - 1);
      if (s.level !== oldLevel) {
        const afterDropValue = swordValue(state, s);
        if (hasRelic(state, 'cracked-crown')) {
          const lost = Math.max(0, preValue - afterDropValue);
          if (lost > 0) {
            s.flat += Math.round(lost * 0.5);
            flatGained += Math.round(lost * 0.5);
            triggers.push({ text: `裂冠：保留 ${Math.round(lost * 0.5).toLocaleString()} G 固定价值`, type: 'relic' });
          }
        }
      }
      triggers.push({ text: '等级 -1', type: 'damage' });
    }
    if (hasRelic(state, 'patched-apron')) {
      s.flat += 140;
      flatGained += 140;
      triggers.push({ text: `补过的围裙：固定价值 +140 G`, type: 'relic' });
    }
    if (hasRelic(state, 'cracked-splice') && s.layers.splice < 4) {
      s.layers.splice += 1;
      triggers.push({ text: `开裂的接合片：相对减破碎 +15%（${s.layers.splice * 15}%）`, type: 'relic' });
    }
    if (hasRelic(state, 'cracked-wristwatch') && !inFrenzy) {
      extraCharge += 1;
      triggers.push({ text: '裂开的腕表：充能 +1', type: 'relic' });
    }
    if (hasRelic(state, 'defeated-kings-seal')) {
      s.store.defeatedGreatLevels += 1;
      triggers.push({ text: '败王玉玺：下次大成功储 +1 级', type: 'relic' });
    }
    if (hasRelic(state, 'unbroken-oath') && chance(state, 0.7)) {
      const gains = gainLevels(state, s, 1, triggers);
      if (gains) triggers.push({ text: '不屈誓言：等级 +1', type: 'relic' });
    }
    if (hasRelic(state, 'giants-spine') && !damagesFromSpine) {
      s.counters.spineCounter += 1;
      if (s.counters.spineCounter % 2 === 0 && s.protections.spineCharges < 1) {
        s.protections.spineCharges = 1;
        triggers.push({ text: "巨人脊骨：准备好一次破碎改损伤", type: 'relic' });
      }
    }
    if (hasRelic(state, 'iron-comb')) {
      const add = Math.round(preValue * 0.05);
      s.flat += add;
      flatGained += add;
      triggers.push({ text: `铁梳：固定价值 +${add.toLocaleString()} G`, type: 'relic' });
    }
  } else if (result === 'hold') {
    s.counters.holdChain += 1;
    if (hasRelic(state, 'heavy-paperweight')) {
      s.flat += 180;
      flatGained += 180;
      triggers.push({ text: '沉重镇纸：固定价值 +180 G', type: 'relic' });
    }
    if (hasRelic(state, 'cold-teacup')) {
      s.mult *= 1.06;
      triggers.push({ text: '凉茶杯：剑值 ×1.06', type: 'relic' });
    }
    if (hasRelic(state, 'sealing-stone') && s.counters.holdChain % 2 === 0) {
      gainLevels(state, s, 1, triggers);
      triggers.push({ text: '封印石：连续不变，额外 +1 级', type: 'relic' });
    }
    if (hasRelic(state, 'sleeping-ember') && chance(state, 0.7)) {
      gainLevels(state, s, 1, triggers);
      triggers.push({ text: '沉睡余烬：不变额外 +1 级', type: 'relic' });
    }
    if (hasRelic(state, 'little-wind-bell') && s.store.successLevels < 2) {
      s.store.successLevels += 1;
      triggers.push({ text: `小风铃：下次普通成功储 +1 级（${s.store.successLevels}/2）`, type: 'relic' });
    }
    if (hasRelic(state, 'sealed-heart') && s.store.sealedGreatLevels < 4) {
      s.store.sealedGreatLevels += 1;
      triggers.push({ text: `封印之心：下次大成功储 +1 级（${s.store.sealedGreatLevels}/4）`, type: 'relic' });
    }
    if (hasRelic(state, 'kings-empty-cup')) {
      s.layers.greatSigns += 1;
      triggers.push({ text: '王的空杯：本剑大成功签 +1', type: 'relic' });
    }
    if (hasRelic(state, 'eternal-seed')) {
      s.baseValue += 40;
      triggers.push({ text: '永恒之种：基础价值 +40 G', type: 'relic' });
    }
    if (hasRelic(state, 'chained-hourglass') && !inFrenzy && chance(state, 0.5)) {
      extraCharge += 1;
      triggers.push({ text: '锁链沙漏：充能 +1', type: 'relic' });
    }
  } else if (result === 'success' || result === 'great') {
    s.counters.successChain += 1;
    let gains = result === 'great' ? 2 : 1;
    if (result === 'great') {
      s.greatMult *= 2.5 / 2.25;
      triggers.push({ text: '大成功：价值倍率 ×2.5', type: 'great' });
      if (hasRelic(state, 'silver-tuning-fork') && !inFrenzy) {
        gains += 1;
        triggers.push({ text: '银音叉：大成功额外 +1 级', type: 'relic' });
      }
      if (hasRelic(state, 'glass-hourglass') && inFrenzy) {
        gains += 1;
        triggers.push({ text: '玻璃沙漏：入神大成功额外 +1 级', type: 'relic' });
      }
      if (hasRelic(state, 'cracked-bell')) {
        s.mult *= 1.20;
        triggers.push({ text: '裂钟：剑值 ×1.20', type: 'relic' });
      }
      if (s.store.sealedGreatLevels > 0) {
        gains += s.store.sealedGreatLevels;
        triggers.push({ text: `封印之心兑现 +${s.store.sealedGreatLevels} 级`, type: 'relic' });
        s.store.sealedGreatLevels = 0;
      }
      if (s.store.defeatedGreatLevels > 0) {
        gains += s.store.defeatedGreatLevels;
        triggers.push({ text: `败王玉玺兑现 +${s.store.defeatedGreatLevels} 级`, type: 'relic' });
        s.store.defeatedGreatLevels = 0;
      }
      if (state.pendingGreatSigns > 0) {
        state.pendingGreatSigns = 0;
        triggers.push({ text: '怨恨之钉的一次性签已消耗', type: 'relic' });
      }
      if (inFrenzy && hasRelic(state, 'bell-collar')) {
        s.mult *= 1.05;
        triggers.push({ text: '铃铛项圈：剑值 ×1.05', type: 'relic' });
      }
    } else {
      if (s.store.successLevels > 0) {
        gains += s.store.successLevels;
        triggers.push({ text: `小风铃兑现 +${s.store.successLevels} 级`, type: 'relic' });
        s.store.successLevels = 0;
      }
      s.counters.normalSuccesses += 1;
      if (hasRelic(state, 'ceaseless-driveshaft') && s.counters.normalSuccesses % 2 === 0) {
        gains += 1;
        triggers.push({ text: '永转传动轴：累计两次普通成功，额外 +1 级', type: 'relic' });
      }
      if (hasRelic(state, 'bronze-cog')) {
        s.layers.successSigns += 1;
        triggers.push({ text: '青铜齿轮：本剑永久成功签 +1', type: 'relic' });
      }
      if (hasRelic(state, 'golden-cog')) {
        s.baseValue += 30;
        triggers.push({ text: '黄金齿轮：基础价值 +30 G', type: 'relic' });
      }
    }
    if (hasRelic(state, 'first-brand') && wasFirstForge) {
      gains += 2;
      triggers.push({ text: '初次烙印：第一锤额外 +2 级', type: 'relic' });
    }
    if (hasRelic(state, 'third-hand') && s.counters.successChain % 2 === 0) {
      gains += 1;
      triggers.push({ text: '第三只手：连续两次成功，额外 +1 级', type: 'relic' });
    }
    if (hasRelic(state, 'echo-hammer') && chance(state, 0.25)) {
      gains += 1;
      triggers.push({ text: '回响之锤：额外 +1 级', type: 'relic' });
    }
    if (hasRelic(state, 'interlocking-weights') && prevResult === 'damage') {
      gains += 2;
      triggers.push({ text: '咬合砝码：损伤后成功，额外 +2 级', type: 'relic' });
    }
    if (hasRelic(state, 'double-knot') && s.counters.successChain % 2 === 0) {
      s.mult *= 1.10;
      triggers.push({ text: '双重绳结：剑值 ×1.10', type: 'relic' });
    }
    if (hasRelic(state, 'dragon-heart') && preLevel >= 7) {
      s.mult *= 1.15;
      triggers.push({ text: '龙之心：剑值 ×1.15', type: 'relic' });
    }
    if (hasRelic(state, 'inspection-stamp')) {
      s.flat += 100;
      flatGained += 100;
      triggers.push({ text: '验货印章：固定价值 +100 G', type: 'relic' });
    }
    if (hasRelic(state, 'scorched-charm') && !inFrenzy && s.layers.scorched < 6) {
      s.layers.scorched += 1;
      triggers.push({ text: `焦黑护符：相对减破碎 +3%（${s.layers.scorched * 3}%）`, type: 'relic' });
    }
    gainLevels(state, s, gains, triggers);
  }

  if (result !== 'hold') s.counters.holdChain = 0;
  if (result !== 'success' && result !== 'great') s.counters.successChain = 0;

  // generic repeat/contrast relics
  const newSameStreak = prevResult === result ? (s.sameStreak || 0) + 1 : 1;
  if (hasRelic(state, 'soot-censer') && prevResult && prevResult !== result) {
    s.baseValue += 20;
    triggers.push({ text: '煤灰香炉：基础价值 +20 G', type: 'relic' });
  }
  if (hasRelic(state, 'wax-effigy') && newSameStreak >= 2) {
    s.flat += 150;
    flatGained += 150;
    triggers.push({ text: '蜡偶：连续相同结果，固定价值 +150 G', type: 'relic' });
  }
  if (hasRelic(state, 'split-twin-mirror') && newSameStreak >= 2 && s.lastValueBonus > 0) {
    s.flat += s.lastValueBonus;
    triggers.push({ text: `裂开的双镜：重复遗物加成 +${s.lastValueBonus.toLocaleString()} G`, type: 'relic' });
  }
  s.lastValueBonus = flatGained;

  if (result === 'break' && !protection) {
    trueBreak = true;
  }

  if (trueBreak) {
    resolveTrueBreak(state, s, { prevResult, triggers, inFrenzy, now });
  } else {
    // survival bookkeeping
    s.forgedOnce = true;
    s.forgeCount += 1;
    s.lastResult = result;
    s.sameStreak = newSameStreak;
    s.historyMaxLevel = Math.max(s.historyMaxLevel, s.level);
    if (result !== 'break' || protection) {
      // a protected break still consumes the hammer; charge accrues normally
      gainCharge(state, s, inFrenzy, extraCharge, wasFirstForge, triggers);
    }
    if (result === 'damage' && hasRelic(state, 'giants-spine') && !damagesFromSpine) {
      // already handled above
    }
    maybeDuplicateSword(state, s, result, triggers, () => { duplication = true; });
    state.cooldownUntil = now + hammerInterval(state, inFrenzy);
    refreshSwordMeta(state, s);
    addLog(state, `${swordDisplayName(s)}：${protection ? '破碎被挡下' : RESULT_LABEL[result]}，等级 +${s.level}，价值 ${swordValue(state, s).toLocaleString()} G。`, 'hammer');
  }

  state.lastHammer = {
    day: state.day,
    swordId: s.id,
    swordName: swordDisplayName(s),
    rawResult: raw,
    result,
    convertedFromBreak,
    protectedBy: protection ? protection.source : null,
    trueBreak,
    levelBefore,
    levelAfter: trueBreak ? 0 : s.level,
    valueBefore: preValue,
    valueAfter: trueBreak ? 0 : swordValue(state, s),
    inFrenzy,
    frenzyStarted,
    frenzyEndsAt: state.frenzy.active ? state.frenzy.endsAt : 0,
    triggers,
    distribution: dist,
    rewindAvailable: hasRewindAvailable(state),
    cooldownUntil: state.cooldownUntil,
    duplication,
    at: now,
  };
  state.run.bestSwordValue = Math.max(state.run.bestSwordValue || 0, bestInventoryValue(state));
  refreshAllValues(state);
  return { ok: true, ...state.lastHammer, snapshotReady: Boolean(state.hammerSnapshot) };
}

function chooseBreakProtection(state, s, scaleProtect = false) {
  if (scaleProtect) {
    return { kind: 'prevent', source: 'scale', text: '裂纹龙鳞：阻止了这次破碎' };
  }
  if (hasRelic(state, 'phoenix-ash') && !s.protections.phoenixUsed) {
    s.protections.phoenixUsed = true;
    s.mult *= 0.6;
    return { kind: 'prevent', source: 'phoenix', text: '凤凰之灰：保住剑，剑值损失 40%' };
  }
  if (hasRelic(state, 'unyielding-cornerstone') && !s.protections.cornerstoneUsed) {
    s.protections.cornerstoneUsed = true;
    return { kind: 'damage', source: 'cornerstone', text: '不倒基石：破碎改为损伤' };
  }
  if (hasRelic(state, 'wirebound-scabbard') && !state.daily.wireboundUsed) {
    state.daily.wireboundUsed = true;
    return { kind: 'damage', source: 'wirebound', text: '铁丝缠鞘：今日首次破碎改为损伤' };
  }
  if (hasRelic(state, 'giants-spine') && s.protections.spineCharges > 0) {
    s.protections.spineCharges = 0;
    return { kind: 'damage', source: 'spine', text: '巨人脊骨：破碎改为损伤' };
  }
  return { kind: 'none', source: null, text: '' };
}

function gainCharge(state, s, inFrenzy, extra, wasFirstForge, triggers) {
  if (inFrenzy) return [];
  let add = 1 + extra;
  if (hasRelic(state, 'ember-locket') && wasFirstForge) {
    add += 2;
    triggers.push({ text: '余烬吊坠：首次锻造额外充能 +2', type: 'relic' });
  }
  const before = s.charge;
  s.charge = Math.min(CHARGE_MAX, s.charge + add);
  const gained = s.charge - before;
  if (gained > 0) triggers.push({ text: `充能 +${gained}（${s.charge}/10）`, type: 'charge' });
  if (s.charge >= CHARGE_MAX) triggers.push({ text: '充能已满，下一锤将启动入神', type: 'frenzy' });
  return [];
}

function maybeDuplicateSword(state, s, result, triggers, cb) {
  if (!hasRelic(state, 'seal-of-twins') || result === 'break') return;
  if (!chance(state, 0.02)) return;
  const copy = JSON.parse(JSON.stringify(s));
  copy.id = uid(state, 'sw');
  copy.createdByCopy = true;
  copy.createdDay = state.day;
  copy.heat = s.heat;
  addSwordToInventory(state, copy);
  for (const f of ['phoenixUsed', 'cornerstoneUsed']) copy.protections[f] = copy.protections[f];
  triggers.push({ text: '双生印：复制了一把剑', type: 'relic' });
  addLog(state, '双生印发动，铁砧旁出现了另一把相同的剑。', 'relic');
  if (cb) cb();
  markSwordCodex(state, copy);
}

function resolveTrueBreak(state, s, ctx) {
  const { prevResult, triggers, inFrenzy, now } = ctx;
  const hist = Math.max(s.valueHistoryMax || 0, swordValue(state, s));
  const level = s.level;
  s.forgedOnce = true;
  s.forgeCount += 1;
  s.lastResult = 'break';
  s.sameStreak = (s.sameStreak || 0) + 1;
  state.run.breaks += 1;
  if (state.run.breaks >= 10) grantAchievement(state, 'all_thumbs');

  if (hasRelic(state, 'ash-sieve')) {
    state.gold += 500;
    triggers.push({ text: '筛灰网：金币 +500 G', type: 'relic' });
  }
  if (hasRelic(state, 'undertakers-chalice')) {
    const value = Math.max(100, Math.floor(hist * 0.3));
    const remnant = makeRemnant(state, value);
    if (tributeSwords(state).length < TRIBUTE_CAP) {
      remnant.location = 'tribute';
    }
    triggers.push({ text: `送葬人的圣杯：生成 ${value.toLocaleString()} G 残骸贡品`, type: 'relic' });
  }
  if (hasRelic(state, 'hungry-molar') && level >= 4) {
    state.pending.hungrySigns = 4;
    triggers.push({ text: '饥饿臼齿：下一把 +0 剑获得 4 张成功签', type: 'relic' });
  }
  let inheritRatio = 0;
  let inheritCharge = 0;
  if (hasRelic(state, 'broken-holy-sword')) { inheritRatio += 0.3; inheritCharge += 3; }
  if (hasRelic(state, 'dawn-scabbard')) { inheritRatio += 0.4; inheritCharge += 4; }
  if (inheritRatio > 0) {
    const levels = Math.floor(level * inheritRatio);
    state.pending.inheritLevels += levels;
    state.pending.inheritCharge += inheritCharge;
    triggers.push({ text: `继承：下一把未锻造 +0 剑获得 +${levels} 与 ${inheritCharge} 充能`, type: 'relic' });
  }
  if (hasRelic(state, 'grudge-nail')) {
    state.pendingGreatSigns += level;
    triggers.push({ text: `怨恨之钉：积存 ${level} 张一次性大成功签`, type: 'relic' });
  }
  if (hasRelic(state, 'ossuary-kings-scabbard') && level >= 7) {
    const key = ['break', 'damage', 'hold', 'success', 'great'].includes(prevResult) ? prevResult : 'success';
    state.runSigns[key] += 1;
    triggers.push({ text: `骨灰王之鞘：本局永久${RESULT_LABEL[key]}签 +1`, type: 'relic' });
  }
  if (hasRelic(state, 'undertakers-ledger') && level >= 7 && state.daily.ledgerExtra < 2) {
    state.daily.ledgerExtra += 1;
    state.pending.supplyExtra += 1;
    triggers.push({ text: '殡葬师的账簿：明日额外供给 +1 把', type: 'relic' });
  }

  state.brokenSwords.unshift({
    id: s.id, name: swordDisplayName(s), family: s.family, level, value: hist,
    day: state.day, reason: 'hammer',
  });
  if (state.brokenSwords.length > 20) state.brokenSwords.length = 20;
  state.swords = state.swords.filter(x => x.id !== s.id);
  state.anvilSwordId = null;
  state.cooldownUntil = now + hammerInterval(state, inFrenzy);
  addLog(state, `${swordDisplayName(s)} 碎了。铁砧上只剩灰。`, 'break');
}

export function hasRewindAvailable(state) {
  return Boolean(state.hammerSnapshot) && (state.consumables.regret_clockwork || 0) > 0;
}

export function rewindHammer(state) {
  if (!state.hammerSnapshot) return fail('no-snapshot', '没有可以撤回的一锤。');
  if ((state.consumables.regret_clockwork || 0) <= 0) return fail('no-clockwork', '需要悔恨发条才能回溯。');
  const snap = state.hammerSnapshot;
  const snapshotKeys = Object.keys(state);
  for (const key of snapshotKeys) delete state[key];
  Object.assign(state, snap);
  state.hammerSnapshot = null;
  state.frenzy = { active: false, endsAt: 0, remainingMs: 0, swordId: null };
  state.cooldownUntil = 0;
  state.consumables.regret_clockwork = Math.max(0, (state.consumables.regret_clockwork || 0) - 1);
  addLog(state, '悔恨发条倒转。上一锤被撤回。', 'rewind');
  refreshAllValues(state);
  return { ok: true };
}

// ---------------------------------------------------------------- inventory actions

export function moveSwordTo(state, swordId, location) {
  const s = getSword(state, swordId);
  if (!s) return fail('no-sword', '找不到这把剑。');
  if (!['rack', 'tribute', 'floor', 'anvil'].includes(location)) return fail('bad-location', '不能放到那里。');
  if (s.location === location) return { ok: true };
  if (location === 'anvil') return placeOnAnvil(state, swordId);
  // Validate first: a rejected move must not detach a sword or consume its session.
  if (location === 'rack' && rackSwords(state).length >= RACK_CAP) return fail('rack-full', '剑架只有三个位置。');
  if (location === 'tribute' && tributeSwords(state).length >= TRIBUTE_CAP) return fail('tribute-full', '贡台已经放满了。');
  if (location === 'floor' && inventorySwords(state).length >= FLOOR_CAP) return fail('floor-full', '地面已经堆满了，先腾出空间。');
  if (s.location === 'anvil') {
    leaveAnvilSession(state);
    state.anvilSwordId = null;
  }
  s.location = location;
  return { ok: true };
}

export function claimOverflow(state) {
  if (inventorySwords(state).length >= FLOOR_CAP) return fail('floor-full', '地面没有空位。');
  const s = state.swords.find(x => x.location === 'overflow');
  if (!s) return fail('no-overflow', '没有待领取的剑。');
  s.location = 'floor';
  return { ok: true, sword: s.id };
}

export function sellSword(state, swordId) {
  const s = getSword(state, swordId);
  if (!s) return fail('no-sword', '找不到这把剑。');
  if (!['floor', 'rack'].includes(s.location)) return fail('bad-location', '贡台和铁砧上的剑不能投进售卖机。');
  let coins = 1;
  let hook = false;
  if (hasRelic(state, 'collectors-hook') && !state.daily.collectorHookUsed && state.shop.firstRerollDone && s.level === 0 && !s.forgedOnce) {
    coins = 2;
    hook = true;
    state.daily.collectorHookUsed = true;
  }
  state.coins += coins;
  state.swords = state.swords.filter(x => x.id !== s.id);
  addLog(state, `${swordDisplayName(s)} 被投入售卖机，获得 ${coins} 剑币。`, 'shop');
  return { ok: true, coins, hook };
}

export function placeOnTribute(state, swordId) {
  const s = getSword(state, swordId);
  if (!s) return fail('no-sword', '找不到这把剑。');
  if (!['floor', 'rack'].includes(s.location)) return fail('bad-location', '这把剑现在不能放上贡台。');
  if (tributeSwords(state).length >= TRIBUTE_CAP) return fail('tribute-full', '贡台已经放满了。');
  s.location = 'tribute';
  return { ok: true };
}

export function takeFromTribute(state, swordId) {
  const s = getSword(state, swordId);
  if (!s || s.location !== 'tribute') return fail('no-sword', '贡台上没有这把剑。');
  if (inventorySwords(state).length >= FLOOR_CAP) return fail('floor-full', '地面没有空间。');
  s.location = 'floor';
  return { ok: true };
}

// ---------------------------------------------------------------- relics / shop

function shopRarityWeights(day) {
  if (day <= 3) return { common: 0.85, rare: 0.15, legendary: 0 };
  if (day <= 5) return { common: 0.75, rare: 0.25, legendary: 0 };
  if (day === 6) return { common: 0.70, rare: 0.25, legendary: 0.05 };
  if (day <= 8) return { common: 0.60, rare: 0.35, legendary: 0.05 };
  if (day <= 12) return { common: 0.53, rare: 0.35, legendary: 0.12 };
  return { common: 0.45, rare: 0.40, legendary: 0.15 };
}

function eligibleRelics(state) {
  const unlocked = new Set(state.unlockedAchievements);
  return RELICS.filter(r => {
    if (r.minDay > state.day) return false;
    if (state.relics.includes(r.id)) return false;
    if (r.unlock) {
      const ach = ACHIEVEMENT_BY_UNLOCK_RELIC[r.id];
      if (!ach || !unlocked.has(ach.id)) return false;
    }
    return true;
  });
}

function weightedPick(state, items, weightFn) {
  if (!items.length) return null;
  const weights = items.map(weightFn);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[0];
  let r = random(state) * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function generateShop(state) {
  const items = [];
  const used = new Set();
  for (let slot = 0; slot < 3; slot++) {
    let pool = eligibleRelics(state).filter(r => !used.has(r.id));
    if (!pool.length) { items.push(null); continue; }
    const weights = shopRarityWeights(state.day);
    let rarity = weightedPick(state, ['common', 'rare', 'legendary'], k => weights[k]);
    let rarityPool = pool.filter(r => r.rarity === rarity);
    if (!rarityPool.length) rarityPool = pool;
    const chosen = weightedPick(state, rarityPool, r => {
      let w = 1;
      if (state.day <= 6 && RECOVERY_RELICS.includes(r.id)) w *= 2.2;
      return w;
    });
    items.push({ relicId: chosen.id, price: chosen.cost, sold: false });
    used.add(chosen.id);
    markSeenRelic(state, chosen.id);
  }
  state.shop.items = items;
  state.shop.day = state.day;
  return items;
}

export function rerollCost(state) {
  const base = 200 + state.day * 80;
  return Math.round((base * Math.pow(1.7, state.shop.paidRerolls || 0)) / 10) * 10;
}

export function rerollShop(state) {
  if (state.phase !== 'playing') return fail('bad-phase', '现在不能刷新。');
  if (state.day < 2) return fail('no-shop', '遗物商店第 2 天才会开门。');
  const free = hasRelic(state, 'worn-voucher') && !state.shop.freeRerollUsed;
  const cost = rerollCost(state);
  if (!free && state.gold < cost) return fail('no-gold', `刷新需要 ${cost.toLocaleString()} G。`);
  if (!free) {
    state.gold -= cost;
    state.shop.paidRerolls += 1;
  } else {
    state.shop.freeRerollUsed = true;
  }
  state.shop.firstRerollDone = true;
  generateShop(state);
  addLog(state, free ? '磨旧的兑换券：免费刷新了遗物商店。' : `花费 ${cost.toLocaleString()} G 刷新了遗物商店。`, 'shop');
  return { ok: true, free, cost: free ? 0 : cost };
}

export function buyRelic(state, index) {
  if (state.phase !== 'playing') return fail('bad-phase', '现在不能购买。');
  const item = state.shop.items[index];
  if (!item || item.sold) return fail('sold', '这个商品位已经空了。');
  const relic = RELIC_BY_ID[item.relicId];
  if (!relic) return fail('bad-item', '未知的遗物。');
  if (state.relics.length >= RELIC_SLOTS) return fail('slots-full', '遗物架已满，需要先丢弃一件遗物。');
  if (state.coins < item.price) return fail('no-coins', `需要 ${item.price} 剑币。`);
  state.coins -= item.price;
  state.relics.push(relic.id);
  item.sold = true;
  markSeenRelic(state, relic.id);
  addLog(state, `购买遗物：${relic.zh}。`, 'relic');
  refreshAllValues(state);
  return { ok: true, relic };
}

export function discardRelic(state, relicId) {
  if (state.phase !== 'playing') return fail('bad-phase', '现在不能丢弃。');
  const idx = state.relics.indexOf(relicId);
  if (idx < 0) return fail('not-owned', '没有这件遗物。');
  state.relics.splice(idx, 1);
  addLog(state, `丢弃遗物：${RELIC_BY_ID[relicId]?.zh || relicId}。`, 'relic');
  refreshAllValues(state);
  return { ok: true };
}

// ---------------------------------------------------------------- merchant

export function merchantVisitCount(day) {
  if (day <= CONTRACT_DAYS) return TRIBUTE_DAYS.filter(d => d.merchant && d.day <= day).length;
  return 7 + Math.floor((day - CONTRACT_DAYS) / 3);
}

function roundPrice(x) {
  return Math.max(10, Math.round(x / 10) * 10);
}

export function generateMerchant(state) {
  const info = dayInfo(state.day);
  if (!info.merchant) { state.merchant = null; return null; }
  const visit = merchantVisitCount(state.day);
  let baseStock = visit <= 1 ? 2 : visit <= 3 ? 3 : visit <= 7 ? 4 : 5;
  if (hasRelic(state, 'silver-supply-writ')) baseStock += 2;
  let optionCount = visit <= 1 ? 2 : visit === 2 ? 3 : 4;
  if (hasRelic(state, 'wandering-ghosts-ledger')) optionCount += 2;
  const basePrice = roundPrice(state.quotaBase * MERCHANT_PRICE.baseSword);
  const specialFamily = pick(state, ['world_tree', 'fishblade', 'funerary']);
  const specialLevel = state.day < 9 ? 0 : state.day < 15 ? 2 : 4;
  const specialPrice = roundPrice(state.quotaBase * MERCHANT_PRICE.specialSword);
  const items = [
    { uid: 'm-base', kind: 'sword', sub: 'base', label: '基础剑', family: null, level: 0, stock: baseStock, initialStock: baseStock, price: basePrice },
    { uid: 'm-special', kind: 'sword', sub: 'special', label: SWORD_FAMILIES[specialFamily].zh, family: specialFamily, level: specialLevel, stock: 1, initialStock: 1, price: specialPrice },
  ];
  const consumablePool = Object.keys(CONSUMABLES).filter(key => {
    const c = CONSUMABLES[key];
    if (c.minDay > state.day) return false;
    if (key === 'incense_of_oblivion' && (state.flags.incenseUsed || state.anger <= 0)) return false;
    return true;
  });
  const chosen = shuffle(state, consumablePool).slice(0, optionCount);
  for (const key of chosen) {
    const c = CONSUMABLES[key];
    items.push({
      uid: `m-${key}`, kind: 'consumable', sub: c.use, key, label: c.zh,
      stock: 1, initialStock: 1, price: roundPrice(state.quotaBase * c.priceFactor),
    });
    markSeenConsumable(state, key);
    markSeenMerchantItem(state, key);
  }
  markSeenMerchantItem(state, 'base-sword');
  markSeenMerchantItem(state, 'special-sword');
  markSwordCodex(state, { family: specialFamily, merchant: true, historyMaxLevel: specialLevel, remnant: false, route: SWORD_FAMILIES[specialFamily].route });
  state.merchant = { day: state.day, visit, items, closed: false };
  return state.merchant;
}

export function buyMerchantItem(state, index) {
  if (state.phase !== 'playing') return fail('bad-phase', '现在不能交易。');
  if (!state.merchant) return fail('no-merchant', '幽灵商人已经离开了。');
  const item = state.merchant.items[index];
  if (!item || item.stock <= 0) return fail('sold-out', '这件商品卖完了。');
  if (state.gold < item.price) return fail('no-gold', `需要 ${item.price.toLocaleString()} G。`);
  if (item.kind === 'consumable' && item.key === 'incense_of_oblivion') {
    if (state.anger <= 0) return fail('no-anger', '巨龙现在并不愤怒，香没有用。');
    if (state.flags.incenseUsed) return fail('used', '每局只能使用一次遗忘之香。');
  }
  state.gold -= item.price;
  item.stock -= 1;
  if (item.sub === 'base' || item.stock > 0) item.price = Math.round(item.price * 3 / 10) * 10;

  if (item.kind === 'sword') {
    const s = makeSword(state, {
      family: item.family || null,
      level: item.level,
      route: item.family ? null : randomInt(state, 3),
    });
    addLog(state, `商人卖出了一把 ${swordDisplayName(s)}。`, 'merchant');
    markSeenMerchantItem(state, `${item.sub}-sword`);
  } else {
    const c = CONSUMABLES[item.key];
    if (item.key === 'incense_of_oblivion') {
      state.anger = Math.max(0, state.anger - 1);
      state.flags.incenseUsed = true;
      addLog(state, '遗忘之香燃起，巨龙怒气降低一档。', 'merchant');
    } else if (item.key === 'ghost_delivery_note') {
      state.pending.supplyExtra += 2;
      addLog(state, '幽灵送货单：明日供给额外 +2 把剑。', 'merchant');
    } else {
      state.consumables[item.key] = (state.consumables[item.key] || 0) + 1;
      addLog(state, `购入 ${c.zh}。`, 'merchant');
    }
    markSeenConsumable(state, item.key);
    markSeenMerchantItem(state, item.key);
  }
  const soldOut = state.merchant.items.every(i => i.stock <= 0);
  if (soldOut) {
    grantAchievement(state, 'take_everything');
    state.merchant.closed = true;
    addLog(state, '你买空了幽灵商人的全部库存。', 'achievement');
  }
  refreshAllValues(state);
  return { ok: true, soldOut };
}

// ---------------------------------------------------------------- consumables

export function useConsumable(state, key, now = Date.now()) {
  if (state.phase !== 'playing') return fail('bad-phase', '现在不能使用。');
  if (key === 'regret_clockwork') return rewindHammer(state);
  const count = state.consumables[key] || 0;
  if (count <= 0) return fail('none-left', '没有这件消耗品。');
  const c = CONSUMABLES[key];
  if (!c) return fail('bad-item', '未知的消耗品。');
  const s = getAnvilSword(state);
  if (!s) return fail('no-sword', '先在铁砧上放一把剑。');
  if (s.remnant) return fail('remnant', '残骸用不上这个。');
  if (key === 'cracked_dragon_scale') {
    if (state.frenzy.active) return fail('frenzy', '入神中不能预置龙鳞。');
    if (s.charge >= CHARGE_MAX) return fail('charge-full', '已满充能、即将入神，不能预置龙鳞。');
    if (state.anvilBuffs.protectBreak) return fail('already', '龙鳞已经预置过了。');
    state.anvilBuffs.protectBreak = true;
  } else if (key === 'red_chalk') {
    if (state.anvilBuffs.redChalk) return fail('already', '红粉笔已经预置过了。');
    state.anvilBuffs.redChalk = true;
  } else if (key === 'powder_pouch') {
    if (state.frenzy.active) return fail('frenzy', '入神中不能使用粉末袋。');
    if (state.anvilBuffs.powder) return fail('already', '粉末袋已经预置过了。');
    state.anvilBuffs.powder = true;
  } else if (key === 'cold_star_shard') {
    if (state.frenzy.active) return fail('frenzy', '入神中不能使用寒星碎片。');
    if (s.charge >= CHARGE_MAX) return fail('charge-full', '充能已满。');
    s.charge = Math.min(CHARGE_MAX, s.charge + 3);
  } else {
    return fail('not-usable', '这件物品不能在铁砧上使用。');
  }
  state.consumables[key] = count - 1;
  addLog(state, `使用了 ${c.zh}。`, 'consumable');
  return { ok: true, charge: s.charge, buffs: { ...state.anvilBuffs } };
}

// ---------------------------------------------------------------- bell / day

export function ringBell(state) {
  if (state.phase !== 'playing') return fail('bad-phase', '现在不能敲铃。');
  const quota = currentQuota(state);
  const offered = tributeSwords(state);
  const total = offered.reduce((sum, s) => sum + swordValue(state, s), 0);
  const angerBefore = state.anger;
  const maxOfferedLevel = offered.reduce((m, s) => Math.max(m, s.level), 0);
  state.gold += total;
  state.run.goldEarned += total;
  state.swords = state.swords.filter(s => s.location !== 'tribute');
  const full = total >= quota;
  let pardonUsed = false;
  let death = false;
  let contractComplete = false;
  let extraGold = 0;

  if (full) {
    state.run.fullTributes += 1;
    if (hasRelic(state, 'tax-tally')) { state.coins += 1; }
    if (hasRelic(state, 'journeyman-badge')) state.pending.supplyMinLevel = Math.max(state.pending.supplyMinLevel, 2);
    if (hasRelic(state, 'pocket-hearth')) state.run.pocketHearthBonus += 20;
    if (hasRelic(state, 'smiths-testament') && maxOfferedLevel >= 10) {
      state.pending.smithLevels = Math.max(state.pending.smithLevels, Math.floor(maxOfferedLevel * 0.3));
    }
    if (total >= quota * 3) grantAchievement(state, 'keep_change');
    if (angerBefore === 2) grantAchievement(state, 'one_last_chance');
    if (state.contractCompleted) {
      state.run.extraFullTributes += 1;
      if (state.run.extraFullTributes >= 3) grantAchievement(state, 'job_for_life');
    }
  } else {
    state.anger += 1;
    if (hasRelic(state, 'mourning-knot')) {
      state.runSigns.great += 1;
      addLog(state, '丧服之结：本局永久大成功签 +1。', 'relic');
    }
    if (state.anger >= 3) {
      if (hasRelic(state, 'dragons-pardon') && !state.flags.pardonUsed) {
        state.flags.pardonUsed = true;
        state.anger = 2;
        pardonUsed = true;
        state.relics = state.relics.filter(id => id !== 'dragons-pardon');
        addLog(state, '巨龙赦免状燃尽，死亡被阻止，怒气回到两档。', 'anger');
      } else {
        death = true;
      }
    }
  }

  const isFinal = state.day === 21;
  if (isFinal && !death) {
    contractComplete = true;
    state.contractCompleted = true;
    state.phase = 'victory';
    grantAchievement(state, 'clocking_out');
  } else if (death) {
    state.phase = 'dead';
    grantAchievement(state, 'now_hiring');
  }

  let next = null;
  if (!death && !isFinal) {
    const info = dayInfo(state.day + 1);
    let nextBase = info.quota;
    let nextQuota = hasRelic(state, 'sealed-rebate') ? Math.round(nextBase * 0.9) : nextBase;
    let carry = 0;
    if (full && hasRelic(state, 'royal-change')) {
      const excess = total - quota;
      carry = Math.min(Math.floor(excess * 0.3), Math.round(nextQuota * 0.3));
      nextQuota -= carry;
    }
    state.royalChangeCarry = carry;
    next = { day: state.day + 1, date: info.date, quota: nextQuota, base: nextBase, carry, merchant: info.merchant };
  }

  const summary = {
    day: state.day,
    date: dayInfo(state.day).date,
    quota,
    total,
    full,
    offered: offered.map(s => ({ name: swordDisplayName(s), level: s.level, value: swordValue(state, s) })),
    goldFromTribute: total,
    extraGold,
    angerBefore,
    angerAfter: state.anger,
    pardonUsed,
    death,
    contractComplete,
    next,
    at: Date.now(),
  };
  state.lastDaySummary = summary;
  addLog(state, full ? `贡品足额：${total.toLocaleString()} / ${quota.toLocaleString()} G。` : `贡品不足：${total.toLocaleString()} / ${quota.toLocaleString()} G。怒气 ${state.anger}/3。`, full ? 'tribute-ok' : 'tribute-fail');
  if (death) addLog(state, '巨龙收走了工坊。本局结束。', 'death');

  if (!death && !isFinal) {
    setupDay(state, state.day + 1);
    refreshAllValues(state);
  }
  return { ok: true, summary, state };
}

export function continueEndless(state) {
  if (state.phase !== 'victory') return fail('bad-phase', '契约尚未完成。');
  setupDay(state, state.day + 1);
  addLog(state, `契约完成，但你选择继续。第 ${state.day} 天，贡额 ${currentQuota(state).toLocaleString()} G。`, 'endless');
  refreshAllValues(state);
  return { ok: true };
}

// ---------------------------------------------------------------- save / load

export function prepareSave(state) {
  const copy = JSON.parse(JSON.stringify({ ...state, hammerSnapshot: null }));
  if (copy.frenzy?.active) {
    copy.frenzy.remainingMs = Math.max(0, copy.frenzy.endsAt - Date.now());
    copy.frenzy.endsAt = 0;
  }
  copy.cooldownUntil = 0;
  copy.updatedAt = new Date().toISOString();
  return copy;
}

export function hydrateState(raw) {
  if (!raw) return null;
  const s = JSON.parse(JSON.stringify(raw));
  s.hammerSnapshot = null;
  s.cooldownUntil = 0;
  if (s.frenzy?.active) {
    s.frenzy.endsAt = Date.now() + (s.frenzy.remainingMs || 0);
  }
  s.anvilBuffs = s.anvilBuffs || { protectBreak: false, redChalk: false, powder: false };
  s.consumables = { cracked_dragon_scale: 0, regret_clockwork: 0, red_chalk: 0, powder_pouch: 0, cold_star_shard: 0, ...(s.consumables || {}) };
  s.startingChoices = s.startingChoices || [];
  s.unlockedAchievements = s.unlockedAchievements || [];
  s.codex = mergeCodex(s.codex);
  s.pending = { supplyExtra: 0, supplyMinLevel: 0, inheritLevels: 0, inheritCharge: 0, hungrySigns: 0, smithLevels: 0, ...(s.pending || {}) };
  return s;
}

export function describeStateForSave(state) {
  return {
    day: state.day,
    phase: state.phase,
    quota: currentQuota(state),
    gold: state.gold,
    coins: state.coins,
    anger: state.anger,
    relics: state.relics.length,
    swords: state.swords.length,
    date: dayInfo(state.day).date,
  };
}

export const ENGINE_VERSION = 2;
