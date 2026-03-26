import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { useToast } from '../src/hooks/use-toast';
import {
  RefreshCw,
  Play,
  Pause,
  Square,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Server,
  Cpu,
  HardDrive,
  Activity,
  TrendingUp,
  Filter,
  Download,
  Eye,
  Settings,
  MoreHorizontal,
  BarChart3,
  Zap,
  Layers,
  Database,
  ArrowRight,
  Search,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { showSuccess } from '../src/services/api';

// 任务运行时状态
type TaskStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'stopping';
type TaskType = 'data_collection' | 'data_sync' | 'data_processing' | 'config_sync' | 'heartbeat';

interface TaskRuntimeInfo {
  id: string;
  name: string;
  type: TaskType;
  status: TaskStatus;
  collectorId: string;
  collectorName: string;
  interfaceId?: string;
  interfaceName?: string;
  schedule: string;
  lastStartTime?: string;
  lastEndTime?: string;
  nextRunTime?: string;
  runCount: number;
  successCount: number;
  failCount: number;
  avgDuration: number;
  lastError?: string;
  progress?: number;
  metrics?: TaskMetrics;
}

interface TaskMetrics {
  dataPointsCollected: number;
  dataPointsSynced: number;
  bytesProcessed: number;
  recordsProcessed: number;
  errorsEncountered: number;
  cpuUsage: number;
  memoryUsage: number;
}

interface TaskLog {
  id: string;
  taskId: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
  details?: any;
}

// 过滤器类型
type StatusFilter = 'all' | TaskStatus;
type TypeFilter = 'all' | TaskType;
type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

export const TaskRuntimeStatus: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();
  const isDark = resolvedTheme === 'dark';

  const [tasks, setTasks] = useState<TaskRuntimeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskRuntimeInfo | null>(null);
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // 过滤器
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [collectorFilter, setCollectorFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // 弹窗状态
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [metricsModalOpen, setMetricsModalOpen] = useState(false);

  // 加载任务列表
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const mockTasks: TaskRuntimeInfo[] = [
        {
          id: 'task-001',
          name: '产线1-温度采集',
          type: 'data_collection',
          status: 'running',
          collectorId: 'collector-1',
          collectorName: 'Factory-A-Gateway-01',
          interfaceId: 'iface-1',
          interfaceName: '产线1-ModbusTCP',
          schedule: '*/5 * * * *',
          lastStartTime: '2026-03-13 10:30:00',
          nextRunTime: '2026-03-13 10:35:00',
          runCount: 1200,
          successCount: 1198,
          failCount: 2,
          avgDuration: 2500,
          progress: 65,
          metrics: {
            dataPointsCollected: 15000,
            dataPointsSynced: 14800,
            bytesProcessed: 1024000,
            recordsProcessed: 15000,
            errorsEncountered: 0,
            cpuUsage: 12.5,
            memoryUsage: 45.2,
          },
        },
        {
          id: 'task-002',
          name: '产线2-压力采集',
          type: 'data_collection',
          status: 'running',
          collectorId: 'collector-1',
          collectorName: 'Factory-A-Gateway-01',
          interfaceId: 'iface-2',
          interfaceName: '产线2-OPCUA',
          schedule: '*/10 * * * *',
          lastStartTime: '2026-03-13 10:30:00',
          nextRunTime: '2026-03-13 10:40:00',
          runCount: 800,
          successCount: 795,
          failCount: 5,
          avgDuration: 3200,
          progress: 40,
          metrics: {
            dataPointsCollected: 8000,
            dataPointsSynced: 7950,
            bytesProcessed: 512000,
            recordsProcessed: 8000,
            errorsEncountered: 0,
            cpuUsage: 8.3,
            memoryUsage: 32.1,
          },
        },
        {
          id: 'task-003',
          name: '数据同步-Factory-B',
          type: 'data_sync',
          status: 'completed',
          collectorId: 'collector-2',
          collectorName: 'Factory-B-Gateway-01',
          schedule: '0 */1 * * *',
          lastStartTime: '2026-03-13 10:00:00',
          lastEndTime: '2026-03-13 10:02:30',
          nextRunTime: '2026-03-13 11:00:00',
          runCount: 24,
          successCount: 24,
          failCount: 0,
          avgDuration: 150000,
        },
        {
          id: 'task-004',
          name: '配置同步-Global',
          type: 'config_sync',
          status: 'running',
          collectorId: 'collector-1',
          collectorName: 'Factory-A-Gateway-01',
          schedule: '0 */6 * * *',
          lastStartTime: '2026-03-13 10:00:00',
          nextRunTime: '2026-03-13 16:00:00',
          runCount: 4,
          successCount: 4,
          failCount: 0,
          avgDuration: 5000,
          progress: 90,
        },
        {
          id: 'task-005',
          name: '心跳检测-Lab-Test',
          type: 'heartbeat',
          status: 'failed',
          collectorId: 'collector-3',
          collectorName: 'Lab-Test-Gateway',
          schedule: '*/1 * * * *',
          lastStartTime: '2026-03-13 10:29:00',
          lastEndTime: '2026-03-13 10:29:05',
          nextRunTime: '2026-03-13 10:30:00',
          runCount: 500,
          successCount: 480,
          failCount: 20,
          avgDuration: 500,
          lastError: '连接超时: 无法连接到采集器',
        },
        {
          id: 'task-006',
          name: '数据预处理-边缘',
          type: 'data_processing',
          status: 'paused',
          collectorId: 'collector-2',
          collectorName: 'Factory-B-Gateway-01',
          schedule: '*/2 * * * *',
          lastStartTime: '2026-03-13 10:28:00',
          lastEndTime: '2026-03-13 10:28:30',
          nextRunTime: '2026-03-13 10:30:00',
          runCount: 300,
          successCount: 298,
          failCount: 2,
          avgDuration: 30000,
        },
      ];
      
      setTasks(mockTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load task status",
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  // 启动任务
  const handleStartTask = async (taskId: string) => {
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 300));
      showSuccess("Task started");
      loadTasks();
    } catch (error) {
      console.error('Failed to start task:', error);
      toast({
        title: "Start Failed",
        description: "Please try again later",
        variant: 'destructive',
      });
    }
  };

  // 暂停任务
  const handlePauseTask = async (taskId: string) => {
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 300));
      showSuccess("Task paused");
      loadTasks();
    } catch (error) {
      console.error('Failed to pause task:', error);
      toast({
        title: "Pause Failed",
        description: "Please try again later",
        variant: 'destructive',
      });
    }
  };

  // 停止任务
  const handleStopTask = async (taskId: string) => {
    if (!window.confirm("Are you sure you want to stop this task?")) return;
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 300));
      showSuccess("Task stopped");
      loadTasks();
    } catch (error) {
      console.error('Failed to stop task:', error);
      toast({
        title: "Stop Failed",
        description: "Please try again later",
        variant: 'destructive',
      });
    }
  };

  // 查看任务日志
  const viewTaskLogs = async (task: TaskRuntimeInfo) => {
    setSelectedTask(task);
    // 模拟加载日志
    const mockLogs: TaskLog[] = [
      { id: 'log-1', taskId: task.id, level: 'info', message: 'Task started successfully', timestamp: '2026-03-13 10:30:00' },
      { id: 'log-2', taskId: task.id, level: 'info', message: 'Starting data collection', timestamp: '2026-03-13 10:30:01' },
      { id: 'log-3', taskId: task.id, level: 'info', message: 'Collected 100 data points', timestamp: '2026-03-13 10:30:10' },
      { id: 'log-4', taskId: task.id, level: 'warning', message: 'High network latency: 150ms', timestamp: '2026-03-13 10:30:15' },
      { id: 'log-5', taskId: task.id, level: 'info', message: 'Data sync completed', timestamp: '2026-03-13 10:30:30' },
    ];
    setTaskLogs(mockLogs);
    setLogsModalOpen(true);
  };

  // 自动刷新
  useEffect(() => {
    loadTasks();
    if (!autoRefresh) return;
    const interval = setInterval(loadTasks, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadTasks]);

  // 获取状态颜色
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'running':
        return isDark ? 'text-green-400 bg-green-400/20' : 'text-green-600 bg-green-100';
      case 'paused':
        return isDark ? 'text-yellow-400 bg-yellow-400/20' : 'text-yellow-600 bg-yellow-100';
      case 'completed':
        return isDark ? 'text-blue-400 bg-blue-400/20' : 'text-blue-600 bg-blue-100';
      case 'failed':
        return isDark ? 'text-red-400 bg-red-400/20' : 'text-red-600 bg-red-100';
      case 'idle':
        return isDark ? 'text-gray-400 bg-gray-400/20' : 'text-gray-600 bg-gray-100';
      case 'stopping':
        return isDark ? 'text-orange-400 bg-orange-400/20' : 'text-orange-600 bg-orange-100';
      default:
        return isDark ? 'text-gray-400 bg-gray-400/20' : 'text-gray-600 bg-gray-100';
    }
  };

  // 获取状态图标
  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'running':
        return <Play className="w-4 h-4 text-green-500" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'idle':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'stopping':
        return <Square className="w-4 h-4 text-orange-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  // 获取任务类型标签
  const getTaskTypeLabel = (type: TaskType) => {
    const typeLabels: Record<TaskType, string> = {
      data_collection: "Data Collection",
      data_sync: "Data Sync",
      data_processing: "Data Processing",
      config_sync: "Config Sync",
      heartbeat: "Heartbeat"
    };
    return typeLabels[type] || type;
  };

  // 获取状态标签
  const getStatusLabel = (status: TaskStatus) => {
    const statusLabels: Record<TaskStatus, string> = {
      idle: "Idle",
      running: "Running",
      paused: "Paused",
      completed: "Completed",
      failed: "Failed",
      stopping: "Stopping"
    };
    return statusLabels[status] || status;
  };

  // 格式化时长
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // 格式化字节
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  };

  // 统计
  const stats = {
    total: tasks.length,
    running: tasks.filter(t => t.status === 'running').length,
    paused: tasks.filter(t => t.status === 'paused').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    idle: tasks.filter(t => t.status === 'idle').length,
  };

  // 过滤后的任务列表
  const filteredTasks = tasks.filter(task => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (typeFilter !== 'all' && task.type !== typeFilter) return false;
    if (collectorFilter !== 'all' && task.collectorId !== collectorFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        task.name.toLowerCase().includes(query) ||
        task.collectorName.toLowerCase().includes(query) ||
        task.interfaceName?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className={`space-y-6 relative ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* 头部 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('taskRuntime.title')}
          </h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('taskRuntime.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className={`flex items-center gap-2 cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm">Auto Refresh</span>
          </label>
          <button
            onClick={loadTasks}
            disabled={loading}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              isDark 
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            } disabled:opacity-50`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.total}</p>
            </div>
            <Layers className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Running</p>
              <p className="text-2xl font-bold text-green-500">{stats.running}</p>
            </div>
            <Play className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Paused</p>
              <p className="text-2xl font-bold text-yellow-500">{stats.paused}</p>
            </div>
            <Pause className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Failed</p>
              <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Completed</p>
              <p className="text-2xl font-bold text-blue-500">{stats.completed}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Idle</p>
              <p className="text-2xl font-bold text-gray-500">{stats.idle}</p>
            </div>
            <Clock className="w-8 h-8 text-gray-500" />
          </div>
        </div>
      </div>

      {/* 过滤器 */}
      <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Filter</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={`px-3 py-2 rounded-lg border text-sm ${
              isDark 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="paused">Paused</option>
            <option value="failed">Failed</option>
            <option value="completed">Completed</option>
            <option value="idle">Idle</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className={`px-3 py-2 rounded-lg border text-sm ${
              isDark 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="all">All Types</option>
            <option value="data_collection">Data Collection</option>
            <option value="data_sync">Data Sync</option>
            <option value="data_processing">Data Processing</option>
            <option value="config_sync">Config Sync</option>
            <option value="heartbeat">Heartbeat</option>
          </select>
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className={`w-full pl-10 pr-4 py-2 rounded-lg border text-sm ${
                  isDark 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
            </div>
          </div>
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Showing {filteredTasks.length} tasks
          </span>
        </div>
      </div>

      {/* 任务列表 */}
      <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={isDark ? 'bg-gray-700/50' : 'bg-gray-50'}>
                <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Name</th>
                <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Type</th>
                <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Status</th>
                <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Collector</th>
                <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Statistics</th>
                <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Progress</th>
                <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Next Run</th>
                <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Actions</th>
              </tr>
            </thead>
            <tbody className={isDark ? 'divide-y divide-gray-700' : 'divide-y divide-gray-200'}>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                  </td>
                </tr>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8">
                    <Layers className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                    <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>No tasks found</p>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr key={task.id} className={isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3">
                      <div>
                        <p className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{task.name}</p>
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>ID: {task.id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                        {getTaskTypeLabel(task.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(task.status)}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                          {getStatusLabel(task.status)}
                        </span>
                      </div>
                      {task.lastError && (
                        <p className="text-xs text-red-500 mt-1">{task.lastError}</p>
                      )}
                    </td>
                    <td className={`px-4 py-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <div>
                        <p>{task.collectorName}</p>
                        {task.interfaceName && (
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{task.interfaceName}</p>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <div className="text-xs space-y-1">
                        <p>Total Runs: {task.runCount}</p>
                        <p className="text-green-500">Success: {task.successCount}</p>
                        <p className="text-red-500">Failed: {task.failCount}</p>
                        <p>Avg Duration: {formatDuration(task.avgDuration)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {task.progress !== undefined ? (
                        <div className="w-24">
                          <div className="flex justify-between text-xs mb-1">
                            <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{task.progress}%</span>
                          </div>
                          <div className={`h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div 
                              className="h-2 rounded-full bg-blue-500 transition-all"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>-</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {task.nextRunTime || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setSelectedTask(task); setDetailModalOpen(true); }}
                          className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                          title="View Detail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => viewTaskLogs(task)}
                          className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                          title="View Logs"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                        {task.status === 'running' && (
                          <button
                            onClick={() => handlePauseTask(task.id)}
                            className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-yellow-900/30 text-yellow-400' : 'hover:bg-yellow-50 text-yellow-600'}`}
                            title="Pause"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        )}
                        {task.status === 'paused' && (
                          <button
                            onClick={() => handleStartTask(task.id)}
                            className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-green-900/30 text-green-400' : 'hover:bg-green-50 text-green-600'}`}
                            title="Start"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        {(task.status === 'running' || task.status === 'paused') && (
                          <button
                            onClick={() => handleStopTask(task.id)}
                            className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                            title="Stop"
                          >
                            <Square className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 任务详情弹窗 */}
      {detailModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className={`w-full max-w-4xl max-h-[80vh] rounded-xl shadow-xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                {getStatusIcon(selectedTask.status)}
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {selectedTask.name}
                </h3>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Basic Information</h4>
                  <div className={`p-4 rounded-lg space-y-3 ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Task ID</span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-900'}>{selectedTask.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Type</span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-900'}>{getTaskTypeLabel(selectedTask.type)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Status</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(selectedTask.status)}`}>
                        {getStatusLabel(selectedTask.status)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Schedule</span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-900'}>{selectedTask.schedule}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Statistics</h4>
                  <div className={`p-4 rounded-lg space-y-3 ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Total Runs</span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-900'}>{selectedTask.runCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Success Count</span>
                      <span className="text-green-500">{selectedTask.successCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Fail Count</span>
                      <span className="text-red-500">{selectedTask.failCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Success Rate</span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-900'}>
                        {((selectedTask.successCount / selectedTask.runCount) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Avg Duration</span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-900'}>{formatDuration(selectedTask.avgDuration)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {selectedTask.metrics && (
                <div className="mt-6">
                  <h4 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Performance Metrics</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Data Points Collected</p>
                      <p className="text-xl font-bold text-blue-500">{selectedTask.metrics.dataPointsCollected.toLocaleString()}</p>
                    </div>
                    <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Data Points Synced</p>
                      <p className="text-xl font-bold text-green-500">{selectedTask.metrics.dataPointsSynced.toLocaleString()}</p>
                    </div>
                    <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Data Processed</p>
                      <p className="text-xl font-bold text-purple-500">{formatBytes(selectedTask.metrics.bytesProcessed)}</p>
                    </div>
                    <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Error Count</p>
                      <p className="text-xl font-bold text-red-500">{selectedTask.metrics.errorsEncountered}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>CPU Usage</p>
                      <div className={`h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                        <div 
                          className="h-2 rounded-full bg-blue-500 transition-all"
                          style={{ width: `${selectedTask.metrics.cpuUsage}%` }}
                        />
                      </div>
                      <p className="text-right text-sm mt-1">{selectedTask.metrics.cpuUsage.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Memory Usage</p>
                      <div className={`h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                        <div 
                          className="h-2 rounded-full bg-green-500 transition-all"
                          style={{ width: `${selectedTask.metrics.memoryUsage}%` }}
                        />
                      </div>
                      <p className="text-right text-sm mt-1">{selectedTask.metrics.memoryUsage.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 任务日志弹窗 */}
      {logsModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className={`w-full max-w-4xl max-h-[80vh] rounded-xl shadow-xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Task Logs - {selectedTask.name}
              </h3>
              <button
                onClick={() => setLogsModalOpen(false)}
                className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              <div className="space-y-2">
                {taskLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        log.level === 'error' ? 'bg-red-500/20 text-red-400' :
                        log.level === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {log.level.toUpperCase()}
                      </span>
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {log.timestamp}
                      </span>
                    </div>
                    <p className={`mt-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                      {log.message}
                    </p>
                    {log.details && (
                      <pre className={`mt-2 text-xs p-2 rounded overflow-x-auto ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
