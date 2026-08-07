import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import MyStocksPage from "./pages/MyStocksPage";
import MyFundPage from "./pages/MyFundPage";
import SellStockForm from "./components/SellStockForm";
import NoticeBanner from "./components/NoticeBanner";
import HotSidebar from "./components/HotSidebar";
import StockDetailModal from "./components/StockDetailModal";
import { StockProvider } from "./context/StockContext";

const App: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <StockProvider>
      <HashRouter>
        <div className="flex min-h-screen flex-col bg-gray-900 text-gray-100">
          <Navbar />
          <NoticeBanner />
          <div className="flex flex-grow flex-col lg:flex-row relative z-10">
            <HotSidebar />
            <main className="container relative z-10 mx-auto min-w-0 flex-grow px-2 py-8 sm:px-4">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/my-stocks" element={<MyStocksPage />} />
                <Route path="/my-fund" element={<MyFundPage />} />
                <Route path="/sell/:stockCompany" element={<SellStockForm />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
          <footer className="mt-auto bg-gray-800 p-4 text-center text-sm text-gray-500">
            © {year} Erick Stocks Simulator. Portfolio demo — mock trading only.
          </footer>
          <StockDetailModal />
        </div>
      </HashRouter>
    </StockProvider>
  );
};

export default App;
