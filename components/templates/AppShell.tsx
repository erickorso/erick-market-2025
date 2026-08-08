import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useI18n } from "../../context/I18nContext";
import HomePage from "../../pages/HomePage";
import MyStocksPage from "../../pages/MyStocksPage";
import MyFundPage from "../../pages/MyFundPage";
import LeaguePage from "../../pages/LeaguePage";
import Navbar from "../organisms/Navbar";
import NoticeBanner from "../organisms/NoticeBanner";
import HotSidebar from "../organisms/HotSidebar";
import RankSidebar from "../organisms/RankSidebar";
import SellStockForm from "../organisms/SellStockForm";
import StockDetailModal from "../organisms/StockDetailModal";
import { protectedRoute } from "../routing/RequireAuth";

/**
 * Page frame: header, the two sidebars, the routed centre column, and the
 * globally mounted detail modal. Only the centre column scrolls.
 */
const AppShell: React.FC = () => {
  const year = new Date().getFullYear();
  const { t } = useI18n();

  return (
    <HashRouter>
      <div className="flex h-dvh flex-col overflow-hidden bg-slate-100 text-slate-900 dark:bg-gray-900 dark:text-gray-100">
        <header className="relative z-50 shrink-0">
          <Navbar />
          <NoticeBanner />
        </header>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:flex-row">
          <HotSidebar />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
            <main className="container relative z-10 mx-auto w-full flex-1 px-2 py-8 sm:px-4">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route
                  path="/league"
                  element={protectedRoute(<LeaguePage />)}
                />
                <Route
                  path="/my-stocks"
                  element={protectedRoute(<MyStocksPage />)}
                />
                <Route
                  path="/my-fund"
                  element={protectedRoute(<MyFundPage />)}
                />
                <Route
                  path="/sell/:stockCompany"
                  element={protectedRoute(<SellStockForm />)}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <footer className="mt-auto border-t border-slate-200 bg-white px-4 py-5 text-center text-sm text-slate-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
              <p>
                © {year} Erick Stocks Simulator. {t("footerDemo")}
              </p>
            </footer>
          </div>

          <RankSidebar />
        </div>

        <StockDetailModal />
      </div>
    </HashRouter>
  );
};

export default AppShell;
