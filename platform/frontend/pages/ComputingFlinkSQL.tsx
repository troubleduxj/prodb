import React, { useState } from 'react';
import { Code2, Play, Table, Database, Save, RotateCcw } from 'lucide-react';
import { useTheme } from '../src/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const CATALOG_TREE = [
    { name: 'default_catalog', type: 'catalog', children: [
        { name: 'tdengine', type: 'database', children: [
            { name: 'meters', type: 'table' },
            { name: 'sensors', type: 'table' },
            { name: 'logs', type: 'table' },
        ]},
        { name: 'kafka_source', type: 'table' },
    ]}
];

export const ComputingFlinkSQL: React.FC = () => {
  const [code, setCode] = useState(`-- Create a Flink Job to sync data from Kafka to TDengine
INSERT INTO tdengine.power_db.meters
SELECT 
  window_end, 
  AVG(voltage), 
  MAX(current)
FROM TABLE(
  TUMBLE(TABLE kafka_source, DESCRIPTOR(ts), INTERVAL '1' MINUTE)
)
GROUP BY window_end, window_start;`);

  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
       <div className="flex items-center justify-between mb-4">
        <div>
           <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('flink.sqlWorkbench')}</h1>
           <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1`}>{t('flink.developAndDebug')}</p>
        </div>
        <div className="flex gap-2">
             <button className={`px-3 py-2 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 border-gray-300'} rounded-lg text-sm font-medium transition-colors border flex items-center`}>
                <Save className="w-4 h-4 mr-2" /> {t('flink.saveScript')}
             </button>
             <button className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center shadow-lg shadow-green-900/20">
                  <Play className="w-4 h-4 mr-2" /> {t('flink.submitJob')}
             </button>
        </div>
       </div>

       <div className="flex-1 flex gap-4 min-h-0">
           {/* Catalog Sidebar */}
           <div className={`w-64 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border flex flex-col overflow-hidden shrink-0`}>
               <div className={`p-3 border-b ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'} flex items-center justify-between`}>
                   <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'} text-sm flex items-center`}>
                       <Database className="w-4 h-4 mr-2 text-blue-400" /> {t('flink.catalogs')}
                   </span>
                   <button className={`${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}><RotateCcw className="w-3 h-3" /></button>
               </div>
               <div className="p-2 overflow-y-auto flex-1">
                   {CATALOG_TREE.map(cat => (
                       <div key={cat.name} className="space-y-1">
                           <div className={`flex items-center text-sm ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'} p-1 rounded cursor-pointer`}>
                               <span className="w-4 h-4 mr-1 opacity-50">📂</span> {cat.name}
                           </div>
                           <div className="pl-4 space-y-1">
                               {cat.children.map(child => (
                                   <div key={child.name}>
                                       <div className={`flex items-center text-sm ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'} p-1 rounded cursor-pointer`}>
                                           {child.type === 'database' ? <span className="mr-2 text-yellow-500 text-xs">DB</span> : <Table className="w-3 h-3 mr-2 text-purple-400" />}
                                           {child.name}
                                       </div>
                                       {child.children && (
                                           <div className="pl-4 space-y-1">
                                               {child.children.map(table => (
                                                   <div key={table.name} className={`flex items-center text-sm ${isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'} p-1 rounded cursor-pointer`}>
                                                        <Table className="w-3 h-3 mr-2 text-blue-400" />
                                                        {table.name}
                                                   </div>
                                               ))}
                                           </div>
                                       )}
                                   </div>
                               ))}
                           </div>
                       </div>
                   ))}
               </div>
           </div>

           {/* Editor & Preview */}
           <div className="flex-1 flex flex-col gap-4 min-w-0">
               {/* Code Area */}
               <div className={`flex-1 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border flex flex-col overflow-hidden relative group`}>
                   <div className="absolute top-0 right-0 p-2 z-10">
                       <div className={`${isDark ? 'bg-gray-700/80' : 'bg-gray-100/80'} backdrop-blur rounded text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} px-2 py-1`}>SQL Dialect: Flink</div>
                   </div>
                   <textarea 
                       className={`flex-1 ${isDark ? 'bg-[#1e1e1e] text-gray-300' : 'bg-white text-gray-700'} font-mono p-4 text-sm resize-none focus:outline-none leading-relaxed`}
                       spellCheck={false}
                       value={code}
                       onChange={(e) => setCode(e.target.value)}
                   />
               </div>

               {/* Preview/Logs */}
               <div className={`h-48 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border flex flex-col overflow-hidden shrink-0`}>
                    <div className={`flex items-center gap-4 px-4 py-2 border-b ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
                        <button className="text-sm font-medium text-blue-400 border-b-2 border-blue-400 pb-2 -mb-2.5">{t('flink.resultPreview')}</button>
                        <button className={`text-sm font-medium ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'} pb-2`}>{t('common.logs')}</button>
                    </div>
                    <div className={`flex-1 p-4 flex items-center justify-center ${isDark ? 'text-gray-500' : 'text-gray-400'} text-sm`}>
                        <p>{t('flink.runQueryWith')} <span className={`font-mono ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'} px-1 rounded`}>PRINT</span> {t('flink.sinkToPreview')}</p>
                    </div>
               </div>
           </div>
       </div>
    </div>
  );
};
