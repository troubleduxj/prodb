import React, { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Toaster } from '../src/components/ui/toaster';
import { useTheme } from '../src/contexts/ThemeContext';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <>
      <div className={`flex h-screen ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} overflow-hidden transition-colors duration-200`}>
        <Sidebar isOpen={isSidebarOpen} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} />
          <main className={`flex-1 overflow-auto p-6 scroll-smooth ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
            {children}
          </main>
        </div>
      </div>
      <Toaster />
    </>
  );
};
