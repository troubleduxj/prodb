import React, { useState } from 'react';
import { CalendarClock, Plus, MoreHorizontal, Mail, Webhook, FileSpreadsheet, FileText, CheckCircle, Clock, PlayCircle } from 'lucide-react';
import { useTheme } from '../src/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const MOCK_REPORTS = [
    { id: 'rpt_001', name: 'Daily Power Consumption', schedule: 'Daily at 08:00', nextRun: 'Tomorrow 08:00', lastStatus: 'Success', format: 'PDF', channel: 'Email' },
    { id: 'rpt_002', name: 'Weekly Voltage Anomalies', schedule: 'Weekly (Mon) at 09:00', nextRun: 'Mon 09:00', lastStatus: 'Success', format: 'CSV', channel: 'Webhook' },
    { id: 'rpt_003', name: 'Shift End Summary', schedule: 'Daily at 18:00', nextRun: 'Today 18:00', lastStatus: 'Failed', format: 'Excel', channel: 'Email' },
];

export const QueryReports: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', query: '', frequency: 'Daily', time: '08:00', format: 'PDF', channel: 'Email' });
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
          <div>
             <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('reports.scheduledReports')}</h1>
             <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1`}>{t('reports.automateQueryExecution')}</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center shadow-lg shadow-blue-900/20"
          >
             <Plus className="w-4 h-4 mr-2" /> {t('reports.createSchedule')}
          </button>
       </div>

       <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} overflow-hidden`}>
           <table className="w-full text-left border-collapse">
               <thead>
                   <tr className={`${isDark ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-100 text-gray-500'} text-xs uppercase border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                       <th className="p-4 font-medium">{t('reports.reportName')}</th>
                       <th className="p-4 font-medium">{t('reports.schedule')}</th>
                       <th className="p-4 font-medium">{t('reports.nextRun')}</th>
                       <th className="p-4 font-medium text-center">{t('common.format')}</th>
                       <th className="p-4 font-medium text-center">{t('common.channel')}</th>
                       <th className="p-4 font-medium text-center">{t('reports.lastStatus')}</th>
                       <th className="p-4 font-medium text-right">{t('common.actions')}</th>
                   </tr>
               </thead>
               <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                   {MOCK_REPORTS.map(rpt => (
                       <tr key={rpt.id} className={`${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'} transition-colors`}>
                           <td className="p-4">
                               <div className="flex items-center gap-3">
                                   <div className="p-2 bg-purple-500/20 rounded text-purple-400">
                                       <CalendarClock className="w-4 h-4" />
                                   </div>
                                   <div>
                                       <p className={`font-bold ${isDark ? 'text-gray-200' : 'text-gray-700'} text-sm`}>{rpt.name}</p>
                                       <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{rpt.id}</p>
                                   </div>
                               </div>
                           </td>
                           <td className={`p-4 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{rpt.schedule}</td>
                           <td className={`p-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} flex items-center gap-2`}>
                               <Clock className="w-3 h-3" /> {rpt.nextRun}
                           </td>
                           <td className="p-4 text-center">
                               <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono ${isDark ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-200 text-gray-600 border-gray-300'} border`}>
                                   {rpt.format === 'PDF' && <FileText className="w-3 h-3 mr-1 text-red-400"/>}
                                   {rpt.format === 'Excel' && <FileSpreadsheet className="w-3 h-3 mr-1 text-green-400"/>}
                                   {rpt.format === 'CSV' && <FileText className="w-3 h-3 mr-1 text-blue-400"/>}
                                   {rpt.format}
                               </span>
                           </td>
                           <td className="p-4 text-center">
                               <div className={`flex items-center justify-center gap-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                   {rpt.channel === 'Email' ? <Mail className="w-3 h-3"/> : <Webhook className="w-3 h-3"/>}
                                   {rpt.channel}
                               </div>
                           </td>
                           <td className="p-4 text-center">
                               {rpt.lastStatus === 'Success' ? (
                                   <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/10 text-green-400">{t('common.success')}</span>
                               ) : (
                                   <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-400">{t('common.failed')}</span>
                               )}
                           </td>
                           <td className="p-4 text-right">
                               <button className={`p-2 hover:${isDark ? 'bg-gray-700' : 'bg-gray-100'} rounded ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'} transition-colors`} title={t('common.runNow')}>
                                   <PlayCircle className="w-4 h-4" />
                               </button>
                               <button className={`p-2 hover:${isDark ? 'bg-gray-700' : 'bg-gray-100'} rounded ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'} transition-colors`}>
                                   <MoreHorizontal className="w-4 h-4" />
                               </button>
                           </td>
                       </tr>
                   ))}
               </tbody>
           </table>
       </div>

       {/* Create Modal */}
       {showModal && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
               <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200`}>
                   <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                       <h2 className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'} flex items-center`}>
                           <CalendarClock className="w-5 h-5 mr-2 text-blue-400" />
                           {t('reports.newScheduledReport')}
                       </h2>
                   </div>
                   <div className="p-6 space-y-4">
                       <div>
                           <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>{t('reports.reportName')}</label>
                           <input 
                               type="text" 
                               value={formData.name}
                               onChange={e => setFormData({...formData, name: e.target.value})}
                               className={`w-full ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded px-3 py-2 outline-none focus:border-blue-500`}
                               placeholder={t('reports.reportNamePlaceholder')}
                           />
                       </div>
                       <div>
                           <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>{t('reports.sourceQuery')}</label>
                           <textarea 
                               className={`w-full h-24 ${isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-gray-50 border-gray-300 text-gray-700'} border rounded px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 resize-none`}
                               placeholder="SELECT ... FROM ..."
                           />
                           <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>{t('reports.tip')}</p>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>{t('reports.frequency')}</label>
                               <select className={`w-full ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded px-3 py-2 outline-none`}>
                                   <option>{t('reports.daily')}</option>
                                   <option>{t('reports.weekly')}</option>
                                   <option>{t('reports.monthly')}</option>
                                   <option>{t('reports.customCron')}</option>
                               </select>
                           </div>
                           <div>
                               <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>{t('reports.timeUTC')}</label>
                               <input 
                                   type="time" 
                                   value={formData.time}
                                   onChange={e => setFormData({...formData, time: e.target.value})}
                                   className={`w-full ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded px-3 py-2 outline-none`}
                               />
                           </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>{t('reports.exportFormat')}</label>
                               <select className={`w-full ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded px-3 py-2 outline-none`}>
                                   <option>{t('reports.pdfDocument')}</option>
                                   <option>{t('reports.excelWorkbook')}</option>
                                   <option>{t('reports.csvZipped')}</option>
                               </select>
                           </div>
                           <div>
                               <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>{t('reports.destination')}</label>
                               <select className={`w-full ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded px-3 py-2 outline-none`}>
                                   <option>{t('common.email')}</option>
                                   <option>{t('reports.webhookJSON')}</option>
                                   <option>{t('common.slack')}</option>
                               </select>
                           </div>
                       </div>
                   </div>
                   <div className={`p-6 border-t ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'} flex justify-end gap-3 rounded-b-xl`}>
                       <button onClick={() => setShowModal(false)} className={`px-4 py-2 text-sm ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}>{t('common.cancel')}</button>
                       <button onClick={() => setShowModal(false)} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium shadow-lg shadow-blue-900/20 flex items-center">
                           <CheckCircle className="w-4 h-4 mr-2" /> {t('reports.activateSchedule')}
                       </button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};
