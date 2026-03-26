import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Play, Pause, Plus, Trash2, Activity, History, X, Calendar, Check, AlertCircle } from 'lucide-react';
import { Page } from '../types';
import { useTheme } from '../src/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export const ComputingNative: React.FC = () => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';
  
  // Backfill State
  const [showBackfillModal, setShowBackfillModal] = useState(false);
  const [selectedStream, setSelectedStream] = useState<any>(null);
  const [backfillRange, setBackfillRange] = useState('7d');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mock Streams Data
  const streams = [
      { 
          id: 's1', 
          name: 'stream_avg_voltage_1m', 
          status: 'RUNNING', 
          sql: 'SELECT avg(voltage) FROM power_db.meters INTERVAL(1m) SLIDING(1m)',
          target: 'meters_1m_avg',
          processed: '1.2M rows',
          lag: '0s'
      },
      { 
          id: 's2', 
          name: 'stream_max_temp_alert', 
          status: 'PAUSED', 
          sql: 'SELECT max(temperature) FROM factory_db.sensors WHERE temperature > 80',
          target: 'temp_alerts',
          processed: '450k rows',
          lag: 'N/A'
      }
  ];

  const handleOpenBackfill = (stream: any) => {
      setSelectedStream(stream);
      setShowBackfillModal(true);
      setBackfillRange('7d');
  };

  const handleRunBackfill = () => {
      setIsSubmitting(true);
      setTimeout(() => {
          setIsSubmitting(false);
          setShowBackfillModal(false);
          alert(`${t('native.backfillJobStarted')} ${selectedStream.name} (${t('native.range')}: ${backfillRange})`);
      }, 1000);
  };

  const getPreviewSql = () => {
      if (!selectedStream) return '';
      
      let timeCondition = '';
      const now = new Date();
      let startDate = new Date();

      if (backfillRange === '24h') startDate.setDate(now.getDate() - 1);
      if (backfillRange === '7d') startDate.setDate(now.getDate() - 7);
      if (backfillRange === '30d') startDate.setDate(now.getDate() - 30);

      const startStr = startDate.toISOString().replace('T', ' ').substring(0, 19);
      const endStr = now.toISOString().replace('T', ' ').substring(0, 19);

      const fromPart = selectedStream.sql.split('FROM')[1] || '';
      
      return `-- ${t('native.temporaryBatchJob')}
INSERT INTO ${selectedStream.target}
SELECT ${selectedStream.sql.split('SELECT')[1].split('FROM')[0]}
FROM ${fromPart}
WHERE ts >= '${startStr}' AND ts <= '${endStr}'
PARTITION BY tbname;`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
           <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('native.nativeStreams')}</h1>
           <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1`}>{t('native.lightweightKernelLevel')}</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center shadow-lg shadow-blue-900/20">
           <Plus className="w-4 h-4 mr-2" /> {t('native.createNativeStream')}
        </button>
      </div>

      <div className="grid gap-4">
          {streams.map((stream) => (
            <div key={stream.id} className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-blue-500/30 transition-all ${stream.status === 'PAUSED' ? 'opacity-75' : ''}`}>
                <div className="flex items-start gap-4 flex-1">
                    <div className={`p-3 rounded-lg ${stream.status === 'RUNNING' ? 'bg-blue-500/10 text-blue-400' : (isDark ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400')}`}>
                        <Zap className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className={`text-lg font-bold ${stream.status === 'RUNNING' ? (isDark ? 'text-gray-100' : 'text-gray-900') : (isDark ? 'text-gray-300' : 'text-gray-500')}`}>{stream.name}</h3>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                stream.status === 'RUNNING' 
                                ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                            }`}>
                                {stream.status}
                            </span>
                        </div>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} font-mono mb-2`}>{stream.sql}</p>
                        <div className={`flex items-center text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} gap-4`}>
                            <span>{t('native.lag')}: <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>{stream.lag}</span></span>
                            <span>{t('native.processed')}: <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>{stream.processed}</span></span>
                            {stream.target && <span>{t('native.target')}: <span className="text-blue-300">{stream.target}</span></span>}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => handleOpenBackfill(stream)}
                        className={`p-2 ${isDark ? 'bg-gray-700 hover:bg-purple-600/20 hover:text-purple-400 text-gray-300' : 'bg-gray-200 hover:bg-purple-100 hover:text-purple-600 text-gray-600'} rounded-lg transition-colors group relative`} 
                        title={t('native.backfillHistory')}
                    >
                        <History className="w-4 h-4" />
                        <span className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white ${isDark ? 'bg-gray-900' : 'bg-gray-700'} rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity`}>{t('native.backfill')}</span>
                    </button>
                    <button 
                        onClick={() => navigate(`/${Page.COMPUTING_MONITOR}`)}
                        className={`p-2 ${isDark ? 'bg-gray-700 hover:bg-blue-600/20 hover:text-blue-400 text-gray-300' : 'bg-gray-200 hover:bg-blue-100 hover:text-blue-600 text-gray-600'} rounded-lg transition-colors`} 
                        title={t('native.viewMonitor')}
                    >
                        <Activity className="w-4 h-4" />
                    </button>
                    {stream.status === 'PAUSED' ? (
                        <button className="p-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg transition-colors" title={t('native.resume')}>
                            <Play className="w-4 h-4" />
                        </button>
                    ) : (
                        <button className={`p-2 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'} rounded-lg transition-colors`} title={t('native.pause')}>
                            <Pause className="w-4 h-4" />
                        </button>
                    )}
                    <button className={`p-2 ${isDark ? 'bg-gray-700 hover:bg-red-900/30 hover:text-red-400 text-gray-300' : 'bg-gray-200 hover:bg-red-100 hover:text-red-600 text-gray-600'} rounded-lg transition-colors`} title={t('common.delete')}>
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
          ))}
      </div>

      {/* Backfill Modal */}
      {showBackfillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border w-full max-w-2xl shadow-2xl`}>
                <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} flex justify-between items-center`}>
                    <div>
                        <h2 className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('native.manualBackfill')}</h2>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('native.reprocessHistorical')} <span className="text-blue-400 font-mono">{selectedStream?.name}</span></p>
                    </div>
                    <button onClick={() => setShowBackfillModal(false)} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}><X className="w-6 h-6"/></button>
                </div>
                
                <div className="p-6 space-y-6">
                    {/* Range Selector */}
                    <div>
                        <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>{t('native.selectTimeRange')}</label>
                        <div className="grid grid-cols-3 gap-4">
                            {['24h', '7d', '30d'].map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setBackfillRange(range)}
                                    className={`p-3 rounded-lg border text-center transition-all ${
                                        backfillRange === range
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : (isDark ? 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500' : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300')
                                    }`}
                                >
                                    <Calendar className="w-5 h-5 mx-auto mb-1" />
                                    <span className="text-sm font-medium">{range === '24h' ? t('native.last24h') : range === '7d' ? t('native.last7d') : t('native.last30d')}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* SQL Preview */}
                    <div>
                        <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>{t('native.previewSQL')}</label>
                        <div className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'} rounded-lg border p-4`}>
                            <pre className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} font-mono overflow-x-auto`}>{getPreviewSql()}</pre>
                        </div>
                    </div>

                    <div className={`p-4 ${isDark ? 'bg-yellow-900/20 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'} border rounded-lg flex gap-3`}>
                        <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0" />
                        <div>
                            <h4 className={`text-sm font-bold ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>{t('native.notice')}</h4>
                            <p className={`text-xs ${isDark ? 'text-yellow-200/80' : 'text-yellow-600'} mt-1`}>{t('native.backfillWarning')}</p>
                        </div>
                    </div>
                </div>

                <div className={`p-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} flex justify-end gap-3`}>
                    <button 
                        onClick={() => setShowBackfillModal(false)}
                        className={`px-4 py-2 ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-700'} text-sm`}
                    >
                        {t('common.cancel')}
                    </button>
                    <button 
                        onClick={handleRunBackfill}
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium flex items-center disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <>{t('native.submitting')}...</>
                        ) : (
                            <><Check className="w-4 h-4 mr-2" /> {t('native.confirmBackfill')}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
