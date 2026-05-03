import { createContext, useContext, useEffect, useState } from 'react';

const AppConfigContext = createContext({ llmEnabled: true });

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState({ llmEnabled: true });

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(setConfig)
      .catch(() => {});
  }, []);

  return (
    <AppConfigContext.Provider value={config}>
      {children}
    </AppConfigContext.Provider>
  );
}

export const useAppConfig = () => useContext(AppConfigContext);
