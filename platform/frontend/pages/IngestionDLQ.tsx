import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { AlertOctagon, RefreshCw, Trash2, CheckCircle, Search, FileJson, ArrowRight, ExternalLink, Play, X, AlertTriangle, GitMerge } from 'lucide-react';
import { Page } from '../types';

interface DeadLetter {
    id: string;
    ts: string;
    sourceId: string;
    sourceName: string;
    errorType: 'Schema Mismatch' | 'Parse Error' | 'Missing Field' | 'Type Error';
    errorMessage: string;
    payload: string;
    status: 'Pending' | 'Replayed' | 'Discarded';
}

const MOCK_DLQ: DeadLetter[] = [
    {
        id: 'msg_001',
        ts: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        sourceId: 'ds_001',
        sourceName: 'Factory A IoT Gateway',
        errorType: 'Schema Mismatch',
        errorMessage: "Field 'voltage' expected FLOAT, got STRING 'high'",
        payload: JSON.stringify({ device_id: 'sensor_01', voltage: 'high', ts: 1678888800000 }, null, 2),
        status: 'Pending'
    },
    {
        id: 'msg_002',
        ts: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        sourceId: 'ds_002',
        sourceName: 'Vehicle Fleet Stream',
        errorType: 'Missing Field',
        errorMessage: "Required field 'vin' is missing",
        payload: JSON.stringify({ speed: 85, gps: { lat: 34.0, lng: -118.2 } }, null, 2),
        status: 'Pending'
    },
    {
        id: 'msg_003',
        ts: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        sourceId: 'ds_003',
        sourceName: 'Weather API Poller',
        errorType: 'Parse Error',
        errorMessage: "Unexpected token in JSON at position 45",
        payload: '{"city": "London", "temp": 12.5, "humidity": 60, ...TRUNCATED',
        status: 'Discarded'
    }
];

export const IngestionDLQ: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [messages, setMessages] = useState<DeadLetter[]>(MOCK_DLQ);
  const [selectedMsg, setSelectedMsg] = useState<DeadLetter | null>(null);
  const [editPayload, setEditPayload] = useState('');
  const [filter, setFilter] = useState('');
  const [isReplaying, setIsReplaying] = useState(false);

  // Stats
  const stats = {
      total: messages.length,
      pending: messages.filter(m => m.status === 'Pending').length,
      replayed: messages.filter(m => m.status === 'Replayed').length,
  };

  const handleOpenDetail = (msg: DeadLetter) => {
      setSelectedMsg(msg);
      setEditPayload(msg.payload);
  };

  const handleCloseDetail = () => {
      setSelectedMsg(null);
      setEditPayload('');
  };

  const handleReplay = (id: string) => {
      setIsReplaying(true);
      setTimeout(() => {
          setMessages(prev => prev.map(m => m.id === id ? { ...m, status: 'Replayed' } : m));
          setIsReplaying(false);
          handleCloseDetail();
      }, 800);
  };

  const handleDelete = (id: string) => {
      setMessages(prev => prev.filter(m => m.id !== id));
      if (selectedMsg?.id === id) handleCloseDetail();
  };

  const handleNavigateToMapping = (sourceId: string) => {
      navigate(`/${Page.INGESTION_MAPPING}?sourceId=${sourceId}`);
  };

  const filteredMessages = messages.filter(m => 
      m.sourceName.toLowerCase().includes(filter.toLowerCase()) || 
      m.errorType.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
           <h1 className={`text-2xl font-bold flex items-center ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
               <AlertOctagon className="w-6 h-6 mr-3 text-red-500" />
               {t('dlq.title', 'Exception Data Center (DLQ)')}
           </h1>
           <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('dlq.description', 'Manage, fix, and replay failed ingestion messages.')}</p>
        </div>
        <button className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border flex items-center ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'}`}>
            <RefreshCw className="w-4 h-4 mr-2" /> {t('dlq.refreshQueue', 'Refresh Queue')}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`p-4 rounded-xl border flex items-center justify-between ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div>
                  <p className={`text-xs uppercase font-bold ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('dlq.pendingFix', 'Pending Fix')}</p>
                  <p className="text-2xl font-bold text-red-400">{stats.pending}</p>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg text-red-500">
                  <AlertTriangle className="w-6 h-6" />
              </div>
          </div>
          <div className={`p-4 rounded-xl border flex items-center justify-between ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div>
                  <p className={`text-xs uppercase font-bold ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('dlq.successfullyReplayed', 'Successfully Replayed')}</p>
                  <p className="text-2xl font-bold text-green-400">{stats.replayed}</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg text-green-500">
                  <CheckCircle className="w-6 h-6" />
              </div>
          </div>
          <div className={`p-4 rounded-xl border flex items-center justify-between ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div>
                  <p className={`text-xs uppercase font-bold ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('dlq.totalEvents', 'Total Events')}</p>
                  <p className={`text-2xl font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
                  <FileJson className="w-6 h-6" />
              </div>
          </div>
      </div>

      {/* Main Content */}
      <div className={`rounded-xl border flex flex-col min-h-[500px] ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          {/* Toolbar */}
          <div className={`p-4 border-b flex justify-between items-center gap-4 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="relative flex-1 max-w-md">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input 
                      type="text" 
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder={t('dlq.searchPlaceholder', 'Search by source or error type...')}
                      className={`w-full border rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-blue-500 ${isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`}
                  />
              </div>
              <div className="flex gap-2">
                  <button className="px-3 py-2 text-xs font-medium bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/20 rounded-lg flex items-center">
                      <Trash2 className="w-3 h-3 mr-1.5" /> {t('dlq.clearAllDiscarded', 'Clear All Discarded')}
                  </button>
                  <button className="px-3 py-2 text-xs font-medium bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/20 rounded-lg flex items-center">
                      <Play className="w-3 h-3 mr-1.5" /> {t('dlq.replayAll', 'Replay All')}
                  </button>
              </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                  <thead className={`text-xs uppercase sticky top-0 z-10 ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                      <tr>
                          <th className={`p-4 border-b font-medium ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{t('common.timestamp', 'Timestamp')}</th>
                          <th className={`p-4 border-b font-medium ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{t('common.source', 'Source')}</th>
                          <th className={`p-4 border-b font-medium ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{t('common.errorType', 'Error Type')}</th>
                          <th className={`p-4 border-b font-medium ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{t('dlq.messageDetails', 'Message Details')}</th>
                          <th className={`p-4 border-b font-medium text-center ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{t('common.status', 'Status')}</th>
                          <th className={`p-4 border-b font-medium text-right ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{t('common.actions', 'Actions')}</th>
                      </tr>
                  </thead>
                  <tbody className={`divide-y text-sm ${isDark ? 'divide-gray-700' : 'divide-gray-100'}`}>
                      {filteredMessages.map(msg => (
                          <tr key={msg.id} className={`transition-colors group ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}`}>
                              <td className={`p-4 whitespace-nowrap font-mono text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {msg.ts}
                              </td>
                              <td className="p-4">
                                  <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{msg.sourceName}</span>
                                  <span className={`block text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{msg.sourceId}</span>
                              </td>
                              <td className="p-4">
                                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                                      msg.errorType === 'Schema Mismatch' ? 'bg-orange-500/20 text-orange-400' :
                                      msg.errorType === 'Parse Error' ? 'bg-red-500/20 text-red-400' :
                                      'bg-yellow-500/20 text-yellow-400'
                                  }`}>
                                      {msg.errorType}
                                  </span>
                              </td>
                              <td className="p-4 max-w-xs">
                                  <p className={`truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`} title={msg.errorMessage}>{msg.errorMessage}</p>
                                  <code className={`text-xs block truncate font-mono mt-1 opacity-70 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{msg.payload}</code>
                              </td>
                              <td className="p-4 text-center">
                                  {msg.status === 'Pending' && <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" title={t('dlq.pending', 'Pending')}></span>}
                                  {msg.status === 'Replayed' && <span className="inline-block w-2 h-2 rounded-full bg-green-500" title={t('dlq.replayed', 'Replayed')}></span>}
                                  {msg.status === 'Discarded' && <span className="inline-block w-2 h-2 rounded-full bg-gray-500" title={t('dlq.discarded', 'Discarded')}></span>}
                              </td>
                              <td className="p-4 text-right">
                                  <button 
                                      onClick={() => handleOpenDetail(msg)}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors shadow-sm"
                                  >
                                      {t('dlq.inspectFix', 'Inspect & Fix')}
                                  </button>
                              </td>
                          </tr>
                      ))}
                      {filteredMessages.length === 0 && (
                          <tr>
                              <td colSpan={6} className={`p-12 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                  <p>{t('dlq.noExceptionMessages', 'No exception messages found matching criteria.')}</p>
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {/* Inspect Drawer/Modal */}
      {selectedMsg && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
              <div className={`w-full max-w-xl border-l shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-200 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className={`p-6 border-b flex justify-between items-center ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
                      <div>
                          <h2 className={`text-lg font-bold flex items-center ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                              <FileJson className="w-5 h-5 mr-2 text-blue-400" /> {t('dlq.messageInspector', 'Message Inspector')}
                          </h2>
                          <p className={`text-xs font-mono mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{selectedMsg.id}</p>
                      </div>
                      <button onClick={handleCloseDetail} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}>
                          <X className="w-6 h-6" />
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* Error Info */}
                      <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-4">
                          <h4 className="text-red-400 font-bold text-sm mb-1 flex items-center">
                              <AlertTriangle className="w-4 h-4 mr-2" />
                              {selectedMsg.errorType}
                          </h4>
                          <p className="text-red-200 text-sm">{selectedMsg.errorMessage}</p>
                      </div>

                      {/* Source Info */}
                      <div className={`flex items-center justify-between p-4 rounded-lg border ${isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                          <div>
                              <p className={`text-xs uppercase ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('common.source', 'Source')}</p>
                              <p className={`text-sm font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{selectedMsg.sourceName}</p>
                          </div>
                          <button 
                              onClick={() => handleNavigateToMapping(selectedMsg.sourceId)}
                              className="text-xs flex items-center text-blue-400 hover:text-blue-300 transition-colors"
                          >
                              <GitMerge className="w-3 h-3 mr-1" /> {t('dlq.fixMappingRules', 'Fix Mapping Rules')}
                          </button>
                      </div>

                      {/* Payload Editor */}
                      <div>
                          <div className="flex justify-between items-center mb-2">
                              <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('dlq.messagePayload', 'Message Payload')}</label>
                              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>JSON Format</span>
                          </div>
                          <textarea 
                              value={editPayload}
                              onChange={(e) => setEditPayload(e.target.value)}
                              className={`w-full h-96 border rounded-lg p-4 font-mono text-sm outline-none focus:border-blue-500 resize-none leading-relaxed ${isDark ? 'bg-[#1e1e1e] border-gray-600 text-blue-300' : 'bg-gray-50 border-gray-300 text-blue-600'}`}
                              spellCheck={false}
                          />
                          <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                              {t('dlq.payloadEditHint', 'You can manually correct the data payload here before replaying.')}
                          </p>
                      </div>
                  </div>

                  <div className={`p-6 border-t flex justify-between items-center ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
                       <button 
                          onClick={() => handleDelete(selectedMsg.id)}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center ${isDark ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20' : 'text-red-500 hover:text-red-600 hover:bg-red-50'}`}
                       >
                           <Trash2 className="w-4 h-4 mr-2" /> {t('dlq.discard', 'Discard')}
                       </button>
                       <div className="flex gap-3">
                           <button onClick={handleCloseDetail} className={`px-4 py-2 text-sm ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-800'}`}>{t('common.cancel', 'Cancel')}</button>
                           <button 
                              onClick={() => handleReplay(selectedMsg.id)}
                              disabled={isReplaying || selectedMsg.status === 'Replayed'}
                              className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-green-900/20 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                           >
                              {isReplaying ? t('dlq.replaying', 'Replaying...') : (
                                  <>
                                      <Play className="w-4 h-4 mr-2 fill-current" /> {t('dlq.replayMessage', 'Replay Message')}
                                  </>
                              )}
                           </button>
                       </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
