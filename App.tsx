import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import MyStocksPage from "./pages/MyStocksPage";
import MyFundPage from "./pages/MyFundPage";
import LeaguePage from "./pages/LeaguePage";
import SellStockForm from "./components/SellStockForm";
import NoticeBanner from "./components/NoticeBanner";
import HotSidebar from "./components/HotSidebar";
import StockDetailModal from "./components/StockDetailModal";
import RequirePlayer from "./components/RequirePlayer";
import { StockProvider } from "./context/StockContext";
import { LeagueProvider } from "./context/LeagueContext";
import { UI } from "./constants";

const App: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <StockProvider>
      <LeagueProvider>
        <HashRouter>
          <div className="flex min-h-screen flex-col bg-gray-900 text-gray-100">
            <Navbar />
            <NoticeBanner />
            <div className="relative z-10 flex flex-grow flex-col lg:flex-row">
              <HotSidebar />
              <main className="container relative z-10 mx-auto min-w-0 flex-grow px-2 py-8 sm:px-4">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/league" element={<LeaguePage />} />
                  <Route
                    path="/my-stocks"
                    element={
                      <RequirePlayer>
                        <MyStocksPage />
                      </RequirePlayer>
                    }
                  />
                  <Route
                    path="/my-fund"
                    element={
                      <RequirePlayer>
                        <MyFundPage />
                      </RequirePlayer>
                    }
                  />
                  <Route
                    path="/sell/:stockCompany"
                    element={
                      <RequirePlayer>
                        <SellStockForm />
                      </RequirePlayer>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
            <footer className="relative z-10 mt-auto border-t border-gray-700 bg-gray-800 px-4 py-5 text-center text-sm text-gray-500">
              <p className="mx-auto mb-3 max-w-3xl text-left text-xs leading-relaxed text-gray-400 sm:text-center">
                {UI.MARKET_DISCLAIMER}
              </p>
              <p>
                © {year} Erick Stocks Simulator. Portfolio demo — mock trading
                only. Not financial advice.
              </p>
            </footer>
            <StockDetailModal />
          </div>
        </HashRouter>
      </LeagueProvider>
    </StockProvider>
  );
};

export default App;
