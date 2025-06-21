
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import MyStocksPage from './pages/MyStocksPage';
import MyFundPage from './pages/MyFundPage';
import SellStockForm from './components/SellStockForm';
import { StockProvider } from './context/StockContext';

const App: React.FC = () => {
  return (
    <StockProvider>
      <HashRouter>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-grow container mx-auto px-0 sm:px-4 py-8">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/my-stocks" element={<MyStocksPage />} />
              <Route path="/my-fund" element={<MyFundPage />} />
              <Route path="/sell/:stockCompany" element={<SellStockForm />} /> {/* Changed from :stockName */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <footer className="bg-gray-800 text-center p-4 text-sm text-gray-500 mt-auto">
            © ${new Date().getFullYear()} Erick Stocks Simulator. All rights reserved. {/* Changed from erickorso stocks */}
          </footer>
        </div>
      </HashRouter>
    </StockProvider>
  );
};

export default App;