import React, { useState, useEffect } from 'react';
import { Workflow, ArrowRight, Database, Server, Cpu, Box, Table, Activity, Zap, TrendingUp, Clock, AlertCircle, CheckCircle, RefreshCw, GitBranch, Layers, Search, Filter, Download } from 'lucide-react';
import { useTheme } from '../src/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

// 实时数据流模拟
interface DataFlowMetrics {
  throughput: number;
  latency: number;
  recordCount: number;
  errorRate: number;
  lastUpdate: string;
}

// 血缘节点
interface LineageNode {
  id: string;
  name: string;
  type: 'source' | 'raw' | 'stream' | 'agg' | 'sink';
  status: 'healthy' | 'warning' | 'error';
  metrics: DataFlowMetrics;
  dependencies: string[];
}

// 模拟节点数据
const MOCK_NODES: LineageNode[] = [
  {
    id: 'src_001',
    name: 'MQTT Gateway',
    type: 'source',
    status: 'healthy',
    metrics: { throughput: 15420, latency: 12, recordCount: 1542000, errorRate: 0.01, lastUpdate: '2s ago' },
    dependencies: []
  },
  {
    id: 'raw_001',
    name: 'meters_raw',
    type: 'raw',
    status: 'healthy',
    metrics: { throughput: 15420, latency: 45, recordCount: 45000000, errorRate: 0, lastUpdate: '2s ago' },
    dependencies: ['src_001']
  },
  {
    id: 'stream_001',
    name: 'stream_avg_1m',
    type: 'stream',
    status: 'healthy',
    metrics: { throughput: 15420, latency: 120, recordCount: 890000, errorRate: 0.02, lastUpdate: '5s ago' },
    dependencies: ['raw_001']
  },
  {
    id: 'agg_001',
    name: 'meters_1m_avg',
    type: 'agg',
    status: 'healthy',
    metrics: { throughput: 256, latency: 180, recordCount: 256000, errorRate: 0, lastUpdate: '5s ago' },
    dependencies: ['stream_001']
  },
  {
    id: 'sink_001',
    name: 'Grafana Dashboard',
    type: 'sink',
    status: 'warning',
    metrics: { throughput: 256, latency: 250, recordCount: 256000, errorRate: 0.5, lastUpdate: '10s ago' },
    dependencies: ['agg_001']
  },
  {
    id: 'sink_002',
    name: 'Alert System',
    type: 'sink',
    status: 'healthy',
    metrics: { throughput: 256, latency: 200, recordCount: 12000, errorRate: 0, lastUpdate: '5s ago' },
    dependencies: ['agg_001']
  }
];

// 模拟历史数据
const HISTORY_DATA = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  throughput: Math.floor(Math.random() * 5000) + 10000,
  latency: Math.floor(Math.random() * 100) + 50,
}));

export const MetadataLineage: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';
  
  const [nodes, setNodes] = useState<LineageNode[]>(MOCK_NODES);
  const [selectedNode, setSelectedNode] = useState<LineageNode | null>(null);
  const [showRealtimePanel, setShowRealtimePanel] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // 模拟实时数据更新
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      setNodes(prev => prev.map(node => ({
        ...node,
        metrics: {
          ...node.metrics,
          throughput: node.metrics.throughput + Math.floor(Math.random() * 100) - 50,
          latency: Math.max(5, node.metrics.latency + Math.floor(Math.random() * 10) - 5),
          recordCount: node.metrics.recordCount + node.metrics.throughput,
          lastUpdate: 'just now'
        }
      })));
      setLastRefresh(new Date());
    }, 3000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'source': return 'border-yellow-500';
      case 'raw': return 'border-blue-500';
      case 'stream': return 'border-purple-500';
      case 'agg': return 'border-green-500';
      case 'sink': return 'border-orange-500';
      default: return 'border-gray-500';
    }
  };

  const getNodeBgColor = (type: string) => {
    switch (type) {
      case 'source': return isDark ? 'bg-yellow-500/10' : 'bg-yellow-50';
      case 'raw': return isDark ? 'bg-blue-500/10' : 'bg-blue-50';
      case 'stream': return isDark ? 'bg-purple-500/10' : 'bg-purple-50';
      case 'agg': return isDark ? 'bg-green-500/10' : 'bg-green-50';
      case 'sink': return isDark ? 'bg-orange-500/10' : 'bg-orange-50';
      default: return isDark ? 'bg-gray-800' : 'bg-white';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-4 h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            {t('lineage.dataLineage', 'Data Lineage')}
          </h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
            {t('lineage.traceDataFlow', 'Trace data flow with real-time metrics and impact analysis.')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              autoRefresh 
                ? 'bg-green-500/10 text-green-500' 
                : isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? t('common.live', 'Live') : t('common.paused', 'Paused')}
          </button>
          
          <select className={`${isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'} border text-sm rounded-lg px-3 py-2 outline-none`}>
            <option>Table: power_db.meters</option>
            <option>Table: fleet_db.vehicles</option>
            <option>Table: iot_db.sensors</option>
          </select>
          
          <button 
            onClick={() => setShowRealtimePanel(!showRealtimePanel)}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              showRealtimePanel
                ? 'bg-blue-600 text-white'
                : isDark ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700 border border-gray-200'
            }`}
          >
            <Activity className="w-4 h-4 inline mr-1" />
            {t('lineage.realtimeMetrics', 'Realtime')}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Canvas Area */}
        <div className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-gray-50'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} relative overflow-hidden bg-[radial-gradient(${isDark ? '#1f2937' : '#e5e7eb'}_1px,transparent_1px)] [background-size:16px_16px]`}>
          <div className="absolute inset-0 flex items-center justify-center p-10">
            {/* Lineage Flow */}
            <div className="flex items-center gap-8">
              {/* Source */}
              <div 
                className="flex flex-col items-center gap-4 cursor-pointer"
                onClick={() => setSelectedNode(nodes[0])}
              >
                <div className={`w-44 p-4 ${getNodeBgColor('source')} ${getNodeColor('source')} border-2 rounded-xl flex flex-col items-center text-center hover:shadow-lg transition-all ${selectedNode?.id === 'src_001' ? 'ring-2 ring-yellow-500' : ''}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(nodes[0].status)}
                    <Server className={`w-5 h-5 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                  </div>
                  <h4 className={`font-bold text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{nodes[0].name}</h4>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Source</p>
                  <div className={`mt-2 text-xs px-2 py-1 rounded ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                    <TrendingUp className="w-3 h-3 inline mr-1" />
                    {(nodes[0].metrics.throughput / 1000).toFixed(1)}k/s
                  </div>
                </div>
              </div>

              <ArrowRight className={`w-6 h-6 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />

              {/* Raw Table */}
              <div 
                className="flex flex-col items-center gap-4 cursor-pointer"
                onClick={() => setSelectedNode(nodes[1])}
              >
                <div className={`w-44 p-4 ${getNodeBgColor('raw')} ${getNodeColor('raw')} border-2 rounded-xl flex flex-col items-center text-center hover:shadow-lg transition-all ${selectedNode?.id === 'raw_001' ? 'ring-2 ring-blue-500' : ''}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(nodes[1].status)}
                    <Database className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                  </div>
                  <h4 className={`font-bold text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{nodes[1].name}</h4>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Raw Storage</p>
                  <div className={`mt-2 text-xs px-2 py-1 rounded ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                    <Layers className="w-3 h-3 inline mr-1" />
                    {(nodes[1].metrics.recordCount / 1000000).toFixed(1)}M rows
                  </div>
                </div>
              </div>

              <ArrowRight className={`w-6 h-6 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />

              {/* Stream Processing */}
              <div 
                className="flex flex-col items-center gap-4 cursor-pointer"
                onClick={() => setSelectedNode(nodes[2])}
              >
                <div className={`w-44 p-4 ${getNodeBgColor('stream')} ${getNodeColor('stream')} border-2 rounded-xl flex flex-col items-center text-center hover:shadow-lg transition-all ${selectedNode?.id === 'stream_001' ? 'ring-2 ring-purple-500' : ''}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(nodes[2].status)}
                    <Cpu className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                  </div>
                  <h4 className={`font-bold text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{nodes[2].name}</h4>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Stream Task</p>
                  <div className={`mt-2 text-xs px-2 py-1 rounded ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                    <Zap className="w-3 h-3 inline mr-1" />
                    {nodes[2].metrics.latency}ms
                  </div>
                </div>
              </div>

              <ArrowRight className={`w-6 h-6 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />

              {/* Aggregated Table */}
              <div 
                className="flex flex-col items-center gap-4 cursor-pointer"
                onClick={() => setSelectedNode(nodes[3])}
              >
                <div className={`w-44 p-4 ${getNodeBgColor('agg')} ${getNodeColor('agg')} border-2 rounded-xl flex flex-col items-center text-center hover:shadow-lg transition-all ${selectedNode?.id === 'agg_001' ? 'ring-2 ring-green-500' : ''}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(nodes[3].status)}
                    <Table className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                  </div>
                  <h4 className={`font-bold text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{nodes[3].name}</h4>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Aggregated</p>
                  <div className={`mt-2 text-xs px-2 py-1 rounded ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                    <TrendingUp className="w-3 h-3 inline mr-1" />
                    {(nodes[3].metrics.throughput / 1000).toFixed(1)}k/s
                  </div>
                </div>
              </div>

              <ArrowRight className={`w-6 h-6 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />

              {/* Downstream Consumers */}
              <div className="flex flex-col gap-4">
                <div 
                  className="cursor-pointer"
                  onClick={() => setSelectedNode(nodes[4])}
                >
                  <div className={`w-40 p-3 ${getNodeBgColor('sink')} ${getNodeColor('sink')} border-2 rounded-xl flex flex-col items-center text-center hover:shadow-lg transition-all ${selectedNode?.id === 'sink_001' ? 'ring-2 ring-orange-500' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(nodes[4].status)}
                      <Box className={`w-4 h-4 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                    </div>
                    <h4 className={`font-bold text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{nodes[4].name}</h4>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Dashboard</p>
                  </div>
                </div>
                <div 
                  className="cursor-pointer"
                  onClick={() => setSelectedNode(nodes[5])}
                >
                  <div className={`w-40 p-3 ${getNodeBgColor('sink')} ${getNodeColor('sink')} border-2 rounded-xl flex flex-col items-center text-center hover:shadow-lg transition-all ${selectedNode?.id === 'sink_002' ? 'ring-2 ring-orange-500' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(nodes[5].status)}
                      <AlertCircle className={`w-4 h-4 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                    </div>
                    <h4 className={`font-bold text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{nodes[5].name}</h4>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Alert System</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Legend */}
          <div className={`absolute bottom-4 right-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border p-3 rounded-lg text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-yellow-500"></span> {t('lineage.source', 'Source')}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span> {t('lineage.rawData', 'Raw')}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-purple-500"></span> {t('lineage.streamTask', 'Stream')}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-green-500"></span> {t('lineage.aggregated', 'Aggregated')}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-500"></span> {t('lineage.sink', 'Sink')}
            </div>
          </div>

          {/* Last Update */}
          <div className={`absolute top-4 right-4 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
        </div>

        {/* Realtime Metrics Panel */}
        {showRealtimePanel && (
          <div className={`w-80 shrink-0 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl overflow-hidden flex flex-col`}>
            {/* Panel Header */}
            <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                {t('lineage.realtimeMetrics', 'Realtime Metrics')}
              </h3>
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                {selectedNode ? selectedNode.name : t('lineage.selectNode', 'Select a node to view details')}
              </p>
            </div>

            {/* Metrics Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedNode ? (
                <>
                  {/* Node Info */}
                  <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Type</span>
                      <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {selectedNode.type.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Status</span>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(selectedNode.status)}
                        <span className={`text-xs font-medium capitalize ${
                          selectedNode.status === 'healthy' ? 'text-green-500' :
                          selectedNode.status === 'warning' ? 'text-yellow-500' : 'text-red-500'
                        }`}>
                          {selectedNode.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Dependencies</span>
                      <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {selectedNode.dependencies.length}
                      </span>
                    </div>
                  </div>

                  {/* Key Metrics */}
                  <div>
                    <h4 className={`text-xs font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Key Metrics</h4>
                    <div className="space-y-3">
                      <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Throughput</span>
                          <span className={`text-sm font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                            {(selectedNode.metrics.throughput / 1000).toFixed(1)}k/s
                          </span>
                        </div>
                      </div>
                      <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Latency</span>
                          <span className={`text-sm font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                            {selectedNode.metrics.latency}ms
                          </span>
                        </div>
                      </div>
                      <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Total Records</span>
                          <span className={`text-sm font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                            {(selectedNode.metrics.recordCount / 1000000).toFixed(2)}M
                          </span>
                        </div>
                      </div>
                      <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Error Rate</span>
                          <span className={`text-sm font-bold ${selectedNode.metrics.errorRate > 0.1 ? 'text-red-500' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {selectedNode.metrics.errorRate.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dependencies */}
                  {selectedNode.dependencies.length > 0 && (
                    <div>
                      <h4 className={`text-xs font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Dependencies</h4>
                      <div className="space-y-2">
                        {selectedNode.dependencies.map(depId => {
                          const depNode = nodes.find(n => n.id === depId);
                          return depNode ? (
                            <div 
                              key={depId}
                              onClick={() => setSelectedNode(depNode)}
                              className={`p-2 rounded-lg cursor-pointer flex items-center justify-between ${isDark ? 'bg-gray-900/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'}`}
                            >
                              <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{depNode.name}</span>
                              <ArrowRight className="w-3 h-3 text-gray-400" />
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-2 space-y-2">
                    <button className={`w-full py-2 rounded-lg text-sm flex items-center justify-center gap-2 ${isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                      <Search className="w-4 h-4" />
                      View Details
                    </button>
                    <button className={`w-full py-2 rounded-lg text-sm flex items-center justify-center gap-2 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                      <Download className="w-4 h-4" />
                      Export Lineage
                    </button>
                  </div>
                </>
              ) : (
                <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Click on a node in the diagram to view its realtime metrics and details.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
