import React from 'react';

export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  icon: string;
  category: string;
  argPlaceholder?: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: '/diagnose', description: '基金深度诊断', usage: '/diagnose 110011', icon: '🔬', category: '分析', argPlaceholder: '基金代码' },
  { name: '/portfolio', description: '持仓综合分析', usage: '/portfolio', icon: '📊', category: '持仓' },
  { name: '/market', description: '市场行情解读', usage: '/market 半导体', icon: '🌍', category: '市场', argPlaceholder: '行业/指数' },
  { name: '/stockpick', description: 'AI智能选股', usage: '/stockpick 医药', icon: '⚡', category: '选股', argPlaceholder: '行业关键词' },
  { name: '/risk', description: '风险评估分析', usage: '/risk', icon: '🛡️', category: '风控' },
  { name: '/dca', description: '定投方案规划', usage: '/dca 沪深300 1000', icon: '📅', category: '定投', argPlaceholder: '标的 金额' },
];

export function parseSlashCommand(input: string): { command: SlashCommand | null; args: string } {
  const trimmed = input.trim();
  for (const cmd of SLASH_COMMANDS) {
    if (trimmed.startsWith(cmd.name + ' ') || trimmed === cmd.name) {
      return { command: cmd, args: trimmed.slice(cmd.name.length).trim() };
    }
  }
  return { command: null, args: trimmed };
}
