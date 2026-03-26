import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../src/contexts/ThemeContext';
import { Bell, Search, HelpCircle, PanelLeft, User, Settings, LogOut, CreditCard, Sparkles, Check } from 'lucide-react';
import { LanguageSwitcher } from '../src/components/LanguageSwitcher';
import { ThemeSwitcher } from '../src/components/ThemeSwitcher';
import { Breadcrumb } from '../src/components/Breadcrumb';
import { api } from '../src/services/api';

interface TopBarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar, isSidebarOpen = true }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const isDark = resolvedTheme === 'dark';

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    api.auth.logout();
    navigate('/login');
  };

  return (
    <header className={`h-16 ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white/80 border-gray-200'} border-b flex items-center justify-between px-6 backdrop-blur-sm sticky top-0 z-10 transition-colors duration-200`}>
      <div className="flex items-center flex-1 gap-4">
        {/* Sidebar Toggle */}
        <button
          onClick={onToggleSidebar}
          className={`p-2 ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700/50' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'} rounded-lg transition-colors focus:outline-none shrink-0`}
          title={isSidebarOpen ? t('topbar.collapseSidebar', 'Collapse Sidebar') : t('topbar.expandSidebar', 'Expand Sidebar')}
        >
          <PanelLeft className={`w-5 h-5 transition-transform duration-300 ${!isSidebarOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {/* Breadcrumb */}
        <Breadcrumb />
        
        {/* Search Box - Centered */}
        <div className="flex-1 flex justify-center max-w-xl mx-auto">
          <div className="relative w-full max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            </span>
            <input
              type="text"
              placeholder={t('topbar.searchPlaceholder', 'Search databases, tables, or settings...')}
              className={`w-full ${isDark ? 'bg-gray-900/50 border-gray-700 text-gray-300 focus:ring-blue-500 focus:border-blue-500' : 'bg-gray-100 border-gray-200 text-gray-700 focus:ring-blue-500 focus:border-blue-500'} text-sm rounded-lg block pl-10 p-2.5 transition-all border outline-none`}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3 ml-6">
        {/* Language Switcher - Icon only with dropdown */}
        <LanguageSwitcher />
        
        {/* Theme Switcher - Icon only with dropdown */}
        <ThemeSwitcher />
        
        <button className={`${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'} transition-colors relative`}>
          <Bell className="w-5 h-5" />
          <span className={`absolute top-0 right-0 block h-2 w-2 rounded-full ring-2 ${isDark ? 'ring-gray-800' : 'ring-white'} bg-red-500 transform translate-x-1/3 -translate-y-1/3`}></span>
        </button>
        <button className={`${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'} transition-colors`}>
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* User Avatar & Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full transition-colors ${
              isDark
                ? 'hover:bg-gray-700/50'
                : 'hover:bg-gray-100'
            } ${isProfileOpen ? (isDark ? 'bg-gray-700/50' : 'bg-gray-100') : ''}`}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center font-bold text-sm text-white shadow-lg shadow-purple-900/20">
              A
            </div>
            <div className="hidden sm:block text-left">
              <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Admin</p>
            </div>
          </button>

          {isProfileOpen && (
            <>
              {/* Backdrop overlay */}
              <div
                className="fixed inset-0 bg-black/20 z-[99]"
                onClick={() => setIsProfileOpen(false)}
              />
              <div className={`absolute right-0 mt-2 w-64 rounded-xl shadow-2xl border z-[100] overflow-hidden ${
                isDark
                  ? 'bg-[#0d1117] border-gray-700'
                  : 'bg-white border-gray-200'
              }`}>
                {/* Header */}
                <div className={`p-4 border-b flex items-center gap-3 ${isDark ? 'border-gray-700 bg-[#161b22]' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-purple-900/20">
                    A
                  </div>
                  <div className="overflow-hidden">
                    <p className={`text-sm font-bold truncate ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Admin User</p>
                    <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>admin@tdengine.local</p>
                  </div>
                </div>
              
              {/* Upgrade */}
              <div className="p-2">
                <button className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors group ${isDark ? 'text-gray-200 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'}`}>
                  <Sparkles className="w-4 h-4 text-yellow-400 group-hover:text-yellow-500" />
                  Upgrade to Pro
                </button>
              </div>
              
              <div className={`h-px mx-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
              
              {/* Links */}
              <div className="p-2 space-y-0.5">
                <button
                  onClick={() => { navigate('/settings/profile'); setIsProfileOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                >
                  <User className="w-4 h-4" /> {t('nav.profile', 'Profile')}
                </button>
                <button
                  onClick={() => { navigate('/settings/account'); setIsProfileOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                >
                  <CreditCard className="w-4 h-4" /> {t('nav.account', 'Account')}
                </button>
                <button
                  onClick={() => { navigate('/settings'); setIsProfileOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                >
                  <Settings className="w-4 h-4" /> {t('nav.settings', 'Settings')}
                </button>
              </div>

              <div className={`h-px mx-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

              {/* Sign Out */}
              <div className="p-2">
                <button
                  onClick={handleLogout}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-900/10' : 'text-red-500 hover:bg-red-50'}`}
                >
                  <LogOut className="w-4 h-4" /> {t('auth.logout', 'Sign out')}
                </button>
              </div>
            </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
