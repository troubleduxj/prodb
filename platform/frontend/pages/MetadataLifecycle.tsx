import React from 'react';
import { useTheme } from '../src/contexts/ThemeContext';
import { History, HardDrive, Clock, AlertTriangle, Edit3, Save } from 'lucide-react';

const MOCK_LIFECYCLE_POLICIES = [
    { db: 'power_db', ttl: 365, keep: '365,365,365', buffer: 256, tiering: 'SSD (7d) -> S3 (Archive)', status: 'Active' },
    { db: 'factory_db', ttl: 90, keep: '90,90,90', buffer: 128, tiering: 'SSD (30d) -> HDD', status: 'Active' },
    { db: 'sys_db', ttl: 30, keep: '30,30,30', buffer: 64, tiering: 'None (SSD Only)', status: 'Active' },
    { db: 'fleet_db', ttl: 730, keep: '730,730,730', buffer: 512, tiering: 'SSD (2d) -> S3 (Archive)', status: 'Warning' },
];

export const MetadataLifecycle: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Lifecycle Management</h1>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Configure data retention (TTL) and multi-tiered storage policies.</p>
          </div>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center">
             <Save className="w-4 h-4 mr-2" /> Apply Changes
          </button>
       </div>

       <div className="grid grid-cols-3 gap-6">
           <div className={`rounded-xl border p-5 flex items-center ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
               <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400 mr-4">
                   <HardDrive className="w-8 h-8" />
               </div>
               <div>
                   <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Hot Storage (SSD)</p>
                   <p className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>8.2 TB <span className={`text-sm font-normal ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>/ 10 TB</span></p>
               </div>
           </div>
           <div className={`rounded-xl border p-5 flex items-center ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
               <div className="p-3 bg-purple-500/20 rounded-lg text-purple-400 mr-4">
                   <History className="w-8 h-8" />
               </div>
               <div>
                   <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Cold Storage (S3/HDD)</p>
                   <p className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>124 TB</p>
               </div>
           </div>
           <div className={`rounded-xl border p-5 flex items-center ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
               <div className="p-3 bg-yellow-500/20 rounded-lg text-yellow-400 mr-4">
                   <AlertTriangle className="w-8 h-8" />
               </div>
               <div>
                   <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Projected Growth (30d)</p>
                   <p className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>+1.5 TB</p>
               </div>
           </div>
       </div>

       <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
           <table className="w-full text-left">
               <thead>
                   <tr className={`text-sm border-b ${isDark ? 'bg-gray-700/50 text-gray-400 border-gray-700' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                       <th className="p-4 font-medium">Database</th>
                       <th className="p-4 font-medium">Retention (Days)</th>
                       <th className="p-4 font-medium">Tiered Storage Rule</th>
                       <th className="p-4 font-medium">Write Buffer (MB)</th>
                       <th className="p-4 font-medium text-center">Status</th>
                       <th className="p-4 font-medium text-right">Action</th>
                   </tr>
               </thead>
               <tbody className={isDark ? 'divide-y divide-gray-700' : 'divide-y divide-gray-200'}>
                   {MOCK_LIFECYCLE_POLICIES.map((policy) => (
                       <tr key={policy.db} className={isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}>
                           <td className={`p-4 font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{policy.db}</td>
                           <td className="p-4">
                               <div className={`flex items-center text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                   <Clock className={`w-4 h-4 mr-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                   {policy.ttl} Days
                               </div>
                           </td>
                           <td className={`p-4 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                               {policy.tiering}
                           </td>
                           <td className={`p-4 text-sm font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{policy.buffer} MB</td>
                           <td className="p-4 text-center">
                               {policy.status === 'Warning' ? (
                                   <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                       Capacity Low
                                   </span>
                               ) : (
                                   <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                                       Healthy
                                   </span>
                               )}
                           </td>
                           <td className="p-4 text-right">
                               <button className={`p-2 rounded-lg transition-colors ${isDark ? 'text-blue-400 hover:text-blue-300 hover:bg-gray-700' : 'text-blue-500 hover:text-blue-600 hover:bg-gray-100'}`}>
                                   <Edit3 className="w-4 h-4" />
                               </button>
                           </td>
                       </tr>
                   ))}
               </tbody>
           </table>
       </div>
    </div>
  );
};
