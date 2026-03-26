import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

type Theme = 'light' | 'dark' | 'system';

const themes: { value: Theme; label: { 'zh-CN': string; 'en-US': string }; icon: typeof Sun }[] = [
  { value: 'light', label: { 'zh-CN': '浅色', 'en-US': 'Light' }, icon: Sun },
  { value: 'dark', label: { 'zh-CN': '深色', 'en-US': 'Dark' }, icon: Moon },
  { value: 'system', label: { 'zh-CN': '跟随系统', 'en-US': 'System' }, icon: Monitor },
];

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentLang = i18n.language || 'zh-CN';
  const isDark = resolvedTheme === 'dark';

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    setIsOpen(false);
  };

  // 根据当前主题显示对应的图标
  const CurrentIcon = themes.find(t => t.value === theme)?.icon || Sun;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-lg transition-colors ${
          isDark
            ? 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
        }`}
        title={t('common.theme', 'Theme')}
      >
        <CurrentIcon className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className={`absolute right-0 mt-2 w-40 rounded-xl shadow-2xl border z-50 overflow-hidden ${
          isDark
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
        }`}>
          <div className="p-2 space-y-1">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => handleThemeChange(value)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  theme === value
                    ? (isDark ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600')
                    : (isDark ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100')
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span>{label[currentLang as 'zh-CN' | 'en-US']}</span>
                </div>
                {theme === value && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
