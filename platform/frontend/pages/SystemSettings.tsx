import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { Save, Monitor, Globe, Wrench, Clock, RefreshCw } from 'lucide-react';
import { useSystem } from '../contexts/SystemContext';

export const SystemSettings: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { platformName, setPlatformName, timezone, setTimezone } = useSystem();
  const [settings, setSettings] = useState({
    language: 'en',
    theme: 'dark',
    dateFormat: 'YYYY-MM-DD HH:mm:ss',
    logLevel: 'INFO',
    retentionDays: 90,
    autoUpdate: true,
  });

  const handleChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('systemSettings.title', 'System Settings')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('systemSettings.subtitle', 'Configure general platform behavior and appearance.')}</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center shadow-lg shadow-blue-900/20">
          <Save className="w-4 h-4 mr-2" /> {t('common.save', 'Save Changes')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-6 flex items-center">
            <Globe className="w-5 h-5 mr-2 text-blue-400" /> {t('systemSettings.general', 'General')}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('systemSettings.platformName', 'Platform Name')}</label>
              <input
                type="text"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-200 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('common.language', 'Language')}</label>
                <select
                  value={settings.language}
                  onChange={(e) => handleChange('language', e.target.value)}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-200 outline-none"
                >
                  <option value="en">{t('language.english', 'English')}</option>
                  <option value="zh">{t('language.chinese', 'Chinese (Simplified)')}</option>
                  <option value="jp">{t('language.japanese', 'Japanese')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('common.timezone', 'Timezone')}</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-200 outline-none"
                >
                  <option value={timezone}>{timezone} ({t('systemSettings.detected', 'Detected')})</option>
                  <option value="UTC">UTC (GMT+0)</option>
                  <option value="America/New_York">EST (New York)</option>
                  <option value="America/Los_Angeles">PST (Los Angeles)</option>
                  <option value="Asia/Shanghai">CST (Shanghai)</option>
                  <option value="Europe/London">GMT (London)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-6 flex items-center">
            <Monitor className="w-5 h-5 mr-2 text-purple-400" /> {t('systemSettings.display', 'Display')}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('systemSettings.defaultTheme', 'Default Theme')}</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="theme"
                    checked={settings.theme === 'dark'}
                    onChange={() => handleChange('theme', 'dark')}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-300">{t('common.dark', 'Dark Mode')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="theme"
                    checked={settings.theme === 'light'}
                    onChange={() => handleChange('theme', 'light')}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-300">{t('common.light', 'Light Mode')}</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('systemSettings.dateFormat', 'Date Format')}</label>
              <select
                value={settings.dateFormat}
                onChange={(e) => handleChange('dateFormat', e.target.value)}
                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-200 outline-none"
              >
                <option value="YYYY-MM-DD HH:mm:ss">YYYY-MM-DD HH:mm:ss</option>
                <option value="MM/DD/YYYY HH:mm">MM/DD/YYYY HH:mm</option>
                <option value="DD.MM.YYYY HH:mm">DD.MM.YYYY HH:mm</option>
              </select>
            </div>
          </div>
        </div>

        {/* Maintenance */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-6 flex items-center">
            <Wrench className="w-5 h-5 mr-2 text-yellow-400" /> {t('systemSettings.maintenance', 'Maintenance')}
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">{t('systemSettings.systemLogLevel', 'System Log Level')}</label>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{t('systemSettings.logLevelDesc', 'Verbosity of backend logs')}</p>
               </div>
               <select
                  value={settings.logLevel}
                  onChange={(e) => handleChange('logLevel', e.target.value)}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1 text-sm text-gray-900 dark:text-gray-200 outline-none"
                >
                  <option value="DEBUG">DEBUG</option>
                  <option value="INFO">INFO</option>
                  <option value="WARN">WARN</option>
                  <option value="ERROR">ERROR</option>
                </select>
            </div>
            <hr className="border-gray-200 dark:border-gray-700" />
            <div className="flex items-center justify-between">
               <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">{t('systemSettings.operationsLogRetention', 'Operations Log Retention')}</label>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{t('systemSettings.retentionDesc', 'Days to keep audit logs')}</p>
               </div>
               <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={settings.retentionDays}
                    onChange={(e) => handleChange('retentionDays', Number(e.target.value))}
                    className="w-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-sm text-gray-900 dark:text-gray-200 text-right outline-none"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('common.days', 'days')}</span>
               </div>
            </div>
            <hr className="border-gray-200 dark:border-gray-700" />
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">{t('systemSettings.autoCheckUpdates', 'Auto-Check Updates')}</label>
               </div>
               <div
                  onClick={() => handleChange('autoUpdate', !settings.autoUpdate)}
                  className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${settings.autoUpdate ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${settings.autoUpdate ? 'left-[22px]' : 'left-0.5'}`}></div>
                </div>
            </div>
          </div>
        </div>
        
        {/* Version Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col justify-center items-center text-center">
            <div className="p-4 bg-gray-100 dark:bg-gray-700/50 rounded-full mb-3">
                <Clock className="w-8 h-8 text-gray-500 dark:text-gray-400" />
            </div>
            <h4 className="text-gray-700 dark:text-gray-200 font-bold mb-1">{t('systemSettings.systemVersion', 'System Version')}</h4>
            <p className="text-blue-500 dark:text-blue-400 font-mono text-lg mb-2">v2.4.0-beta</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{t('systemSettings.build', 'Build')}: 20231027.a1b2c3</p>
            <button className="mt-4 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white flex items-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-1.5 rounded transition-colors">
                <RefreshCw className="w-3 h-3 mr-1" /> {t('systemSettings.checkForUpdates', 'Check for updates')}
            </button>
        </div>
      </div>
    </div>
  );
};
