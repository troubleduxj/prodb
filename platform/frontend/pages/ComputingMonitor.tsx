import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { Gauge, Activity, GitCommit, ArrowRight, Database, Server } from 'lucide-react';

export const ComputingMonitor: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <div>
           <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('computing.monitor.title', 'Pipeline Monitor')}</h1>
           <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('computing.monitor.description', 'End-to-end visualization of data processing streams.')}</p>
        </div>
      </div>

      <div className={`rounded-xl border p-6 min-h-[400px] relative overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="absolute top-4 right-4 flex items-center gap-4">
              <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  <span className="w-2 h-2 rounded-full bg-green-400"></span> {t('computing.monitor.healthy', 'Healthy')}
              </div>
              <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  <span className="w-2 h-2 rounded-full bg-yellow-400"></span> {t('computing.monitor.backpressure', 'Backpressure')}
              </div>
          </div>

          <div className="flex items-center justify-center h-full pt-10 pb-10 gap-8">
              {/* Stage 1: Ingestion */}
              <div className="flex flex-col items-center gap-4 relative group">
                  <div className={`w-40 p-4 border rounded-xl flex flex-col items-center text-center z-10 ${isDark ? 'bg-gray-900 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
                      <div className={`p-2 rounded-full mb-2 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                          <Server className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                      </div>
                      <h4 className={`font-bold text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>MQTT Ingestion</h4>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>45k msg/s</p>
                  </div>
              </div>

              {/* Arrow */}
              <div className={`flex-1 h-0.5 relative ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}>
                   <ArrowRight className={`absolute -right-2 -top-2.5 w-5 h-5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                   <div className={`absolute top-2 left-1/2 -translate-x-1/2 text-[10px] px-1 ${isDark ? 'text-gray-500 bg-gray-800' : 'text-gray-500 bg-white'}`}>Kafka Topic</div>
              </div>

              {/* Stage 2: Flink Job */}
              <div className="flex flex-col items-center gap-4 relative group">
                   <div className="absolute -top-8 text-xs text-yellow-500 font-bold animate-pulse">{t('computing.monitor.highLoad', 'High Load')}</div>
                  <div className={`w-40 p-4 border border-yellow-500/50 rounded-xl flex flex-col items-center text-center z-10 shadow-[0_0_15px_rgba(234,179,8,0.1)] ${isDark ? 'bg-gray-900' : 'bg-yellow-50'}`}>
                      <div className={`p-2 rounded-full mb-2 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                          <Activity className="w-5 h-5 text-yellow-400" />
                      </div>
                      <h4 className={`font-bold text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Flink ETL Job</h4>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Lag: 1.2s</p>
                  </div>
              </div>

              {/* Arrow */}
              <div className={`flex-1 h-0.5 relative ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}>
                   <ArrowRight className={`absolute -right-2 -top-2.5 w-5 h-5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
              </div>

              {/* Stage 3: TDengine */}
              <div className="flex flex-col items-center gap-4 relative group">
                  <div className={`w-40 p-4 border rounded-xl flex flex-col items-center text-center z-10 ${isDark ? 'bg-gray-900 border-blue-500' : 'bg-blue-50 border-blue-500'}`}>
                      <div className={`p-2 rounded-full mb-2 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                          <Database className="w-5 h-5 text-blue-400" />
                      </div>
                      <h4 className={`font-bold text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>TDengine Storage</h4>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>power_db.meters</p>
                  </div>
              </div>

              {/* Arrow */}
              <div className={`flex-1 h-0.5 relative ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}>
                   <ArrowRight className={`absolute -right-2 -top-2.5 w-5 h-5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                   <div className={`absolute top-2 left-1/2 -translate-x-1/2 text-[10px] px-1 ${isDark ? 'text-gray-500 bg-gray-800' : 'text-gray-500 bg-white'}`}>{t('computing.monitor.nativeStream', 'Native Stream')}</div>
              </div>

               {/* Stage 4: Aggregation */}
               <div className="flex flex-col items-center gap-4 relative group">
                  <div className={`w-40 p-4 border rounded-xl flex flex-col items-center text-center z-10 ${isDark ? 'bg-gray-900 border-green-500' : 'bg-green-50 border-green-500'}`}>
                      <div className={`p-2 rounded-full mb-2 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                          <Gauge className="w-5 h-5 text-green-400" />
                      </div>
                      <h4 className={`font-bold text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>1min Aggregation</h4>
                      <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('computing.monitor.continuousQuery', 'Continuous Query')}</p>
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
          <div className={`rounded-xl border p-6 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h3 className={`font-bold mb-4 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{t('computing.monitor.throughput', 'Throughput (Records/sec)')}</h3>
              <div className="h-40 flex items-end gap-1">
                  {[40, 65, 45, 80, 55, 70, 60, 90, 85, 75, 60, 50, 65, 70, 80, 95, 85, 70, 60, 50].map((h, i) => (
                      <div key={i} className="flex-1 bg-blue-500/20 hover:bg-blue-500/40 transition-colors rounded-t" style={{height: `${h}%`}}></div>
                  ))}
              </div>
          </div>
          <div className={`rounded-xl border p-6 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h3 className={`font-bold mb-4 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{t('computing.monitor.checkpointDuration', 'Checkpoint Duration (ms)')}</h3>
              <div className="h-40 flex items-end gap-1">
                  {[20, 22, 21, 25, 20, 22, 23, 21, 22, 20, 25, 28, 30, 25, 22, 21, 20, 22, 21, 20].map((h, i) => (
                      <div key={i} className="flex-1 bg-green-500/20 hover:bg-green-500/40 transition-colors rounded-t" style={{height: `${h * 2}%`}}></div>
                  ))}
              </div>
          </div>
      </div>
    </div>
  );
};
