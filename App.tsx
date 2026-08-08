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
import RankSidebar from "./components/RankSidebar";
import StockDetailModal from "./components/StockDetailModal";
import RequirePlayer from "./components/RequirePlayer";
import { StockProvider } from "./context/StockContext";
import { LeagueProvider } from "./context/LeagueContext";
import { I18nProvider, useI18n } from "./context/I18nContext";

const AppShell: React.FC = () => {
  const year = new Date().getFullYear();
  const { t } = useI18n();

  return (
    <HashRouter>
      <div className="flex min-h-screen flex-col bg-gray-900 text-gray-100">
        <header className="sticky top-0 z-50">
          <Navbar />
          <NoticeBanner />
        </header>
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
          <RankSidebar />
        </div>
        <footer className="relative z-10 mt-auto border-t border-gray-700 bg-gray-800 px-4 py-5 text-center text-sm text-gray-500">
          <p>
            © {year} Erick Stocks Simulator. {t("footerDemo")}
          </p>
        </footer>
        <StockDetailModal />
      </div>
    </HashRouter>
  );
};

const App: React.FC = () => (
  <I18nProvider>
    <StockProvider>
      <LeagueProvider>
        <AppShell />
      </LeagueProvider>
    </StockProvider>
  </I18nProvider>
);

export default App;
