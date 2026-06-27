import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Empty, message, Tooltip } from 'antd';
import { ReloadOutlined, HistoryOutlined } from '@ant-design/icons';
import { stockPickerApi } from '../../services/api';

const PickHistoryTab: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadHistory = async (p = 1) => {
    setLoading(true);
    try {
      const res = await stockPickerApi.getHistory({ page: p, pageSize: 20 });
      setHistory(res.items || []);
      setTotal(res.total || 0);
      setPage(p);
    } catch (e: any) {
      if (!e.message?.includes('会员')) message.error('加载历史失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  const columns = [
    { title: '时间', dataIndex: 'created_at', width: 160, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: '策略', dataIndex: 'strategy', width: 100, render: (v: string) => {
      const labels: Record<string, string> = { aggressive: '激进', balanced: '均衡', conservative: '稳健', value: '价值' };
      return <Tag color="blue">{labels[v] || v}</Tag>;
    }},
    { title: '结果数', dataIndex: 'result_count', width: 80, render: (v: number) => <Tag>{v}</Tag> },
    { title: 'Top基金', dataIndex: 'results', render: (v: any[]) => {
      if (!v || v.length === 0) return '-';
      const top = v[0];
      return (
        <Tooltip title={v.slice(0, 5).map((r: any) => `${r.name || r.fund?.name}: ${r.score}分`).join('\n')}>
          <span>{top.name || top.fund?.name} <Tag color="green">{top.score}分</Tag></span>
        </Tooltip>
      );
    }},
    { title: '操作', width: 80, render: (_: any, r: any) => (
      <Button size="small" icon={<ReloadOutlined />} onClick={() => {
        const filters = typeof r.filters === 'string' ? JSON.parse(r.filters) : r.filters;
        message.info(`已加载筛选条件：${JSON.stringify(filters)}`);
      }}>重跑</Button>
    )},
  ];

  if (history.length === 0 && !loading) {
    return <Empty description="暂无选股历史" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#8c8c8c' }}>
          <HistoryOutlined /> 共 {total} 条历史记录
        </span>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => loadHistory()}>刷新</Button>
      </div>
      <Table
        dataSource={history}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ current: page, total, pageSize: 20, onChange: loadHistory, showSizeChanger: false }}
      />
    </div>
  );
};

export default PickHistoryTab;
