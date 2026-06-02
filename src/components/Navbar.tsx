import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Drawer, Grid } from 'antd';
import {
  HomeOutlined,
  FundOutlined,
  GlobalOutlined,
  SwapOutlined,
  SafetyOutlined,
  CalculatorOutlined,
  LineChartOutlined,
  MenuOutlined,
  StockOutlined,
  BarChartOutlined,
} from '@ant-design/icons';

const { useBreakpoint } = Grid;

const navItems = [
  { key: '/', label: '首页', icon: <HomeOutlined /> },
  { key: '/funds', label: '基金列表', icon: <FundOutlined /> },
  { key: '/industry', label: '行业分析', icon: <BarChartOutlined /> },
  { key: '/hs300', label: '沪深300', icon: <StockOutlined /> },
  { key: '/qdii', label: 'QDII基金', icon: <GlobalOutlined /> },
  { key: '/compare', label: '基金对比', icon: <SwapOutlined /> },
  { key: '/risk-assessment', label: '风险评估', icon: <SafetyOutlined /> },
  { key: '/dca-calculator', label: '定投计算器', icon: <CalculatorOutlined /> },
  { key: '/market', label: '市场分析', icon: <LineChartOutlined /> },
];

export default function Navbar() {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const menuItems = navItems.map((item) => ({
    ...item,
    label: <Link to={item.key}>{item.label}</Link>,
  }));

  const selectedKey = navItems.find(
    (item) => item.key === '/' ? location.pathname === '/' : location.pathname.startsWith(item.key)
  )?.key || '/';

  return (
    <Layout.Header
      style={{
        background: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '0 20px',
        height: 60,
        lineHeight: '60px',
      }}
    >
      <div style={{ maxWidth: 1800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <StockOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <span style={{ fontWeight: 600, fontSize: 18, color: '#1677ff', whiteSpace: 'nowrap' }}>基金推荐助手</span>
        </Link>

        {isMobile ? (
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setDrawerOpen(true)}
            style={{ fontSize: 18 }}
          />
        ) : (
          <Menu
            mode="horizontal"
            selectedKeys={[selectedKey]}
            items={menuItems}
            style={{ border: 'none', flex: 1, justifyContent: 'flex-end' }}
          />
        )}
      </div>

      <Drawer
        title="导航"
        placement="right"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        width={240}
      >
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={navItems.map((item) => ({
            ...item,
            label: <Link to={item.key} onClick={() => setDrawerOpen(false)}>{item.label}</Link>,
          }))}
          style={{ border: 'none' }}
        />
      </Drawer>
    </Layout.Header>
  );
}
