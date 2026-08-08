import React from "react";
import AppShell from "./components/templates/AppShell";
import { StockProvider } from "./context/StockContext";
import { LeagueProvider } from "./context/LeagueContext";
import { I18nProvider } from "./context/I18nContext";
import { AuthProvider } from "./context/AuthContext";
import { UserProvider } from "./context/UserContext";
import { AuthPromptProvider } from "./context/AuthPromptContext";
import { ThemeProvider } from "./context/ThemeContext";

/** Provider stack. The frame itself lives in the AppShell template. */
const App: React.FC = () => (
  <ThemeProvider>
    <I18nProvider>
      <AuthProvider>
        <UserProvider>
          <AuthPromptProvider>
            <StockProvider>
              <LeagueProvider>
                <AppShell />
              </LeagueProvider>
            </StockProvider>
          </AuthPromptProvider>
        </UserProvider>
      </AuthProvider>
    </I18nProvider>
  </ThemeProvider>
);

export default App;
