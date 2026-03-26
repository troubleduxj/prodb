import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ServerCog, Upload, RefreshCw, XCircle, PauseCircle, PlayCircle, MoreHorizontal, Gauge } from 'lucide-react';
import { Page } from '../types';
import { useTheme } from '../src/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const MOCK_JOBS = [
    { id: 'job_a1b2c3d4', name: 'Kafka to TDengine Sync', type: 'SQL', state: 'RUNNING', uptime: '4d 2h 15m', parallelism: 4, restarts: 0 },
    { id: 'job_e5f6g7h8', name: 'Complex Event Processing (CEP)', type: 'JAR', state: 'RUNNING', uptime: '12h 45m', parallelism: 8, restarts: 2 },
    { id: 'job_i9j0k1l2', name: 'Historical Replay 2023', type: 'SQL', state: 'FAILED', uptime: '-', parallelism: 2, restarts: 5 },
];

export const ComputingFlinkJobs: React.FC = () => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <div>
           <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('flink.jobManager')}</h1>
           <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1`}>{t('flink.manageStatefulStream')}</p>
        </div>
        <div className="flex gap-3">
             <button className={`px-4 py-2 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 border-gray-300'} rounded-lg text-sm font-medium transition-colors border flex items-center`}>
                <Upload className="w-4 h-4 mr-2" /> {t('flink.uploadJAR')}
             </button>
             <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center shadow-lg shadow-blue-900/20">
                  <RefreshCw className="w-4 h-4 mr-2" /> {t('common.refresh')}
             </button>
        </div>
       </div>

       {/* Cluster Stats */}
       <div className="grid grid-cols-4 gap-4">
           <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-4 rounded-xl border`}>
               <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} uppercase`}>{t('flink.taskManagers')}</p>
               <p className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>3 <span className="text-sm font-normal text-green-400">{t('common.online')}</span></p>
           </div>
           <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-4 rounded-xl border`}>
               <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} uppercase`}>{t('flink.totalSlots')}</p>
               <p className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>24 <span className={`text-sm font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('flink.available')}</span></p>
           </div>
           <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-4 rounded-xl border`}>
               <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} uppercase`}>{t('flink.runningJobs')}</p>
               <p className="text-2xl font-bold text-blue-400">2</p>
           </div>
           <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-4 rounded-xl border`}>
               <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} uppercase`}>{t('flink.failedJobs')}</p>
               <p className="text-2xl font-bold text-red-400">1</p>
           </div>
       </div>

       {/* Job List */}
       <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border overflow-hidden`}>
           <table className="w-full text-left border-collapse">
               <thead>
                   <tr className={`${isDark ? 'bg-gray-700/50 text-gray-400 border-gray-700' : 'bg-gray-100 text-gray-500 border-gray-200'} text-xs uppercase border-b`}>
                       <th className="p-4 font-medium">{t('flink.jobName')}</th>
                       <th className="p-4 font-medium text-center">{t('common.type')}</th>
                       <th className="p-4 font-medium text-center">{t('common.state')}</th>
                       <th className="p-4 font-medium text-center">{t('flink.uptime')}</th>
                       <th className="p-4 font-medium text-center">{t('flink.parallelism')}</th>
                       <th className="p-4 font-medium text-right">{t('common.actions')}</th>
                   </tr>
               </thead>
               <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                   {MOCK_JOBS.map(job => (
                       <tr key={job.id} className={`${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'} transition-colors`}>
                           <td className="p-4">
                               <div className="flex items-center">
                                   <div className={`p-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-lg mr-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                       <ServerCog className="w-5 h-5" />
                                   </div>
                                   <div>
                                       <p className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{job.name}</p>
                                       <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} font-mono`}>{job.id}</p>
                                   </div>
                               </div>
                           </td>
                           <td className="p-4 text-center">
                               <span className={`text-xs font-mono ${isDark ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-200 text-gray-600 border-gray-300'} px-2 py-1 rounded border`}>{job.type}</span>
                           </td>
                           <td className="p-4 text-center">
                               {job.state === 'RUNNING' && <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20"><PlayCircle className="w-3 h-3 mr-1"/> {t('common.running')}</span>}
                               {job.state === 'FAILED' && <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20"><XCircle className="w-3 h-3 mr-1"/> {t('common.failed')}</span>}
                               {job.state === 'FINISHED' && <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-gray-500/10 text-gray-400 border border-gray-500/20">{t('common.finished')}</span>}
                           </td>
                           <td className={`p-4 text-center text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'} font-mono`}>
                               {job.uptime}
                           </td>
                           <td className="p-4 text-center">
                               <div className={`w-24 h-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full mx-auto overflow-hidden relative`}>
                                   <div className="absolute top-0 left-0 h-full bg-blue-500" style={{width: `${(job.parallelism / 24) * 100}%`}}></div>
                               </div>
                               <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1 block`}>{job.parallelism} / 24 {t('flink.slots')}</span>
                           </td>
                           <td className="p-4 text-right">
                               <button 
                                   onClick={() => navigate(`/${Page.COMPUTING_MONITOR}`)}
                                   className={`p-2 ${isDark ? 'text-gray-400 hover:text-blue-400 hover:bg-gray-700' : 'text-gray-500 hover:text-blue-500 hover:bg-gray-100'} rounded-lg transition-colors mr-1`}
                                   title={t('flink.monitorPipeline')}
                               >
                                   <Gauge className="w-5 h-5" />
                               </button>
                               <button className={`p-2 ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'} rounded-lg transition-colors`}>
                                   <MoreHorizontal className="w-5 h-5" />
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
