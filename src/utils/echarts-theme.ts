import * as echarts from 'echarts';

const darkTheme = {
  backgroundColor: 'transparent',
  textStyle: { color: '#a0a0a0' },
  title: { textStyle: { color: '#e8e8e8' }, subtextStyle: { color: '#a0a0a0' } },
  legend: { textStyle: { color: '#a0a0a0' } },
  tooltip: {
    backgroundColor: '#262626',
    borderColor: '#444',
    textStyle: { color: '#e8e8e8' },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#444' } },
    axisTick: { lineStyle: { color: '#444' } },
    axisLabel: { color: '#a0a0a0' },
    splitLine: { lineStyle: { color: '#333' } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: '#444' } },
    axisTick: { lineStyle: { color: '#444' } },
    axisLabel: { color: '#a0a0a0' },
    splitLine: { lineStyle: { color: '#333' } },
  },
  line: { itemStyle: { borderWidth: 2 } },
  bar: { itemStyle: { barBorderWidth: 0, barBorderColor: '#333' } },
  pie: {
    itemStyle: { borderColor: '#1a1a1a', borderWidth: 1 },
    label: { color: '#a0a0a0' },
  },
  gauge: {
    axisLine: { lineStyle: { color: [[0.4, '#52c41a'], [0.6, '#faad14'], [1, '#ff4d4f']] } },
    axisTick: { lineStyle: { color: '#666' } },
    splitLine: { lineStyle: { color: '#666' } },
    axisLabel: { color: '#a0a0a0' },
    title: { color: '#e8e8e8' },
    detail: { color: '#e8e8e8' },
  },
};

let registered = false;

export function registerEchartsDarkTheme() {
  if (!registered) {
    echarts.registerTheme('dark', darkTheme);
    registered = true;
  }
}

export function getEchartsTheme(isDark: boolean): string {
  return isDark ? 'dark' : undefined as any;
}
