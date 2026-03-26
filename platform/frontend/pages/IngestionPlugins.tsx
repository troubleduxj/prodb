import React from 'react';
import { MOCK_PLUGINS } from '../constants';
import { Download, CheckCircle, Upload, Search, Box } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useTheme } from '../src/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const IconComponent = ({ name, className }: { name: string, className?: string }) => {
  const Icon = (Icons as any)[name] || Box;
  return <Icon className={className} />;
};

export const IngestionPlugins: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
           <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('plugins.pluginLibrary')}</h1>
           <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1`}>{t('plugins.installAndManage')}</p>
        </div>
        <div className="flex gap-3">
             <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <input 
                    type="text" 
                    placeholder={t('plugins.searchMarket')}
                    className={`pl-9 pr-4 py-2 ${isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'} border rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none w-64`} 
                />
             </div>
             <button className={`px-4 py-2 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 border-gray-300'} rounded-lg text-sm font-medium transition-colors flex items-center border`}>
                <Upload className="w-4 h-4 mr-2" /> {t('plugins.uploadPlugin')}
             </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {MOCK_PLUGINS.map((plugin) => (
             <div key={plugin.id} className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} p-6 flex flex-col h-full group hover:border-blue-500/30 transition-all`}>
                <div className="flex items-start justify-between mb-4">
                   <div className={`p-3 ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'} rounded-lg text-blue-400 group-hover:bg-blue-500/10 group-hover:text-blue-300 transition-colors`}>
                      <IconComponent name={plugin.icon} className="w-8 h-8" />
                   </div>
                   {plugin.status === 'Installed' ? (
                     <span className="flex items-center text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20">
                        <CheckCircle className="w-3 h-3 mr-1" /> {t('common.installed')}
                     </span>
                   ) : (
                     <span className={`flex items-center text-xs ${isDark ? 'text-gray-400 bg-gray-700/50 border-gray-600' : 'text-gray-500 bg-gray-100 border-gray-200'} px-2 py-1 rounded-full border`}>
                        {t('common.available')}
                     </span>
                   )}
                </div>
                
                <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'} mb-1`}>{plugin.name}</h3>
                <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs ${isDark ? 'text-gray-500 bg-gray-900' : 'text-gray-400 bg-gray-100'} font-mono px-1.5 py-0.5 rounded`}>v{plugin.version}</span>
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>by TDengine</span>
                </div>
                
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} flex-1 mb-6 leading-relaxed`}>{plugin.description}</p>
                
                {plugin.status === 'Installed' ? (
                   <button 
                      className={`w-full py-2 ${isDark ? 'bg-gray-700/50 text-gray-400 border-gray-700' : 'bg-gray-100 text-gray-400 border-gray-200'} rounded-lg text-sm font-medium cursor-default border`}
                      disabled
                   >
                      {t('plugins.upToDate')}
                   </button>
                ) : (
                   <button 
                      className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center shadow-lg shadow-blue-900/20"
                   >
                      <Download className="w-4 h-4 mr-2" /> {t('plugins.installPlugin')}
                   </button>
                )}
             </div>
          ))}
      </div>
    </div>
  );
};
