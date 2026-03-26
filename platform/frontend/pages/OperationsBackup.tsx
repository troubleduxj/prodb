import React from 'react';
import { useTheme } from '../src/contexts/ThemeContext';
import { Archive, Download, Upload, Clock, Save } from 'lucide-react';

export const OperationsBackup: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
          <div>
             <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Disaster Recovery</h1>
             <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Manage snapshots, backups, and data migration (taosdump).</p>
          </div>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center">
             <Save className="w-4 h-4 mr-2" /> Create Snapshot
          </button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className={`rounded-xl border p-6 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
               <h3 className={`font-bold mb-4 flex items-center ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                   <Archive className="w-5 h-5 mr-2 text-blue-400" /> Snapshot History
               </h3>
               <div className="space-y-3">
                   {[
                       { name: 'daily_backup_20231027', size: '45 GB', time: 'Today 02:00 AM', status: 'Success' },
                       { name: 'daily_backup_20231026', size: '44 GB', time: 'Yesterday 02:00 AM', status: 'Success' },
                       { name: 'manual_pre_upgrade', size: '44 GB', time: 'Oct 25 10:00 AM', status: 'Success' },
                   ].map((bak, i) => (
                       <div key={i} className={`flex items-center justify-between p-3 rounded border transition-colors ${isDark ? 'bg-gray-700/30 border-gray-700 hover:bg-gray-700/50' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                           <div>
                               <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{bak.name}</p>
                               <div className={`flex items-center gap-3 text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                   <span className="flex items-center"><Clock className="w-3 h-3 mr-1"/> {bak.time}</span>
                                   <span>{bak.size}</span>
                               </div>
                           </div>
                           <button className="text-blue-400 hover:text-blue-500 p-2">
                               <Download className="w-4 h-4" />
                           </button>
                       </div>
                   ))}
               </div>
           </div>

           <div className={`rounded-xl border p-6 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
               <h3 className={`font-bold mb-4 flex items-center ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                   <Upload className="w-5 h-5 mr-2 text-green-400" /> Import Wizard
               </h3>
               <div className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDark ? 'border-gray-600 hover:border-blue-500 hover:bg-gray-700/10' : 'border-gray-300 hover:border-blue-500 hover:bg-gray-50'}`}>
                   <Upload className={`w-12 h-12 mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                   <p className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Drag & Drop SQL/CSV files</p>
                   <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>or click to browse</p>
               </div>
               <div className="mt-4">
                   <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Recent Imports</p>
                   <div className={`p-2 rounded flex items-center justify-between text-xs ${isDark ? 'bg-gray-700/30 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                       <span>meters_legacy_data.csv</span>
                       <span className="text-green-400">Completed</span>
                   </div>
               </div>
           </div>
       </div>
    </div>
  );
};
