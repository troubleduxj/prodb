import React, { useState, useEffect } from 'react';
import { Database, Server, Link2, CheckCircle, XCircle, RefreshCw, Bot, Cpu, Settings2, Trash2, Plus, Sparkles, AlertTriangle, Activity, FileText, Shield, X, Save, Loader2, Trash } from 'lucide-react';
import { useTheme } from '../src/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { api } from '../src/services/api';
import { toast } from '../src/hooks/use-toast';

// --- Types ---
interface ConnectionDetail {
  restPort?: number;
  version?: '2.x' | '3.x';
  logAgentUrl?: string;
  prometheusUrl?: string;
  token?: string;
  maxPoolSize?: number;
  timeout?: number;
}

interface ConnectionConfig {
  id: string;
  name: string;
  type: 'TDengine' | 'Redis' | 'Kafka' | 'ClickHouse';
  host: string;
  port: number;
  username?: string;
  password?: string;
  status: 'connected' | 'disconnected' | 'testing' | 'error';
  details?: ConnectionDetail;
  is_default?: boolean;
  max_open_conns?: number;
  max_idle_conns?: number;
  conn_timeout?: number;
}

interface AIProviderConfig {
  id: string;
  provider: 'Google Gemini' | 'OpenAI' | 'Anthropic' | 'Local (Ollama/vLLM)';
  name: string;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  isDefault: boolean;
  status: 'Connected' | 'Error' | 'Untested';
}

// --- Mock Data for AI (Not implemented in backend yet) ---
const INITIAL_AI_PROVIDERS: AIProviderConfig[] = [
  { id: 'ai_1', provider: 'Google Gemini', name: 'Gemini Production', model: 'gemini-1.5-pro', isDefault: true, status: 'Connected' },
  { id: 'ai_2', provider: 'OpenAI', name: 'GPT-4 Fallback', model: 'gpt-4-turbo', isDefault: false, status: 'Untested' },
  { id: 'ai_3', provider: 'Local (Ollama/vLLM)', name: 'Local Reasoning', baseUrl: 'http://localhost:11434', model: 'deepseek-r1:8b', isDefault: false, status: 'Connected' }
];

export const SystemConnect: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'infra' | 'ai'>('infra');
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';

  // Infra State
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edit Modal State
  const [editingConn, setEditingConn] = useState<ConnectionConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editTab, setEditTab] = useState<'basic' | 'monitor' | 'advanced'>('basic');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // AI State
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiProviders, setAiProviders] = useState<AIProviderConfig[]>(INITIAL_AI_PROVIDERS);

  // --- Load Data from API ---
  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.connections.list();
      if (result.success && result.data?.connections) {
        // Transform backend data to frontend format
        const transformedConnections: ConnectionConfig[] = result.data.connections.map((conn: any) => ({
          id: conn.id,
          name: conn.name,
          type: 'TDengine', // Currently only TDengine is supported
          host: conn.host,
          port: conn.port,
          username: conn.username,
          status: conn.status || 'disconnected',
          is_default: conn.is_default,
          max_open_conns: conn.max_open_conns,
          max_idle_conns: conn.max_idle_conns,
          conn_timeout: conn.conn_timeout,
          details: {
            version: '3.x', // Default version
            restPort: conn.port === 6030 ? 6041 : conn.port,
            maxPoolSize: conn.max_open_conns || 100,
            timeout: (conn.conn_timeout || 30) * 1000,
          }
        }));
        setConnections(transformedConnections);
      } else {
        setError(result.error || '加载连接失败');
        toast({
          variant: 'destructive',
          title: '错误',
          description: result.error || '加载连接失败',
        });
      }
    } catch (err) {
      setError('网络请求失败');
      toast({
        variant: 'destructive',
        title: '错误',
        description: '无法连接到服务器',
      });
    } finally {
      setLoading(false);
    }
  };

  // --- Infra Handlers ---
  const handleTestInfra = async (id: string) => {
    setConnections(prev => prev.map(c => c.id === id ? { ...c, status: 'testing' } : c));
    setTesting(true);
    
    try {
      console.log(`[Test Connection] Testing connection ID: ${id}`);
      const result = await api.connections.testById(id);
      console.log(`[Test Connection] Full result:`, JSON.stringify(result, null, 2));
      
      // Check if API call was successful
      if (!result.success) {
        setConnections(prev => prev.map(c => c.id === id ? { ...c, status: 'error' } : c));
        toast({
          variant: 'destructive',
          title: '连接测试失败',
          description: result.error || '无法连接到服务器',
        });
        return;
      }
      
      // Backend returns: { status: "success", data: { success: true, message: "...", ... } }
      // The api service returns: { success: true, data: { status: "success", data: { ... } } }
      const responseData = result.data; // This is the axios response.data
      console.log(`[Test Connection] Response data:`, responseData);
      
      // Check backend response structure
      if (responseData?.status === 'success' && responseData?.data) {
        const testResult = responseData.data;
        console.log(`[Test Connection] Test result:`, testResult);
        
        if (testResult.success) {
          setConnections(prev => prev.map(c =>
            c.id === id ? { ...c, status: 'connected' } : c
          ));
          toast({
            title: '连接测试成功',
            description: testResult.message || '数据库连接正常',
          });
        } else {
          setConnections(prev => prev.map(c =>
            c.id === id ? { ...c, status: 'error' } : c
          ));
          toast({
            variant: 'destructive',
            title: '连接测试失败',
            description: testResult.message || testResult.error || '无法连接到数据库',
          });
        }
      } else if (responseData?.success !== undefined) {
        // Alternative format: response.data might be the test result directly
        if (responseData.success) {
          setConnections(prev => prev.map(c =>
            c.id === id ? { ...c, status: 'connected' } : c
          ));
          toast({
            title: '连接测试成功',
            description: responseData.message || '数据库连接正常',
          });
        } else {
          setConnections(prev => prev.map(c =>
            c.id === id ? { ...c, status: 'error' } : c
          ));
          toast({
            variant: 'destructive',
            title: '连接测试失败',
            description: responseData.message || responseData.error || '无法连接到数据库',
          });
        }
      } else {
        // Unknown response format
        console.error(`[Test Connection] Unknown response format:`, responseData);
        setConnections(prev => prev.map(c => c.id === id ? { ...c, status: 'error' } : c));
        toast({
          variant: 'destructive',
          title: '响应格式错误',
          description: '服务器返回了意外的响应格式',
        });
      }
    } catch (err: any) {
      console.error(`[Test Connection] Error:`, err);
      setConnections(prev => prev.map(c => c.id === id ? { ...c, status: 'error' } : c));
      toast({
        variant: 'destructive',
        title: '连接测试异常',
        description: err?.message || '测试连接时发生网络错误',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!editingConn) return;
    
    setSaving(true);
    try {
      // Transform frontend data to backend format
      const connectionData = {
        name: editingConn.name,
        host: editingConn.host,
        port: editingConn.port,
        username: editingConn.username,
        password: editingConn.password,
        database: 'default', // Default database
        max_open_conns: editingConn.details?.maxPoolSize || 100,
        max_idle_conns: editingConn.details?.maxPoolSize ? Math.floor(editingConn.details.maxPoolSize / 2) : 20,
        conn_timeout: editingConn.details?.timeout ? Math.floor(editingConn.details.timeout / 1000) : 30,
        is_default: editingConn.is_default || false,
        description: '',
      };

      let result;
      if (isCreating) {
        result = await api.connections.create(connectionData);
        if (result.success) {
          toast({
            title: '成功',
            description: '连接创建成功',
          });
        }
      } else {
        result = await api.connections.update(editingConn.id, connectionData);
        if (result.success) {
          toast({
            title: '成功',
            description: '连接更新成功',
          });
        }
      }

      if (result.success) {
        // Reload connections to get fresh data
        await loadConnections();
        setEditingConn(null);
        setIsCreating(false);
      } else {
        toast({
          variant: 'destructive',
          title: '保存失败',
          description: result.error || '请检查配置信息',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '错误',
        description: '保存连接时发生错误',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    if (!confirm('确定要删除这个连接吗？')) return;
    
    try {
      const result = await api.connections.delete(id);
      if (result.success) {
        setConnections(prev => prev.filter(c => c.id !== id));
        toast({
          title: '成功',
          description: '连接已删除',
        });
      } else {
        toast({
          variant: 'destructive',
          title: '删除失败',
          description: result.error || '请稍后重试',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '错误',
        description: '删除连接时发生错误',
      });
    }
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingConn({
      id: 'new',
      name: 'New Connection',
      type: 'TDengine',
      host: 'localhost',
      port: 6030,
      username: 'root',
      status: 'disconnected',
      is_default: false,
      details: {
        version: '3.x',
        restPort: 6041,
        maxPoolSize: 100,
        timeout: 5000,
      }
    });
    setEditTab('basic');
  };

  const handleEditChange = (field: keyof ConnectionConfig, value: any) => {
    if (editingConn) setEditingConn({ ...editingConn, [field]: value });
  };

  const handleDetailChange = (field: keyof ConnectionDetail, value: any) => {
    if (editingConn) {
      setEditingConn({
        ...editingConn,
        details: { ...editingConn.details, [field]: value }
      });
    }
  };

  const handleCloseModal = () => {
    setEditingConn(null);
    setIsCreating(false);
  };

  // --- AI Handlers (Mock) ---
  const handleTestAI = (id: string) => {
    setAiProviders(prev => prev.map(p => p.id === id ? { ...p, status: 'Untested' } : p));
    setTimeout(() => {
      setAiProviders(prev => prev.map(p => p.id === id ? { ...p, status: 'Connected' } : p));
    }, 1200);
  };

  const handleSetDefaultAI = (id: string) => {
    setAiProviders(prev => prev.map(p => ({ ...p, isDefault: p.id === id })));
  };

  const handleDeleteAI = (id: string) => {
    setAiProviders(prev => prev.filter(p => p.id !== id));
  };

  // --- Render Helpers ---
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'testing':
        return (
          <span className="text-xs flex items-center text-yellow-500 animate-pulse">
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> {t('common.testing')}
          </span>
        );
      case 'connected':
        return (
          <span className="text-xs flex items-center text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
            <CheckCircle className="w-3 h-3 mr-1" /> {t('common.online')}
          </span>
        );
      case 'error':
        return (
          <span className="text-xs flex items-center text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
            <XCircle className="w-3 h-3 mr-1" /> {t('common.error')}
          </span>
        );
      default:
        return (
          <span className="text-xs flex items-center text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
            <XCircle className="w-3 h-3 mr-1" /> {t('common.offline')}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('connect.settings')}</h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1`}>{t('connect.manageInfrastructure')}</p>
        </div>
        
        <div className={`flex gap-1 ${isDark ? 'bg-gray-800' : 'bg-white'} p-1 rounded-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <button 
            onClick={() => setActiveTab('infra')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'infra' 
              ? (isDark ? 'bg-gray-700 text-gray-100' : 'bg-gray-200 text-gray-900') 
              : (isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100')
            }`}
          >
            {t('connect.infrastructure')}
          </button>
          <button 
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === 'ai' 
              ? 'bg-purple-600/20 text-purple-300 shadow-sm border border-purple-500/30' 
              : (isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100')
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> {t('connect.aiConfig')}
          </button>
        </div>
      </div>

      {activeTab === 'infra' && (
        <>
          {/* Refresh Button */}
          <div className="flex justify-end">
            <button
              onClick={loadConnections}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isDark 
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700' 
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              } disabled:opacity-50`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {t('common.refresh')}
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>加载连接配置...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className={`${isDark ? 'bg-red-900/20 border-red-500/30' : 'bg-red-50 border-red-200'} border rounded-xl p-6 text-center`}>
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <h3 className={`text-lg font-medium ${isDark ? 'text-red-300' : 'text-red-700'} mb-2`}>加载失败</h3>
              <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'} mb-4`}>{error}</p>
              <button
                onClick={loadConnections}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                重试
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && connections.length === 0 && (
            <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-12 text-center`}>
              <Database className={`w-12 h-12 ${isDark ? 'text-gray-600' : 'text-gray-400'} mx-auto mb-4`} />
              <h3 className={`text-lg font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>暂无连接配置</h3>
              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'} mb-6`}>点击下方的"添加服务连接"创建新的数据库连接</p>
            </div>
          )}

          {/* Connections Grid */}
          {!loading && !error && connections.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-300">
              {connections.map(conn => (
                <div key={conn.id} className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} p-6 flex flex-col group hover:border-blue-500/30 transition-all`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${
                        conn.type === 'TDengine' ? 'bg-blue-500/20 text-blue-400' :
                        conn.type === 'Redis' ? 'bg-red-500/20 text-red-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>
                        {conn.type === 'TDengine' ? <Database className="w-6 h-6" /> :
                         conn.type === 'Redis' ? <Server className="w-6 h-6" /> :
                         <Link2 className="w-6 h-6" />}
                      </div>
                      <div>
                        <h3 className={`font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{conn.name}</h3>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{conn.type}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      {getStatusDisplay(conn.status)}
                      {conn.is_default && (
                        <span className="text-[10px] text-blue-400 mt-1">默认</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 flex-1">
                    <div className={`${isDark ? 'bg-gray-900/50' : 'bg-gray-50'} rounded-lg p-3 border ${isDark ? 'border-gray-700/50' : 'border-gray-200'} space-y-3`}>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'} uppercase font-bold block mb-0.5`}>{t('common.host')}</span>
                          <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} font-mono truncate block`} title={conn.host}>{conn.host}</span>
                        </div>
                        <div className="col-span-1">
                          <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'} uppercase font-bold block mb-0.5`}>{t('common.port')}</span>
                          <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} font-mono block`}>{conn.port}</span>
                        </div>
                      </div>
                      <div>
                        <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'} uppercase font-bold block mb-0.5`}>{t('common.user')}</span>
                        <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} font-mono block`}>{conn.username || '-'}</span>
                      </div>
                    </div>
                    
                    {conn.type === 'TDengine' && conn.details && (
                      <div className="flex gap-2 flex-wrap">
                        {conn.details.version && (
                          <span className={`text-[10px] ${isDark ? 'bg-gray-700 text-gray-300 border-gray-600/50' : 'bg-gray-200 text-gray-600 border-gray-300'} px-2 py-1 rounded border`}>
                            v{conn.details.version}
                          </span>
                        )}
                        {conn.details.restPort && (
                          <span className="text-[10px] bg-blue-900/20 text-blue-300 px-2 py-1 rounded border border-blue-500/20">
                            REST: {conn.details.restPort}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={`mt-6 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} flex justify-between gap-2`}>
                    <button 
                      onClick={() => handleDeleteConnection(conn.id)}
                      className={`px-3 py-1.5 ${isDark ? 'bg-red-900/20 hover:bg-red-900/40 text-red-400 border-red-500/30' : 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200'} rounded text-sm font-medium transition-colors flex items-center border`}
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setIsCreating(false); setEditingConn(conn); setEditTab('basic'); }}
                        className={`px-3 py-1.5 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 border-gray-300'} rounded text-sm font-medium transition-colors flex items-center border`}
                      >
                        <Settings2 className="w-4 h-4 mr-1.5" /> {t('common.configure')}
                      </button>
                      <button 
                        onClick={() => handleTestInfra(conn.id)}
                        disabled={conn.status === 'testing' || testing}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50 flex items-center"
                      >
                        {conn.status === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.test')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Add New Button */}
          {!loading && (
            <div 
              onClick={handleCreateNew}
              className={`border-2 border-dashed ${isDark ? 'border-gray-700' : 'border-gray-300'} rounded-xl p-6 flex flex-col items-center justify-center ${isDark ? 'text-gray-500' : 'text-gray-400'} hover:border-blue-500 hover:text-blue-400 transition-all cursor-pointer min-h-[200px] ${!connections.length ? 'mt-0' : 'mt-6'}`}
            >
              <div className={`p-4 ${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-full mb-3`}>
                <Link2 className="w-8 h-8" />
              </div>
              <p className="font-medium">{t('connect.addServiceConnection')}</p>
            </div>
          )}
        </>
      )}

      {/* Edit Connection Modal */}
      {editingConn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]`}>
            <div className={`p-5 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} flex justify-between items-center`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  editingConn.type === 'TDengine' ? 'bg-blue-500/20 text-blue-400' : (isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')
                }`}>
                  {editingConn.type === 'TDengine' ? <Database className="w-5 h-5" /> : <Server className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                    {isCreating ? '创建新连接' : `${t('connect.configure')} ${editingConn.name}`}
                  </h2>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{editingConn.type} {t('connect.connectionParameters')}</p>
                </div>
              </div>
              <button onClick={handleCloseModal} className={`${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}><X className="w-5 h-5"/></button>
            </div>

            {/* Tabs */}
            <div className={`flex border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} px-5 gap-4`}>
              <button 
                onClick={() => setEditTab('basic')}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${editTab === 'basic' ? 'border-blue-500 text-blue-400' : (isDark ? 'border-transparent text-gray-400 hover:text-gray-200' : 'border-transparent text-gray-500 hover:text-gray-700')}`}
              >
                {t('common.general')}
              </button>
              {editingConn.type === 'TDengine' && (
                <>
                  <button 
                    onClick={() => setEditTab('monitor')}
                    className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center ${editTab === 'monitor' ? 'border-purple-500 text-purple-400' : (isDark ? 'border-transparent text-gray-400 hover:text-gray-200' : 'border-transparent text-gray-500 hover:text-gray-700')}`}
                  >
                    <Activity className="w-3.5 h-3.5 mr-2" /> {t('connect.monitoringLogs')}
                  </button>
                  <button 
                    onClick={() => setEditTab('advanced')}
                    className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center ${editTab === 'advanced' ? 'border-yellow-500 text-yellow-400' : (isDark ? 'border-transparent text-gray-400 hover:text-gray-200' : 'border-transparent text-gray-500 hover:text-gray-700')}`}
                  >
                    <Shield className="w-3.5 h-3.5 mr-2" /> {t('common.advanced')}
                  </button>
                </>
              )}
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {editTab === 'basic' && (
                <div className="space-y-4">
                  <div>
                    <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>连接名称</label>
                    <input 
                      type="text" 
                      value={editingConn.name}
                      onChange={(e) => handleEditChange('name', e.target.value)}
                      className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none focus:border-blue-500`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>{t('common.hostIP')}</label>
                      <input 
                        type="text" 
                        value={editingConn.host}
                        onChange={(e) => handleEditChange('host', e.target.value)}
                        className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none focus:border-blue-500`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>{t('common.rpcPort')}</label>
                      <input 
                        type="number" 
                        value={editingConn.port}
                        onChange={(e) => handleEditChange('port', Number(e.target.value))}
                        className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none focus:border-blue-500`}
                      />
                      <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>{t('connect.defaultPort')}: 6030</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>{t('common.username')}</label>
                      <input 
                        type="text" 
                        value={editingConn.username || ''}
                        onChange={(e) => handleEditChange('username', e.target.value)}
                        className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none focus:border-blue-500`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>{t('common.password')}</label>
                      <input 
                        type="password" 
                        value={editingConn.password || ''}
                        onChange={(e) => handleEditChange('password', e.target.value)}
                        className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none focus:border-blue-500`}
                        placeholder={isCreating ? '' : '•••••••• (留空保持原密码)'}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="isDefault"
                      checked={editingConn.is_default || false}
                      onChange={(e) => handleEditChange('is_default', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="isDefault" className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      设为默认连接
                    </label>
                  </div>
                  {editingConn.type === 'TDengine' && (
                    <div>
                      <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>{t('connect.clusterVersion')}</label>
                      <select 
                        value={editingConn.details?.version || '3.x'}
                        onChange={(e) => handleDetailChange('version', e.target.value)}
                        className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none`}
                      >
                        <option value="3.x">TDengine 3.x ({t('common.recommended')})</option>
                        <option value="2.x">TDengine 2.x ({t('common.legacy')})</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {editTab === 'monitor' && (
                <div className="space-y-5">
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-3">
                    <Activity className="w-5 h-5 text-blue-400 shrink-0" />
                    <div className="text-xs text-blue-200/80">
                      <p className="font-bold text-blue-300 mb-1">{t('connect.whyConfigureMonitoring')}</p>
                      <p>{t('connect.monitoringDescription')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>{t('connect.restApiPort')}</label>
                      <input 
                        type="number" 
                        value={editingConn.details?.restPort || 6041}
                        onChange={(e) => handleDetailChange('restPort', Number(e.target.value))}
                        className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none focus:border-purple-500`}
                      />
                      <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>{t('connect.usedForStatusChecks')}</p>
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>{t('connect.prometheusExporterUrl')}</label>
                      <input 
                        type="text" 
                        value={editingConn.details?.prometheusUrl || ''}
                        onChange={(e) => handleDetailChange('prometheusUrl', e.target.value)}
                        placeholder="http://host:9090"
                        className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none focus:border-purple-500`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>{t('connect.logAgentEndpoint')}</label>
                    <div className="flex gap-2">
                      <div className={`p-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <input 
                        type="text" 
                        value={editingConn.details?.logAgentUrl || ''}
                        onChange={(e) => handleDetailChange('logAgentUrl', e.target.value)}
                        placeholder="http://log-server:9200/_search"
                        className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none focus:border-purple-500`}
                      />
                    </div>
                    <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>{t('connect.urlToFetchLogs')}</p>
                  </div>
                </div>
              )}

              {editTab === 'advanced' && (
                <div className="space-y-4">
                  <div>
                    <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>{t('connect.authToken')}</label>
                    <input 
                      type="password" 
                      value={editingConn.details?.token || ''}
                      onChange={(e) => handleDetailChange('token', e.target.value)}
                      placeholder={t('connect.useTokenInsteadOfPassword')}
                      className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none focus:border-yellow-500`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>{t('connect.maxConnectionPool')}</label>
                      <input 
                        type="number" 
                        value={editingConn.details?.maxPoolSize || 100}
                        onChange={(e) => handleDetailChange('maxPoolSize', Number(e.target.value))}
                        className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none focus:border-yellow-500`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-1`}>{t('connect.requestTimeout')}</label>
                      <input 
                        type="number" 
                        value={editingConn.details?.timeout || 5000}
                        onChange={(e) => handleDetailChange('timeout', Number(e.target.value))}
                        className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none focus:border-yellow-500`}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={`p-5 border-t ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'} flex justify-end gap-3 rounded-b-xl`}>
              <button 
                onClick={handleCloseModal} 
                className={`px-4 py-2 text-sm ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                disabled={saving}
              >
                {t('common.cancel')}
              </button>
              <button 
                onClick={handleSaveConnection}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium shadow-lg shadow-blue-900/20 flex items-center disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {saving ? '保存中...' : t('connect.saveConfiguration')}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
          {/* Global AI Switch */}
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} p-6 flex items-center justify-between`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${aiEnabled ? 'bg-purple-500/20 text-purple-400' : (isDark ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400')}`}>
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'} flex items-center gap-2`}>
                  {t('connect.aiAssistantFeatures')}
                  {!aiEnabled && <span className={`text-xs ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'} px-2 py-0.5 rounded`}>{t('common.disabled')}</span>}
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('connect.aiDescription')}</p>
              </div>
            </div>
            <div 
              onClick={() => setAiEnabled(!aiEnabled)}
              className={`w-14 h-7 rounded-full relative cursor-pointer transition-colors ${aiEnabled ? 'bg-purple-600' : (isDark ? 'bg-gray-600' : 'bg-gray-300')}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-1 shadow-sm transition-all ${aiEnabled ? 'left-[30px]' : 'left-1'}`}></div>
            </div>
          </div>

          {/* Provider Configs */}
          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-opacity ${!aiEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            {aiProviders.map(provider => (
              <div 
                key={provider.id} 
                className={`
                  ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border p-6 relative group transition-all
                  ${provider.isDefault ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : (isDark ? 'border-gray-700 hover:border-gray-500' : 'border-gray-200 hover:border-gray-400')}
                `}
              >
                {provider.isDefault && (
                  <div className="absolute top-0 right-0 bg-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg shadow-sm">
                    {t('connect.defaultProvider')}
                  </div>
                )}
                
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'} rounded-lg`}>
                      <Cpu className={`w-6 h-6 ${provider.isDefault ? 'text-purple-400' : (isDark ? 'text-gray-400' : 'text-gray-500')}`} />
                    </div>
                    <div>
                      <h3 className={`font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{provider.name}</h3>
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{provider.provider}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 pr-2">
                    <button className={`p-2 hover:${isDark ? 'bg-gray-700' : 'bg-gray-100'} rounded ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'} transition-colors`} title={t('common.settings')}>
                      <Settings2 className="w-4 h-4" />
                    </button>
                    {!provider.isDefault && (
                      <button 
                        onClick={() => handleDeleteAI(provider.id)}
                        className={`p-2 hover:bg-red-900/30 rounded ${isDark ? 'text-gray-400 hover:text-red-400' : 'text-gray-500 hover:text-red-500'} transition-colors`}
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className={`space-y-4 mb-6 p-4 ${isDark ? 'bg-gray-900/30' : 'bg-gray-50'} rounded-lg border ${isDark ? 'border-gray-700/30' : 'border-gray-200'}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'} uppercase font-bold block mb-1`}>{t('common.modelName')}</label>
                      <input 
                        type="text" 
                        value={provider.model} 
                        readOnly 
                        className={`w-full ${isDark ? 'bg-gray-800 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-600'} border rounded px-2 py-1.5 text-sm font-mono outline-none`} 
                      />
                    </div>
                    <div>
                      <label className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'} uppercase font-bold block mb-1`}>{t('common.apiKey')}</label>
                      <input 
                        type="password" 
                        value="sk-................" 
                        readOnly 
                        className={`w-full ${isDark ? 'bg-gray-800 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-600'} border rounded px-2 py-1.5 text-sm font-mono outline-none`} 
                      />
                    </div>
                  </div>
                  {provider.baseUrl && (
                    <div>
                      <label className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'} uppercase font-bold block mb-1`}>{t('common.baseUrl')}</label>
                      <input 
                        type="text" 
                        value={provider.baseUrl} 
                        readOnly 
                        className={`w-full ${isDark ? 'bg-gray-800 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-600'} border rounded px-2 py-1.5 text-sm font-mono outline-none`} 
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${provider.status === 'Connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : (isDark ? 'bg-gray-600' : 'bg-gray-400')}`}></div>
                    <span className={`text-xs font-medium ${provider.status === 'Connected' ? 'text-green-400' : (isDark ? 'text-gray-500' : 'text-gray-400')}`}>
                      {provider.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    {!provider.isDefault && (
                      <button 
                        onClick={() => handleSetDefaultAI(provider.id)}
                        className={`text-xs ${isDark ? 'text-gray-400 hover:text-purple-400' : 'text-gray-500 hover:text-purple-500'} transition-colors font-medium`}
                      >
                        {t('connect.setAsDefault')}
                      </button>
                    )}
                    <button 
                      onClick={() => handleTestAI(provider.id)}
                      className={`px-4 py-1.5 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600' : 'bg-gray-200 hover:bg-gray-300 text-gray-700 border-gray-300'} rounded text-xs font-medium transition-colors border`}
                    >
                      {t('connect.testConnection')}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Add New Card */}
            <div className={`border-2 border-dashed ${isDark ? 'border-gray-700' : 'border-gray-300'} rounded-xl p-6 flex flex-col items-center justify-center ${isDark ? 'text-gray-500' : 'text-gray-400'} hover:border-purple-500 hover:text-purple-400 hover:bg-purple-900/5 transition-all cursor-pointer min-h-[250px] group`}>
              <div className={`p-4 ${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-full mb-3 group-hover:bg-purple-500/10 transition-colors`}>
                <Plus className="w-8 h-8" />
              </div>
              <p className="font-medium">{t('connect.addLLMProvider')}</p>
              <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'} mt-1`}>{t('connect.llmOptions')}</p>
            </div>
          </div>
          
          {/* Warning Banner if no default */}
          {!aiProviders.some(p => p.isDefault) && aiEnabled && (
            <div className={`${isDark ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-4 flex items-center gap-3`}>
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <p className={`text-sm ${isDark ? 'text-yellow-200' : 'text-yellow-700'}`}>
                <span className="font-bold">{t('connect.configurationIncomplete')}:</span> {t('connect.selectDefaultProvider')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
