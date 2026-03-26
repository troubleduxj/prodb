import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'react-router-dom';
import { Home, ChevronRight } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface BreadcrumbItem {
  id: string;
  label: string;
  path: string;
  icon?: React.ElementType;
}

// 路由路径到翻译 key 的映射
const ROUTE_TO_KEY: Record<string, { key: string; parent?: string }> = {
  'dashboard': { key: 'nav.dashboard' },
  'realtime-live': { key: 'nav.liveData', parent: 'realtime' },
  'realtime-tables': { key: 'nav.tablesAndTags', parent: 'realtime' },
  'realtime-query': { key: 'nav.queryStudio', parent: 'realtime' },
  'realtime-devices': { key: 'nav.deviceExplorer', parent: 'realtime' },
  'realtime-streams': { key: 'nav.dataStreamMonitor', parent: 'realtime' },
  'realtime-history': { key: 'nav.queryHistory', parent: 'realtime' },
  'realtime-views': { key: 'nav.savedViews', parent: 'realtime' },
  'ingestion-sources': { key: 'nav.dataSources', parent: 'ingestion' },
  'ingestion-plugins': { key: 'nav.pluginLibrary', parent: 'ingestion' },
  'ingestion-mapping': { key: 'nav.mappingRules', parent: 'ingestion' },
  'ingestion-pipelines': { key: 'nav.pipelines', parent: 'ingestion' },
  'ingestion-dlq': { key: 'nav.deadLetterQueue', parent: 'ingestion' },
  'collector-agents': { key: 'nav.agents', parent: 'collector' },
  'collector-configs': { key: 'nav.configurations', parent: 'collector' },
  'collector-monitor': { key: 'nav.monitoring', parent: 'collector' },
  'computing-native': { key: 'nav.nativeStreams', parent: 'computing' },
  'computing-flink-jobs': { key: 'nav.flinkJobs', parent: 'computing' },
  'computing-flink-sql': { key: 'nav.flinkSQL', parent: 'computing' },
  'computing-topology': { key: 'nav.topologyLineage', parent: 'computing' },
  'computing-monitor': { key: 'nav.pipelineMonitor', parent: 'computing' },
  'query-workbench': { key: 'nav.sqlWorkbench', parent: 'query' },
  'query-reports': { key: 'nav.scheduledReports', parent: 'query' },
  'query-api': { key: 'nav.queryAsAPI', parent: 'query' },
  'query-virtual-views': { key: 'nav.virtualViews', parent: 'query' },
  'query-snippets': { key: 'nav.snippets', parent: 'query' },
  'metadata-map': { key: 'nav.dataMap', parent: 'metadata' },
  'metadata-lifecycle': { key: 'nav.lifecycleMgmt', parent: 'metadata' },
  'metadata-schema': { key: 'nav.dynamicSchema', parent: 'metadata' },
  'metadata-lineage': { key: 'nav.dataLineage', parent: 'metadata' },
  'operations-cluster': { key: 'nav.clusterCore', parent: 'operations' },
  'operations-nodes': { key: 'nav.nodeMonitor', parent: 'operations' },
  'operations-data': { key: 'nav.dataOps', parent: 'operations' },
  'operations-logs': { key: 'nav.logCenter', parent: 'operations' },
  'operations-slow-query': { key: 'nav.slowQuery', parent: 'operations' },
  'operations-tenants': { key: 'nav.tenants', parent: 'operations' },
  'operations-alerts': { key: 'nav.alerting', parent: 'operations' },
  'operations-backup': { key: 'nav.disasterRecovery', parent: 'operations' },
  'system-settings': { key: 'nav.system', parent: 'system' },
  'system-connect': { key: 'nav.connectSettings', parent: 'system' },
  'system-notifications': { key: 'nav.notificationSettings', parent: 'system' },
  'system-security': { key: 'nav.securitySettings', parent: 'system' },
  'settings': { key: 'nav.settings' },
  'help-center': { key: 'nav.helpCenter' },
  'ecosystem': { key: 'nav.ecosystem' },
};

// 父菜单 key 映射
const PARENT_KEYS: Record<string, { key: string; path: string }> = {
  'realtime': { key: 'nav.realtimeExplorer', path: '/realtime-live' },
  'ingestion': { key: 'nav.ingestion', path: '/ingestion-sources' },
  'collector': { key: 'nav.collectorManagement', path: '/collector-agents' },
  'computing': { key: 'nav.streamComputing', path: '/computing-native' },
  'query': { key: 'nav.queryService', path: '/query-workbench' },
  'metadata': { key: 'nav.metadata', path: '/metadata-map' },
  'operations': { key: 'nav.operations', path: '/operations-cluster' },
  'system': { key: 'nav.system', path: '/system-settings' },
};

export const Breadcrumb: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const currentPath = location.pathname.substring(1);

  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const result: BreadcrumbItem[] = [];
    
    // 添加 Home
    result.push({
      id: 'home',
      label: '',
      path: '/dashboard',
      icon: Home
    });

    if (!currentPath || currentPath === 'dashboard') {
      return result;
    }

    const routeInfo = ROUTE_TO_KEY[currentPath];
    if (!routeInfo) {
      return result;
    }

    // 如果有父菜单，先添加父菜单
    if (routeInfo.parent && PARENT_KEYS[routeInfo.parent]) {
      const parent = PARENT_KEYS[routeInfo.parent];
      result.push({
        id: routeInfo.parent,
        label: t(parent.key),
        path: parent.path
      });
    }

    // 添加当前页面
    result.push({
      id: currentPath,
      label: t(routeInfo.key),
      path: `/${currentPath}`
    });

    return result;
  };

  const items = getBreadcrumbItems();

  return (
    <nav className="flex items-center space-x-1 text-sm">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const Icon = item.icon;

        return (
          <React.Fragment key={item.id}>
            {index > 0 && (
              <ChevronRight className={`w-4 h-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
            )}
            {isLast ? (
              <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                {Icon ? <Icon className="w-4 h-4" /> : item.label}
              </span>
            ) : (
              <Link
                to={item.path}
                className={`flex items-center transition-colors ${
                  isDark 
                    ? 'text-gray-400 hover:text-gray-200' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {Icon ? <Icon className="w-4 h-4" /> : item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
