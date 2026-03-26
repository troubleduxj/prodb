import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Cpu,
  Database,
  RefreshCw,
  Layers,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '../lib/utils';

type TaskStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';
type TaskType = 'data_collection' | 'data_sync' | 'data_processing' | 'config_sync' | 'heartbeat';

interface Task {
  id: string;
  name: string;
  type: TaskType;
  status: TaskStatus;
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
  cpuUsage?: number;
  memoryUsage?: number;
  dataPointsCollected?: number;
  dataPointsSynced?: number;
}

const mockTasks: Task[] = [
  {
    id: 'task-001',
    name: '产线1-温度采集',
    type: 'data_collection',
    status: 'running',
    schedule: '*/5 * * * *',
    lastStartTime: '2026-03-13 10:30:00',
    nextRunTime: '2026-03-13 10:35:00',
    runCount: 1200,
    successCount: 1198,
    failCount: 2,
    avgDuration: 2500,
    progress: 65,
    cpuUsage: 12.5,
    memoryUsage: 45.2,
    dataPointsCollected: 15000,
    dataPointsSynced: 14800,
  },
  {
    id: 'task-002',
    name: '产线2-压力采集',
    type: 'data_collection',
    status: 'running',
    schedule: '*/10 * * * *',
    lastStartTime: '2026-03-13 10:30:00',
    nextRunTime: '2026-03-13 10:40:00',
    runCount: 800,
    successCount: 795,
    failCount: 5,
    avgDuration: 3200,
    progress: 40,
    cpuUsage: 8.3,
    memoryUsage: 32.1,
    dataPointsCollected: 8000,
    dataPointsSynced: 7950,
  },
  {
    id: 'task-003',
    name: '数据同步-本地',
    type: 'data_sync',
    status: 'completed',
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
    name: '配置同步',
    type: 'config_sync',
    status: 'running',
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
    name: '心跳检测',
    type: 'heartbeat',
    status: 'failed',
    schedule: '*/1 * * * *',
    lastStartTime: '2026-03-13 10:29:00',
    lastEndTime: '2026-03-13 10:29:05',
    nextRunTime: '2026-03-13 10:30:00',
    runCount: 500,
    successCount: 480,
    failCount: 20,
    avgDuration: 500,
    lastError: '连接超时: 无法连接到Platform',
  },
  {
    id: 'task-006',
    name: '数据预处理',
    type: 'data_processing',
    status: 'paused',
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

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadTasks = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setTasks(mockTasks);
    setLoading(false);
  };

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'running' as TaskStatus } : t));
  };

  const handlePause = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'paused' as TaskStatus } : t));
  };

  const handleStop = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'idle' as TaskStatus } : t));
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'running':
        return <Play className="w-4 h-4 text-emerald-500" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getTypeLabel = (type: TaskType) => {
    switch (type) {
      case 'data_collection':
        return '数据采集';
      case 'data_sync':
        return '数据同步';
      case 'data_processing':
        return '数据处理';
      case 'config_sync':
        return '配置同步';
      case 'heartbeat':
        return '心跳检测';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const stats = {
    total: tasks.length,
    running: tasks.filter(t => t.status === 'running').length,
    paused: tasks.filter(t => t.status === 'paused').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">任务运行时</h1>
          <p className="text-zinc-400 mt-1">监控采集器任务的实时运行状态</p>
        </div>
        <button
          onClick={loadTasks}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          刷新
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-400 text-sm">总任务数</div>
          <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-400 text-sm">运行中</div>
          <div className="text-2xl font-bold text-emerald-500 mt-1">{stats.running}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-400 text-sm">已暂停</div>
          <div className="text-2xl font-bold text-yellow-500 mt-1">{stats.paused}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-400 text-sm">失败</div>
          <div className="text-2xl font-bold text-red-500 mt-1">{stats.failed}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-zinc-400 text-sm">已完成</div>
          <div className="text-2xl font-bold text-blue-500 mt-1">{stats.completed}</div>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
          >
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50"
              onClick={() => setExpandedId(expandedId === task.id ? null : task.id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center">
                  <Layers className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">{task.name}</h3>
                  <p className="text-sm text-zinc-500">{task.id} · {getTypeLabel(task.type)}</p>
                </div>
                <span className={cn(
                  "px-2 py-1 rounded text-xs font-medium flex items-center gap-1",
                  task.status === 'running' ? "bg-emerald-500/20 text-emerald-500" :
                  task.status === 'paused' ? "bg-yellow-500/20 text-yellow-500" :
                  task.status === 'failed' ? "bg-red-500/20 text-red-500" :
                  task.status === 'completed' ? "bg-blue-500/20 text-blue-500" :
                  "bg-zinc-700 text-zinc-400"
                )}>
                  {getStatusIcon(task.status)}
                  {task.status === 'running' ? '运行中' :
                   task.status === 'paused' ? '已暂停' :
                   task.status === 'failed' ? '失败' :
                   task.status === 'completed' ? '已完成' : '空闲'}
                </span>
              </div>

              <div className="flex items-center gap-6">
                {task.progress !== undefined && (
                  <div className="w-32">
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>进度</span>
                      <span>{task.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full">
                      <div 
                        className="h-1.5 bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-sm text-zinc-400">执行次数</p>
                  <p className="text-white">{task.runCount}</p>
                </div>
                <button className="p-1 text-zinc-500 hover:text-white">
                  {expandedId === task.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedId === task.id && (
              <div className="border-t border-zinc-800 p-4">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">调度规则</p>
                    <p className="text-white">{task.schedule}</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">下次执行</p>
                    <p className="text-white">{task.nextRunTime || '-'}</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">平均耗时</p>
                    <p className="text-white">{formatDuration(task.avgDuration)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-zinc-400">成功率</span>
                      <span className="text-emerald-500">
                        {((task.successCount / task.runCount) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-500">成功: {task.successCount}</span>
                      <span className="text-red-500">失败: {task.failCount}</span>
                    </div>
                  </div>
                  {task.cpuUsage !== undefined && (
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                      <p className="text-sm text-zinc-400 mb-2">资源使用</p>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-zinc-500">CPU</span>
                            <span className="text-white">{task.cpuUsage.toFixed(1)}%</span>
                          </div>
                          <div className="h-1 bg-zinc-700 rounded-full">
                            <div className="h-1 bg-blue-500 rounded-full" style={{ width: `${task.cpuUsage}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-zinc-500">内存</span>
                            <span className="text-white">{task.memoryUsage?.toFixed(1)}%</span>
                          </div>
                          <div className="h-1 bg-zinc-700 rounded-full">
                            <div className="h-1 bg-green-500 rounded-full" style={{ width: `${task.memoryUsage}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {task.dataPointsCollected !== undefined && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                      <p className="text-xs text-zinc-500">数据点采集</p>
                      <p className="text-xl font-bold text-white">{task.dataPointsCollected.toLocaleString()}</p>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                      <p className="text-xs text-zinc-500">数据点同步</p>
                      <p className="text-xl font-bold text-emerald-500">{task.dataPointsSynced?.toLocaleString()}</p>
                    </div>
                  </div>
                )}

                {task.lastError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                    <p className="text-red-400 text-sm">{task.lastError}</p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {task.status !== 'running' && (
                    <button
                      onClick={() => handleStart(task.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 text-emerald-500 rounded-lg text-sm hover:bg-emerald-500/30"
                    >
                      <Play className="w-4 h-4" />
                      启动
                    </button>
                  )}
                  {task.status === 'running' && (
                    <button
                      onClick={() => handlePause(task.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-yellow-500/20 text-yellow-500 rounded-lg text-sm hover:bg-yellow-500/30"
                    >
                      <Pause className="w-4 h-4" />
                      暂停
                    </button>
                  )}
                  {(task.status === 'running' || task.status === 'paused') && (
                    <button
                      onClick={() => handleStop(task.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-red-500/20 text-red-500 rounded-lg text-sm hover:bg-red-500/30"
                    >
                      <Square className="w-4 h-4" />
                      停止
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}