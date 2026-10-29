import * as E from './engine.js';

// Guidance reads the real run; it never changes probabilities, supply or tax.
export function tutorialObjective(state) {
  const t = state?.tutorial;
  if (!t?.active) return null;
  if (state.phase === 'dead' || state.phase === 'victory') return null;
  if (state.day > (t.startDay || 1)) return { key: 'complete', step: 5, tab: 'forge', title: '你活过了这一天。', text: '贡剑已经换成金币，新一天的三把剑也到了。遗物商亭从第 2 天开放；拿不需要的剑换剑币，再购买遗物。幽灵商人每 3 天到访一次。', label: '接下来，自己掌锤', action: 'finish' };
  if (state.phase !== 'playing') return null;
  const quota = E.currentQuota(state);
  const offered = E.tributeTotal(state);
  const remaining = Math.max(0, quota - offered);
  const available = state.swords.filter(s => !['tribute', 'overflow', 'broken'].includes(s.location));
  const candidates = available.slice().sort((a, b) => E.swordValue(state, b) - E.swordValue(state, a));
  const total = candidates.reduce((n, s) => n + E.swordValue(state, s), offered);
  const format = n => Math.round(n).toLocaleString('en-US');
  if (offered >= quota) return { key: 'bell', step: 4, tab: 'tribute', title: '贡品够了，敲铃收工。', text: `贡台已有 ${format(offered)} G，达到今日 ${format(quota)} G 的需求。敲铃会收走台上的剑，把它们换成金币；留在工坊的剑可以带到明天。`, label: '检查贡品并敲铃', action: 'ring' };
  if (total >= quota || (candidates.length && candidates.every(s => s.remnant))) {
    const sword = candidates[0];
    return { key: 'tribute', step: 3, tab: 'tribute', swordId: sword.id, title: '先把今天的贡品留好。', text: `把这把价值 ${format(E.swordValue(state, sword))} G 的剑放上贡台。台上还差 ${format(remaining)} G。金币余额不能抵贡，敲铃前仍可取回台上的剑。`, label: '把这把剑放上贡台', action: 'tribute' };
  }
  const sword = E.getAnvilSword(state);
  if (sword && !sword.remnant) {
    if (!sword.heat && !E.hasRelic(state, 'lifetime-contract')) return { key: 'heat', step: 1, tab: 'forge', title: '先让剑吃透炉火。', text: '点击炉火旁的「加热」，或按 H。每把剑只需加热一次，之后可以连续锻造。', label: '加热这把剑', action: 'heat' };
    return { key: 'hammer', step: 2, tab: 'forge', title: sword.charge >= 10 ? '下一锤，进入入神！' : '挥锤增值，也要懂得收手。', text: `当前工坊剑值合计 ${format(total)} G，距离足额还差 ${format(quota - total)} G。每锤先看破碎概率；充能满 10 后，下一锤开启基础 4 秒的入神，期间不会破碎。够交贡时我会提醒你停手。`, label: '挥锤 · SPACE', action: 'hammer' };
  }
  const next = candidates.find(s => !s.remnant);
  if (next) return { key: 'place', step: 0, tab: 'inventory', swordId: next.id, title: state.lastHammer?.trueBreak ? '剑碎了，换一把再来。' : '拿起你的第一把剑。', text: '每天会送来三把基础剑。点击库存里的「上砧」，也可以把剑拖到铁砧上。今天先学会锻剑，再交贡活到明天。', label: '把一把剑放上铁砧', action: 'place' };
  if (E.overflowSwords(state).length) return { key: 'claim', step: 0, tab: 'inventory', title: '还有待放置的剑。', text: '先领取一把待放置的剑，再继续锻造。', label: '领取一把剑', action: 'claim' };
  return { key: 'recover', step: 4, tab: 'tribute', title: '今天先活下来。', text: `可锻造的剑用完了，贡台还差 ${format(remaining)} G。欠贡增加一档怒气，达到第三档才会死亡。${state.anger < 2 ? '今天敲铃仍能活到明天，并拿到三把新剑。' : '当前已是最后警告；不要贸然敲铃，检查回溯道具和待放置的剑。'}`, label: state.anger < 2 ? '确认欠贡，进入明天' : '检查工坊与道具', action: state.anger < 2 ? 'ring' : 'kit' };
}
