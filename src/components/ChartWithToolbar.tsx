import { useState, useRef } from 'react';
import { Card, Button, Space, Modal, Tooltip } from 'antd';
import { FullscreenOutlined, DownloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useTheme } from '../contexts/ThemeContext';
import { getEchartsTheme } from '../utils/echarts-theme';

interface ChartWithToolbarProps {
  title?: string;
  option: Record<string, unknown>;
  height?: number;
  extra?: React.ReactNode;
}

export default function ChartWithToolbar({ title, option, height = 300, extra }: ChartWithToolbarProps) {
  const { isDark } = useTheme();
  const chartRef = useRef<ReactECharts>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const handleExport = () => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    const url = instance.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: isDark ? '#1a1a1a' : '#fff',
    });
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'chart'}_${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  const toolbar = (
    <Space>
      {extra}
      <Tooltip title="导出图片">
        <Button size="small" icon={<DownloadOutlined />} onClick={handleExport} />
      </Tooltip>
      <Tooltip title="全屏">
        <Button size="small" icon={<FullscreenOutlined />} onClick={() => setFullscreen(true)} />
      </Tooltip>
    </Space>
  );

  return (
    <>
      <Card title={title} extra={toolbar} size="small">
        <ReactECharts
          ref={chartRef}
          theme={getEchartsTheme(isDark)}
          option={option}
          style={{ height }}
          opts={{ renderer: 'svg' }}
        />
      </Card>
      <Modal
        open={fullscreen}
        onCancel={() => setFullscreen(false)}
        footer={null}
        width="90vw"
        style={{ top: 20 }}
        title={title}
      >
        <ReactECharts
          theme={getEchartsTheme(isDark)}
          option={option}
          style={{ height: '70vh' }}
          opts={{ renderer: 'svg' }}
        />
      </Modal>
    </>
  );
}
