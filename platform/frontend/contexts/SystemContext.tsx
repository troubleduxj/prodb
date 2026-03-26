
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

interface SystemContextType {
  platformName: string;
  setPlatformName: (name: string) => void;
  timezone: string;
  setTimezone: (tz: string) => void;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

export const SystemProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [platformName, setPlatformName] = useState('TDengine');
  const [timezone, setTimezone] = useState('UTC');

  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) {
        setTimezone(detected);
      }
    } catch (e) {
      console.error("Timezone detection failed", e);
    }
  }, []);

  return (
    <SystemContext.Provider value={{ platformName, setPlatformName, timezone, setTimezone }}>
      {children}
    </SystemContext.Provider>
  );
};

export const useSystem = () => {
  const context = useContext(SystemContext);
  if (!context) {
    throw new Error('useSystem must be used within a SystemProvider');
  }
  return context;
};
