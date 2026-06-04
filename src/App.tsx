import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Spin } from 'antd';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import DataStatus from './components/DataStatus';
import Home from './pages/Home';
import FundList from './pages/FundList';
import FundDetail from './pages/FundDetail';
import RiskAssessment from './pages/RiskAssessment';
import DCACalculator from './pages/DCACalculator';
import MarketAnalysis from './pages/MarketAnalysis';
import QDIIFunds from './pages/QDIIFunds';
import IndustryAnalysis from './pages/IndustryAnalysis';
import HS300Analysis from './pages/HS300Analysis';
import Login from './pages/Login';
import Portfolio from './pages/Portfolio';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/funds" element={<FundList />} />
      <Route path="/funds/:code" element={<FundDetail />} />
      <Route path="/qdii" element={<QDIIFunds />} />
      <Route path="/risk-assessment" element={<RiskAssessment />} />
      <Route path="/dca-calculator" element={<DCACalculator />} />
      <Route path="/market" element={<MarketAnalysis />} />
      <Route path="/industry" element={<IndustryAnalysis />} />
      <Route path="/hs300" element={<HS300Analysis />} />
      <Route path="/login" element={<Login />} />
      <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <Router basename="/web">
      <AuthProvider>
        <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
          <Navbar />
          <div style={{ position: 'sticky', top: 64, zIndex: 99, padding: '8px 24px', background: 'rgba(245, 245, 245, 0.8)', backdropFilter: 'blur(8px)' }}>
            <DataStatus />
          </div>
          <Layout.Content style={{ maxWidth: 1800, margin: '0 auto', padding: '20px 24px', width: '100%' }}>
            <AppRoutes />
          </Layout.Content>
        </Layout>
      </AuthProvider>
    </Router>
  );
}

export default App;
