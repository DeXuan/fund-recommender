import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, Spin, Grid } from 'antd';
const { useBreakpoint } = Grid;
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import DataStatus from './components/DataStatus';
import ErrorBoundary from './components/ErrorBoundary';

const GsapEnhancer = lazy(() => import('./components/GsapEnhancer'));
const FloatingChat = lazy(() => import('./components/FloatingChat'));
const ParticleCanvas = lazy(() => import('./components/ParticleCanvas'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));

const Home = lazy(() => import('./pages/Home'));
const FundList = lazy(() => import('./pages/FundList'));
const FundDetail = lazy(() => import('./pages/FundDetail'));
const QDIIFunds = lazy(() => import('./pages/QDIIFunds'));
const IndustryAnalysis = lazy(() => import('./pages/IndustryAnalysis'));

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
const AIAssistant = lazy(() => import('./pages/AIAssistant'));
const FundDiagnosis = lazy(() => import('./pages/FundDiagnosis'));
const ValuationCenter = lazy(() => import('./pages/ValuationCenter'));
const PortfolioOverlap = lazy(() => import('./pages/PortfolioOverlap'));
const About = lazy(() => import('./pages/About'));

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
        <Route path="/hs300" element={<Navigate to="/funds" replace />} />
        <Route path="/cmb-products" element={<CMBProducts />} />
        <Route path="/cmb-products/:code" element={<CMBProductDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
        <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
        <Route path="/stock-picker" element={<ProtectedRoute><StockPicker /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/fund-compare" element={<FundCompare />} />
        <Route path="/ai-assistant" element={<AIAssistant />} />
        <Route path="/fund-diagnosis" element={<ProtectedRoute><FundDiagnosis /></ProtectedRoute>} />
        <Route path="/fund-diagnosis/:code" element={<ProtectedRoute><FundDiagnosis /></ProtectedRoute>} />
        <Route path="/valuation-center" element={<ProtectedRoute><ValuationCenter /></ProtectedRoute>} />
        <Route path="/portfolio-overlap" element={<ProtectedRoute><PortfolioOverlap /></ProtectedRoute>} />
        <Route path="/admin/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
        <Route path="/admin/monitor" element={<AdminRoute><SystemMonitor /></AdminRoute>} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  const screens = useBreakpoint();
  const isMobile = !screens.sm;
  return (
    <Router basename={import.meta.env.VITE_CAPACITOR === 'true' ? '' : '/web'}>
      <AuthProvider>
        <Layout style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
          <Suspense fallback={null}><ParticleCanvas /></Suspense>
          <Suspense fallback={null}><GsapEnhancer /></Suspense>
          <Navbar />
          <div role="status" aria-live="polite" aria-label="数据状态" style={{ position: 'sticky', top: 64, zIndex: 99, padding: isMobile ? '6px 12px' : '8px 24px', background: 'var(--bg-primary)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--border-color-light)' }}>
            <DataStatus />
          </div>
          <Layout.Content role="main" aria-label="主要内容" style={{ maxWidth: 1800, margin: '0 auto', padding: isMobile ? '12px 12px' : '20px 24px', width: '100%' }}>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </Layout.Content>
          <Footer />
          <Suspense fallback={null}><FloatingChat /></Suspense>
          <Suspense fallback={null}><CommandPalette /></Suspense>
        </Layout>
      </AuthProvider>
    </Router>
  );
}

export default App;
