import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import Navbar from './components/Navbar';
import DataStatus from './components/DataStatus';
import Home from './pages/Home';
import FundList from './pages/FundList';
import FundDetail from './pages/FundDetail';
import FundCompare from './pages/FundCompare';
import RiskAssessment from './pages/RiskAssessment';
import DCACalculator from './pages/DCACalculator';
import MarketAnalysis from './pages/MarketAnalysis';
import QDIIFunds from './pages/QDIIFunds';
import IndustryAnalysis from './pages/IndustryAnalysis';
import HS300Analysis from './pages/HS300Analysis';

function App() {
  return (
    <Router basename="/web">
      <Layout style={{ minHeight: '100vh' }}>
        <Navbar />
        <div style={{ position: 'sticky', top: 60, zIndex: 99, padding: '8px 24px' }}>
          <DataStatus />
        </div>
        <Layout.Content style={{ maxWidth: 1800, margin: '0 auto', padding: '20px', width: '100%' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/funds" element={<FundList />} />
            <Route path="/funds/:code" element={<FundDetail />} />
            <Route path="/qdii" element={<QDIIFunds />} />
            <Route path="/compare" element={<FundCompare />} />
            <Route path="/risk-assessment" element={<RiskAssessment />} />
            <Route path="/dca-calculator" element={<DCACalculator />} />
            <Route path="/market" element={<MarketAnalysis />} />
            <Route path="/industry" element={<IndustryAnalysis />} />
            <Route path="/hs300" element={<HS300Analysis />} />
          </Routes>
        </Layout.Content>
      </Layout>
    </Router>
  );
}

export default App;
