import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { toast } from '../src/hooks/use-toast';
import { Server, Activity, CheckCircle, XCircle, RefreshCw, Terminal, Cpu, HardDrive, Network, Lock, FileText, Plus, Search, Filter, MoreHorizontal, Play, Square, RotateCcw, Key, Eye, EyeOff, Copy, X, AlertCircle, Clock, Loader2, Edit, Trash2 } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9080/api/v1';

// 后端返回的原始Collector数据格式
interface BackendCollector {
  id: string;
  agent_id: string;
  name: string;
  secret_key: string;
  status: 'online' | 'offline' | 'warning' | string;
  last_heartbeat: string | null;
  config_json: string;
  created_at: string;
  updated_at: string;
}

// 前端使用的Agent数据格式
interface Agent {
  id: string;
  agentId: string;
  name: string;
  version: string;
  ip: string;
  os: string;
  status: 'Online' | 'Offline' | 'Warning';
  uptime: string;
  cpu: number;
  memory: number;
  lastHeartbeat: string;
  configVersion: string;
  configSyncStatus: 'synced' | 'syncing' | 'pending' | 'failed';
  pendingConfigCount: number;
  failedConfigCount: number;
  token: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

// 将后端Collector转换为前端Agent格式
const transformBackendCollector = (collector: BackendCollector): Agent => {
  // 解析config_json获取额外信息
  let configData: any = {};
  try {
    if (collector.config_json) {
      configData = JSON.parse(collector.config_json);
    }
  } catch (e) {
    // 解析失败时使用默认值
  }

  // 计算最后心跳时间显示
  const lastHeartbeat = collector.last_heartbeat
    ? formatTimeAgo(new Date(collector.last_heartbeat))
    : 'Never';

  // 状态映射：后端小写 -> 前端首字母大写
  const statusMap: Record<string, 'Online' | 'Offline' | 'Warning'> = {
    'online': 'Online',
    'offline': 'Offline',
    'warning': 'Warning',
  };

  return {
    id: collector.id,
    agentId: collector.agent_id,
    name: collector.name,
    version: configData.version || 'v2.5.0',
    ip: configData.ip || '-',
    os: configData.os || 'Linux (Unknown)',
    status: statusMap[collector.status?.toLowerCase()] || 'Offline',
    uptime: configData.uptime || '-',
    cpu: configData.cpu || 0,
    memory: configData.memory || 0,
    lastHeartbeat,
    configVersion: configData.configVersion || 'v1',
    configSyncStatus: configData.configSyncStatus || 'pending',
    pendingConfigCount: configData.pendingConfigCount || 0,
    failedConfigCount: configData.failedConfigCount || 0,
    token: collector.secret_key,
  };
};

// 格式化时间为"x ago"格式
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

// 生成随机Token
const generateToken = (): string => {
  return `tk_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36).substring(4)}`;
};

export const CollectorAgents: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Online' | 'Offline' | 'Warning'>('All');

  const [selectedAgentToken, setSelectedAgentToken] = useState<Agent | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [selectedAgentForLogs, setSelectedAgentForLogs] = useState<Agent | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentId, setNewAgentId] = useState('');
  const [newAgentOS, setNewAgentOS] = useState('Linux (Ubuntu 22.04)');
  const [agentIdError, setAgentIdError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // 编辑Agent相关状态
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [editAgentName, setEditAgentName] = useState('');
  const [editAgentOS, setEditAgentOS] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // 删除Agent相关状态
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Action菜单相关状态
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // 加载Collector列表
  const fetchCollectors = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/collectors`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch collectors: ${response.statusText}`);
      }
      const data: BackendCollector[] = await response.json();
      const transformedAgents = data.map(transformBackendCollector);
      setAgents(transformedAgents);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast({
        title: t('collector.loadError', 'Failed to load agents'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载数据
  useEffect(() => {
    fetchCollectors();
  }, []);

  // 验证 Agent ID 格式
  const validateAgentId = (id: string): boolean => {
    if (!id.trim()) return false;
    // 只允许小写字母、数字和连字符
    const regex = /^[a-z0-9-]+$/;
    return regex.test(id);
  };

  // 自动生成 Agent ID（基于名称）
  const generateAgentId = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const generateMockLogs = (agentName: string): LogEntry[] => {
    const mockLogs: LogEntry[] = [];
    const levels: ('INFO' | 'WARN' | 'ERROR')[] = ['INFO', 'INFO', 'INFO', 'WARN', 'INFO', 'ERROR', 'INFO'];
    const messages = [
      `Agent ${agentName} service started.`,
      'Connected to ingestion pipeline.',
      'Heartbeat acknowledged by server.',
      'Latency spike detected in data transmission.',
      'Batch processed: 1500 records.',
      'Connection timeout. Retrying in 5s...',
      'Configuration updated successfully.'
    ];

    const now = Date.now();
    for (let i = 0; i < 25; i++) {
      mockLogs.push({
        id: `log_${i}`,
        timestamp: new Date(now - i * 1000 * 45).toISOString(),
        level: levels[Math.floor(Math.random() * levels.length)],
        message: messages[Math.floor(Math.random() * messages.length)]
      });
    }
    return mockLogs;
  };

  const handleViewLogs = (agent: Agent) => {
    setSelectedAgentForLogs(agent);
    setLogs(generateMockLogs(agent.name));
  };

  // 生成唯一的Agent ID（基于UUID）
  const generateUniqueAgentId = (): string => {
    const uuid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    // 提取UUID前8位作为短ID，加上collector前缀
    const shortId = uuid.toString().replace(/-/g, '').substring(0, 8);
    return `collector-${shortId}`;
  };

  const handleDeployAgent = async () => {
    if (!newAgentName.trim()) return;

    setIsCreating(true);
    setAgentIdError('');

    // 自动生成唯一的Agent ID
    const generatedAgentId = generateUniqueAgentId();

    try {
      const configData = {
        version: 'v2.5.0',
        ip: '-',
        os: newAgentOS,
        uptime: '-',
        cpu: 0,
        memory: 0,
        configVersion: 'v1',
        configSyncStatus: 'pending',
        pendingConfigCount: 0,
        failedConfigCount: 0,
      };

      const response = await fetch(`${API_BASE_URL}/collectors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          agent_id: generatedAgentId,
          name: newAgentName,
          config_json: JSON.stringify(configData),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create agent: ${response.statusText}`);
      }

      const newCollector: BackendCollector = await response.json();
      const newAgent = transformBackendCollector(newCollector);

      setAgents(prev => [newAgent, ...prev]);
      setIsDeployModalOpen(false);
      setNewAgentName('');
      setNewAgentId('');
      setSelectedAgentToken(newAgent);
      setShowToken(true);

      toast({
        title: t('collector.createSuccess', 'Agent created successfully'),
        description: t('collector.createSuccessDesc', 'The new agent has been registered and is ready for deployment.'),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setAgentIdError(errorMessage);
      toast({
        title: t('collector.createError', 'Failed to create agent'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // 处理名称变更时自动生成 Agent ID
  const handleNameChange = (value: string) => {
    setNewAgentName(value);
    if (!newAgentId && value.trim()) {
      setNewAgentId(generateAgentId(value));
    }
  };

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) || agent.ip.includes(searchTerm);
    const matchesStatus = statusFilter === 'All' || agent.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleRegenerateToken = (agentId: string) => {
    if (confirm(t('collector.confirmRegenerateToken', 'Are you sure you want to regenerate the token? The agent will be disconnected until updated with the new token.'))) {
      const newToken = generateToken();
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, token: newToken } : a));
      if (selectedAgentToken && selectedAgentToken.id === agentId) {
          setSelectedAgentToken(prev => prev ? { ...prev, token: newToken } : null);
      }
    }
  };

  const handleCopyToken = (token: string) => {
      navigator.clipboard.writeText(token);
      toast({
        title: t('collector.tokenCopied', 'Token copied'),
        description: t('collector.tokenCopiedDesc', 'The token has been copied to your clipboard.'),
      });
  };

  // 打开编辑模态框
  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setEditAgentName(agent.name);
    setEditAgentOS(agent.os);
    setIsEditModalOpen(true);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingAgent || !editAgentName.trim()) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/collectors/${editingAgent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: editAgentName,
          config_json: JSON.stringify({
            ...editingAgent,
            name: editAgentName,
            os: editAgentOS,
          }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update agent: ${response.statusText}`);
      }

      const updatedCollector: BackendCollector = await response.json();
      const updatedAgent = transformBackendCollector(updatedCollector);

      setAgents(prev => prev.map(a => a.id === updatedAgent.id ? updatedAgent : a));
      setIsEditModalOpen(false);
      setEditingAgent(null);

      toast({
        title: t('collector.updateSuccess', 'Agent updated successfully'),
        description: t('collector.updateSuccessDesc', 'The agent information has been updated.'),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: t('collector.updateError', 'Failed to update agent'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // 打开删除确认模态框
  const handleDeleteClick = (agent: Agent) => {
    setDeletingAgent(agent);
    setIsDeleteModalOpen(true);
  };

  // 确认删除
  const handleConfirmDelete = async () => {
    if (!deletingAgent) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/collectors/${deletingAgent.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete agent: ${response.statusText}`);
      }

      setAgents(prev => prev.filter(a => a.id !== deletingAgent.id));
      setIsDeleteModalOpen(false);
      setDeletingAgent(null);

      toast({
        title: t('collector.deleteSuccess', 'Agent deleted successfully'),
        description: t('collector.deleteSuccessDesc', 'The agent has been removed from the system.'),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: t('collector.deleteError', 'Failed to delete agent'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('collector.title', 'Collector Agents')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('collector.subtitle', 'Manage and monitor deployed collection agents across your infrastructure.')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchCollectors}
            disabled={loading}
            className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh', 'Refresh')}
          </button>
          <button
            onClick={() => setIsDeployModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
          >
            <Plus className="w-4 h-4" /> {t('collector.deployNewAgent', 'Deploy New Agent')}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
          </div>
          <button
            onClick={fetchCollectors}
            className="text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            {t('common.retry', 'Retry')}
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">{t('collector.totalAgents', 'Total Agents')}</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{agents.length}</h3>
            </div>
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <Server className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">{t('collector.online', 'Online')}</p>
              <h3 className="text-2xl font-bold text-green-400 mt-1">{agents.filter(a => a.status === 'Online').length}</h3>
            </div>
            <div className="p-2 bg-green-500/10 rounded-lg text-green-400">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">{t('collector.warnings', 'Warnings')}</p>
              <h3 className="text-2xl font-bold text-yellow-400 mt-1">{agents.filter(a => a.status === 'Warning').length}</h3>
            </div>
            <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">{t('collector.offline', 'Offline')}</p>
              <h3 className="text-2xl font-bold text-red-400 mt-1">{agents.filter(a => a.status === 'Offline').length}</h3>
            </div>
            <div className="p-2 bg-red-500/10 rounded-lg text-red-400">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('collector.searchPlaceholder', 'Search agents by name or IP...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-4">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:border-blue-500"
          >
            <option value="All">{t('collector.statusAll', 'All Status')}</option>
            <option value="Online">{t('collector.statusOnline', 'Online')}</option>
            <option value="Warning">{t('collector.statusWarning', 'Warning')}</option>
            <option value="Offline">{t('collector.statusOffline', 'Offline')}</option>
          </select>
        </div>
      </div>

      {/* Agents List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-xs uppercase text-gray-500 dark:text-gray-400">
                <th className="px-6 py-4 font-semibold">{t('collector.agentName', 'Agent Name')}</th>
                <th className="px-6 py-4 font-semibold">{t('collector.agentId', 'Agent ID')}</th>
                <th className="px-6 py-4 font-semibold">{t('collector.status', 'Status')}</th>
                <th className="px-6 py-4 font-semibold">{t('collector.resources', 'Resources')}</th>
                <th className="px-6 py-4 font-semibold">{t('collector.configSync', 'Config Sync')}</th>
                <th className="px-6 py-4 font-semibold">{t('collector.systemInfo', 'System Info')}</th>
                <th className="px-6 py-4 font-semibold text-right">{t('common.action', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading && agents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{t('common.loading', 'Loading...')}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    {agents.length === 0
                      ? t('collector.noAgents', 'No agents found. Click "Deploy New Agent" to create one.')
                      : t('collector.noMatchingAgents', 'No agents match your search criteria.')}
                  </td>
                </tr>
              ) : (
                filteredAgents.map(agent => (
                  <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300">
                          <Terminal className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-200">{agent.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-500 font-mono">{agent.ip}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{agent.agentId}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border w-fit ${
                          agent.status === 'Online' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                          agent.status === 'Warning' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {agent.status === 'Online' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {agent.status === 'Warning' && <Activity className="w-3 h-3 mr-1" />}
                          {agent.status === 'Offline' && <XCircle className="w-3 h-3 mr-1" />}
                          {agent.status}
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{t('collector.lastSeen', 'Last seen')}: {agent.lastHeartbeat}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2 min-w-[140px]">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1"><Cpu className="w-3 h-3" /> {t('collector.cpu', 'CPU')}</span>
                          <span className={`${agent.cpu > 80 ? 'text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>{agent.cpu}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${agent.cpu > 80 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${agent.cpu}%` }}></div>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1"><HardDrive className="w-3 h-3" /> {t('collector.mem', 'MEM')}</span>
                          <span className={`${agent.memory > 90 ? 'text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>{agent.memory}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${agent.memory > 90 ? 'bg-red-500' : 'bg-purple-500'}`} style={{ width: `${agent.memory}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        {/* 配置版本 */}
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">{agent.configVersion}</span>
                        </div>

                        {/* 同步状态 */}
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border w-fit ${
                          agent.configSyncStatus === 'synced' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                          agent.configSyncStatus === 'syncing' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          agent.configSyncStatus === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {agent.configSyncStatus === 'synced' && <CheckCircle className="w-3 h-3" />}
                          {agent.configSyncStatus === 'syncing' && <RefreshCw className="w-3 h-3 animate-spin" />}
                          {agent.configSyncStatus === 'pending' && <Clock className="w-3 h-3" />}
                          {agent.configSyncStatus === 'failed' && <AlertCircle className="w-3 h-3" />}
                          <span>
                            {agent.configSyncStatus === 'synced' && t('collector.synced', 'Synced')}
                            {agent.configSyncStatus === 'syncing' && t('collector.syncing', 'Syncing')}
                            {agent.configSyncStatus === 'pending' && t('collector.pending', 'Pending')}
                            {agent.configSyncStatus === 'failed' && t('collector.failed', 'Failed')}
                          </span>
                        </div>

                        {/* 待处理和失败计数 */}
                        {(agent.pendingConfigCount > 0 || agent.failedConfigCount > 0) && (
                          <div className="flex items-center gap-2 text-xs">
                            {agent.pendingConfigCount > 0 && (
                              <span className="text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {agent.pendingConfigCount} {t('collector.pendingItems', 'pending')}
                              </span>
                            )}
                            {agent.failedConfigCount > 0 && (
                              <span className="text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                {agent.failedConfigCount} {t('collector.failedItems', 'failed')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-16">{t('collector.version', 'Version')}:</span>
                          <span className="text-gray-700 dark:text-gray-300">{agent.version}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-16">{t('collector.os', 'OS')}:</span>
                          <span className="text-gray-700 dark:text-gray-300">{agent.os}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-16">{t('collector.uptime', 'Uptime')}:</span>
                          <span className="text-gray-700 dark:text-gray-300">{agent.uptime}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative" id={`action-menu-${agent.id}`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionMenuId(openActionMenuId === agent.id ? null : agent.id);
                          }}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                          title={t('collector.actions', 'Actions')}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
          <span>{t('collector.showing', 'Showing {{filtered}} of {{total}} agents', { filtered: filteredAgents.length, total: agents.length })}</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50" disabled>{t('common.previous', 'Previous')}</button>
            <button className="px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">{t('common.next', 'Next')}</button>
          </div>
        </div>
      </div>

      {/* Deploy Agent Modal */}
      {isDeployModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl flex flex-col">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 rounded-t-xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('collector.deployNewAgent', 'Deploy New Agent')}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('collector.deploySubtitle', 'Register a new collector agent')}</p>
              </div>
              <button onClick={() => setIsDeployModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><X className="w-5 h-5"/></button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase">{t('collector.agentNameLabel', 'Agent Name')} *</label>
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder={t('collector.agentNamePlaceholder', 'e.g., Production-Gateway-01')}
                  className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase">{t('collector.agentIdLabel', 'Agent ID')} *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAgentId}
                    readOnly
                    placeholder={t('collector.agentIdPlaceholder', 'e.g., production-gateway-01')}
                    className="flex-1 bg-gray-100 dark:bg-gray-900 border rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-400 focus:outline-none font-mono cursor-not-allowed border-gray-200 dark:border-gray-700"
                  />
                  <button
                    onClick={() => setNewAgentId(generateUniqueAgentId())}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-600 dark:text-gray-300 transition-colors"
                    title={t('collector.regenerateId', 'Regenerate ID')}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('collector.agentIdAutoGenHelp', 'Auto-generated unique ID. You can regenerate if needed.')}
                </p>
                {agentIdError && (
                  <p className="text-xs text-red-500 mt-1">{agentIdError}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase">{t('collector.operatingSystem', 'Operating System')}</label>
                <select
                  value={newAgentOS}
                  onChange={(e) => setNewAgentOS(e.target.value)}
                  className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="Linux (Ubuntu 22.04)">Linux (Ubuntu 22.04)</option>
                  <option value="Linux (CentOS 7)">Linux (CentOS 7)</option>
                  <option value="Linux (Alpine)">Linux (Alpine)</option>
                  <option value="Windows Server 2019">Windows Server 2019</option>
                  <option value="Windows Server 2022">Windows Server 2022</option>
                  <option value="macOS">macOS</option>
                  <option value="Docker Container">Docker Container</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => {
                    setIsDeployModalOpen(false);
                    setNewAgentName('');
                    setNewAgentId('');
                    setAgentIdError('');
                  }}
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleDeployAgent}
                  disabled={!newAgentName.trim() || isCreating}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('common.creating', 'Creating...')}
                    </>
                  ) : (
                    t('collector.createAgent', 'Create Agent')
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Agent Modal */}
      {isEditModalOpen && editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl flex flex-col">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 rounded-t-xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('collector.editAgent', 'Edit Agent')}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('collector.editAgentSubtitle', 'Update agent information')}</p>
              </div>
              <button onClick={() => { setIsEditModalOpen(false); setEditingAgent(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><X className="w-5 h-5"/></button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase">{t('collector.agentNameLabel', 'Agent Name')} *</label>
                <input
                  type="text"
                  value={editAgentName}
                  onChange={(e) => setEditAgentName(e.target.value)}
                  placeholder={t('collector.agentNamePlaceholder', 'e.g., Production-Gateway-01')}
                  className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase">{t('collector.agentIdLabel', 'Agent ID')}</label>
                <input
                  type="text"
                  value={editingAgent.agentId}
                  readOnly
                  className="w-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-500 dark:text-gray-400 font-mono cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('collector.agentIdReadOnly', 'Agent ID cannot be changed')}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase">{t('collector.operatingSystem', 'Operating System')}</label>
                <select
                  value={editAgentOS}
                  onChange={(e) => setEditAgentOS(e.target.value)}
                  className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="Linux (Ubuntu 22.04)">Linux (Ubuntu 22.04)</option>
                  <option value="Linux (CentOS 7)">Linux (CentOS 7)</option>
                  <option value="Linux (Alpine)">Linux (Alpine)</option>
                  <option value="Windows Server 2019">Windows Server 2019</option>
                  <option value="Windows Server 2022">Windows Server 2022</option>
                  <option value="macOS">macOS</option>
                  <option value="Docker Container">Docker Container</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => { setIsEditModalOpen(false); setEditingAgent(null); }}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editAgentName.trim() || isUpdating}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('common.saving', 'Saving...')}
                    </>
                  ) : (
                    t('common.save', 'Save Changes')
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Agent Modal */}
      {isDeleteModalOpen && deletingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl flex flex-col">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-red-50 dark:bg-red-900/20 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('collector.deleteAgent', 'Delete Agent')}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('collector.deleteAgentSubtitle', 'This action cannot be undone')}</p>
                </div>
              </div>
              <button onClick={() => { setIsDeleteModalOpen(false); setDeletingAgent(null); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><X className="w-5 h-5"/></button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {t('collector.deleteAgentConfirm', 'Are you sure you want to delete the following agent?')}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <Terminal className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-200">{deletingAgent.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{deletingAgent.agentId}</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setIsDeleteModalOpen(false); setDeletingAgent(null); }}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors shadow-lg shadow-red-900/20 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('common.deleting', 'Deleting...')}
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      {t('common.delete', 'Delete Agent')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {selectedAgentForLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-3xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 rounded-t-xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('collector.agentLogs', 'Agent Logs')}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('collector.systemLogsFor', 'System logs for')} <span className="text-gray-700 dark:text-gray-200 font-mono">{selectedAgentForLogs.name}</span></p>
              </div>
              <button onClick={() => setSelectedAgentForLogs(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><X className="w-5 h-5"/></button>
            </div>

            <div className="p-0 overflow-hidden flex-1 flex flex-col">
              <div className="bg-gray-50 dark:bg-gray-950 p-4 overflow-y-auto font-mono text-xs space-y-1 h-full custom-scrollbar">
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-3 hover:bg-gray-100 dark:hover:bg-gray-900/50 p-1 rounded">
                    <span className="text-gray-400 dark:text-gray-500 shrink-0 w-36">{log.timestamp}</span>
                    <span className={`shrink-0 w-12 font-bold ${
                      log.level === 'INFO' ? 'text-blue-400' :
                      log.level === 'WARN' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {log.level}
                    </span>
                    <span className="text-gray-700 dark:text-gray-300 break-all">{log.message}</span>
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="text-gray-400 dark:text-gray-500 text-center py-10 italic">{t('collector.noLogsAvailable', 'No logs available for this period.')}</div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex justify-between items-center">
               <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 transition-colors flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> {t('common.refresh', 'Refresh')}
                  </button>
                  <button className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-xs text-gray-700 dark:text-gray-300 transition-colors flex items-center gap-1">
                    <Search className="w-3 h-3" /> {t('common.search', 'Filter')}
                  </button>
               </div>
               <div className="flex gap-2">
                 <button
                   onClick={() => navigate(`/operations/logs?source=${selectedAgentForLogs.id}`)}
                   className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors flex items-center gap-2"
                 >
                   <FileText className="w-4 h-4" /> {t('collector.viewHistoricalLogs', 'View Historical Logs')}
                 </button>
                 <button
                   onClick={() => setSelectedAgentForLogs(null)}
                   className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors"
                 >
                   {t('common.close', 'Close')}
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Token Management Modal */}
      {selectedAgentToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-md shadow-2xl flex flex-col">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 rounded-t-xl">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('collector.accessToken', 'Access Token')}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('collector.manageAuthFor', 'Manage authentication for')} {selectedAgentToken.name}</p>
              </div>
              <button onClick={() => setSelectedAgentToken(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><X className="w-5 h-5"/></button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 rounded-lg p-4 flex items-start gap-3">
                <Lock className="w-5 h-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                <div className="text-xs text-yellow-700 dark:text-yellow-200/80">
                  <p className="font-bold text-yellow-600 dark:text-yellow-500 mb-1">{t('collector.securityWarning', 'Security Warning')}</p>
                  {t('collector.tokenWarningText', 'This token grants full access for this specific agent. Do not share it. If compromised, regenerate it immediately.')}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{t('collector.currentToken', 'Current Token')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type={showToken ? "text" : "password"}
                    readOnly
                    value={selectedAgentToken.token}
                    className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 font-mono text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 tracking-wider"
                  />
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className={`p-2.5 rounded-lg transition-colors ${showToken ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    title={showToken ? t('collector.hideToken', 'Hide Token') : t('collector.showToken', 'Show Token')}
                    type="button"
                  >
                    {showToken ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleCopyToken(selectedAgentToken.token)}
                    className="p-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors shadow-lg shadow-blue-900/20"
                    title={t('collector.copyToken', 'Copy Token')}
                    type="button"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleRegenerateToken(selectedAgentToken.id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 border border-transparent rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-all"
                >
                  <RefreshCw className="w-4 h-4" /> {t('collector.regenerateToken', 'Regenerate Token')}
                </button>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-2">
                  {t('collector.regenerateWarning', 'Regenerating will invalidate the current token immediately.')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Menu Portal - Rendered outside table to avoid clipping */}
      {openActionMenuId && (() => {
        const agent = agents.find(a => a.id === openActionMenuId);
        if (!agent) return null;
        const button = document.getElementById(`action-menu-${agent.id}`);
        if (!button) return null;
        const rect = button.getBoundingClientRect();
        const menuHeight = 220; // Approximate menu height
        const spaceBelow = window.innerHeight - rect.bottom;
        const showAbove = spaceBelow < menuHeight;
        return (
          <div
            className="fixed z-50 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1"
            style={{
              right: `${window.innerWidth - rect.right}px`,
              top: showAbove ? `${rect.top - menuHeight}px` : `${rect.bottom + 4}px`,
            }}
          >
            <button
              onClick={() => { setSelectedAgentToken(agent); setShowToken(false); setOpenActionMenuId(null); }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Key className="w-4 h-4 text-yellow-500" />
              {t('collector.manageToken', 'Manage Token')}
            </button>
            <button
              onClick={() => { handleEditAgent(agent); setOpenActionMenuId(null); }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Edit className="w-4 h-4 text-blue-500" />
              {t('collector.editAgent', 'Edit Agent')}
            </button>
            <button
              onClick={() => { handleViewLogs(agent); setOpenActionMenuId(null); }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <FileText className="w-4 h-4 text-gray-500" />
              {t('collector.viewLogs', 'View Logs')}
            </button>
            <button
              onClick={() => { setOpenActionMenuId(null); }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4 text-gray-500" />
              {t('collector.restartAgent', 'Restart Agent')}
            </button>
            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
            <button
              onClick={() => { handleDeleteClick(agent); setOpenActionMenuId(null); }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {t('collector.deleteAgent', 'Delete Agent')}
            </button>
          </div>
        );
      })()}
      
      {/* Backdrop for action menu */}
      {openActionMenuId && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpenActionMenuId(null)}
        />
      )}
    </div>
  );
};
