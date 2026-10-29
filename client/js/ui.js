import {
  E, RELIC_BY_ID, RELICS, SWORD_FAMILIES, RARITIES, ACHIEVEMENTS, ACHIEVEMENT_BY_ID,
  CONSUMABLES, FAMILY_ORDER, TUTORIAL_STEPS, RELIC_SLOTS,
  fmt, compact, esc, tip, relicTip, consumableTip, swordTip, relicIcon, consumableIcon,
  achievementIcon, swordArtPath, rarityOf, rarityZh, swordFamilyLabel, phaseLabel,
  relativeTime, mergedCodex, achievementMap, bestSword, hammerDisabledReason,
  consumeDisabledReason, tutorialTarget,
} from './helpers.js';

import { tutorialObjective } from '../shared/engine/tutorial.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const CONSUMABLE_ORDER = ['cracked_dragon_scale', 'regret_clockwork', 'red_chalk', 'powder_pouch', 'cold_star_shard'];
const PHASE_ORDER = ['break', 'damage', 'hold', 'success', 'great'];
const PHASE_NAMES = { break: '破碎', damage: '损伤', hold: '不变', success: '成功', great: '大成功' };

export function renderAll(app) {
  if (!app.state) return;
  applyMobileTab(app);
  renderHUD(app);
  renderLeft(app);
  renderCenter(app);
  renderRight(app);
  renderTribute(app);
  updateTimers(app);
}

export function applyMobileTab(app) {
  const screen = document.getElementById('screen-game');
  if (!screen) return;
  const tabs = ['forge', 'inventory', 'shop', 'tribute'];
  const tab = tabs.includes(app.mobileTab) ? app.mobileTab : 'forge';
  for (const t of tabs) screen.classList.toggle('mobile-tab-' + t, t === tab);
  document.querySelectorAll('.mobile-dock-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  const badge = document.getElementById('dock-tribute-count');
  if (badge && app.state) badge.textContent = String(E.tributeSwords(app.state).length);
}

export function renderHUD(app) {
  const s = app.state;
  const quota = E.currentQuota(s);
  const total = E.tributeTotal(s);
  const info = { day: s.day };
  const dayInfo = (s.day <= 21)
    ? { date: ['4月15日','4月16日','4月17日','4月18日','4月19日','4月20日','4月21日','4月22日','4月23日','4月24日','4月25日','4月26日','4月27日','4月28日','4月29日','4月30日','5月1日','5月2日','5月3日','5月4日','5月5日'][s.day - 1] }
    : { date: `延长第 ${s.day - 21} 天` };
  const hudDay = $('#hud-day');
  hudDay.textContent = `第 ${s.day} 天`;
  $('#hud-date').textContent = dayInfo.date;
  $('#hud-phase').textContent = s.phase === 'playing'
    ? (s.merchant ? '幽灵商人到访' : '契约进行中')
    : phaseLabel(s.phase);
  $('#hud-quota').textContent = fmt(quota);
  $('#hud-tribute-total').textContent = `贡台 ${compact(total)} G`;
  const fill = $('#quota-fill');
  fill.style.width = `${Math.min(100, quota ? total / quota * 100 : 0)}%`;
  fill.parentElement.classList.toggle('full', total >= quota);
  $('#hud-gold').textContent = compact(s.gold);
  $('#hud-coins').textContent = compact(s.coins);
  const angerEl = $('#hud-anger');
  angerEl.innerHTML = [0, 1, 2].map(i => `<i class="${i < s.anger ? (s.anger >= 3 ? 'lit critical' : 'lit') : ''}"></i>`).join('');
  const dragon = $('#dragon-face img');
  dragon.src = `./assets/ui/dragon_${s.anger >= 3 ? 'rage' : s.anger > 0 ? 'warn' : 'calm'}.svg`;
  renderSyncBadge(app);
}

export function renderSyncBadge(app) {
  const el = $('#sync-badge');
  if (!el) return;
  el.className = 'sync-badge' + (app.sync === 'saving' ? ' saving' : app.sync === 'offline' ? ' offline' : '');
  const txt = app.sync === 'saving' ? '同步中' : app.sync === 'offline' ? '离线' : '云端';
  el.innerHTML = `<i></i><span>${txt}</span>`;
}

export function renderLeft(app) {
  const s = app.state;
  const sword = E.getAnvilSword(s);
  const forge = $('#forge-card');
  const hot = sword && (sword.heat || E.hasRelic(s, 'lifetime-contract'));
  forge.classList.toggle('hot', Boolean(hot));
  const badge = $('#heat-badge');
  badge.textContent = sword ? (sword.heat ? '已加热' : E.hasRelic(s, 'lifetime-contract') ? '终身契约' : '待加热') : '空炉';
  const heatBtn = $('#btn-heat');
  let heatLabel = '加热铁砧上的剑';
  let heatDisabled = true;
  if (s.phase !== 'playing') { heatLabel = '现在无法加热'; }
  else if (!sword) { heatLabel = '先把剑放上铁砧'; }
  else if (sword.remnant) { heatLabel = '残骸无法加热'; }
  else if (sword.heat) { heatLabel = '已经加热好了'; }
  else if (E.hasRelic(s, 'lifetime-contract')) { heatLabel = '终身契约：无需加热'; heatDisabled = true; }
  else { heatDisabled = false; }
  heatBtn.disabled = heatDisabled;
  heatBtn.innerHTML = `<img src="./assets/ui/heat.svg" alt="">${heatLabel}`;
  $('#forge-hint').textContent = E.hasRelic(s, 'lifetime-contract') ? '终身契约已免除加热' : (sword?.heat ? '可以挥锤了' : '加热后才能锻造');

  // inventory
  const floor = E.inventorySwords(s);
  $('#inv-count').textContent = floor.length;
  const inv = $('#inventory-grid');
  let html = '';
  for (const sw of floor) {
    const selected = app.selectedSwordId === sw.id;
    html += `
      <div class="inv-row${selected ? ' selected' : ''}${sw.heat ? ' hot' : ''}" data-action="select-sword" data-id="${sw.id}" draggable="true" data-sword-id="${sw.id}" ${tip(swordTip(app, sw))}>
        <div class="inv-icon"><img src="${swordArtPath(sw)}" alt=""></div>
        <div class="inv-main">
          <div class="inv-name">${esc(E.swordDisplayName(sw))}</div>
          <div class="inv-meta"><b>+${sw.level}</b><span>${sw.remnant ? '残骸' : sw.heat ? '已加热' : '未加热'}</span><span class="inv-value">${compact(E.swordValue(s, sw))} G</span></div>
        </div>
        <button class="mini-btn" data-action="place-anvil" data-id="${sw.id}" ${tip('放上铁砧')}>上砧</button>
      </div>`;
  }
  if (!floor.length) html = `<div class="inv-empty">地面还空着。<br>每天会有三把基础剑送进来。</div>`;
  const overflow = E.overflowSwords(s);
  if (overflow.length) {
    html += `<div class="overflow-row"><span>待放置：${overflow.length} 把剑</span><button data-action="claim-overflow">领取一把</button></div>`;
  }
  inv.innerHTML = html;
  $('#claim-overflow').classList.toggle('hidden', overflow.length === 0);
  $('#claim-overflow').textContent = `领取待放置（${overflow.length}）`;

  // rack
  const rack = E.rackSwords(s);
  const rackSlots = $('#rack-slots');
  let rhtml = '';
  for (let i = 0; i < 3; i++) {
    const sw = rack[i];
    if (sw) {
      rhtml += `<div class="rack-slot filled" data-action="select-sword" data-id="${sw.id}" draggable="true" data-sword-id="${sw.id}" ${tip(swordTip(app, sw))}>
        <span class="rack-level">+${sw.level}</span>
        <img class="rack-sword" src="${swordArtPath(sw)}" alt="">
        <span class="rack-name">${esc(E.swordDisplayName(sw))}</span>
      </div>`;
    } else {
      rhtml += `<div class="rack-slot" data-drop-slot="rack"><span class="rack-empty">空位</span></div>`;
    }
  }
  rackSlots.innerHTML = rhtml;
  $('#rack-count').textContent = `${rack.length} / 3`;

  renderSwordContext(app);
}

export function renderSwordContext(app) {
  const s = app.state;
  const el = $('#sword-context');
  if (!el) return;
  const sw = app.selectedSwordId ? E.getSword(s, app.selectedSwordId) : null;
  if (!sw) {
    el.innerHTML = `<span class="ctx-label">选中一把剑以显示操作</span>`;
    return;
  }
  const name = esc(E.swordDisplayName(sw));
  let buttons = '';
  if (sw.location === 'tribute') {
    buttons += `<button class="mini-btn" data-action="from-tribute" data-id="${sw.id}">从贡台取回</button>`;
  } else if (sw.location === 'anvil') {
    buttons += `<button class="mini-btn" data-action="take-anvil">取走</button>`;
    buttons += `<button class="mini-btn" data-action="to-tribute" data-id="${sw.id}">放上贡台</button>`;
    buttons += `<button class="mini-btn" data-action="to-rack" data-id="${sw.id}">放上剑架</button>`;
  } else {
    if (!sw.remnant) buttons += `<button class="mini-btn" data-action="place-anvil" data-id="${sw.id}">放上铁砧</button>`;
    buttons += `<button class="mini-btn" data-action="to-tribute" data-id="${sw.id}">放上贡台</button>`;
    buttons += `<button class="mini-btn" data-action="to-rack" data-id="${sw.id}">放上剑架</button>`;
    buttons += `<button class="mini-btn" data-action="sell-sword" data-id="${sw.id}">换剑币</button>`;
  }
  el.innerHTML = `<span class="ctx-name">${name} <em>+${sw.level}</em></span><span class="ctx-actions">${buttons}</span>`;
}

export function renderCenter(app) {
  const s = app.state;
  const sw = E.getAnvilSword(s);
  const stage = $('#anvil-stage');
  const empty = !sw;
  $('#stage-empty').classList.toggle('hidden', !empty);
  const swordEl = $('#anvil-sword');
  swordEl.style.opacity = sw ? '1' : '0';
  const strikePhase = $('#forge-rig')?.dataset.strikePhase;
  $('#hammer-art').style.opacity = sw || (strikePhase && strikePhase !== 'idle') ? '1' : '0';
  stage.classList.toggle('is-hot', Boolean(sw && (sw.heat || E.hasRelic(s, 'lifetime-contract'))));
  stage.classList.toggle('frenzy', s.frenzy.active);
  stage.classList.toggle('ready', Boolean(sw && sw.charge >= 10 && !s.frenzy.active));
  const frenzyLayer = $('#frenzy-layer');
  frenzyLayer.classList.toggle('active', s.frenzy.active);

  if (sw) {
    $('#anvil-sword-art').src = swordArtPath(sw);
    $('#sword-family').textContent = swordFamilyLabel(sw);
    $('#sword-name').textContent = E.swordDisplayName(sw);
    $('#sword-subline').textContent = sw.remnant
      ? '一件可以献上的残骸'
      : `+${sw.level} · ${sw.heat || E.hasRelic(s, 'lifetime-contract') ? '已加热' : '未加热'} · 历史最高 +${sw.historyMaxLevel} · 充能 ${sw.charge}/10`;
    $('#sword-chips').innerHTML = stageChips(app, sw);
    $('#stat-level').textContent = `+${sw.level}`;
    $('#stat-value').textContent = `${fmt(E.swordValue(s, sw))} G`;
    $('#stat-value-note').textContent = sw.remnant ? '残骸贡品' : `历史最高 ${fmt(sw.valueHistoryMax)} G`;
    $('#sword-history').textContent = `历史最高 +${sw.historyMaxLevel}`;
    const pips = [];
    for (let i = 0; i < 10; i++) pips.push(`<i class="${i < sw.charge ? 'full' : ''}"></i>`);
    $('#charge-pips').innerHTML = pips.join('');
    $('#charge-count').textContent = `${sw.charge} / 10`;
    $('#layer-chips').innerHTML = layerChips(app, sw);
    $('#sword-actions').innerHTML = `
      ${(!sw.heat && !E.hasRelic(s, 'lifetime-contract') && !sw.remnant) ? '<button class="btn btn-ember btn-small" data-action="heat">加热</button>' : ''}
      <button class="btn btn-ghost btn-small" data-action="to-rack" data-id="${sw.id}">上架</button>
      <button class="btn btn-ghost btn-small" data-action="to-tribute" data-id="${sw.id}">献台</button>
      <button class="btn btn-ghost btn-small" data-action="take-anvil">取走</button>
    `;
  } else {
    $('#sword-family').textContent = '未放置';
    $('#sword-name').textContent = '等待一把剑';
    $('#sword-subline').textContent = '—';
    $('#sword-chips').innerHTML = '';
    $('#stat-level').textContent = '+0';
    $('#stat-value').textContent = '— G';
    $('#stat-value-note').textContent = '';
    $('#sword-history').textContent = '历史最高 —';
    $('#charge-pips').innerHTML = new Array(10).fill('<i></i>').join('');
    $('#charge-count').textContent = '0 / 10';
    $('#layer-chips').innerHTML = '';
    $('#sword-actions').innerHTML = '';
  }
  renderProbabilities(app, sw);
  renderConsumables(app, sw);
  renderControls(app, sw);
  renderBuffStrip(app);
  renderMobileBar(app, sw);
}

function stageChips(app, sw) {
  const s = app.state;
  const chips = [];
  if (sw.remnant) {
    chips.push(`<span class="chip gold">残骸贡品</span>`);
    return chips.join('');
  }
  if (sw.heat || E.hasRelic(s, 'lifetime-contract')) chips.push(`<span class="chip hot"><img src="./assets/ui/flame.svg" alt="">已加热</span>`);
  if (sw.charge >= 10) chips.push(`<span class="chip gold"><img src="./assets/ui/charge.svg" alt="">入神就绪</span>`);
  if (E.hasRelic(s, 'phoenix-ash') && !sw.protections.phoenixUsed) chips.push(`<span class="chip">凤凰之灰可用</span>`);
  if (E.hasRelic(s, 'unyielding-cornerstone') && !sw.protections.cornerstoneUsed) chips.push(`<span class="chip">基石可挡一次碎</span>`);
  if (E.hasRelic(s, 'giants-spine') && sw.protections.spineCharges > 0) chips.push(`<span class="chip good">脊骨已蓄</span>`);
  if (E.hasRelic(s, 'abyssal-pearl') && sw.protections.pearlBlocks < 2 && sw.level > 0) chips.push(`<span class="chip good">珍珠护级 ${2 - sw.protections.pearlBlocks}</span>`);
  if (sw.layers.splice > 0) chips.push(`<span class="chip good">减碎 ${Math.min(60, sw.layers.splice * 15)}%</span>`);
  if (sw.lastResult) chips.push(`<span class="chip">上一锤：${PHASE_NAMES[sw.lastResult]}</span>`);
  return chips.join('');
}

function layerChips(app, sw) {
  const s = app.state;
  const out = [];
  if (sw.store.successLevels) out.push(`<span class="chip">小风铃储级 ${sw.store.successLevels}</span>`);
  if (sw.store.sealedGreatLevels) out.push(`<span class="chip gold">封印之心储级 ${sw.store.sealedGreatLevels}</span>`);
  if (sw.store.defeatedGreatLevels) out.push(`<span class="chip gold">玉玺储级 ${sw.store.defeatedGreatLevels}</span>`);
  if (sw.layers.greatSigns) out.push(`<span class="chip gold">本剑大成功签 +${sw.layers.greatSigns}</span>`);
  if (sw.layers.successSigns) out.push(`<span class="chip good">本剑成功签 +${sw.layers.successSigns}</span>`);
  if (sw.layers.scorched) out.push(`<span class="chip good">焦黑减碎 ${sw.layers.scorched * 3}%</span>`);
  if (sw.counters.normalSuccesses) out.push(`<span class="chip">普通成功累计 ${sw.counters.normalSuccesses}</span>`);
  if (!out.length) out.push(`<span class="chip" style="opacity:.5">暂无本剑层数</span>`);
  return out.join('');
}

function renderProbabilities(app, sw) {
  const s = app.state;
  const bars = $('#prob-bars');
  const signs = $('#prob-signs');
  const foot = $('#prob-foot');
  if (!sw) {
    signs.innerHTML = '';
    bars.innerHTML = `<div class="empty-state">铁砧上还没有剑。<br>下一锤的概率会显示在这里。</div>`;
    foot.innerHTML = '';
    $('#prob-note').textContent = '等级越高，破碎越危险';
    return;
  }
  if (sw.remnant) {
    signs.innerHTML = '';
    bars.innerHTML = `<div class="empty-state">残骸无法锻造，只能用于进贡或兑换剑币。</div>`;
    foot.innerHTML = '';
    return;
  }
  const dist = E.previewDistribution(s);
  const notes = [];
  notes.push(`基础破碎 ${E.breakChanceBase(sw.level).toFixed(1)}%`);
  if (dist.breakRel < 1) notes.push(`相对减碎 ×${(dist.breakRel).toFixed(2)}`);
  if (s.frenzy.active) notes.push('入神中，破碎已移除');
  if (s.anvilBuffs.protectBreak) notes.push('龙鳞保护下一锤');
  if (s.anvilBuffs.powder) notes.push('粉末袋：成功→大成功，其余→破碎');
  if (s.anvilBuffs.redChalk) notes.push('红粉笔：大成功签翻倍');
  $('#prob-note').textContent = s.frenzy.active ? '入神中 · 无破碎' : `${PHASE_NAMES[sw.lastResult] ? '上锤 ' + PHASE_NAMES[sw.lastResult] + ' · ' : ''}等级 +${sw.level}`;
  signs.innerHTML = PHASE_ORDER.map(k => `<span class="sign-pill ${k}" ${tip(`${PHASE_NAMES[k]}签：${dist.counts[k]} 张（破碎按等级权重放大）`)}>${PHASE_NAMES[k]}<b>${Math.round(dist.counts[k] * 10) / 10}</b></span>`).join('');
  bars.innerHTML = PHASE_ORDER.map(k => `
    <div class="prob-row ${k}">
      <span class="plabel">${PHASE_NAMES[k]}</span>
      <span class="pbar"><i style="width:${dist.percents[k]}%"></i></span>
      <span class="pval">${dist.percents[k].toFixed(1)}%</span>
    </div>`).join('');
  foot.innerHTML = `<span>${notes.slice(0, 2).join(' · ')}</span><span class="${dist.percents.break >= 35 ? 'danger' : 'gold'}">${notes.slice(2).join(' · ') || '破碎结果会让剑消失'}</span>`;
}

function renderConsumables(app, sw) {
  const s = app.state;
  const row = $('#consume-row');
  const items = CONSUMABLE_ORDER.map((key, i) => {
    const c = CONSUMABLES[key];
    const count = s.consumables[key] || 0;
    const reason = consumeDisabledReason(app, key);
    const buffed = (key === 'cracked_dragon_scale' && s.anvilBuffs.protectBreak) || (key === 'red_chalk' && s.anvilBuffs.redChalk) || (key === 'powder_pouch' && s.anvilBuffs.powder);
    return `<button class="consume-slot${count ? '' : ' disabled'}${buffed ? ' active-buff' : ''}" data-action="use-consumable" data-key="${key}" ${tip(`${consumableTip(key)}${count ? '<div class="tt-meta">剩余 <b>' + count + '</b> · 快捷键 ' + (i + 1) + '</div>' : '<div class="tt-meta">未持有</div>'}${reason ? '<div class="tt-meta" style="color:#e05a4f">' + esc(reason) + '</div>' : ''}`)}>
      <span class="slot-key">${i + 1}</span>
      <img src="${consumableIcon(key)}" alt="">
      <span class="count">${count}</span>
    </button>`;
  }).join('');
  row.innerHTML = `<span class="consume-label">铁砧道具</span>${items}`;
}

function renderControls(app, sw) {
  const s = app.state;
  const heat = $('#btn-heat');
  const hammer = $('#btn-hammer');
  const reason = hammerDisabledReason(app);
  hammer.disabled = Boolean(reason);
  hammer.title = reason || '挥锤 (Space)';
  hammer.querySelector('.hammer-label b').textContent = s.frenzy.active ? '连续挥锤' : '挥锤';
  const take = $('#btn-take');
  take.disabled = !sw;
  const rewind = $('#btn-rewind');
  const clockworks = s.consumables.regret_clockwork || 0;
  rewind.disabled = !E.hasRewindAvailable(s);
  rewind.textContent = clockworks ? `回溯 ×${clockworks}` : '回溯';
  rewind.title = !s.hammerSnapshot ? '先挥一锤才能回溯' : clockworks ? '悔恨发条：撤回上一锤' : '需要悔恨发条';
  const merchant = $('#btn-merchant');
  merchant.disabled = !s.merchant;
  merchant.textContent = s.merchant ? '幽灵商人到访' : '幽灵商人';
  merchant.classList.toggle('btn-primary', Boolean(s.merchant));
  merchant.classList.toggle('btn-ghost', !s.merchant);
  const heatReason = !sw ? '先在铁砧上放一把剑' : sw.remnant ? '残骸无法加热' : sw.heat ? '已经加热好了' : '';
  heat.disabled = Boolean(heatReason) || s.phase !== 'playing';
  heat.title = heatReason || '加热铁砧上的剑 (H)';
}

function renderBuffStrip(app) {
  const s = app.state;
  const el = $('#buff-strip');
  const buf = [];
  if (s.anvilBuffs.protectBreak) buf.push('龙鳞：下一锤阻止破碎');
  if (s.anvilBuffs.redChalk) buf.push('红粉笔：大成功签翻倍');
  if (s.anvilBuffs.powder) buf.push('粉末袋：二分赌局');
  if (s.frenzy.active) buf.push('入神进行中');
  const last = s.lastHammer;
  if (last && Date.now() - last.at < 9000) {
    const trig = last.triggers.filter(t => t.type !== 'charge').slice(0, 4).map(t => t.text);
    if (trig.length) buf.push(`本锤：${trig.join(' · ')}`);
  }
  el.innerHTML = buf.map(t => `<span class="buff-chip">${esc(t)}</span>`).join('');
}

export function renderRight(app) {
  const s = app.state;
  const content = $('#right-content');
  $$('.right-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === app.rightTab));
  const merchantBanner = s.merchant
    ? `<div class="merchant-banner" data-action="open-merchant">
        <img src="./assets/scene/merchant.svg" alt="">
        <div><strong>幽灵商人来访</strong><span>第 ${s.day} 天 · 用金币交易 · 摊位还亮着</span></div>
        <span class="arrow">查看 →</span>
      </div>`
    : '';
  if (app.rightTab === 'relics') {
    content.innerHTML = merchantBanner + renderRelicRack(app);
    return;
  }
  if (s.day < 2) {
    content.innerHTML = `${merchantBanner}<div class="shop-empty">
      <img src="./assets/scene/vending.svg" alt="">
      <div>遗物商亭 <b>第 2 天</b>开门。</div>
      <div style="font-size:9px;color:var(--muted-2);margin-top:4px">开局的三件免费遗物已经选过了。<br>明天开始，用剑币购买新的遗物。</div>
    </div>`;
    return;
  }
  const items = s.shop.items || [];
  const slotsFull = s.relics.length >= RELIC_SLOTS;
  const list = items.map((item, i) => {
    if (!item) return `<div class="shop-empty" style="padding:14px">商品位空了</div>`;
    const r = RELIC_BY_ID[item.relicId];
    if (!r) return '';
    const sold = item.sold;
    const cannotCoins = s.coins < item.price;
    let reason = '';
    if (sold) reason = '已售出';
    else if (slotsFull) reason = '遗物架已满';
    else if (cannotCoins) reason = '剑币不足';
    return `<div class="shop-item ${sold ? 'sold' : ''} rarity-${r.rarity}">
      <div class="shop-icon" data-action="open-relic" data-id="${r.id}" ${tip(relicTip(r.id))}><img src="${relicIcon(r.id)}" alt=""></div>
      <div>
        <div class="shop-name">${esc(r.zh)}<span class="rarity-label">${RARITIES[r.rarity].zh}</span></div>
        <div class="shop-desc">${esc(r.desc)}</div>
      </div>
      <div class="shop-buy">
        <span class="shop-price"><img src="./assets/ui/swordcoin.svg" alt="">${item.price}</span>
        <button class="btn btn-primary btn-small" data-action="buy-relic" data-index="${i}" ${sold || cannotCoins ? 'disabled' : ''} title="${slotsFull ? '遗物架已满：点击后可先丢弃一件' : (reason || '购买')}">${sold ? '已售' : slotsFull ? '换遗物' : '购买'}</button>
      </div>
    </div>`;
  }).join('');
  const free = E.hasRelic(s, 'worn-voucher') && !s.shop.freeRerollUsed;
  const cost = E.rerollCost(s);
  const canReroll = free || s.gold >= cost;
  const reroll = `<div class="reroll-row">
    <span class="reroll-cost">${free ? '<span style="color:var(--gold)">磨旧的兑换券：本次免费</span>' : `<img src="./assets/ui/gold.svg" alt="">${fmt(cost)} G · 已刷 ${s.shop.paidRerolls} 次`}</span>
    <button class="btn btn-ghost btn-small" data-action="reroll-shop" ${canReroll ? '' : 'disabled'}>刷新商亭</button>
  </div>`;
  content.innerHTML = `${merchantBanner}
    <div class="shop-head"><span class="shop-title">遗物商亭 <span class="shop-sub">第 ${s.day} 天</span></span><span class="coin-count"><img src="./assets/ui/swordcoin.svg" alt="">${s.coins}</span></div>
    <div class="shop-list">${list || '<div class="shop-empty">今天没有可出售的遗物。</div>'}</div>
    ${reroll}
    <div class="relic-tab-note">遗物槽 <b>${s.relics.length}/${RELIC_SLOTS}</b>。满槽时先丢弃旧遗物；丢弃没有退款。${slotsFull ? '<br><span style="color:#e05a4f">遗物架已满，购买前请先丢弃。</span>' : ''}</div>`;
}

function renderRelicRack(app) {
  const s = app.state;
  const relics = s.relics;
  let grid = '';
  for (let i = 0; i < RELIC_SLOTS; i++) {
    const id = relics[i];
    if (id) {
      const r = RELIC_BY_ID[id];
      grid += `<div class="relic-slot ${r.rarity}" data-action="open-relic" data-id="${id}" ${tip(relicTip(id))}>
        <img src="${relicIcon(id)}" alt="">
      </div>`;
    } else {
      grid += `<div class="relic-slot empty"></div>`;
    }
  }
  const list = relics.map(id => {
    const r = RELIC_BY_ID[id];
    return `<div class="kv-row"><span>${esc(r.zh)} <span class="rarity-label" style="font-size:7px;color:${RARITIES[r.rarity].color}">${RARITIES[r.rarity].zh}</span></span><button class="mini-btn" data-action="open-relic" data-id="${id}">查看</button></div>`;
  }).join('');
  return `<div class="shop-head"><span class="shop-title">持有遗物</span><span class="coin-count">${relics.length} / ${RELIC_SLOTS}</span></div>
    <div class="relic-grid">${grid}</div>
    <div class="relic-tab-note">持续生效的遗物会随丢弃而失去。已为本局永久获得的签不会因丢弃而消失。<br><b>点击图标</b>查看效果并丢弃。</div>
    <div style="margin-top:10px">${list || '<div class="empty-state" style="padding:16px">还没有遗物。</div>'}</div>`;
}

function renderTribute(app) {
  const s = app.state;
  const quota = E.currentQuota(s);
  const swords = E.tributeSwords(s);
  const total = swords.reduce((sum, sw) => sum + E.swordValue(s, sw), 0);
  const drop = $('#tribute-drop');
  drop.classList.toggle('empty', swords.length === 0);
  drop.innerHTML = swords.map(sw => `<div class="tribute-sword" ${tip(swordTip(app, sw))}>
    <img src="${swordArtPath(sw)}" alt="">
    <div class="ts-name">${esc(E.swordDisplayName(sw))}</div>
    <span class="ts-value">+${sw.level} · ${compact(E.swordValue(s, sw))} G</span>
    <button class="ts-remove" data-action="from-tribute" data-id="${sw.id}" title="取回">×</button>
  </div>`).join('');
  $('#tribute-quota').textContent = `${fmt(quota)} G`;
  $('#tribute-meta').textContent = `${swords.length} 把剑 · 合计 ${fmt(total)} G`;
  $('#tribute-total').textContent = `${fmt(total)} G`;
  const diff = total - quota;
  const diffEl = $('#tribute-diff');
  if (diff >= 0) {
    diffEl.textContent = `已足额 · 超出 ${fmt(diff)} G`;
    diffEl.style.color = 'var(--green)';
  } else {
    diffEl.textContent = `还差 ${fmt(-diff)} G`;
    diffEl.style.color = 'var(--red)';
  }
  const bell = $('#btn-bell');
  bell.disabled = s.phase !== 'playing';
  bell.classList.toggle('ready', diff >= 0);
  $('#tribute-bar').classList.toggle('full', diff >= 0);
  $('#tribute-total').parentElement.classList.toggle('short', diff < 0);
}

export function renderMobileBar(app, sw) {
  const s = app.state;
  const name = document.getElementById('mab-name');
  const meta = document.getElementById('mab-meta');
  const heat = document.getElementById('mab-heat');
  const hammer = document.getElementById('mab-hammer');
  if (!name || !meta || !heat || !hammer) return;
  if (!sw) {
    name.textContent = '铁砧空着';
    meta.textContent = '去「库存」把剑放上铁砧';
    heat.disabled = true;
    hammer.disabled = true;
    return;
  }
  name.textContent = `+${sw.level} ${E.swordDisplayName(sw)}`;
  const dist = E.previewDistribution(s);
  meta.textContent = `${compact(E.swordValue(s, sw))} G · 充能 ${sw.charge}/10 · 碎 ${dist ? dist.percents.break.toFixed(1) : 0}%`;
  const heatReason = sw.remnant ? '残骸' : sw.heat ? '已加热' : E.hasRelic(s, 'lifetime-contract') ? '免加热' : '';
  heat.disabled = Boolean(heatReason) || s.phase !== 'playing';
  heat.textContent = heatReason || '加热';
  const reason = hammerDisabledReason(app);
  hammer.disabled = Boolean(reason);
  hammer.textContent = reason && reason.includes('回气') ? '回气…' : s.frenzy.active ? '连锤' : '挥锤';
}

export function updateTimers(app) {
  const s = app.state;
  if (!s) return;
  const now = Date.now();
  const layer = $('#frenzy-layer');
  if (layer) layer.classList.toggle('active', s.frenzy.active);
  if (s.frenzy.active) {
    const remain = Math.max(0, s.frenzy.endsAt - now);
    const totalMs = s.frenzy.endsAt - (s.frenzy.endsAt - (s.frenzyTotal || 0));
    const t = $('#frenzy-time');
    if (t) t.textContent = `${(remain / 1000).toFixed(1)}s`;
    const fill = $('#frenzy-fill');
    if (fill) fill.style.width = `${Math.min(100, remain / (E.frenzyDuration(s) || 4000) * 100)}%`;
  }
  const mabHammer = document.getElementById('mab-hammer');
  if (mabHammer) {
    const reason = hammerDisabledReason(app);
    mabHammer.disabled = Boolean(reason);
    mabHammer.textContent = reason && reason.includes('回气') ? '回气…' : app.state.frenzy.active ? '连锤' : '挥锤';
    const mabMeta = document.getElementById('mab-meta');
    const sword = E.getAnvilSword(app.state);
    if (mabMeta && sword) {
      const dist = E.previewDistribution(app.state);
      mabMeta.textContent = `${compact(E.swordValue(app.state, sword))} G · 充能 ${sword.charge}/10 · 碎 ${dist ? dist.percents.break.toFixed(1) : 0}%`;
    }
  }
  const hammer = $('#btn-hammer');
  if (hammer) {
    const reason = hammerDisabledReason(app);
    hammer.disabled = Boolean(reason);
    hammer.title = reason || '挥锤 (Space)';
    const remaining = Math.max(0, (s.cooldownUntil || 0) - now);
    const interval = s.lastHammer?.inFrenzy ? 500 : 640;
    const sweep = $('#cooldown-sweep');
    if (sweep) sweep.style.width = remaining > 0 ? `${Math.min(100, remaining / interval * 100)}%` : '0%';
  }
  renderSyncBadge(app);
}

export function renderMenu(app) {
  const userEl = $('#menu-username');
  if (userEl) userEl.textContent = app.user?.username || '—';
  const slots = $('#slots-grid');
  if (!slots) return;
  const saves = app.saves || [];
  let html = '';
  for (let slot = 1; slot <= 3; slot++) {
    const save = saves.find(x => x.slot === slot);
    if (!save || !save.state) {
      html += `<div class="slot-empty" data-action="slot-new" data-slot="${slot}">
        <div class="plus-mark">+</div>
        <strong>空契约位</strong>
        <span style="font-size:10px;color:var(--muted-2)">开始一份新的 21 天契约</span>
        <span style="font-size:9px;color:var(--gold-dark);letter-spacing:.1em">签订新契约</span>
      </div>`;
      continue;
    }
    const st = save.state;
    const meta = save.meta || {};
    const phase = st.phase || meta.phase || 'playing';
    const sw = bestSword(st);
    const art = sw ? swordArtPath(sw) : './assets/swords/citadel_s0.svg';
    const phaseClass = phase === 'dead' ? 'dead' : phase === 'victory' ? 'victory' : '';
    const stateLabel = phase === 'dead' ? '已阵亡' : phase === 'victory' ? '契约完成' : phase === 'select' ? '待开局' : '进行中';
    const kindLabel = save.saveKind || '';
    html += `<div class="slot-card ${phaseClass}" data-slot="${slot}">
      <div class="slot-scene">
        <img src="./assets/scene/${phase === 'dead' ? 'dragon_rage' : phase === 'victory' ? 'dragon_calm' : 'background'}.svg" alt="">
        <div class="slot-day"><strong>第 ${meta.day || st.day || '—'} 天</strong><span>${esc(meta.date || '')}</span></div>
      </div>
      <div class="slot-top">
        <span class="slot-index">CONTRACT 0${slot}</span>
        <span class="slot-state">${stateLabel}</span>
        <button class="mini-btn" data-action="slot-delete" data-slot="${slot}" title="删除存档" style="margin-left:6px">×</button>
      </div>
      <div class="slot-weapon"><img src="${art}" alt=""></div>
      <div class="slot-title">${esc(sw ? E.swordDisplayName(sw) : '尚未落锤')}</div>
      <div class="slot-sub">${phase === 'dead' ? '巨龙收走了这座工坊。' : phase === 'victory' ? '你活过了 5 月 5 日。' : phase === 'select' ? '初始遗物还在等你。' : `遗物 ${meta.relics ?? st.relics?.length ?? 0}/8 · 巨龙怒气 ${meta.anger ?? st.anger ?? 0}/3`}</div>
      <div class="slot-stats">
        <div class="slot-stat"><span>金币</span><b>${compact(meta.gold ?? st.gold ?? 0)}</b></div>
        <div class="slot-stat"><span>剑币</span><b>${compact(meta.coins ?? st.coins ?? 0)}</b></div>
        <div class="slot-stat"><span>怒气</span><b>${meta.anger ?? st.anger ?? 0} / 3</b></div>
        <div class="slot-stat"><span>更新时间</span><b style="font-size:8px">${relativeTime(save.updatedAt)}</b></div>
      </div>
      <div class="slot-actions">
        <button class="btn btn-primary btn-small" data-action="slot-load" data-slot="${slot}">${phase === 'select' ? '继续开局' : phase === 'dead' || phase === 'victory' ? '查看结局' : '继续铁匠'}</button>
        <button class="btn btn-ghost btn-small" data-action="slot-new" data-slot="${slot}">新契约</button>
      </div>
    </div>`;
  }
  slots.innerHTML = html;

  const codex = mergedCodex(app);
  const ach = achievementMap(app);
  const relicCount = Object.keys(codex.relics || {}).length;
  const swordCount = Object.keys(codex.swords || {}).length;
  const achCount = Object.keys(ach).length;
  const stats = app.profile?.stats || {};
  const summary = $('#profile-summary');
  if (summary) {
    summary.innerHTML = `
      <div class="profile-stat"><span>契约完成</span><b>${stats.contracts || (ach['clocking_out'] ? 1 : 0)}</b></div>
      <div class="profile-stat"><span>最佳天数</span><b>${stats.bestDay || 0}</b></div>
      <div class="profile-stat"><span>成就</span><b>${achCount} / 19</b></div>
      <div class="profile-stat"><span>剑系发现</span><b>${swordCount} / 9</b></div>
      <div class="profile-stat"><span>遗物发现</span><b>${relicCount} / 94</b></div>
      <div class="profile-stat"><span>开局次数</span><b>${stats.runs || 0}</b></div>`;
  }
  const sync = $('#menu-sync');
  if (sync) {
    sync.innerHTML = app.sync === 'offline'
      ? '<span style="color:var(--red)">云端离线，改动可能未上传</span>'
      : app.sync === 'saving' ? '正在同步到云端…' : '<span class="ok">云端已连接 · 三槽共享图鉴</span>';
  }
  renderSyncBadge(app);
}

export function renderTutorial(app) {
  const layer = $('#tutorial-layer');
  if (!layer) return;
  const data = tutorialObjective(app.state);
  $$('.guide-target').forEach(el => el.classList.remove('guide-target'));
  $('#screen-game').classList.toggle('guide-on', Boolean(data && !app.modal));
  if (!data || app.modal) {
    layer.classList.add('hidden');
    layer.innerHTML = '';
    return;
  }
  if (app._tutorialKey !== data.key && window.innerWidth <= 800) {
    app.mobileTab = data.tab;
    applyMobileTab(app);
  }
  app._tutorialKey = data.key;
  layer.classList.remove('hidden');
  const target = window.innerWidth <= 800
    ? { place: '#inventory-grid', heat: '#mab-heat', hammer: '#mab-hammer', tribute: '#tribute-drop', bell: '#btn-bell', recover: '#btn-bell' }[data.key]
    : { place: '#inventory-grid', heat: '#btn-heat', hammer: '#btn-hammer', tribute: '#tribute-drop', bell: '#btn-bell', recover: '#btn-bell' }[data.key];
  if (target) $(target)?.classList.add('guide-target');
  layer.innerHTML = `
    <section class="tutorial-card" aria-label="首日实操引导">
      <div class="tutorial-progress" aria-label="第 ${data.step + 1} 步，共 6 步">${['拿剑','加热','锻造','献贡','敲铃','次日'].map((name, i) => `<span class="${i < data.step ? 'done' : i === data.step ? 'current' : ''}">${name}</span>`).join('')}</div>
      <h4 aria-live="polite">${esc(data.title)}</h4>
      <p>${esc(data.text)}</p>
      <div class="tutorial-actions">
        <button class="btn btn-ghost btn-small" data-action="tutorial-skip">跳过 (P)</button>
        <button class="btn btn-primary btn-small" data-action="tutorial-do">${esc(data.label)}</button>
      </div>
    </section>`;
}

export function toast(app, title, message = '', kind = 'info', duration = 3800) {
  const root = $('#toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<strong>${esc(title)}</strong>${message ? `<span>${esc(message)}</span>` : ''}`;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 280);
  }, duration);
}

export function setAuthMode(app, mode) {
  app.authMode = mode;
  $$('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.authTab === mode));
  $('#auth-confirm-field').classList.toggle('hidden', mode !== 'register');
  $('#auth-submit').textContent = mode === 'register' ? '写下名字，签下契约' : '推开工坊的门';
  const pwd = $('#auth-password');
  pwd.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
  $('#auth-error').textContent = '';
}

export function showAuthError(msg) {
  const el = $('#auth-error');
  if (el) el.textContent = msg || '';
}

export function setScreen(app, name) {
  for (const id of ['landing', 'menu', 'game']) {
    const el = $(`#screen-${id}`);
    if (el) el.classList.toggle('hidden', id !== name);
  }
  app.screen = name;
  document.body.dataset.screen = name;
  document.body.style.overflow = '';
  window.scrollTo(0, 0);
  document.querySelector('.menu-shell')?.scrollTo?.(0, 0);
  const modal = document.getElementById('modal-root');
  if (modal) modal.scrollTop = 0;
  if (name === 'game') {
    app.audio?.startAmbience();
  } else {
    app.audio?.stopAmbience();
  }
}
