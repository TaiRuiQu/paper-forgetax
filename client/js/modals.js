import {
  E, RELIC_BY_ID, RELICS, SWORD_FAMILIES, RARITIES, ACHIEVEMENTS, ACHIEVEMENT_BY_ID,
  CONSUMABLES, FAMILY_ORDER, fmt, compact, esc, tip, relicTip, relicIcon, consumableIcon,
  achievementIcon, swordArtPath, rarityOf, mergedCodex, achievementMap, phaseLabel, consumeDisabledReason,
} from './helpers.js';
import { TRIBUTE_DAYS, dayInfo } from '../shared/data/gameData.js';
import { canVibrate, isTouchDevice, fullscreenSupported } from './device.js';

const $ = sel => document.querySelector(sel);

const MODAL_BACKDROP_CLOSE = true;

function showModal(app, type, payload = {}, options = {}) {
  if (!app._modalPaused) {
    app.pauseClock?.();
    app._modalPaused = true;
  }
  app.modal = { type, payload, options };
  document.getElementById('app').inert = true;
  document.getElementById('tooltip')?.classList.add('hidden');
  document.body.classList.add('modal-open');
  renderModal(app);
  app.renderTutorial?.();
  setTimeout(() => {
    const frame = $('.modal-frame');
    if (frame) frame.querySelector('.modal-close, .btn')?.focus?.();
  }, 20);
}

export function closeModal(app) {
  app.modal = null;
  document.getElementById('app').inert = false;
  document.body.classList.remove('modal-open');
  const root = $('#modal-root');
  if (root) root.innerHTML = '';
  if (app._modalPaused) {
    app._modalPaused = false;
    app.resumeClock?.();
  }
  app.renderTutorial?.();
}

export function refreshModal(app) {
  if (app.modal) renderModal(app);
}

function shell({ title, subtitle = '', eyebrow = '', body = '', footer = '', size = '', closable = true }) {
  const close = closable
    ? `<button class="modal-close" data-action="close-modal" title="关闭 (Esc)"><span aria-hidden="true">×</span><span class="sr-only">关闭</span></button>`
    : '';
  return `<div class="modal-backdrop" data-modal-backdrop>
    <section class="modal-frame ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-head">
        <div>${eyebrow ? `<div class="modal-eyebrow">${esc(eyebrow)}</div>` : ''}<h2 class="modal-title">${esc(title)}</h2>${subtitle ? `<div class="modal-sub">${esc(subtitle)}</div>` : ''}</div>
        ${close}
      </header>
      <div class="modal-body">${body}</div>
      ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
    </section>
  </div>`;
}

function renderModal(app) {
  const root = $('#modal-root');
  if (!root || !app.modal) return;
  const cfg = build(app, app.modal.type, app.modal.payload, app.modal.options);
  if (!cfg) { root.innerHTML = ''; return; }
  root.innerHTML = shell(cfg);
  const backdrop = root.querySelector('[data-modal-backdrop]');
  if (backdrop && cfg.closable !== false && MODAL_BACKDROP_CLOSE) {
    // Close on the click itself (not on press), so a tap on the backdrop is
    // fully consumed and cannot land on the workshop underneath.
    let pressedBackdrop = false;
    backdrop.addEventListener('pointerdown', e => { pressedBackdrop = e.target === backdrop; });
    backdrop.addEventListener('click', e => {
      if (pressedBackdrop && e.target === backdrop) closeModal(app);
      pressedBackdrop = false;
    });
  }
}

function build(app, type, payload, options) {
  switch (type) {
    case 'intro': return buildIntro(app);
    case 'startRelic': return buildStartRelic(app, payload, options);
    case 'merchant': return buildMerchant(app, payload, options);
    case 'codex': return buildCodex(app, payload, options);
    case 'achievements': return buildAchievements(app, payload, options);
    case 'calendar': return buildCalendar(app, payload, options);
    case 'relic': return buildRelicDetail(app, payload, options);
    case 'confirm': return buildConfirm(app, payload, options);
    case 'daySummary': return buildDaySummary(app, payload, options);
    case 'victory': return buildVictory(app, payload, options);
    case 'death': return buildDeath(app, payload, options);
    case 'menu': return buildMenu(app, payload, options);
    case 'settings': return buildSettings(app, payload, options);
    case 'howto': return buildHowTo(app, payload, options);
    case 'log': return buildLog(app, payload, options);
    case 'kit': return buildKit(app, payload, options);
    case 'discardPick': return buildDiscardPick(app, payload, options);
    case 'discardOwned': return buildDiscardOwned(app, payload, options);
    default: return null;
  }
}

// ---------------------------------------------------------------- start relic
export function openIntro(app) {
  showModal(app, 'intro', {}, { closable: false });
}

function buildIntro() {
  return {
    title: '这间工坊，已经不属于你。',
    closable: false,
    size: 'intro-frame',
    body: `<div class="intro-story">
      <p>巨龙占据了山头，也接管了你的炉火。</p>
      <p>你是留下来的铁匠。每天，三把新剑会送到门前。<br>你要加热、挥锤，把它们锻成足够值钱的贡品。</p>
      <p>交不够，巨龙便记下一次警告。<br><strong>第三次，它会连你一起收走。</strong></p>
      <p class="intro-contract">从 4 月 15 日，到 5 月 5 日。<br><b>撑过这 21 天，完成你的契约。</b></p>
      <span class="intro-hint">炉火还亮着。今天，先活下来。</span>
    </div>`,
    footer: '<button class="btn btn-primary" data-action="intro-enter">点燃炉火，走进工坊</button>',
  };
}

export function openStartRelic(app) {
  showModal(app, 'startRelic', {}, { closable: false });
}

function buildStartRelic(app) {
  const state = app.state;
  const cards = state.startingChoices.map(id => {
    const r = RELIC_BY_ID[id];
    return `<div class="start-relic rarity-${r.rarity}">
      <span class="rarity-label" style="color:${RARITIES[r.rarity].color};border-color:currentColor">${RARITIES[r.rarity].zh}</span>
      <div class="big-icon"><img src="${relicIcon(id)}" alt=""></div>
      <h4>${esc(r.zh)}</h4>
      <div class="en">${esc(r.en)}</div>
      <p>${esc(r.desc)}</p>
      <button class="btn btn-primary btn-small" data-action="choose-start-relic" data-id="${id}">选它开局</button>
    </div>`;
  }).join('');
  return {
    title: '开局三选一',
    eyebrow: 'FREE STARTING RELIC',
    subtitle: '免费选一件遗物带走。不能刷新；选中后另外两件会消失。',
    size: 'wide',
    closable: false,
    body: `<div class="start-hero"><h3>巨龙的账本已经摊开。</h3><p>选一件遗物，撑过接下来的 21 天。</p></div><div class="start-relics">${cards}</div>`,
    footer: `<span style="font-size:10px;color:var(--muted-2);flex:1">初始选择独立于后续商店。第 2 天起，遗物商亭开门。</span>`,
  };
}

// ---------------------------------------------------------------- merchant
export function openMerchant(app) {
  if (!app.state.merchant) {
    app.toast?.('幽灵商人不在', '他在第 3、6、9、12、15、18、21 天到访。', 'info');
    return;
  }
  showModal(app, 'merchant');
}

function merchantItemArt(item) {
  if (item.kind === 'consumable') return consumableIcon(item.key);
  if (item.family) {
    const fake = { family: item.family, merchant: true, historyMaxLevel: item.level, remnant: false, route: SWORD_FAMILIES[item.family].route };
    return swordArtPath(fake);
  }
  return './assets/swords/citadel_s0.svg';
}

function buildMerchant(app) {
  const s = app.state;
  const m = s.merchant;
  if (!m) return { title: '幽灵商人', body: '<div class="empty-state">商人已经离开了。</div>', size: 'medium' };
  const items = m.items.map((item, i) => {
    const sold = item.stock <= 0;
    const canAfford = s.gold >= item.price;
    let desc = '';
    if (item.kind === 'sword' && item.sub === 'base') desc = '随机普通剑，+0，含隐藏剑系分支。可追加购买（单价 ×3）。';
    else if (item.kind === 'sword') desc = `${SWORD_FAMILIES[item.family].zh} · +${item.level} · 商人专属剑系，基础价值 640 G。`;
    else desc = CONSUMABLES[item.key]?.desc || '';
    const iconClass = item.kind === 'sword' ? 'sword' : '';
    return `<div class="merchant-item ${item.kind}${sold ? ' sold' : ''}">
      <div class="mi-icon ${iconClass}"><img src="${merchantItemArt(item)}" alt=""></div>
      <div>
        <h5>${esc(item.label)} ${item.kind === 'consumable' ? `<span style="font-size:8px;color:var(--muted-2)">${esc(CONSUMABLES[item.key]?.en || '')}</span>` : `<span style="font-size:8px;color:var(--muted-2)">+${item.level}</span>`}</h5>
        <div class="mi-meta">${esc(desc)}</div>
        <div class="mi-stock">库存 ${item.stock}${item.sub === 'base' ? ' · 追加单价递增' : ''}</div>
      </div>
      <div class="mi-buy">
        <div class="mi-price"><img src="./assets/ui/gold.svg" alt="">${fmt(item.price)}</div>
        <button class="btn ${canAfford && !sold ? 'btn-primary' : 'btn-ghost'} btn-small" data-action="buy-merchant" data-index="${i}" ${sold || !canAfford ? 'disabled' : ''} title="${sold ? '售罄' : canAfford ? '购买' : '金币不足'}">${sold ? '售罄' : '购买'}</button>
      </div>
    </div>`;
  }).join('');
  const allSold = m.items.every(i => i.stock <= 0);
  return {
    title: '幽灵商人',
    eyebrow: `VISIT ${m.visit} · DAY ${m.day}`,
    subtitle: allSold ? '货架已经空了。他正把金币一枚枚收进袖子里。' : '他只收金币。同一商品追加购买时，单价会变成三倍。',
    size: 'wide',
    body: `<div class="merchant-layout">
      <div class="merchant-portrait">
        <img src="./assets/scene/merchant.svg" alt="">
        <div class="ghost-name">流浪的供货人</div>
        <div class="ghost-sub">“买吧。你还会再来的。”</div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span class="merchant-gold"><img src="./assets/ui/gold.svg" alt="">你的金币 ${fmt(s.gold)} G</span>
          ${allSold ? '<span class="chip gold">已买空本次库存</span>' : `<span style="font-size:9px;color:var(--muted-2)">买空全部库存可解锁成就</span>`}
        </div>
        <div class="merchant-items">${items}</div>
        <div class="modal-lore" style="margin-top:10px;font-size:9px">价格随当日贡额变化。遗忘之香只在你有怒气时出售，并且每局只能生效一次。</div>
      </div>
    </div>`,
    footer: `<button class="btn btn-ghost" data-action="close-modal">离开摊位</button>`,
  };
}

// ---------------------------------------------------------------- codex
export function openCodex(app, tab = 'swords') {
  showModal(app, 'codex', { tab }, { size: 'wide' });
}

function buildCodex(app, { tab = 'swords' }) {
  const codex = mergedCodex(app);
  const relicSeen = Object.keys(codex.relics || {}).length;
  const tabs = [
    ['swords', '剑系图鉴'], ['relics', `遗物 ${relicSeen}/94`], ['merchant', '商人物品'],
  ].map(([id, label]) => `<button class="codex-tab ${tab === id ? 'active' : ''}" data-action="codex-tab" data-tab="${id}">${label}</button>`).join('');
  let body = '';
  if (tab === 'swords') body = codexSwords(app, codex);
  else if (tab === 'relics') body = codexRelics(app, codex);
  else body = codexMerchant(app, codex);
  return {
    title: '工坊图鉴',
    eyebrow: 'THE CODEX',
    subtitle: '发现记录跨三份存档保存。未发现的内容以剪影显示。',
    size: 'wide',
    body: `<div class="codex-tabs">${tabs}</div>${body}`,
    footer: `<span style="flex:1;font-size:9px;color:var(--muted-2)">看到、买到或持有过的内容会点亮。掌握成就会把名作遗物加入后续商店池。</span><button class="btn btn-ghost btn-small" data-action="close-modal">合上</button>`,
  };
}

function codexSwords(app, codex) {
  const maxByFamily = codex.swords || {};
  const cards = FAMILY_ORDER.map(fam => {
    const f = SWORD_FAMILIES[fam];
    const max = maxByFamily[fam] ?? -1;
    const stages = f.stages.map((name, idx) => {
      const found = idx <= max;
      return `<img class="${found ? 'discovered' : ''}" src="./assets/swords/${fam}_s${idx}.svg" alt="${esc(found ? name : '未发现')}">`;
    }).join('');
    const names = f.stages.map((name, idx) => `<span class="${idx <= max ? 'discovered' : ''}">${idx <= max ? esc(name) : '???'}</span>`).join('');
    const ach = ACHIEVEMENTS.find(a => a.family === fam);
    const unlocked = ach && achievementMap(app)[ach.id];
    return `<div class="family-card ${max >= 0 ? 'discovered' : ''}">
      <div class="family-head"><h4>${esc(f.zh)}</h4><span>${esc(f.en).toUpperCase()}</span></div>
      <div class="family-stages">${stages}</div>
      <div class="family-stage-names">${names}</div>
      <p>${max >= 0 ? esc(f.desc) : '尚未揭示。将任意一把剑锻至 +10 即可发现剑系与中段外观。'}</p>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;font-size:8px;color:${unlocked ? 'var(--gold)' : 'var(--muted-2)'}">
        <span>${ach ? `+20 掌握 → ${RELIC_BY_ID[ach.unlock]?.zh || '—'}` : ''}</span><span>${unlocked ? '已掌握' : `已见 ${Math.max(0, max + 1)} / 6`}</span>
      </div>
    </div>`;
  }).join('');
  const discovered = FAMILY_ORDER.filter(f => (maxByFamily[f] ?? -1) >= 0).length;
  const finalForms = FAMILY_ORDER.filter(f => (maxByFamily[f] ?? -1) >= 5).length;
  return `<div class="codex-summary"><span>已发现剑系 <b>${discovered}/9</b></span><span>最终形态 <b>${finalForms}/9</b></span><span>每把剑的 +0/+2/+4/+6/+10/+20 外观都记录在案</span></div><div class="family-grid">${cards}</div>`;
}

function codexRelics(app, codex) {
  const cards = RELICS.map(r => {
    const found = Boolean(codex.relics?.[r.id]);
    let lock = '';
    if (!found && r.unlock) {
      const ach = ACHIEVEMENTS.find(a => a.unlock === r.id);
      lock = ach ? `需完成「${ach.zh}」` : '需要先解锁';
    }
    return `<div class="relic-codex ${found ? '' : 'unknown'} ${r.rarity}" data-action="open-relic" data-id="${r.id}" ${tip(found ? relicTip(r.id) : `<div class="tt-title">未发现的遗物</div><div class="tt-desc">在商店见到、获得或持有后点亮。</div>${lock ? `<div class="tt-meta">${esc(lock)}</div>` : ''}`)}>
      <img src="${relicIcon(r.id)}" alt="">
    </div>`;
  }).join('');
  const found = Object.keys(codex.relics || {}).length;
  const byRarity = ['common', 'rare', 'legendary'].map(k => `${RARITIES[k].zh} ${RELICS.filter(r => r.rarity === k && codex.relics?.[r.id]).length}/${RELICS.filter(r => r.rarity === k).length}`);
  return `<div class="codex-summary"><span>已发现遗物 <b>${found}/94</b></span>${byRarity.map(x => `<span>${x}</span>`).join('')}<span>点击图标查看详情</span></div><div class="relic-codex-grid">${cards}</div>`;
}

function codexMerchant(app, codex) {
  const seen = codex.merchant || {};
  const entries = [
    { key: 'base-sword', name: '基础剑', desc: '幽灵商人出售的普通剑，随机路线与隐藏分支。', icon: './assets/swords/citadel_s0.svg', sword: true },
    { key: 'special-sword', name: '商人专属剑', desc: '世界树、海产、殡葬三条剑系之一，基础价值 640 G。', icon: './assets/swords/world_tree_s0.svg', sword: true },
    ...Object.entries(CONSUMABLES).map(([key, c]) => ({ key, name: c.zh, desc: c.desc, icon: consumableIcon(key) })),
  ];
  const cards = entries.map(e => {
    const found = Boolean(seen[e.key]);
    return `<div class="merchant-codex-card ${found ? '' : 'unknown'}" ${tip(found ? `<div class="tt-title">${esc(e.name)}</div><div class="tt-desc">${esc(e.desc)}</div>` : '<div class="tt-title">未发现的商人物品</div><div class="tt-desc">在商人处见到后点亮。</div>')}>
      <img src="${e.icon}" style="${e.sword ? 'width:60px;height:34px' : ''}" alt="">
      <div><h5>${found ? esc(e.name) : '？？？'}</h5><p>${found ? esc(e.desc) : '尚未在幽灵商人处见过。'}</p></div>
    </div>`;
  }).join('');
  const found = entries.filter(e => seen[e.key]).length;
  return `<div class="codex-summary"><span>已发现商人物品 <b>${found}/${entries.length}</b></span><span>商人每 3 天到访一次</span><span>买空库存有隐藏成就</span></div><div class="merchant-codex-grid">${cards}</div>`;
}

// ---------------------------------------------------------------- achievements
export function openAchievements(app) {
  showModal(app, 'achievements', {}, { size: 'wide' });
}

function achievementReward(a) {
  if (!a.unlock) return '无对应遗物';
  const r = RELIC_BY_ID[a.unlock];
  return `解锁遗物：${r?.zh || a.unlock}`;
}

function buildAchievements(app) {
  const map = achievementMap(app);
  const cards = ACHIEVEMENTS.map(a => {
    const unlocked = Boolean(map[a.id]);
    return `<div class="achievement-card ${unlocked ? 'unlocked' : ''}">
      <img src="${achievementIcon(a.id)}" alt="">
      <div>
        <h5>${esc(a.zh)} <span class="en">${esc(a.en)}</span></h5>
        <p>${esc(a.desc)}</p>
        <div class="reward">${esc(achievementReward(a))}</div>
      </div>
    </div>`;
  }).join('');
  const count = Object.keys(map).length;
  return {
    title: '成就',
    eyebrow: 'ACHIEVEMENTS',
    subtitle: '达成后会把对应遗物解锁到后续商店池；不直接赠送。',
    size: 'wide',
    body: `<div class="codex-summary"><span>已解锁 <b>${count}/19</b></span><span>九条剑系各有 +20 掌握成就</span><span>成就跨三份存档共享</span></div><div class="achievements-grid">${cards}</div>`,
    footer: `<button class="btn btn-ghost btn-small" data-action="close-modal">合上</button>`,
  };
}

// ---------------------------------------------------------------- calendar
export function openCalendar(app) {
  showModal(app, 'calendar');
}

function buildCalendar(app) {
  const s = app.state;
  const rows = TRIBUTE_DAYS.map(d => {
    const today = d.day === s.day;
    const past = d.day < s.day;
    return `<tr class="${today ? 'today' : ''} ${past ? 'past' : ''}">
      <td>第 ${d.day} 天</td><td>${d.date}</td><td class="q">${fmt(d.quota)} G</td>
      <td>${d.merchant ? '<span class="merchant-tag">商人</span>' : '—'}</td>
      <td>${today ? '<span style="color:var(--gold)">今天</span>' : past ? '已过' : ''}</td>
    </tr>`;
  }).join('');
  let endless = '';
  if (s.day > 21) {
    const info = dayInfo(s.day);
    endless = `<tr class="today"><td>第 ${s.day} 天</td><td>${esc(info.date)}</td><td class="q">${fmt(E.currentQuota(s))} G</td><td>${info.merchant ? '<span class="merchant-tag">商人</span>' : '—'}</td><td>今天</td></tr>`;
  }
  const next = E.nextQuotaPreview(s);
  const anger = [0, 1, 2].map(i => `<i class="${i < s.anger ? 'lit' : ''}"></i>`).join('');
  return {
    title: '契约日历',
    eyebrow: 'THE CONTRACT',
    subtitle: '4 月 15 日 — 5 月 5 日，共 21 天。',
    size: 'medium',
    body: `<div class="cal-warning">
      <div class="cal-warn-row"><span>巨龙怒气</span><div class="anger-display">${anger}</div><b>第三档即死亡</b><span style="margin-left:auto;color:var(--gold)">今日 ${s.anger} / 3</span></div>
      <p>欠贡增加一档怒气。<b style="color:var(--bone)">第 21 天结算时，只要怒气没有进入致命阶段，即使当天贡品不足，也完成契约。</b></p>
      <p>下一次基础贡额：<b style="color:var(--gold)">${fmt(next.quota)} G</b>${next.carry ? `（王室零钱抵扣 ${fmt(next.carry)} G）` : ''}${next.merchant ? ' · 幽灵商人将到访' : ''}</p>
    </div>
    <div class="calendar-wrap"><table class="cal-table">
      <thead><tr><th>契约日</th><th>日期</th><th>基础贡额</th><th>幽灵商人</th><th>状态</th></tr></thead>
      <tbody>${rows}${endless}</tbody>
    </table></div>
    <div class="modal-lore" style="margin-top:10px;font-size:9px">日历日期是局内题材日期。减税密函与王室零钱会改变实际需求；以上为未修正的基础贡额。</div>`,
    footer: `<button class="btn btn-ghost btn-small" data-action="close-modal">合上</button>`,
  };
}

// ---------------------------------------------------------------- relic detail
export function openRelicDetail(app, id) {
  showModal(app, 'relic', { id });
}

function buildRelicDetail(app, { id }) {
  const r = RELIC_BY_ID[id];
  if (!r) return null;
  const s = app.state || { relics: [], phase: null };
  const codex = mergedCodex(app);
  const found = Boolean(codex.relics?.[id]) || s.relics.includes(id);
  const owned = s.relics.includes(id);
  if (!found) {
    let condition = '在商店中见到、获得或持有后点亮。';
    if (r.unlock) {
      const ach = ACHIEVEMENTS.find(a => a.unlock === id);
      if (ach) condition = `需先完成成就「${ach.zh}」：${ach.desc}`;
    }
    return {
      title: '未发现的遗物',
      eyebrow: 'UNKNOWN RELIC',
      subtitle: '图鉴记录会跨存档保留。',
      size: 'medium',
      body: `<div class="relic-detail-head"><div class="relic-detail-icon"><img src="${relicIcon(id)}" style="filter:brightness(0) opacity(.4)" alt=""></div>
        <div><h3>？？？</h3><div class="en">???</div><div class="relic-detail-meta"><span class="chip">${RARITIES[r.rarity].zh}</span></div></div></div>
        <div class="relic-detail-desc">${esc(condition)}</div>`,
      footer: `<button class="btn btn-ghost btn-small" data-action="close-modal">合上</button>`,
    };
  }
  return {
    title: r.zh,
    eyebrow: `${r.en.toUpperCase()} · ${RARITIES[r.rarity].en.toUpperCase()}`,
    subtitle: owned ? '正在持有 · 本局持续生效' : '已发现 · 未持有',
    size: 'medium',
    body: `<div class="relic-detail-head">
      <div class="relic-detail-icon"><img src="${relicIcon(id)}" alt=""></div>
      <div>
        <h3>${esc(r.zh)}</h3>
        <div class="en">${esc(r.en)}</div>
        <div class="relic-detail-meta">
          <span class="chip" style="color:${RARITIES[r.rarity].color}">${RARITIES[r.rarity].zh}</span>
          <span class="chip">费用 ${r.cost} 剑币</span>
          <span class="chip">最早第 ${r.minDay} 天</span>
          ${owned ? '<span class="chip good">持有中</span>' : ''}
        </div>
      </div>
    </div>
    <div class="relic-detail-desc">${esc(r.desc)}</div>
    <div class="modal-lore" style="margin-top:10px;font-size:9px">作用范围以描述为准：有些只影响当前剑、下一锤或每把剑一次；丢弃来源遗物后，已经为本局永久获得的签不会消失。</div>`,
    footer: `${owned && s.phase === 'playing' ? `<button class="btn btn-danger btn-small" data-action="discard-relic-confirm" data-id="${id}">丢弃遗物</button><span class="spacer"></span>` : ''}<button class="btn btn-ghost btn-small" data-action="close-modal">合上</button>`,
  };
}

// ---------------------------------------------------------------- confirm
export function openConfirm(app, payload) {
  showModal(app, 'confirm', payload);
}

function buildConfirm(app, payload) {
  return {
    title: payload.title || '确认',
    eyebrow: payload.eyebrow || 'CONFIRM',
    subtitle: payload.subtitle || '',
    size: 'small',
    closable: true,
    body: `<div class="modal-lore">${payload.body || ''}</div>`,
    footer: `<button class="btn btn-ghost btn-small" data-action="close-modal">取消</button>
      <button class="btn ${payload.danger ? 'btn-danger' : 'btn-primary'} btn-small" data-action="confirm-dialog">${esc(payload.confirmLabel || '确认')}</button>`,
  };
}

// ---------------------------------------------------------------- day summary
export function openDaySummary(app, summary) {
  if (summary.death) { openDeath(app, summary); return; }
  if (summary.contractComplete) { openVictory(app, summary); return; }
  showModal(app, 'daySummary', summary, { closable: false });
}

function buildDaySummary(app, summary) {
  const anger = [0, 1, 2].map(i => `<i class="${i < summary.angerAfter ? 'lit' : ''}"></i>`).join('');
  const offered = (summary.offered || []).map(o => `<div class="kv-row"><span>${esc(o.name)} <span style="color:var(--muted-2)">+${o.level}</span></span><b>${fmt(o.value)} G</b></div>`).join('');
  return {
    title: `第 ${summary.day} 天 · 结算`,
    eyebrow: summary.full ? 'TRIBUTE ACCEPTED' : 'TRIBUTE SHORT',
    subtitle: summary.date,
    size: 'medium',
    closable: false,
    body: `<div class="summary-hero">
      <div class="summary-total">${fmt(summary.total)} G</div>
      <div class="summary-vs">献出总值 / 今日需求</div>
      <div class="summary-quota">${fmt(summary.quota)} G</div>
      <div class="summary-stamp ${summary.full ? 'ok' : 'fail'}">${summary.full ? '足额' : '欠贡'}</div>
    </div>
    <div class="summary-rows">
      <div class="summary-row good"><span>贡品转化金币</span><b>+${fmt(summary.goldFromTribute)} G</b></div>
      <div class="summary-row ${summary.full ? 'good' : 'bad'}"><span>巨龙怒气</span><b>${summary.angerBefore} → ${summary.angerAfter} / 3 <span class="anger-display" style="display:inline-flex;margin-left:6px;vertical-align:middle">${anger}</span></b></div>
      ${summary.pardonUsed ? '<div class="summary-row"><span>巨龙赦免状</span><b>已燃尽，免于死亡</b></div>' : ''}
      ${offered ? `<div style="padding:8px 10px 4px;background:rgba(10,8,13,.2)">${offered}</div>` : ''}
    </div>
    ${summary.next ? `<div class="summary-next">第 ${summary.next.day} 天 · ${summary.next.date}<br>基础贡额 <b>${fmt(summary.next.quota)} G</b>${summary.next.carry ? ` · 王室零钱已抵扣 ${fmt(summary.next.carry)} G` : ''}${summary.next.merchant ? '<br><span style="color:var(--purple)">幽灵商人将到访</span>' : ''}</div>` : ''}
    <div class="modal-lore" style="font-size:9px;margin-top:10px">未献出的剑仍留在工坊。已经加热的剑会保持加热。明天仍会收到三把基础剑。</div>`,
    footer: `<button class="btn btn-primary" data-action="close-day-summary">进入第 ${summary.next ? summary.next.day : summary.day + 1} 天</button>`,
  };
}

// ---------------------------------------------------------------- victory / death
export function openVictory(app, summary) {
  showModal(app, 'victory', summary || app.state.lastDaySummary || {}, { closable: false });
}

function buildVictory(app, summary) {
  const s = app.state;
  return {
    title: '契约完成',
    eyebrow: 'CLOCKING OUT',
    subtitle: '你活过了五月五日。',
    size: 'medium',
    closable: false,
    body: `<div class="end-screen">
      <img class="end-art" src="./assets/scene/dragon_calm.svg" alt="">
      <div class="end-stamp">THE CONTRACT IS PAID</div>
      <h2 class="end-title victory">巨龙收下了账本。</h2>
      <div class="end-sub">工坊还在。你还在。21 天，一把又一把剑。</div>
      <div class="end-stats">
        <div class="end-stat"><span>最终日</span><b>第 ${s.day} 天</b></div>
        <div class="end-stat"><span>累计金币</span><b>${compact(s.run.goldEarned)}</b></div>
        <div class="end-stat"><span>最高剑等</span><b>+${s.run.maxLevel}</b></div>
        <div class="end-stat"><span>足额进贡</span><b>${s.run.fullTributes}</b></div>
        <div class="end-stat"><span>碎剑</span><b>${s.run.breaks}</b></div>
        <div class="end-stat"><span>入神</span><b>${s.run.frenzies}</b></div>
        <div class="end-stat"><span>遗物</span><b>${s.relics.length}/8</b></div>
        <div class="end-stat"><span>成就</span><b>${s.unlockedAchievements.length}/19</b></div>
      </div>
      <div class="modal-lore">契约可以延长。继续锻造，贡额会从此后的 232,000 G 起每天增长约 20%。完成契约后再足额进贡三次，会接近「终身差事」。<br><br><b style="color:var(--gold)">第 21 天结算后，只要巨龙怒气没有进入致命阶段，即使当天贡品不足，也算完成契约。</b></div>
      <div class="end-actions">
        <button class="btn btn-primary" data-action="continue-endless">继续延长契约</button>
        <button class="btn btn-ghost" data-action="return-menu">带着战利品收工</button>
      </div>
    </div>`,
  };
}

export function openDeath(app, summary) {
  showModal(app, 'death', summary || app.state.lastDaySummary || {}, { closable: false });
}

function buildDeath(app, summary) {
  const s = app.state;
  return {
    title: '工坊易主',
    eyebrow: 'NOW HIRING',
    subtitle: '第三档怒气就是终点。',
    size: 'medium',
    closable: false,
    body: `<div class="end-screen">
      <img class="end-art" src="./assets/scene/dragon_rage.svg" alt="">
      <div class="end-stamp">THE FORGE IS CLOSED</div>
      <h2 class="end-title dead">巨龙收走了工坊。</h2>
      <div class="end-sub">${summary.pardonUsed ? '赦免状燃尽了，但这次没有第二条。' : '铁砧还在，铁匠不在了。'}</div>
      <div class="end-stats">
        <div class="end-stat"><span>抵达</span><b>第 ${summary.day || s.day} 天</b></div>
        <div class="end-stat"><span>累计金币</span><b>${compact(s.run.goldEarned)}</b></div>
        <div class="end-stat"><span>最高剑等</span><b>+${s.run.maxLevel}</b></div>
        <div class="end-stat"><span>碎剑</span><b>${s.run.breaks}</b></div>
      </div>
      <div class="modal-lore">图鉴发现、成就与解锁都保留在云端。下一次开局会继承这些长期进度。</div>
      <div class="end-actions">
        <button class="btn btn-primary" data-action="restart-confirm">再签一份契约</button>
        <button class="btn btn-ghost" data-action="return-menu">回到主菜单</button>
      </div>
    </div>`,
  };
}

// ---------------------------------------------------------------- menu / settings
export function openMenu(app) {
  showModal(app, 'menu');
}

function buildMenu(app) {
  const s = app.state;
  return {
    title: '工坊菜单',
    eyebrow: 'PAUSED',
    subtitle: app.user ? `铁匠 ${app.user.username} · 云端存档` : '',
    size: 'small',
    body: `<div class="info-grid">
      <div class="info-cell"><span>当前契约</span><b>第 ${s.day} 天 · ${phaseLabel(s.phase)}</b></div>
      <div class="info-cell gold"><span>金币 / 剑币</span><b>${compact(s.gold)} / ${s.coins}</b></div>
      <div class="info-cell"><span>今日贡额</span><b>${fmt(E.currentQuota(s))} G</b></div>
      <div class="info-cell ${s.anger >= 2 ? 'red' : ''}"><span>巨龙怒气</span><b>${s.anger} / 3</b></div>
    </div>
    <div class="menu-actions" style="margin-top:14px">
      <button class="btn btn-primary" data-action="save-exit">保存并回主菜单</button>
      <button class="btn btn-ghost" data-action="open-settings">设置</button>
      <button class="btn btn-ghost" data-action="open-howto">玩法说明</button>
      <button class="btn btn-ghost" data-action="open-codex">图鉴</button>
      <button class="btn btn-ghost" data-action="open-achievements">成就</button>
      <button class="btn btn-ghost" data-action="close-modal">继续游戏</button>
    </div>
    <div class="danger-zone">
      <span>放弃本局会删除这个云端存档。图鉴与成就不会丢。</span>
      <button class="btn btn-danger btn-small" data-action="abandon-confirm">放弃本局</button>
    </div>`,
    footer: `<button class="btn btn-ghost btn-small" data-action="logout">退出登录</button><span class="spacer"></span><button class="btn btn-ghost btn-small" data-action="close-modal">关闭 (Esc)</button>`,
  };
}

export function openSettings(app) {
  showModal(app, 'settings');
}

function buildSettings(app) {
  const s = app.settings || {};
  return {
    title: '设置',
    eyebrow: 'SETTINGS',
    subtitle: '声音与显示偏好保存在本地。',
    size: 'small',
    body: `<div class="settings-row"><div><label>音效</label><small>锤击、结果、结算与界面音</small></div><button class="switch ${s.sound ? 'on' : ''}" data-action="toggle-setting" data-key="sound" aria-label="音效开关"></button></div>
    <div class="settings-row"><div><label>音量</label><small>合成音效的整体音量</small></div><input type="range" min="0" max="100" value="${Math.round((s.volume ?? 0.65) * 100)}" id="setting-volume"></div>
    <div class="settings-row"><div><label>减少动态</label><small>减少粒子、抖动与循环动画</small></div><button class="switch ${s.reduceMotion ? 'on' : ''}" data-action="toggle-setting" data-key="reduceMotion" aria-label="减少动态"></button></div>
    ${canVibrate() ? `<div class="settings-row"><div><label>震动反馈</label><small>锤击、碎剑、入神与拖放时轻微震动</small></div><button class="switch ${s.haptics ? 'on' : ''}" data-action="toggle-setting" data-key="haptics" aria-label="震动反馈"></button></div>` : ''}
    ${isTouchDevice() && fullscreenSupported() ? `<div class="settings-row"><div><label>进入契约时全屏</label><small>手机上自动全屏并锁定横屏</small></div><button class="switch ${s.autoFullscreen ? 'on' : ''}" data-action="toggle-setting" data-key="autoFullscreen" aria-label="进入契约时全屏"></button></div>` : ''}
    <div class="settings-row"><div><label>重看教程</label><small>从第一步开始重新引导</small></div><button class="btn btn-ghost btn-small" data-action="replay-tutorial">重看</button></div>
    ${app.state && app.activeSlot && app.screen === 'game' ? `<div class="settings-row"><div><label>备份当前契约</label><small>导出到本地；回到契约列表可导入恢复</small></div><button class="btn btn-ghost btn-small" data-action="slot-export" data-slot="${app.activeSlot}">导出存档</button></div>` : ''}
    <div class="settings-row"><div><label>账号</label><small>${app.user ? esc(app.user.username) : '未登录'}</small></div><button class="btn btn-ghost btn-small" data-action="logout">退出登录</button></div>
    <div class="modal-lore" style="font-size:9px;margin-top:8px">云端接口：${esc(app.apiBase || '')}</div>`,
    footer: `<button class="btn btn-ghost btn-small" data-action="close-modal">关闭</button>`,
  };
}

// ---------------------------------------------------------------- how to play
export function openHowTo(app) {
  showModal(app, 'howto', {}, { size: 'wide' });
}

function buildHowTo() {
  const rules = [
    ['目标', '撑过 21 天。每日领到 3 把基础剑，通过加热与挥锤提高剑值，再把剑放上贡台、敲铃献出。第 21 天结算后，只要怒气没有到致命阶段，即使欠贡也算完成契约。'],
    ['三种资源', '实体剑：能锻造、进贡、投入售卖机。<b>剑币</b>：通常一把剑换 1 枚，用来买遗物。<b>金币 G</b>：由献出的剑转化而来，用来刷新商店、买商人物品。已有金币不能直接当贡品。'],
    ['一天的循环', '领取补给 → 放剑上铁砧 → 加热 → 挥锤 → 购买/丢弃遗物 → 选择贡品 → 敲铃。未献出的剑跨日保留；剑架三格不是库存上限。'],
    ['五种结果', '成功 +1 级；大成功通常 +2 级且当锤价值 ×2.5；不变不加级；损伤 −1 级；破碎会毁剑。等级越高，基础破碎风险越高（+0 为 0%，+10 约 46.7%，+30 起 72%）。'],
    ['相对减碎', '「破碎概率相对降低 15%」是乘算：40% → 34%，不是 40−15。加签会重新归一化，看到的是最终概率。'],
    ['入神', '每次入神外挥锤 +1 充能，满 10 点后<b>下一锤</b>开启 4 秒入神：期间移除破碎，但仍可能出现损伤、不变、成功与大成功。入神中不再充能。'],
    ['遗物与范围', '遗物架 8 格。注意效果范围：当前剑、下一锤、每把剑一次、每日一次、本局永久、跨局解锁都不同。丢弃遗物会失去持续加成；已获得的永久签保留。'],
    ['幽灵商人', '第 3、6、9、12、15、18、21 天到访，用金币交易。同一商品追加购买单价 ×3。买空全部库存可解锁成就。'],
    ['欠贡与怒气', '每次欠贡 +1 档怒气，第三档死亡。欠贡后次日仍有 3 把基础剑。遗忘之香每局一次；巨龙赦免状在死亡时救一次。'],
    ['契约后', '完成契约可继续锻造，贡额每天约 +20%。完成契约后再足额进贡 3 次，会解锁终身契约。'],
    ['快捷键', '空格 挥锤 · H 加热 · E / 右键铁砧 取走 · R 回溯 · 1–5 使用铁砧道具 · X 丢弃遗物 · Esc 菜单/关闭弹窗 · P 跳过教程。'],
    ['触屏', '手机请横屏游玩。<b>长按</b>一把剑即可拿起，拖到铁砧、剑架、贡台或左侧标签上放下；长按遗物与道具查看说明。入神期间<b>按住</b>挥锤会连续锻造。系统返回手势等同 Esc。'],
  ];
  return {
    title: '玩法说明',
    eyebrow: 'HOW TO PLAY',
    subtitle: '所有关键边界都按参考文档实现。',
    size: 'wide',
    body: `<div class="help-two-col">${rules.map(([k, v]) => `<div class="help-item"><div class="key">${esc(k)}</div><div>${v}</div></div>`).join('')}</div>`,
    footer: `<span style="flex:1;font-size:9px;color:var(--muted-2)">数字与概率来自公开资料；未公开的结算顺序采用可解释的固定规则。保持炉火不灭。</span><button class="btn btn-ghost btn-small" data-action="close-modal">明白了</button>`,
  };
}

// ---------------------------------------------------------------- log
export function openLog(app) {
  showModal(app, 'log');
}

function buildLog(app) {
  const rows = (app.state.log || []).map(l => `<div class="log-row ${l.type}"><span class="log-day">D${l.day}</span><span>${esc(l.text)}</span></div>`).join('');
  return {
    title: '炉边记录',
    eyebrow: 'WORKSHOP LOG',
    subtitle: '最近的锤击、交易与结算。',
    size: 'medium',
    body: `<div class="log-list">${rows || '<div class="empty-state">还没有记录。</div>'}</div>`,
    footer: `<button class="btn btn-ghost btn-small" data-action="close-modal">合上</button>`,
  };
}

// ---------------------------------------------------------------- discard picker
export function openDiscardPick(app, buyIndex) {
  showModal(app, 'discardPick', { buyIndex });
}

function buildDiscardPick(app, { buyIndex }) {
  const s = app.state;
  const rows = s.relics.map(id => {
    const r = RELIC_BY_ID[id];
    return `<div class="merchant-item consumable" style="border-left-color:${RARITIES[r.rarity].color}">
      <div class="mi-icon"><img src="${relicIcon(id)}" alt=""></div>
      <div><h5>${esc(r.zh)}</h5><div class="mi-meta">${esc(r.desc)}</div></div>
      <button class="btn btn-danger btn-small" data-action="discard-for-buy" data-id="${id}" data-index="${buyIndex}">丢弃</button>
    </div>`;
  }).join('');
  return {
    title: '遗物架已满',
    eyebrow: 'DISCARD A RELIC',
    subtitle: '要买新的遗物，必须先丢弃一件。没有退款。',
    size: 'medium',
    body: `<div class="merchant-items">${rows}</div>`,
    footer: `<button class="btn btn-ghost btn-small" data-action="close-modal">算了</button>`,
  };
}

// ---------------------------------------------------------------- mobile tool kit
const KIT_ORDER = ['cracked_dragon_scale', 'regret_clockwork', 'red_chalk', 'powder_pouch', 'cold_star_shard'];

export function openKit(app) {
  showModal(app, 'kit');
}

function buildKit(app) {
  const s = app.state;
  const sword = E.getAnvilSword(s);
  const rows = KIT_ORDER.map(key => {
    const c = CONSUMABLES[key];
    const count = s.consumables[key] || 0;
    const reason = consumeDisabledReason(app, key);
    const disabled = Boolean(reason) || count <= 0;
    return `<div class="kit-row">
      <img src="${consumableIcon(key)}" alt="">
      <div><h5>${esc(c.zh)} <span class="kit-count">×${count}</span></h5><p>${esc(c.desc)}</p></div>
      <button class="btn ${disabled ? 'btn-ghost' : 'btn-primary'} btn-small" data-action="use-consumable" data-key="${key}" ${disabled ? 'disabled' : ''} title="${esc(reason || '使用')}">${key === 'regret_clockwork' ? '回溯' : '使用'}</button>
    </div>`;
  }).join('');
  const buffs = [];
  if (s.anvilBuffs.protectBreak) buffs.push('龙鳞保护下一锤');
  if (s.anvilBuffs.redChalk) buffs.push('红大成功签翻倍');
  if (s.anvilBuffs.powder) buffs.push('粉末袋已预置');
  if (s.frenzy.active) buffs.push('入神中');
  return {
    title: '铁砧工具袋',
    eyebrow: 'ANVIL TOOLS',
    subtitle: sword ? `当前剑：${E.swordDisplayName(sword)} · +${sword.level}` : '先在铁砧上放一把剑',
    size: 'medium',
    body: `<div class="pill-list" style="margin-bottom:10px">${buffs.length ? buffs.map(b => `<span class="chip gold">${esc(b)}</span>`).join('') : '<span class="chip">没有预置效果</span>'}</div>${rows}
      <div class="relic-tab-note">消耗品在铁砧上生效。龙鳞和粉末袋会消耗每一次下一锤；回溯需要已经挥过一锤。</div>`,
    footer: `<button class="btn btn-ghost btn-small" data-action="close-modal">收起工具袋</button>`,
  };
}

export function openDiscardOwned(app) {
  if (!app.state) return;
  showModal(app, 'discardOwned');
}

function buildDiscardOwned(app) {
  const s = app.state;
  const rows = s.relics.map(id => {
    const r = RELIC_BY_ID[id];
    return `<div class="merchant-item consumable" style="border-left-color:${RARITIES[r.rarity].color}">
      <div class="mi-icon"><img src="${relicIcon(id)}" alt=""></div>
      <div><h5>${esc(r.zh)}</h5><div class="mi-meta">${esc(r.desc)}</div></div>
      <button class="btn btn-danger btn-small" data-action="discard-relic-confirm" data-id="${id}">丢弃</button>
    </div>`;
  }).join('');
  return {
    title: '丢弃遗物',
    eyebrow: 'DISCARD RELIC',
    subtitle: '丢弃没有退款。已经为本局永久获得的签不会消失。',
    size: 'medium',
    body: rows ? `<div class="merchant-items">${rows}</div>` : '<div class="empty-state">遗物架是空的。</div>',
    footer: `<button class="btn btn-ghost btn-small" data-action="close-modal">取消 (Esc)</button>`,
  };
}
