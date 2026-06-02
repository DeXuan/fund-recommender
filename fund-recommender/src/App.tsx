import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <Router>
      <div className="app">
        <Navbar />
        <div style={{ position: 'sticky', top: 60, zIndex: 99, padding: '8px 24px' }}>
          <DataStatus />
        </div>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/funds" element={<FundList />} />
            <Route path="/funds/:code" element={<FundDetail />} />
            <Route path="/qdii" element={<QDIIFunds />} />
            <Route path="/compare" element={<FundCompare />} />
            <Route path="/risk-assessment" element={<RiskAssessment />} />
            <Route path="/dca-calculator" element={<DCACalculator />} />
            <Route path="/market" element={<MarketAnalysis />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
