import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { useToast } from '../src/hooks/use-toast';
import {
  RefreshCw,
  AlertTriangle,
  Bell,
  CheckCircle,
  XCircle,
  Filter,
  Download,
  Plus,
  Edit3,
  Eye,
  TrendingUp,
  Activity,
  Database,
  Clock,
  Search,
  Shield,
  Cpu,
  Trash2,
} from 'lucide-react';
import {
  getEdgeAlertConfigs,
  deleteEdgeAlertConfig,
  getEdgeAlerts,
  getAlertStats,
  ackEdgeAlert,
  clearEdgeAlerts,
  exportEdgeAlerts,
  EdgeAlertConfig,
  EdgeAlert,
} from '../src/services/edgeAlertApi';
import { showSuccess } from '../src/services/api';

// Alert Statistics
interface AlertStatistics {
  total: number;
  critical: number;
  warning: number;
  info: number;
  pending: number;
  acknowledged: number;
}

// Filter Types
type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';
type StatusFilter = 'all' | 'pending' | 'acknowledged' | 'cleared';
type TimeRange = '1h' | '24h' | '7d' | '30d' | 'all';

export const EdgeAlertManager: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();
  const isDark = resolvedTheme === 'dark';

  // Tab State
  const [activeTab, setActiveTab] = useState<'alerts' | 'rules' | 'stats'>('alerts');

  // Alert List State
  const [alerts, setAlerts] = useState<EdgeAlert[]>([]);
  const [alertLoading, setAlertLoading] = useState(false);
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());

  // Rule List State
  const [rules, setRules] = useState<EdgeAlertConfig[]>([]);
  const [ruleLoading, setRuleLoading] = useState(false);

  // Statistics Data
  const [stats, setStats] = useState<AlertStatistics>({
    total: 0,
    critical: 0,
    warning: 0,
    info: 0,
    pending: 0,
    acknowledged: 0,
  });

  // Filters
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EdgeAlertConfig | null>(null);
  const [alertDetailOpen, setAlertDetailOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<EdgeAlert | null>(null);

  // Auto Refresh
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load Alert List
  const loadAlerts = useCallback(async () => {
    setAlertLoading(true);
    try {
      const params: any = {};
      if (severityFilter !== 'all') params.severity = severityFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (timeRange !== 'all') params.timeRange = timeRange;
      if (searchQuery) params.search = searchQuery;

      const data = await getEdgeAlerts(params);
      setAlerts(data);
    } catch (error) {
      console.error('Failed to load alerts:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load alerts",
        variant: 'destructive',
      });
    } finally {
      setAlertLoading(false);
    }
  }, [severityFilter, statusFilter, timeRange, searchQuery, toast, t]);

  // Load Alert Rules
  const loadRules = useCallback(async () => {
    setRuleLoading(true);
    try {
      const data = await getEdgeAlertConfigs();
      setRules(data);
    } catch (error) {
      console.error('Failed to load rules:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load rules",
        variant: 'destructive',
      });
    } finally {
      setRuleLoading(false);
    }
  }, [toast, t]);

  // Load Statistics
  const loadStats = useCallback(async () => {
    try {
      const data = await getAlertStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  // Acknowledge Alert
  const handleAckAlert = async (alertId: string) => {
    try {
      await ackEdgeAlert(alertId);
      showSuccess("Alert acknowledged");
      loadAlerts();
      loadStats();
    } catch (error) {
      console.error('Failed to ack alert:', error);
      toast({
        title: "Acknowledge Failed",
        description: "Please try again later",
        variant: 'destructive',
      });
    }
  };

  // Batch Acknowledge Alerts
  const handleBatchAck = async () => {
    if (selectedAlerts.size === 0) return;
    try {
      const promises = Array.from(selectedAlerts).map(id => ackEdgeAlert(id));
      await Promise.all(promises);
      showSuccess(`${selectedAlerts.size} alerts acknowledged`);
      setSelectedAlerts(new Set());
      loadAlerts();
      loadStats();
    } catch (error) {
      console.error('Failed to batch ack:', error);
      toast({
        title: "Batch Acknowledge Failed",
        description: "Please try again later",
        variant: 'destructive',
      });
    }
  };

  // Clear Alerts
  const handleClearAlerts = async () => {
    if (!window.confirm("Are you sure you want to clear all acknowledged alerts?")) return;
    try {
      await clearEdgeAlerts();
      showSuccess("Alerts cleared");
      loadAlerts();
      loadStats();
    } catch (error) {
      console.error('Failed to clear alerts:', error);
      toast({
        title: "Clear Failed",
        description: "Please try again later",
        variant: 'destructive',
      });
    }
  };

  // Export Alerts
  const handleExport = async () => {
    try {
      const blob = await exportEdgeAlerts({
        severity: severityFilter !== 'all' ? severityFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        timeRange,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edge-alerts-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess("Export successful");
    } catch (error) {
      console.error('Failed to export alerts:', error);
      toast({
        title: "Export Failed",
        description: "Please try again later",
        variant: 'destructive',
      });
    }
  };

  // Delete Rule
  const handleDeleteRule = async (ruleId: string) => {
    if (!window.confirm("Are you sure you want to delete this rule?")) return;
    try {
      await deleteEdgeAlertConfig(ruleId);
      showSuccess("Rule deleted");
      loadRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
      toast({
        title: "Delete Failed",
        description: "Please try again later",
        variant: 'destructive',
      });
    }
  };

  // Toggle Alert Selection
  const toggleAlertSelection = (alertId: string) => {
    setSelectedAlerts(prev => {
      const next = new Set(prev);
      if (next.has(alertId)) {
        next.delete(alertId);
      } else {
        next.add(alertId);
      }
      return next;
    });
  };

  // Select All / Deselect All
  const toggleSelectAll = () => {
    if (selectedAlerts.size === alerts.length) {
      setSelectedAlerts(new Set());
    } else {
      setSelectedAlerts(new Set(alerts.map(a => a.id)));
    }
  };

  // Auto Refresh
  useEffect(() => {
    loadAlerts();
    loadRules();
    loadStats();
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadAlerts();
      loadStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadAlerts, loadRules, loadStats]);

  // Get Severity Icon
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Bell className="w-5 h-5 text-blue-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  // Get Severity Color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return isDark ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-red-100 text-red-700 border-red-200';
      case 'warning':
        return isDark ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'info':
        return isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return isDark ? 'bg-gray-500/20 text-gray-400 border-gray-500/50' : 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Get Status Color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return isDark ? 'text-red-400' : 'text-red-600';
      case 'acknowledged':
        return isDark ? 'text-yellow-400' : 'text-yellow-600';
      case 'cleared':
        return isDark ? 'text-green-400' : 'text-green-600';
      default:
        return isDark ? 'text-gray-400' : 'text-gray-600';
    }
  };

  // Get Severity Label
  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical':
        return "Critical";
      case 'warning':
        return "Warning";
      case 'info':
        return "Info";
      default:
        return severity;
    }
  };

  // Get Status Label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return "Pending";
      case 'acknowledged':
        return "Acknowledged";
      case 'cleared':
        return "Cleared";
      default:
        return status;
    }
  };

  // Filtered Alert List
  const filteredAlerts = alerts.filter(alert => {
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        alert.title?.toLowerCase().includes(query) ||
        alert.message?.toLowerCase().includes(query) ||
        alert.collector_name?.toLowerCase().includes(query) ||
        alert.interface_name?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className={`space-y-6 relative ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('edgeAlert.title')}
          </h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('edgeAlert.subtitle')}
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
            onClick={() => activeTab === 'alerts' ? loadAlerts() : loadRules()}
            disabled={alertLoading || ruleLoading}
            className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${alertLoading || ruleLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.total}</p>
            </div>
            <Database className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Critical</p>
              <p className="text-2xl font-bold text-red-500">{stats.critical}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Warning</p>
              <p className="text-2xl font-bold text-yellow-500">{stats.warning}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Info</p>
              <p className="text-2xl font-bold text-blue-500">{stats.info}</p>
            </div>
            <Bell className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Pending</p>
              <p className="text-2xl font-bold text-orange-500">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Acknowledged</p>
              <p className="text-2xl font-bold text-green-500">{stats.acknowledged}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={`flex items-center gap-1 p-1 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'alerts'
              ? isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
              : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bell className="w-4 h-4" />
          Alerts
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'rules'
              ? isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
              : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Shield className="w-4 h-4" />
          Rules
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'stats'
              ? isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
              : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          Statistics
        </button>
      </div>

      {/* Alert List Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Filter</span>
              </div>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="all">All Severity</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
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
                <option value="pending">Pending</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="cleared">Cleared</option>
              </select>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="1h">Last 1 hour</option>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="all">All time</option>
              </select>
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search alerts..."
                    className={`w-full pl-10 pr-4 py-2 rounded-lg border text-sm ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    }`}
                  />
                </div>
              </div>
              {selectedAlerts.size > 0 && (
                <button
                  onClick={handleBatchAck}
                  className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm bg-green-600 hover:bg-green-500 text-white"
                >
                  <CheckCircle className="w-4 h-4" />
                  Acknowledge Selected ({selectedAlerts.size})
                </button>
              )}
              <button
                onClick={handleExport}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm ${
                  isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={handleClearAlerts}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm ${
                  isDark ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400' : 'bg-red-50 hover:bg-red-100 text-red-600'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                Clear Acknowledged
              </button>
            </div>
          </div>

          {/* Alert List */}
          <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={isDark ? 'bg-gray-700/50' : 'bg-gray-50'}>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedAlerts.size === filteredAlerts.length && filteredAlerts.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                    </th>
                    <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Severity</th>
                    <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Alert Info</th>
                    <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Collector</th>
                    <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Interface</th>
                    <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Status</th>
                    <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Time</th>
                    <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={isDark ? 'divide-y divide-gray-700' : 'divide-y divide-gray-200'}>
                  {alertLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                      </td>
                    </tr>
                  ) : filteredAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8">
                        <Bell className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                        <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>No alerts found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAlerts.map((alert) => (
                      <tr key={alert.id} className={isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedAlerts.has(alert.id)}
                            onChange={() => toggleAlertSelection(alert.id)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {getSeverityIcon(alert.severity)}
                            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getSeverityColor(alert.severity)}`}>
                              {getSeverityLabel(alert.severity)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{alert.title}</p>
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{alert.message}</p>
                          </div>
                        </td>
                        <td className={`px-4 py-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{alert.collector_name || alert.collector_id}</td>
                        <td className={`px-4 py-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{alert.interface_name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${getStatusColor(alert.status)}`}>
                            {getStatusLabel(alert.status)}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {new Date(alert.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setSelectedAlert(alert); setAlertDetailOpen(true); }}
                              className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                              title="View Detail"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {alert.status === 'pending' && (
                              <button
                                onClick={() => handleAckAlert(alert.id)}
                                className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-green-900/30 text-green-400' : 'hover:bg-green-50 text-green-600'}`}
                                title="Acknowledge"
                              >
                                <CheckCircle className="w-4 h-4" />
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
        </div>
      )}

      {/* Alert Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Alert Rules ({rules.length})
            </h3>
            <button
              onClick={() => { setEditingRule(null); setRuleModalOpen(true); }}
              className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-500 text-white"
            >
              <Plus className="w-4 h-4" />
              New Rule
            </button>
          </div>
          <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={isDark ? 'bg-gray-700/50' : 'bg-gray-50'}>
                    <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Rule Name</th>
                    <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Collector</th>
                    <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Datapoint</th>
                    <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Condition</th>
                    <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Severity</th>
                    <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Enabled</th>
                    <th className={`px-4 py-3 text-left font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={isDark ? 'divide-y divide-gray-700' : 'divide-y divide-gray-200'}>
                  {ruleLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                      </td>
                    </tr>
                  ) : rules.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8">
                        <Shield className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                        <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>No rules found</p>
                      </td>
                    </tr>
                  ) : (
                    rules.map((rule) => (
                      <tr key={rule.id} className={isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3">
                          <p className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{rule.name}</p>
                          {rule.description && (
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{rule.description}</p>
                          )}
                        </td>
                        <td className={`px-4 py-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{rule.collector_id}</td>
                        <td className={`px-4 py-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{rule.point_name}</td>
                        <td className={`px-4 py-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {rule.condition} {rule.threshold}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getSeverityColor(rule.severity)}`}>
                            {getSeverityLabel(rule.severity)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${rule.enabled ? 'text-green-500' : 'text-gray-500'}`}>
                            {rule.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setEditingRule(rule); setRuleModalOpen(true); }}
                              className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                              title="Edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRule(rule.id!)}
                              className={`p-1.5 rounded transition-colors ${isDark ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-50 text-red-600'}`}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Tab */}
      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alert Trend */}
          <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <TrendingUp className="w-5 h-5 inline-block mr-2" />
              Alert Trend
            </h3>
            <div className={`h-64 flex items-center justify-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <p>Chart placeholder</p>
            </div>
          </div>
          {/* Alert Distribution */}
          <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <Activity className="w-5 h-5 inline-block mr-2" />
              Alert Distribution
            </h3>
            <div className={`h-64 flex items-center justify-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <p>Chart placeholder</p>
            </div>
          </div>
          {/* Collector Alert Statistics */}
          <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <Cpu className="w-5 h-5 inline-block mr-2" />
              Collector Statistics
            </h3>
            <div className={`h-64 flex items-center justify-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <p>Chart placeholder</p>
            </div>
          </div>
          {/* Alert Response Time */}
          <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <Clock className="w-5 h-5 inline-block mr-2" />
              Response Time
            </h3>
            <div className={`h-64 flex items-center justify-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              <p>Chart placeholder</p>
            </div>
          </div>
        </div>
      )}

      {/* Alert Detail Modal */}
      {alertDetailOpen && selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className={`w-full max-w-2xl max-h-[80vh] rounded-xl shadow-xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                {getSeverityIcon(selectedAlert.severity)}
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Alert Detail
                </h3>
              </div>
              <button
                onClick={() => setAlertDetailOpen(false)}
                className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Title</label>
                <p className={`mt-1 text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedAlert.title}</p>
              </div>
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Message</label>
                <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{selectedAlert.message}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Collector</label>
                  <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{selectedAlert.collector_name || selectedAlert.collector_id}</p>
                </div>
                <div>
                  <label className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Interface</label>
                  <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{selectedAlert.interface_name || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Severity</label>
                  <p className="mt-1">
                    <span className={`px-2 py-1 rounded text-sm border ${getSeverityColor(selectedAlert.severity)}`}>
                      {getSeverityLabel(selectedAlert.severity)}
                    </span>
                  </p>
                </div>
                <div>
                  <label className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Status</label>
                  <p className={`mt-1 font-medium ${getStatusColor(selectedAlert.status)}`}>
                    {getStatusLabel(selectedAlert.status)}
                  </p>
                </div>
              </div>
              <div>
                <label className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Occurred At</label>
                <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {new Date(selectedAlert.created_at).toLocaleString()}
                </p>
              </div>
              {selectedAlert.acknowledged_at && (
                <div>
                  <label className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Acknowledged At</label>
                  <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {new Date(selectedAlert.acknowledged_at).toLocaleString()}
                  </p>
                </div>
              )}
              <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <label className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Raw Data</label>
                <pre className={`mt-2 text-xs overflow-x-auto ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {JSON.stringify(selectedAlert.raw_data, null, 2)}
                </pre>
              </div>
            </div>
            <div className={`flex justify-end gap-3 p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={() => setAlertDetailOpen(false)}
                className={`px-4 py-2 rounded-lg text-sm ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                Close
              </button>
              {selectedAlert.status === 'pending' && (
                <button
                  onClick={() => { handleAckAlert(selectedAlert.id); setAlertDetailOpen(false); }}
                  className="px-4 py-2 rounded-lg text-sm text-white bg-green-600 hover:bg-green-500"
                >
                  Acknowledge Alert
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EdgeAlertManager;
