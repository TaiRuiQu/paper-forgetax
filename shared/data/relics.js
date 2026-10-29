// 94 non-disabled relics, transcribed from Appendix A of the reference document.
// rarity / minDay / cost / unlock follow the community snapshot; descriptions preserve stated limits.

export const RELICS = [
  {
    id: 'ash-sieve', zh: '筛灰网', en: 'Ash Sieve', rarity: 'common', minDay: 2, cost: 1, icon: 'sieve', tags: [],
    desc: '剑真正破碎时，直接获得 500 G。',
  },
  {
    id: 'bent-nail', zh: '弯钉', en: 'Bent Nail', rarity: 'common', minDay: 2, cost: 1, icon: 'nail', tags: ['offense'],
    desc: '普通成功签 +4。',
  },
  {
    id: 'black-knot', zh: '黑色绳结', en: 'Black Knot', rarity: 'common', minDay: 2, cost: 1, icon: 'knot', tags: ['defense', 'recovery'],
    desc: '破碎概率相对降低 10%。',
  },
  {
    id: 'blunt-mallet', zh: '钝铁锤', en: 'Blunt Mallet', rarity: 'common', minDay: 2, cost: 1, icon: 'mallet', tags: [],
    desc: '将 1 张损伤签转为普通成功签。',
  },
  {
    id: 'bound-idol', zh: '缚神像', en: 'Bound Idol', rarity: 'common', minDay: 2, cost: 1, icon: 'idol', tags: ['offense'],
    desc: '每把剑首次达到 +4、+8、+12 等 4 的倍数等级时，剑值乘 1.15。',
  },
  {
    id: 'charcoal-pouch', zh: '炭粉袋', en: 'Charcoal Pouch', rarity: 'common', minDay: 2, cost: 1, icon: 'pouch', tags: ['offense'],
    desc: '基础价值 +80 G。',
  },
  {
    id: 'first-brand', zh: '初次烙印', en: 'First Brand', rarity: 'common', minDay: 2, cost: 1, icon: 'brand', tags: ['offense'],
    desc: '每把剑第一锤若为成功或大成功，额外升 2 级。',
  },
  {
    id: 'heavy-paperweight', zh: '沉重镇纸', en: 'Heavy Paperweight', rarity: 'common', minDay: 2, cost: 1, icon: 'paperweight', tags: [],
    desc: '每次不变，固定价值 +180 G。',
  },
  {
    id: 'inspection-stamp', zh: '验货印章', en: 'Inspection Stamp', rarity: 'common', minDay: 2, cost: 1, icon: 'stamp', tags: ['offense'],
    desc: '每次成功或大成功，固定价值 +100 G。',
  },
  {
    id: 'iron-signet', zh: '铁印', en: 'Iron Signet', rarity: 'common', minDay: 2, cost: 1, icon: 'signet', tags: ['offense'],
    desc: '剑值乘 1.15。',
  },
  {
    id: 'leather-loop', zh: '皮环', en: 'Leather Loop', rarity: 'common', minDay: 2, cost: 1, icon: 'loop', tags: [],
    desc: '入神之外的锻造速度 +20%。',
  },
  {
    id: 'lucky-coal', zh: '幸运炭', en: 'Lucky Coal', rarity: 'common', minDay: 2, cost: 1, icon: 'coal', tags: ['offense'],
    desc: '大成功签 +1。',
  },
  {
    id: 'patched-apron', zh: '补过的围裙', en: 'Patched Apron', rarity: 'common', minDay: 2, cost: 1, icon: 'apron', tags: [],
    desc: '每次损伤，固定价值 +140 G。',
  },
  {
    id: 'patient-weight', zh: '等待之坠', en: 'Patient Weight', rarity: 'common', minDay: 2, cost: 1, icon: 'weight', tags: [],
    desc: '不变签 +3。',
  },
  {
    id: 'red-thread', zh: '红线', en: 'Red Thread', rarity: 'common', minDay: 2, cost: 1, icon: 'thread', tags: ['defense'],
    desc: '不变之后，下一锤的破碎概率相对降低 20%。',
  },
  {
    id: 'sealing-stone', zh: '封印石', en: 'Sealing Stone', rarity: 'common', minDay: 2, cost: 1, icon: 'sealingstone', tags: [],
    desc: '不变签 +2；每连续两次不变，额外升 1 级。',
  },
  {
    id: 'wax-effigy', zh: '蜡偶', en: 'Wax Effigy', rarity: 'common', minDay: 2, cost: 1, icon: 'wax', tags: [],
    desc: '连续出现两次相同结果时，固定价值 +150 G。',
  },
  {
    id: 'worn-whetstone', zh: '磨损的砥石', en: 'Worn Whetstone', rarity: 'common', minDay: 2, cost: 1, icon: 'whetstone', tags: [],
    desc: '将最多 2 张不变签转为普通成功签。',
  },
  {
    id: 'undertakers-chalice', zh: '送葬人的圣杯', en: "Undertaker's Chalice", rarity: 'rare', minDay: 2, cost: 1, icon: 'chalice', tags: ['recovery'],
    desc: '真正破碎时，以该剑历史最高剑值的 30% 生成残骸贡品。',
  },
  {
    id: 'blind-die', zh: '盲者之骰', en: 'Blind Die', rarity: 'common', minDay: 3, cost: 1, icon: 'die', tags: [],
    desc: '损伤或不变之后，下一锤大成功签 +3。',
  },
  {
    id: 'chained-hourglass', zh: '锁链沙漏', en: 'Chained Hourglass', rarity: 'common', minDay: 3, cost: 1, icon: 'hourglass', tags: [],
    desc: '入神外发生不变，有 50% 概率额外获得 1 点入神充能。',
  },
  {
    id: 'closed-third-eye', zh: '紧闭的第三只眼', en: 'Closed Third Eye', rarity: 'common', minDay: 3, cost: 1, icon: 'eye', tags: [],
    desc: '不变之后，下一锤普通成功签 +4。',
  },
  {
    id: 'cold-teacup', zh: '凉茶杯', en: 'Cold Teacup', rarity: 'common', minDay: 3, cost: 1, icon: 'teacup', tags: ['offense'],
    desc: '每次不变，该剑积累一次 ×1.06 剑值倍率。',
  },
  {
    id: 'cracked-wristwatch', zh: '裂开的腕表', en: 'Cracked Wristwatch', rarity: 'common', minDay: 3, cost: 1, icon: 'watch', tags: [],
    desc: '入神外每次损伤，额外获得 1 点入神充能。',
  },
  {
    id: 'double-knot', zh: '双重绳结', en: 'Double Knot', rarity: 'common', minDay: 3, cost: 1, icon: 'doubleknot', tags: ['offense'],
    desc: '每连续两次成功／大成功，该剑积累一次 ×1.10 剑值倍率。',
  },
  {
    id: 'hungry-molar', zh: '饥饿臼齿', en: 'Hungry Molar', rarity: 'common', minDay: 3, cost: 1, icon: 'molar', tags: ['recovery'],
    desc: '≥+4 的剑真正破碎后，下一把未经锻造的 +0 剑获得 4 张本剑持续生效的成功签。',
  },
  {
    id: 'iron-comb', zh: '铁梳', en: 'Iron Comb', rarity: 'common', minDay: 3, cost: 1, icon: 'comb', tags: [],
    desc: '每次损伤，按损伤前等级对应价值的 5% 增加固定价值。',
  },
  {
    id: 'iron-hoop', zh: '牢固铁箍', en: 'Iron Hoop', rarity: 'common', minDay: 3, cost: 1, icon: 'hoop', tags: ['defense'],
    desc: '破碎签 −2（基础签数最低保留 1 张），仍须经过等级权重。',
  },
  {
    id: 'little-wind-bell', zh: '小风铃', en: 'Little Wind Bell', rarity: 'common', minDay: 3, cost: 1, icon: 'windbell', tags: [],
    desc: '每次不变，为本剑下一次普通成功储存额外 1 级，上限 2；大成功不兑现。',
  },
  {
    id: 'thorn-weight', zh: '荆棘砝码', en: 'Thorn Weight', rarity: 'common', minDay: 3, cost: 1, icon: 'thorn', tags: [],
    desc: '剑值乘 1.10；将 2 张不变签转为损伤签。',
  },
  {
    id: 'broken-holy-sword', zh: '折断的圣剑', en: 'Broken Holy Sword', rarity: 'rare', minDay: 3, cost: 1, icon: 'brokensword', tags: ['recovery'],
    desc: '破碎剑的 30% 等级由下一把未经锻造的 +0 剑继承，继承时获得 3 点充能；可与黎明之鞘相加。',
  },
  {
    id: 'cracked-crown', zh: '裂冠', en: 'Cracked Crown', rarity: 'rare', minDay: 3, cost: 1, icon: 'crown', tags: ['recovery'],
    desc: '损伤实际造成等级价值损失时，将其 50% 留为固定价值。',
  },
  {
    id: 'cracked-splice', zh: '开裂的接合片', en: 'Cracked Splice', rarity: 'rare', minDay: 3, cost: 2, icon: 'splice', tags: ['defense', 'recovery'],
    desc: '每次损伤为该剑累积 15% 相对减破碎，最多累积 60%。',
  },
  {
    id: 'golden-nail', zh: '金钉', en: 'Golden Nail', rarity: 'rare', minDay: 3, cost: 2, icon: 'goldennail', tags: ['offense'],
    desc: '大成功签 +2。',
  },
  {
    id: 'grudge-nail', zh: '怨恨之钉', en: 'Grudge Nail', rarity: 'rare', minDay: 3, cost: 2, icon: 'grudge', tags: ['offense'],
    desc: '剑真正破碎时，按其等级积存一次性大成功签。',
  },
  {
    id: 'mourning-knot', zh: '丧服之结', en: 'Mourning Knot', rarity: 'rare', minDay: 3, cost: 1, icon: 'mourning', tags: ['recovery'],
    desc: '每次欠贡，为本局永久增加 1 张大成功签。',
  },
  {
    id: 'scorched-charm', zh: '焦黑护符', en: 'Scorched Charm', rarity: 'rare', minDay: 3, cost: 1, icon: 'charm', tags: ['defense'],
    desc: '入神外每次成功或大成功，该剑累积 3% 相对减破碎，最多 18%。',
  },
  {
    id: 'sealed-heart', zh: '封印之心', en: 'Sealed Heart', rarity: 'rare', minDay: 3, cost: 2, icon: 'heart', tags: [],
    desc: '每次不变，为本剑下一次大成功储存额外 1 级，上限 4。',
  },
  {
    id: 'third-hand', zh: '第三只手', en: 'Third Hand', rarity: 'rare', minDay: 3, cost: 2, icon: 'hand', tags: ['offense'],
    desc: '每连续两次成功／大成功，额外升 1 级；其他结果打断连锁。',
  },
  {
    id: 'worn-voucher', zh: '磨旧的兑换券', en: 'Worn Voucher', rarity: 'rare', minDay: 3, cost: 2, icon: 'voucher', tags: ['economy'],
    desc: '每日一次免费遗物商店刷新；这次不抬高后续付费刷新价格。',
  },
  {
    id: 'collectors-hook', zh: '收账人的钩子', en: "Collector's Hook", rarity: 'rare', minDay: 4, cost: 2, icon: 'hook', tags: ['economy'],
    desc: '当日至少刷新过一次后，首把投入售卖机的未经锻造 +0 剑兑换 2 剑币。',
  },
  {
    id: 'cracked-bell', zh: '裂钟', en: 'Cracked Bell', rarity: 'rare', minDay: 4, cost: 1, icon: 'crackedbell', tags: ['offense'],
    desc: '每次大成功，该剑额外积累一次 ×1.20 剑值倍率。',
  },
  {
    id: 'defeated-kings-seal', zh: '败王玉玺', en: "Defeated King's Seal", rarity: 'rare', minDay: 4, cost: 3, icon: 'kingseal', tags: [],
    desc: '每次损伤，为本剑下一次大成功储存额外 1 级。',
  },
  {
    id: 'ember-locket', zh: '余烬吊坠', en: 'Ember Locket', rarity: 'rare', minDay: 4, cost: 2, icon: 'locket', tags: [],
    desc: '每把剑首次普通锻造，额外获得 2 点充能，即通常共 3 点。',
  },
  {
    id: 'interlocking-weights', zh: '咬合砝码', en: 'Interlocking Weights', rarity: 'rare', minDay: 4, cost: 2, icon: 'weights', tags: ['offense'],
    desc: '损伤后紧接着出现成功或大成功时，额外升 2 级。',
  },
  {
    id: 'journeyman-badge', zh: '熟练工徽章', en: 'Journeyman Badge', rarity: 'rare', minDay: 4, cost: 2, icon: 'badge', tags: ['recovery'],
    desc: '足额进贡后，下一批供给剑的起始等级至少为 +2。',
  },
  {
    id: 'lightning-mark', zh: '雷纹', en: 'Lightning Mark', rarity: 'rare', minDay: 4, cost: 1, icon: 'lightning', tags: ['defense'],
    desc: '入神外的大成功，使本剑下一锤破碎概率相对降低 40%。',
  },
  {
    id: 'silver-tuning-fork', zh: '银音叉', en: 'Silver Tuning Fork', rarity: 'rare', minDay: 4, cost: 2, icon: 'tuningfork', tags: ['offense'],
    desc: '入神外的大成功额外升 1 级，即通常合计升 3 级。',
  },
  {
    id: 'sleeping-ember', zh: '沉睡余烬', en: 'Sleeping Ember', rarity: 'rare', minDay: 4, cost: 3, icon: 'ember', tags: [],
    desc: '每次不变，有 70% 概率额外升 1 级。',
  },
  {
    id: 'soot-censer', zh: '煤灰香炉', en: 'Soot Censer', rarity: 'rare', minDay: 4, cost: 2, icon: 'censer', tags: ['offense'],
    desc: '本次结果与上次不同时，该剑基础价值 +20 G。',
  },
  {
    id: 'unbroken-oath', zh: '不屈誓言', en: 'Unbroken Oath', rarity: 'rare', minDay: 4, cost: 2, icon: 'oath', tags: ['recovery'],
    desc: '每次损伤，有 70% 概率获得 1 级；通常用于补回损失的一级。',
  },
  {
    id: 'wirebound-scabbard', zh: '铁丝缠鞘', en: 'Wirebound Scabbard', rarity: 'rare', minDay: 4, cost: 2, icon: 'scabbard', tags: ['defense'],
    desc: '每日首次破碎结果改为损伤；每日重置。',
  },
  {
    id: 'worn-grip', zh: '磨秃的握柄', en: 'Worn Grip', rarity: 'rare', minDay: 4, cost: 2, icon: 'grip', tags: [],
    desc: '普通锻造及入神中的速度均 +15%。',
  },
  {
    id: 'black-iron-stone', zh: '黑铁砥石', en: 'Black Iron Stone', rarity: 'rare', minDay: 5, cost: 2, icon: 'blackstone', tags: ['offense'],
    desc: '当前等级 ≥+8 时，剑值乘 1.30。',
  },
  {
    id: 'bronze-cog', zh: '青铜齿轮', en: 'Bronze Cog', rarity: 'rare', minDay: 5, cost: 3, icon: 'bronzecog', tags: ['offense'],
    desc: '每次普通成功，为这把剑永久增加 1 张普通成功签。',
  },
  {
    id: 'dragonscale-tongs', zh: '龙鳞钳', en: 'Dragonscale Tongs', rarity: 'rare', minDay: 5, cost: 2, icon: 'tongs', tags: ['defense'],
    desc: '当前等级 ≥+6 时，破碎概率相对降低 25%。',
  },
  {
    id: 'echo-hammer', zh: '回响之锤', en: 'Echo Hammer', rarity: 'rare', minDay: 5, cost: 2, icon: 'echohammer', tags: ['offense'],
    desc: '每次成功或大成功，独立判定 25% 概率额外升 1 级。',
  },
  {
    id: 'giants-spine', zh: '巨人脊骨', en: "Giant's Spine", rarity: 'rare', minDay: 5, cost: 2, icon: 'spine', tags: ['defense'],
    desc: '每两次损伤为本剑准备一次「破碎改损伤」；最多存一次，保护产生的损伤不为自身充能。',
  },
  {
    id: 'glass-hourglass', zh: '玻璃沙漏', en: 'Glass Hourglass', rarity: 'rare', minDay: 5, cost: 2, icon: 'glasshourglass', tags: ['offense'],
    desc: '入神中的大成功通常合计升 3 级；不是在常规 +2 上再加 3。',
  },
  {
    id: 'golden-cog', zh: '黄金齿轮', en: 'Golden Cog', rarity: 'rare', minDay: 5, cost: 2, icon: 'goldcog', tags: ['offense'],
    desc: '每次普通成功，该剑基础价值 +30 G。',
  },
  {
    id: 'ossuary-kings-scabbard', zh: '骨灰王之鞘', en: "Ossuary King's Scabbard", rarity: 'rare', minDay: 5, cost: 3, icon: 'ossuary', tags: ['recovery'],
    desc: '≥+7 的剑真正破碎时，为本局永久增加 1 张其破碎前一锤结果对应的签。',
  },
  {
    id: 'sealed-rebate', zh: '减税密函', en: 'Sealed Rebate', rarity: 'rare', minDay: 5, cost: 2, icon: 'rebate', tags: ['economy'],
    desc: '当日贡额降低 10%。',
  },
  {
    id: 'smiths-testament', zh: '铁匠遗言', en: "Smith's Testament", rarity: 'rare', minDay: 5, cost: 2, icon: 'testament', tags: ['recovery'],
    desc: '足额进贡且献出的最高等级剑 ≥+10，下一批其中一把继承该等级的 30%。',
  },
  {
    id: 'tax-tally', zh: '征税牌', en: 'Tax Tally', rarity: 'rare', minDay: 5, cost: 3, icon: 'tally', tags: ['economy'],
    desc: '每次足额进贡，获得 1 剑币。',
  },
  {
    id: 'bell-collar', zh: '铃铛项圈', en: 'Bell Collar', rarity: 'rare', minDay: 6, cost: 2, icon: 'collar', tags: ['offense'],
    desc: '入神中的每一锤，使本剑剑值额外乘 1.05。',
  },
  {
    id: 'headless-bell', zh: '无首之钟', en: 'Headless Bell', rarity: 'rare', minDay: 6, cost: 2, icon: 'headlessbell', tags: ['offense'],
    desc: '入神结束时，额外升 1 级。',
  },
  {
    id: 'obsidian-eye', zh: '黑曜石之眼', en: 'Obsidian Eye', rarity: 'rare', minDay: 6, cost: 2, icon: 'obsidian', tags: ['offense'],
    desc: '当前等级 ≥+8 时，将最多 2 张普通成功签转为大成功签。',
  },
  {
    id: 'red-hourglass', zh: '红沙漏', en: 'Red Hourglass', rarity: 'rare', minDay: 6, cost: 2, icon: 'redhourglass', tags: [],
    desc: '入神时长 +1 秒。',
  },
  {
    id: 'royal-spike', zh: '王室长钉', en: 'Royal Spike', rarity: 'rare', minDay: 6, cost: 2, icon: 'spike', tags: ['offense'],
    desc: '普通成功签 +6。',
  },
  {
    id: 'silver-supply-writ', zh: '银质供货许可', en: 'Silver Supply Writ', rarity: 'rare', minDay: 6, cost: 2, icon: 'writ', tags: ['economy'],
    desc: '从下次幽灵商人到访起，基础剑库存 +2。',
  },
  {
    id: 'butterfingers', zh: '笨手笨脚', en: 'Butterfingers', rarity: 'legendary', minDay: 6, cost: 3, icon: 'butterfingers', tags: [], unlock: 'achievement',
    desc: '破碎签 +3，同时大成功签 +5。',
  },
  {
    id: 'dawn-scabbard', zh: '黎明之鞘', en: 'Dawn Scabbard', rarity: 'legendary', minDay: 6, cost: 3, icon: 'dawn', tags: ['recovery'], unlock: 'masterwork',
    desc: '破碎剑的 40% 等级由下一把未经锻造 +0 剑继承，继承时获得 4 点充能。',
  },
  {
    id: 'dragons-pardon', zh: '巨龙赦免状', en: "Dragon's Pardon", rarity: 'legendary', minDay: 6, cost: 4, icon: 'pardon', tags: ['defense'], unlock: 'achievement',
    desc: '在将要因怒气死亡时阻止一次死亡，怒气降低 1，遗物随即消失。',
  },
  {
    id: 'kings-empty-cup', zh: '王的空杯', en: "King's Empty Cup", rarity: 'legendary', minDay: 6, cost: 3, icon: 'cup', tags: ['offense'],
    desc: '每次不变，为本剑持续增加 1 张大成功签。',
  },
  {
    id: 'phoenix-ash', zh: '凤凰之灰', en: 'Phoenix Ash', rarity: 'legendary', minDay: 6, cost: 3, icon: 'ash', tags: ['defense'],
    desc: '每把剑可挡一次破碎，保留等级，代价为剑值损失 40%。',
  },
  {
    id: 'sickle-and-hammer', zh: '镰刀与锤子', en: 'Sickle and Hammer', rarity: 'legendary', minDay: 6, cost: 4, icon: 'sickle', tags: [], unlock: 'achievement',
    desc: '将五类结果的基础签数分别设为 5，后续仍受等级权重与其他修正影响。',
  },
  {
    id: 'split-twin-mirror', zh: '裂开的双镜', en: 'Split Twin Mirror', rarity: 'legendary', minDay: 6, cost: 3, icon: 'mirror', tags: ['offense'],
    desc: '连续两次相同结果时，重复本锤最后一次遗物价值加成。',
  },
  {
    id: 'wandering-ghosts-ledger', zh: '流浪幽灵的账簿', en: "Wandering Ghost's Ledger", rarity: 'legendary', minDay: 6, cost: 3, icon: 'ledger', tags: ['economy'], unlock: 'achievement',
    desc: '从下次幽灵商人到访起，额外提供 2 个商品选项。',
  },
  {
    id: 'pocket-hearth', zh: '随身火炉', en: 'Pocket Hearth', rarity: 'rare', minDay: 7, cost: 3, icon: 'hearth', tags: ['offense'],
    desc: '本局每次足额进贡，使基础价值加成累计增加 20 G。',
  },
  {
    id: 'abyssal-pearl', zh: '深海之珠', en: 'Abyssal Pearl', rarity: 'legendary', minDay: 7, cost: 4, icon: 'pearl', tags: ['defense'], unlock: 'masterwork',
    desc: '损伤签 +3；每把剑前两次损伤不掉级，损伤遗物仍触发。',
  },
  {
    id: 'ceaseless-driveshaft', zh: '永转传动轴', en: 'Ceaseless Driveshaft', rarity: 'legendary', minDay: 7, cost: 4, icon: 'driveshaft', tags: ['offense'], unlock: 'masterwork',
    desc: '本剑每累计两次普通成功，额外升 1 级，不要求连续。',
  },
  {
    id: 'eternal-seed', zh: '永恒之种', en: 'Eternal Seed', rarity: 'legendary', minDay: 7, cost: 4, icon: 'seed', tags: ['offense'], unlock: 'masterwork',
    desc: '不变签 +6；每次不变，该剑基础价值 +40 G。',
  },
  {
    id: 'perfect-mana-core', zh: '完美魔力核', en: 'Perfect Mana Core', rarity: 'legendary', minDay: 7, cost: 4, icon: 'manacore', tags: ['offense'], unlock: 'masterwork',
    desc: '入神期间大成功签 +6。',
  },
  {
    id: 'possessed-bellows', zh: '入神风箱', en: 'Possessed Bellows', rarity: 'legendary', minDay: 7, cost: 3, icon: 'bellows', tags: [],
    desc: '入神中的锻造速度 +30%。',
  },
  {
    id: 'royal-change', zh: '王室的零钱', en: 'Royal Change', rarity: 'legendary', minDay: 7, cost: 4, icon: 'change', tags: ['economy'], unlock: 'achievement',
    desc: '超额贡品的 30% 可抵扣下一日需求，最多降低下一日贡额的 30%。',
  },
  {
    id: 'unyielding-cornerstone', zh: '不倒基石', en: 'Unyielding Cornerstone', rarity: 'legendary', minDay: 7, cost: 4, icon: 'cornerstone', tags: ['defense'], unlock: 'masterwork',
    desc: '每把剑首次破碎结果改为损伤。',
  },
  {
    id: 'supply-permit', zh: '追加供货许可', en: 'Supply Permit', rarity: 'rare', minDay: 8, cost: 4, icon: 'permit', tags: ['economy'],
    desc: '从下一批供给起，每日多获得 1 把实体剑。',
  },
  {
    id: 'dragon-heart', zh: '龙之心', en: 'Dragon Heart', rarity: 'legendary', minDay: 8, cost: 4, icon: 'dragonheart', tags: ['offense'], unlock: 'masterwork',
    desc: '挥锤前等级 ≥+7 时，每次成功或大成功使本剑剑值额外乘 1.15。',
  },
  {
    id: 'seal-of-twins', zh: '双生印', en: 'Seal of Twins', rarity: 'legendary', minDay: 8, cost: 4, icon: 'twins', tags: ['economy'], unlock: 'masterwork',
    desc: '每次未真正碎剑的挥锤后，2% 概率复制本剑；复制等级、价值及相关层数。',
  },
  {
    id: 'undertakers-ledger', zh: '殡葬师的账簿', en: "Undertaker's Ledger", rarity: 'legendary', minDay: 8, cost: 4, icon: 'undertakerledger', tags: ['recovery'], unlock: 'achievement',
    desc: '≥+7 的剑真正破碎后，次日多供给 1 把剑，每日最多多 2 把。',
  },
  {
    id: 'undying-wick', zh: '不灭灯芯', en: 'Undying Wick', rarity: 'legendary', minDay: 8, cost: 4, icon: 'wick', tags: [], unlock: 'achievement',
    desc: '入神时长 +2 秒。',
  },
  {
    id: 'dragon-signet', zh: '龙之印', en: 'Dragon Signet', rarity: 'legendary', minDay: 9, cost: 3, icon: 'dragonsignet', tags: ['offense'],
    desc: '当前等级 ≥+12 时，剑值乘 1.50。',
  },
  {
    id: 'oracle-die', zh: '先知之骰', en: 'Oracle Die', rarity: 'legendary', minDay: 9, cost: 3, icon: 'oracledie', tags: ['offense'],
    desc: '大成功签 +4。',
  },
  {
    id: 'lifetime-contract', zh: '终身契约', en: 'Lifetime Contract', rarity: 'legendary', minDay: 9, cost: 5, icon: 'contract', tags: ['economy'], unlock: 'achievement',
    desc: '立即免除加热；下一批供给起，新剑至少 +7。',
  },
];

export const RELIC_BY_ID = Object.fromEntries(RELICS.map(r => [r.id, r]));

export function relicName(id) {
  return RELIC_BY_ID[id]?.zh || id;
}

// Shop weighting aid: relic ids considered defensive / recovery for days 2-6 bias.
export const RECOVERY_RELICS = RELICS.filter(r => r.tags.includes('recovery') || r.tags.includes('defense')).map(r => r.id);
