import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Spin } from 'antd';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import DataStatus from './components/DataStatus';
import ErrorBoundary from './components/ErrorBoundary';

const Home = lazy(() => import('./pages/Home'));
const FundList = lazy(() => import('./pages/FundList'));
const FundDetail = lazy(() => import('./pages/FundDetail'));
const RiskAssessment = lazy(() => import('./pages/RiskAssessment'));
const DCACalculator = lazy(() => import('./pages/DCACalculator'));
const MarketAnalysis = lazy(() => import('./pages/MarketAnalysis'));
const QDIIFunds = lazy(() => import('./pages/QDIIFunds'));
const IndustryAnalysis = lazy(() => import('./pages/IndustryAnalysis'));
const HS300Analysis = lazy(() => import('./pages/HS300Analysis'));
const Login = lazy(() => import('./pages/Login'));
const Portfolio = lazy(() => import('./pages/Portfolio'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>}>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </Layout.Content>
        </Layout>
      </AuthProvider>
    </Router>
  );
}

export default App;
