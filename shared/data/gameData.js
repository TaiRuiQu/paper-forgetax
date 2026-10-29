// Static content for the 2D ForgeTax replica. Values follow docs/reference/forgetax.md.
// Community-sourced values are kept in the range described there; unknowns are isolated here.

export const CONTRACT_DAYS = 21;
export const RELIC_SLOTS = 8;
export const MAX_LEVEL = 99;
export const FINAL_APPEARANCE_LEVEL = 20;
export const BASE_SWORD_VALUE = 320;
export const MERCHANT_SWORD_VALUE = 640;

// day, in-game date, base quota, ghost merchant visit
export const TRIBUTE_DAYS = [
  { day: 1, date: '4月15日', quota: 1800, merchant: false },
  { day: 2, date: '4月16日', quota: 2100, merchant: false },
  { day: 3, date: '4月17日', quota: 2600, merchant: true },
  { day: 4, date: '4月18日', quota: 3350, merchant: false },
  { day: 5, date: '4月19日', quota: 4350, merchant: false },
  { day: 6, date: '4月20日', quota: 5700, merchant: true },
  { day: 7, date: '4月21日', quota: 7500, merchant: false },
  { day: 8, date: '4月22日', quota: 9800, merchant: false },
  { day: 9, date: '4月23日', quota: 12800, merchant: true },
  { day: 10, date: '4月24日', quota: 16700, merchant: false },
  { day: 11, date: '4月25日', quota: 21500, merchant: false },
  { day: 12, date: '4月26日', quota: 27750, merchant: true },
  { day: 13, date: '4月27日', quota: 35700, merchant: false },
  { day: 14, date: '4月28日', quota: 45800, merchant: false },
  { day: 15, date: '4月29日', quota: 58650, merchant: true },
  { day: 16, date: '4月30日', quota: 74650, merchant: false },
  { day: 17, date: '5月1日', quota: 94550, merchant: false },
  { day: 18, date: '5月2日', quota: 119350, merchant: true },
  { day: 19, date: '5月3日', quota: 149950, merchant: false },
  { day: 20, date: '5月4日', quota: 186850, merchant: false },
  { day: 21, date: '5月5日', quota: 232000, merchant: true },
];

export const SWORD_ROUTES = [
  { id: 'route0', zh: '壁垒路线', families: ['citadel', 'holy'] },
  { id: 'route1', zh: '狂暴路线', families: ['sawblade', 'dragonfang'] },
  { id: 'route2', zh: '奥术路线', families: ['runeblade', 'splitblade'] },
];

// stage index: 0 => +0, 1 => +2, 2 => +4, 3 => +6..+9, 4 => +10..+19, 5 => +20+
export const SWORD_STAGE_LEVELS = [0, 2, 4, 6, 10, 20];

export const SWORD_FAMILIES = {
  citadel: {
    zh: '城塞剑', en: 'Citadel', baseValue: 320, route: 0, branch: 0, source: 'normal',
    stages: ['厚铁剑', '厚铁阔剑', '铁门剑', '铁门重刃', '堡垒巨剑', '裂大陆铁城塞'],
    enStages: ['Heavy Iron Sword', 'Broad Iron Sword', 'Gate Blade', 'Gate Greatblade', 'Fortress Greatsword', 'Continent-Cleaving Iron Citadel'],
    accent: '#9fb4c8', desc: '挡在工坊与巨龙之间的厚铁。每一次叠锻都让它更像一扇门。',
  },
  holy: {
    zh: '圣剑', en: 'Holy', baseValue: 320, route: 0, branch: 1, source: 'normal',
    stages: ['厚铁剑', '晨祷剑', '银辉剑', '圣痕剑', '圣剑', '誓约胜利之剑'],
    enStages: ['Heavy Iron Sword', 'Matins Blade', 'Silverblade', 'Stigmata Sword', 'Holy Sword', 'Excalibur'],
    accent: '#ffe08a', desc: '与城塞同源的厚铁，在某个无人知晓的清晨显出圣痕。',
  },
  sawblade: {
    zh: '锯剑', en: 'Sawblade', baseValue: 320, route: 1, branch: 0, source: 'normal',
    stages: ['狂暴铁块', '锯齿铁片', '咬刃', '机械锯剑', '毁灭锯刃', '毁灭齿轮'],
    enStages: ['Furious Iron Lump', 'Jagged Slab', 'Biting Edge', 'Mechanical Sawblade', 'Ruinous Saw', 'Unstoppable Gears of Ruin'],
    accent: '#e6704a', desc: '不像剑，更像一台饥饿的机器。锯齿转过的地方寸草不生。',
  },
  dragonfang: {
    zh: '龙牙剑', en: 'Dragonfang', baseValue: 320, route: 1, branch: 1, source: 'normal',
    stages: ['狂暴铁块', '龙鳞铁片', '咬刃·龙', '龙牙大剑', '魔剑', '魔剑·屠龙者'],
    enStages: ['Furious Iron Lump', 'Dragonscale Slab', 'Dragon Bite', 'Dragonfang Greatsword', 'Demon Blade', 'Demon Blade: Dragonslayer'],
    accent: '#c04a5a', desc: '原料里混进了龙的碎屑。它记得自己该咬向谁。',
  },
  runeblade: {
    zh: '符文剑', en: 'Runeblade', baseValue: 320, route: 2, branch: 0, source: 'normal',
    stages: ['魔力碎片', '铭文短剑', '觉醒刃', '符文剑', '法术刃', '创世之刃'],
    enStages: ['Mana Shard', 'Inscribed Shortsword', 'Awakened Edge', 'Runeblade', 'Spellsong Blade', 'Akasha, Blade of Genesis'],
    accent: '#7f8cff', desc: '铁里烧进了会发光的字。每次挥锤都像在替世界补一行注脚。',
  },
  splitblade: {
    zh: '分裂剑', en: 'Splitblade', baseValue: 320, route: 2, branch: 1, source: 'normal',
    stages: ['魔力碎片', '分裂短剑', '觉醒刃·双', '群剑', '万剑之影', '万剑之主'],
    enStages: ['Mana Shard', 'Splitting Shortsword', 'Twin Awakened Edge', 'Sword Swarm', 'Shadow of Ten Thousand', 'Sovereign of Blades'],
    accent: '#9ad6c8', desc: '一把剑的影子長成了另一把剑。最后，影子比本体更像本体。',
  },
  world_tree: {
    zh: '世界树', en: 'World Tree', baseValue: 640, route: 3, branch: 0, source: 'merchant',
    stages: ['树枝', '木棍', '萌芽', '树苗之剑', '世界树', '世界树·尤格特拉希尔'],
    enStages: ['Branch', 'Club', 'Sprout', 'Sapling Blade', 'World Tree', 'Yggdrasil, the World Tree'],
    accent: '#84b35b', desc: '从商人那里买来的一截树枝。它似乎还在生长。',
  },
  fishblade: {
    zh: '海产剑', en: 'Fishblade', baseValue: 640, route: 3, branch: 1, source: 'merchant',
    stages: ['海草刀片', '鱼骨刃', '鱼蟹钳剑', '巨鲸刃', '海兽之牙', '利维坦之牙'],
    enStages: ['Seaweed Blade', 'Fishbone Blade', 'Crabclaw Sword', 'Whale Edge', 'Sea Beast Fang', "Leviathan's Fang"],
    accent: '#59c3d6', desc: '带着海腥味的剑。深水里有什么东西正借它看着你。',
  },
  funerary: {
    zh: '殡葬剑', en: 'Funerary', baseValue: 640, route: 3, branch: 2, source: 'merchant',
    stages: ['棺钉', '墓碑刀', '棺盖剑', '墓园之刃', '冥界之门', '冥界之钥'],
    enStages: ['Coffin Nail', 'Gravestone Blade', 'Coffin Lid Sword', 'Graveyard Edge', 'Gate to the Underworld', 'Key to the Underworld'],
    accent: '#b09ac9', desc: '为死者打的剑。它不介意再送几个人上路。',
  },
};

export const ALL_FAMILIES = Object.keys(SWORD_FAMILIES);

export const RARITIES = {
  common: { zh: '普通', en: 'Common', color: '#b8b3a5', glow: '#8d8779' },
  rare: { zh: '稀有', en: 'Rare', color: '#6db8e8', glow: '#3a8bc0' },
  legendary: { zh: '传说', en: 'Legendary', color: '#f0b04a', glow: '#c47a20' },
};

// Free starting relic roll (3 of 8, no reroll). Leather Loop is deliberately absent.
export const STARTING_RELIC_POOL = [
  'bent-nail', 'black-knot', 'inspection-stamp', 'sealing-stone',
  'cracked-splice', 'sealed-heart', 'lucky-coal', 'undertakers-chalice',
];

// Anvil consumables. instant: bought from merchant and applied immediately.
export const CONSUMABLES = {
  cracked_dragon_scale: {
    zh: '裂纹龙鳞', en: 'Cracked Dragon Scale', minDay: 3, color: '#d9b36a',
    desc: '保护下一锤：若抽到破碎则阻止碎剑。无论抽到什么都消耗。入神中、或已满充能即将入神时不能预置。',
    use: 'next-hammer', priceFactor: 0.423,
  },
  regret_clockwork: {
    zh: '悔恨发条', en: 'Regret Clockwork', minDay: 3, color: '#c7a86d',
    desc: '在离开铁砧前，撤回上一锤（包括破碎）。需在风险锤之前持有。',
    use: 'rewind', priceFactor: 1.53,
  },
  red_chalk: {
    zh: '红粉笔', en: 'Red Chalk', minDay: 6, color: '#e0605a',
    desc: '下一锤的大成功签翻倍。不等于最终大成功概率直接翻倍；入神内也可用。',
    use: 'next-hammer', priceFactor: 0.52,
  },
  powder_pouch: {
    zh: '粉末袋', en: 'Powder Pouch', minDay: 6, color: '#a9a29a',
    desc: '下一次普通锻造中，成功／大成功改成大成功，其他结果改成破碎。不能在入神中使用。',
    use: 'next-hammer', priceFactor: 0.74,
  },
  cold_star_shard: {
    zh: '寒星碎片', en: 'Cold Star Shard', minDay: 6, color: '#92d5e8',
    desc: '增加 3 点入神充能。入神中或已满充能时不能使用。',
    use: 'charge', priceFactor: 0.28,
  },
  incense_of_oblivion: {
    zh: '遗忘之香', en: 'Incense of Oblivion', minDay: 9, color: '#c8b2e0',
    desc: '购买时立即降低一档巨龙怒气。每局一次。',
    use: 'instant', priceFactor: 1.12,
  },
  ghost_delivery_note: {
    zh: '幽灵送货单', en: 'Ghost Delivery Note', minDay: 6, color: '#9fc7b5',
    desc: '为下一批供给预订额外两把基础剑。',
    use: 'instant', priceFactor: 0.66,
  },
};

export const MERCHANT_PRICE = {
  baseSword: 0.4,
  specialSword: 1.138,
};

export const ACHIEVEMENTS = [
  { id: 'mastery_citadel', zh: '城塞掌握', en: 'Citadel Mastery', desc: '将一把城塞剑锻至 +20。', unlock: 'unyielding-cornerstone', family: 'citadel' },
  { id: 'mastery_holy', zh: '圣剑掌握', en: 'Holy Mastery', desc: '将一把圣剑锻至 +20。', unlock: 'dawn-scabbard', family: 'holy' },
  { id: 'mastery_sawblade', zh: '锯剑掌握', en: 'Sawblade Mastery', desc: '将一把锯剑锻至 +20。', unlock: 'ceaseless-driveshaft', family: 'sawblade' },
  { id: 'mastery_dragonfang', zh: '龙牙掌握', en: 'Dragonfang Mastery', desc: '将一把龙牙剑锻至 +20。', unlock: 'dragon-heart', family: 'dragonfang' },
  { id: 'mastery_runeblade', zh: '符文掌握', en: 'Runeblade Mastery', desc: '将一把符文剑锻至 +20。', unlock: 'perfect-mana-core', family: 'runeblade' },
  { id: 'mastery_splitblade', zh: '分裂掌握', en: 'Splitblade Mastery', desc: '将一把分裂剑锻至 +20。', unlock: 'seal-of-twins', family: 'splitblade' },
  { id: 'mastery_world_tree', zh: '世界树掌握', en: 'World Tree Mastery', desc: '将一把世界树剑锻至 +20。', unlock: 'eternal-seed', family: 'world_tree' },
  { id: 'mastery_fishblade', zh: '海产掌握', en: 'Fishblade Mastery', desc: '将一把海产剑锻至 +20。', unlock: 'abyssal-pearl', family: 'fishblade' },
  { id: 'mastery_funerary', zh: '殡葬掌握', en: 'Funerary Mastery', desc: '将一把殡葬剑锻至 +20。', unlock: 'undertakers-ledger', family: 'funerary' },
  { id: 'clocking_out', zh: '下班打卡', en: 'Clocking Out', desc: '活过 5 月 5 日，完成契约。', unlock: 'sickle-and-hammer' },
  { id: 'all_thumbs', zh: '全是左手', en: 'All Thumbs', desc: '单局真正打碎 10 把剑。', unlock: 'butterfingers' },
  { id: 'no_rest', zh: '锤子不休息', en: 'No Rest for the Hammer', desc: '单局进入入神 5 次。', unlock: 'undying-wick' },
  { id: 'keep_change', zh: '零钱留着', en: 'Keep the Change', desc: '一次献出至少需求 3 倍的贡值。', unlock: 'royal-change' },
  { id: 'one_last_chance', zh: '最后的机会', en: 'One Last Chance', desc: '在最后警告阶段足额进贡。', unlock: 'dragons-pardon' },
  { id: 'take_everything', zh: '我全都要', en: "I'll Take Everything", desc: '买空一次幽灵商人访问的全部库存。', unlock: 'wandering-ghosts-ledger' },
  { id: 'job_for_life', zh: '终身差事', en: 'A Job for Life', desc: '完成契约后再足额进贡 3 次。', unlock: 'lifetime-contract' },
  { id: 'one_more_hit', zh: '再来一锤？', en: 'One More Hit?', desc: '首次把任意剑锻至 +10。', unlock: null },
  { id: 'now_hiring', zh: '现正招聘', en: 'Now Hiring', desc: '首次死于巨龙。', unlock: null },
  { id: 'hammer_time', zh: '锤子时间', en: 'Hammer Time', desc: '教程之外首次进入入神。', unlock: null },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
export const ACHIEVEMENT_BY_UNLOCK_RELIC = Object.fromEntries(ACHIEVEMENTS.filter(a => a.unlock).map(a => [a.unlock, a]));

export const TUTORIAL_STEPS = [
  { id: 'welcome', title: '欢迎来到被巨龙接管的工坊', text: '你是这里最后的铁匠。每天领到三把剑，锻高它们的价值，向巨龙献上足额贡品。撑过 21 天。' },
  { id: 'heat', title: '第一步：加热', text: '把剑放上铁砧，先点「加热」。未加热的剑不能锻造。' },
  { id: 'hammer', title: '第二步：挥锤', text: '查看下一锤的五种结果概率，再挥锤。等级越高，破碎风险越大。' },
  { id: 'frenzy', title: '入神', text: '每次挥锤积攒 1 点充能。满 10 点后，下一锤将开启持续 4 秒的入神：期间不会破碎，但时间有限。' },
  { id: 'tribute', title: '第三步：献贡', text: '把剑放到贡台，台面总值达到今日贡额后敲响贡铃。敲铃之后剑会被带走。' },
  { id: 'shop', title: '遗物与商人', text: '把不需要的剑投入售卖机换剑币，再用剑币购买遗物。幽灵商人在第 3、6、9…天到访，用金币交易。' },
  { id: 'done', title: '活过 21 天', text: '欠贡会增加一档怒气，第三档就会死亡。第 21 天结算时，只要还活着，即使欠贡也算完成契约。' },
];

export const FAMILY_ORDER = [
  'citadel', 'holy', 'sawblade', 'dragonfang', 'runeblade',
  'splitblade', 'world_tree', 'fishblade', 'funerary',
];

export function dayInfo(day) {
  if (day <= CONTRACT_DAYS) return TRIBUTE_DAYS[day - 1];
  const last = TRIBUTE_DAYS[CONTRACT_DAYS - 1];
  return {
    day,
    date: `延长第 ${day - CONTRACT_DAYS} 天`,
    quota: Math.round(last.quota * Math.pow(1.2, day - CONTRACT_DAYS)),
    merchant: (day - CONTRACT_DAYS) % 3 === 0,
  };
}

export function baseQuotaForDay(day) {
  if (day <= CONTRACT_DAYS) return TRIBUTE_DAYS[day - 1].quota;
  return Math.round(TRIBUTE_DAYS[CONTRACT_DAYS - 1].quota * Math.pow(1.2, day - CONTRACT_DAYS));
}

export function merchantVisitsBefore(day) {
  return TRIBUTE_DAYS.filter(d => d.day < day && d.merchant).length;
}

export function familyStage(level) {
  if (level >= 20) return 5;
  if (level >= 10) return 4;
  if (level >= 6) return 3;
  if (level >= 4) return 2;
  if (level >= 2) return 1;
  return 0;
}

export function familyForSword(route, branch) {
  const r = SWORD_ROUTES[route] || SWORD_ROUTES[0];
  return r.families[branch ? 1 : 0];
}
