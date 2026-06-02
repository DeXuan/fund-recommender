import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: '首页' },
  { path: '/funds', label: '基金列表' },
  { path: '/qdii', label: 'QDII基金' },
  { path: '/compare', label: '基金对比' },
  { path: '/risk-assessment', label: '风险评估' },
  { path: '/dca-calculator', label: '定投计算器' },
  { path: '/market', label: '市场分析' },
];

export default function Navbar() {
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">💰</span>
          <span className="brand-text">支付宝基金推荐</span>
        </Link>
        <div className="navbar-menu">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`navbar-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
