import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Spin } from 'antd';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import DataStatus from './components/DataStatus';
import ErrorBoundary from './components/ErrorBoundary';
import GsapEnhancer from './components/GsapEnhancer';

const Home = lazy(() => import('./pages/Home'));
const FundList = lazy(() => import('./pages/FundList'));
const FundDetail = lazy(() => import('./pages/FundDetail'));
const QDIIFunds = lazy(() => import('./pages/QDIIFunds'));
const IndustryAnalysis = lazy(() => import('./pages/IndustryAnalysis'));
const HS300Analysis = lazy(() => import('./pages/HS300Analysis'));

const CMBProducts = lazy(() => import('./pages/CMBProducts'));
const CMBProductDetail = lazy(() => import('./pages/CMBProductDetail'));

const Login = lazy(() => import('./pages/Login'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const MarketEvents = lazy(() => import('./pages/MarketEvents'));

const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const SystemMonitor = lazy(() => import('./pages/admin/SystemMonitor'));
const Subscription = lazy(() => import('./pages/Subscription'));
const StockPicker = lazy(() => import('./pages/StockPicker'));
const Profile = lazy(() => import('./pages/Profile'));
const FundCompare = lazy(() => import('./pages/FundCompare'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
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
        <Route path="/risk-assessment" element={<Navigate to="/portfolio" replace />} />
        <Route path="/dca-calculator" element={<Navigate to="/portfolio" replace />} />
        <Route path="/market" element={<Navigate to="/industry" replace />} />
        <Route path="/industry" element={<IndustryAnalysis />} />
        <Route path="/events" element={<MarketEvents />} />
        <Route path="/hs300" element={<HS300Analysis />} />
        <Route path="/cmb-products" element={<CMBProducts />} />
        <Route path="/cmb-products/:code" element={<CMBProductDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
        <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
        <Route path="/stock-picker" element={<ProtectedRoute><StockPicker /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/fund-compare" element={<FundCompare />} />
        <Route path="/admin/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
        <Route path="/admin/monitor" element={<AdminRoute><SystemMonitor /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <Router basename="/web">
      <AuthProvider>
        <Layout style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
          <GsapEnhancer />
          <Navbar />
          <div style={{ position: 'sticky', top: 64, zIndex: 99, padding: '8px 24px', background: 'var(--bg-primary)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--border-color-light)' }}>
            <DataStatus />
          </div>
          <Layout.Content style={{ maxWidth: 1800, margin: '0 auto', padding: '20px 24px', width: '100%' }}>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </Layout.Content>
          <Footer />
        </Layout>
      </AuthProvider>
    </Router>
  );
}

export default App;
