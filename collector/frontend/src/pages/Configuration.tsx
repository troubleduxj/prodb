import React, { useState, useEffect } from 'react';
import { Save, Database, Key, Globe, CheckCircle2, Loader2, Wifi, AlertCircle, Code, Eye, EyeOff, Copy } from 'lucide-react';

// API 基础 URL
const API_BASE_URL = '/api/v1';

// 配置接口
interface CollectorConfig {
  platform_url: string;
  agent_id: string;
  access_token: string;
  buffer_size: number;
  sync_interval: number;
}

export default function Configuration() {
  // 表单状态
  const [platformUrl, setPlatformUrl] = useState('');
  const [agentId, setAgentId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [bufferSize, setBufferSize] = useState(1024);
  const [syncInterval, setSyncInterval] = useState(1000);
  const [jsonSchema, setJsonSchema] = useState(`{
  "type": "object",
  "properties": {
    "timestamp": { "type": "string", "format": "date-time" },
    "sensor_id": { "type": "string" },
    "value": { "type": "number" },
    "unit": { "type": "string" }
  },
  "required": ["timestamp", "sensor_id", "value"]
}`);

  // UI 状态
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showToken, setShowToken] = useState(false);

  // 验证错误
  const [validationErrors, setValidationErrors] = useState<{
    platformUrl?: string;
    agentId?: string;
    accessToken?: string;
  }>({});

  // 页面加载时读取配置
  useEffect(() => {
    fetchConfig();
  }, []);

  // 读取配置
  const fetchConfig = async () => {
    try {
      setLoading(true);
      setLoadError('');
      
      const response = await fetch(`${API_BASE_URL}/config`);
      
      if (!response.ok) {
        throw new Error(`Failed to load config: ${response.status}`);
      }
      
      const data = await response.json();
      
      setPlatformUrl(data.platform_url || '');
      setAgentId(data.agent_id || '');
      setAccessToken(data.access_token || '');
      setBufferSize(data.buffer_size || 1024);
      setSyncInterval(data.sync_interval || 1000);
    } catch (error) {
      console.error('Error loading config:', error);
      setLoadError('Failed to load configuration. Please try again.');
      // 使用默认值
      setPlatformUrl('http://localhost:9080');
    } finally {
      setLoading(false);
    }
  };

  // 验证表单
  const validateForm = (): boolean => {
    const errors: { platformUrl?: string; agentId?: string; accessToken?: string } = {};
    
    // 验证 Platform URL
    if (!platformUrl.trim()) {
      errors.platformUrl = 'Platform URL is required';
    } else {
      try {
        new URL(platformUrl);
      } catch {
        errors.platformUrl = 'Please enter a valid URL';
      }
    }
    
    // 验证 Agent ID
    if (!agentId.trim()) {
      errors.agentId = 'Agent ID is required';
    } else {
      const agentIdRegex = /^[a-z0-9-]+$/;
      if (!agentIdRegex.test(agentId)) {
        errors.agentId = 'Agent ID must contain only lowercase letters, numbers, and hyphens';
      }
    }
    
    // 验证 Access Token
    if (!accessToken.trim()) {
      errors.accessToken = 'Access Token is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 保存配置
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }
    
    setSaving(true);
    setSaveError('');
    setSaved(false);
    
    try {
      const config: Partial<CollectorConfig> = {
        platform_url: platformUrl,
        agent_id: agentId,
        access_token: accessToken,
        buffer_size: bufferSize,
        sync_interval: syncInterval,
      };
      
      const response = await fetch(`${API_BASE_URL}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to save: ${response.status}`);
      }
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error: any) {
      console.error('Error saving config:', error);
      setSaveError(error.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!validateForm()) {
      return;
    }
    
    setTesting(true);
    setTestStatus('idle');
    setTestMessage('');
    
    try {
      const response = await fetch(`${API_BASE_URL}/config/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ platform_url: platformUrl }),
      });
      
      // 检查是否是 JSON 响应
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setTestStatus('success');
        setTestMessage(data.message || 'Connection successful');
      } else {
        setTestStatus('error');
        setTestMessage(data.message || 'Connection failed');
      }
    } catch (error: any) {
      console.error('Error testing connection:', error);
      setTestStatus('error');
      setTestMessage(error.message || 'Failed to test connection. Please check if the collector backend is running.');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-zinc-400">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">System Configuration</h1>
        <p className="text-zinc-400">Configure connection to the Real-time Database Platform.</p>
      </div>

      {loadError && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>{loadError}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Platform Connection */}
        <div className="bg-[#1A1A1A] border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Globe className="w-5 h-5 text-blue-500" />
              </div>
              <h2 className="text-lg font-semibold text-white">Platform Connection</h2>
            </div>
            <div className="flex items-center gap-2">
              {testStatus === 'success' && (
                <span className="text-sm text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> {testMessage}
                </span>
              )}
              {testStatus === 'error' && (
                <span className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {testMessage}
                </span>
              )}
              <button 
                onClick={handleTestConnection}
                disabled={testing}
                className="text-sm bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Platform URL *</label>
                <input 
                  type="text" 
                  value={platformUrl}
                  onChange={(e) => {
                    setPlatformUrl(e.target.value);
                    setValidationErrors(prev => ({ ...prev, platformUrl: undefined }));
                  }}
                  placeholder="https://api.rtdb-platform.com"
                  className={`w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors ${validationErrors.platformUrl ? 'border-red-500' : 'border-zinc-700'}`}
                />
                {validationErrors.platformUrl && (
                  <p className="text-xs text-red-500">{validationErrors.platformUrl}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Agent ID *</label>
                <input 
                  type="text" 
                  value={agentId}
                  onChange={(e) => {
                    setAgentId(e.target.value);
                    setValidationErrors(prev => ({ ...prev, agentId: undefined }));
                  }}
                  placeholder="e.g., agent-us-east-042"
                  className={`w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-mono ${validationErrors.agentId ? 'border-red-500' : 'border-zinc-700'}`}
                />
                {validationErrors.agentId ? (
                  <p className="text-xs text-red-500">{validationErrors.agentId}</p>
                ) : (
                  <p className="text-xs text-zinc-500">Lowercase letters, numbers, and hyphens only</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">Access Token *</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2.5 font-mono text-sm text-zinc-100 break-all relative">
                  {showToken ? accessToken : '••••••••••••••••••••••••••••••••'}
                </div>
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="p-2.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-zinc-300 transition-colors"
                  title={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(accessToken);
                    alert('Token copied to clipboard');
                  }}
                  className="p-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white transition-colors shadow-lg shadow-emerald-900/20"
                  title="Copy Token"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              {validationErrors.accessToken ? (
                <p className="text-xs text-red-500">{validationErrors.accessToken}</p>
              ) : (
                <p className="text-xs text-zinc-500">Token used to authenticate with the central collection platform</p>
              )}
            </div>
          </div>
        </div>

        {/* Data Schema Configuration */}
        <div className="bg-[#1A1A1A] border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Code className="w-5 h-5 text-orange-500" />
            </div>
            <h2 className="text-lg font-semibold text-white">Data Schema</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">JSON Schema Definition</label>
              <textarea 
                rows={6}
                value={jsonSchema}
                onChange={(e) => setJsonSchema(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
              <p className="text-xs text-zinc-500">Define the structure of the data payload sent to the platform</p>
            </div>
          </div>
        </div>

        {/* Local Storage */}
        <div className="bg-[#1A1A1A] border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Database className="w-5 h-5 text-purple-500" />
            </div>
            <h2 className="text-lg font-semibold text-white">Local Buffer Settings</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Max Buffer Size</label>
                <input 
                  type="number" 
                  value={bufferSize}
                  onChange={(e) => setBufferSize(parseInt(e.target.value) || 0)}
                  min={100}
                  max={10000}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
                <p className="text-xs text-zinc-500">Maximum number of data points to buffer locally</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Sync Interval (ms)</label>
                <input 
                  type="number" 
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(parseInt(e.target.value) || 0)}
                  min={100}
                  max={60000}
                  step={100}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
                <p className="text-xs text-zinc-500">How often to sync data to the platform (milliseconds)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Save Error */}
        {saveError && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>{saveError}</span>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button 
            onClick={handleSave}
            disabled={saving || saved}
            className={`
              px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all shadow-lg
              ${saved 
                ? 'bg-emerald-500 text-white shadow-emerald-900/20' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'}
              ${saving ? 'opacity-80 cursor-wait' : ''}
            `}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Saved Successfully
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Configuration
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
