import React from 'react';
import { Webhook, Plus, Copy, Power, MoreVertical, PlayCircle } from 'lucide-react';
import { useTheme } from '../src/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const MOCK_APIS = [
    { id: 'api_01', path: '/v1/stats/voltage', method: 'GET', sql: 'SELECT avg(voltage) FROM meters...', status: 'Active', latency: '45ms', hits: '12.5k' },
    { id: 'api_02', path: '/v1/alerts/recent', method: 'GET', sql: 'SELECT * FROM alerts WHERE severity > 2...', status: 'Active', latency: '120ms', hits: '3.2k' },
    { id: 'api_03', path: '/v1/report/daily', method: 'POST', sql: 'SELECT max(val) FROM sensors WHERE...', status: 'Inactive', latency: '-', hits: '0' },
];

export const QueryApi: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
           <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('api.queryAsAPI')}</h1>
           <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1`}>{t('api.publishSQLQueries')}</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center shadow-lg shadow-blue-900/20">
           <Plus className="w-4 h-4 mr-2" /> {t('api.newEndpoint')}
        </button>
      </div>

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} overflow-hidden`}>
          <table className="w-full text-left border-collapse">
              <thead>
                  <tr className={`${isDark ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-100 text-gray-500'} text-xs uppercase border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <th className="p-4 font-medium">{t('api.endpointPath')}</th>
                      <th className="p-4 font-medium text-center">{t('common.method')}</th>
                      <th className="p-4 font-medium">{t('api.underlyingSQL')}</th>
                      <th className="p-4 font-medium text-center">{t('common.status')}</th>
                      <th className="p-4 font-medium text-center">{t('api.avgLatency')}</th>
                      <th className="p-4 font-medium text-right">{t('common.actions')}</th>
                  </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {MOCK_APIS.map(api => (
                      <tr key={api.id} className={`${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'} transition-colors`}>
                          <td className="p-4">
                              <div className="flex items-center gap-2">
                                  <div className={`p-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded text-purple-400`}>
                                      <Webhook className="w-4 h-4" />
                                  </div>
                                  <div>
                                      <span className={`font-mono text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{api.path}</span>
                                      <span className={`block text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>ID: {api.id}</span>
                                  </div>
                              </div>
                          </td>
                          <td className="p-4 text-center">
                              <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded">{api.method}</span>
                          </td>
                          <td className="p-4">
                              <code className={`text-xs ${isDark ? 'text-gray-400 bg-gray-900 border-gray-700' : 'text-gray-500 bg-gray-100 border-gray-200'} px-2 py-1 rounded border block truncate max-w-[200px]`}>
                                  {api.sql}
                              </code>
                          </td>
                          <td className="p-4 text-center">
                              {api.status === 'Active' ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                                      {t('common.active')}
                                  </span>
                              ) : (
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>
                                      {t('common.inactive')}
                                  </span>
                              )}
                          </td>
                          <td className={`p-4 text-center text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'} font-mono`}>{api.latency}</td>
                          <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                  <button className={`p-2 ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'} rounded transition`} title={t('common.test')}>
                                      <PlayCircle className="w-4 h-4" />
                                  </button>
                                  <button className={`p-2 ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'} rounded transition`} title={t('common.copyURL')}>
                                      <Copy className="w-4 h-4" />
                                  </button>
                                  <button className={`p-2 ${isDark ? 'text-gray-400 hover:text-red-400 hover:bg-gray-700' : 'text-gray-500 hover:text-red-500 hover:bg-gray-100'} rounded transition`} title={t('common.disable')}>
                                      <Power className="w-4 h-4" />
                                  </button>
                                  <button className={`p-2 ${isDark ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'} rounded transition`}>
                                      <MoreVertical className="w-4 h-4" />
                                  </button>
                              </div>
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>
    </div>
  );
};
