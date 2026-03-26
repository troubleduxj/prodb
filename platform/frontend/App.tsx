import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import './src/i18n';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { Layout } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Ingestion } from './pages/Ingestion';
import { IngestionPlugins } from './pages/IngestionPlugins';
import { IngestionMapping } from './pages/IngestionMapping';
import { IngestionPipelines } from './pages/IngestionPipelines';
import { IngestionDLQ } from './pages/IngestionDLQ';

// Collector Pages
import { CollectorAgents } from './pages/CollectorAgents';
import { CollectorConfigs } from './pages/CollectorConfigs';
import { CollectorMonitor } from './pages/CollectorMonitor';
import { CollectorInterfaces } from './pages/CollectorInterfaces';
import { ConfigDeliveryStatus } from './pages/ConfigDeliveryStatus';
import { EdgeAlertManager } from './pages/EdgeAlertManager';
import { TaskRuntimeStatus } from './pages/TaskRuntimeStatus';

// Realtime Pages
import { RealtimeLive } from './pages/RealtimeLive';
import { RealtimeTables } from './pages/RealtimeTables/index';
import { RealtimeDevices } from './pages/RealtimeDevices';
import { RealtimeHistory } from './pages/RealtimeHistory';

// Computing Pages
import { ComputingNative } from './pages/ComputingNative';
import { ComputingFlinkJobs } from './pages/ComputingFlinkJobs';
import { ComputingFlinkSQL } from './pages/ComputingFlinkSQL';
import { ComputingMonitor } from './pages/ComputingMonitor';
import { ComputingTopology } from './pages/ComputingTopology';

// Query Services Pages
import { QueryWorkbench } from './pages/QueryWorkbench';
import { QueryApi } from './pages/QueryApi';
import { QueryVirtualViews } from './pages/QueryVirtualViews';
import { QuerySnippets } from './pages/QuerySnippets';
import { QueryReports } from './pages/QueryReports';

// Metadata Pages
import { MetadataMap } from './pages/MetadataMap';
import { MetadataLifecycle } from './pages/MetadataLifecycle';
import { MetadataSchema } from './pages/MetadataSchema';
import { MetadataLineage } from './pages/MetadataLineage';

// Operations Pages
import { OperationsCluster } from './pages/OperationsCluster';
import { OperationsNodes } from './pages/OperationsNodes';
import { OperationsData } from './pages/OperationsData';
import { OperationsSlowQuery } from './pages/OperationsSlowQuery';
import { OperationsLogs } from './pages/OperationsLogs';
import { OperationsTenants } from './pages/OperationsTenants';
import { OperationsAlerts } from './pages/OperationsAlerts';
import { OperationsBackup } from './pages/OperationsBackup';

// System Pages
import { SystemSettings } from './pages/SystemSettings';
import { SystemConnect } from './pages/SystemConnect';
import { SystemNotifications } from './pages/SystemNotifications';
import { SystemSecurity } from './pages/SystemSecurity';

// User Settings Page
import { SettingsPage } from './pages/Settings';
import { HelpCenter } from './pages/HelpCenter';
import { HelpDocs } from './pages/HelpDocs';
import { HelpApiRef } from './pages/HelpApiRef';
import { HelpCommunity } from './pages/HelpCommunity';

import { Ecosystem } from './pages/Ecosystem';
import { Page } from './types';
import { SystemProvider } from './contexts/SystemContext';

// 包装组件，用于添加认证保护
const ProtectedRoute: React.FC<{ element: React.ReactNode }> = ({ element }) => (
  <RequireAuth>
    <Layout>{element}</Layout>
  </RequireAuth>
);

const App: React.FC = () => {
  return (
    <SystemProvider>
      <ThemeProvider>
      <HashRouter>
        <Routes>
          {/* 登录/注册页不需要认证 */}
          <Route path="/login" element={<Auth />} />
          
          {/* 需要认证的路由 */}
          <Route path="/" element={<ProtectedRoute element={<Navigate to={`/${Page.DASHBOARD}`} replace />} />} />
          <Route path={`/${Page.DASHBOARD}`} element={<ProtectedRoute element={<Dashboard />} />} />
          
          {/* Realtime Explorer Routes */}
          <Route path="/realtime" element={<ProtectedRoute element={<Navigate to={`/${Page.REALTIME_LIVE}`} replace />} />} />
          <Route path={`/${Page.REALTIME_LIVE}`} element={<ProtectedRoute element={<RealtimeLive />} />} />
          <Route path={`/${Page.REALTIME_TABLES}`} element={<ProtectedRoute element={<RealtimeTables />} />} />
          <Route path={`/${Page.REALTIME_QUERY}`} element={<ProtectedRoute element={<QueryWorkbench />} />} />
          <Route path={`/${Page.REALTIME_DEVICES}`} element={<ProtectedRoute element={<RealtimeDevices />} />} />
          <Route path={`/${Page.REALTIME_STREAMS}`} element={<ProtectedRoute element={<ComputingMonitor />} />} />
          <Route path={`/${Page.REALTIME_HISTORY}`} element={<ProtectedRoute element={<RealtimeHistory />} />} />
          <Route path={`/${Page.REALTIME_VIEWS}`} element={<ProtectedRoute element={<QueryVirtualViews />} />} />

          {/* Data Ingestion Routes */}
          <Route path="/ingestion" element={<ProtectedRoute element={<Navigate to={`/${Page.INGESTION_SOURCES}`} replace />} />} />
          <Route path={`/${Page.INGESTION_SOURCES}`} element={<ProtectedRoute element={<Ingestion />} />} />
          <Route path={`/${Page.INGESTION_PLUGINS}`} element={<ProtectedRoute element={<IngestionPlugins />} />} />
          <Route path={`/${Page.INGESTION_MAPPING}`} element={<ProtectedRoute element={<IngestionMapping />} />} />
          <Route path={`/${Page.INGESTION_PIPELINES}`} element={<ProtectedRoute element={<IngestionPipelines />} />} />
          <Route path={`/${Page.INGESTION_DLQ}`} element={<ProtectedRoute element={<IngestionDLQ />} />} />

          {/* Collector Management Routes */}
          <Route path="/collector" element={<ProtectedRoute element={<Navigate to={`/${Page.COLLECTOR_AGENTS}`} replace />} />} />
          <Route path={`/${Page.COLLECTOR_AGENTS}`} element={<ProtectedRoute element={<CollectorAgents />} />} />
          <Route path={`/${Page.COLLECTOR_CONFIGS}`} element={<ProtectedRoute element={<CollectorConfigs />} />} />
          <Route path={`/${Page.COLLECTOR_MONITOR}`} element={<ProtectedRoute element={<CollectorMonitor />} />} />
          <Route path={`/${Page.COLLECTOR_INTERFACES}`} element={<ProtectedRoute element={<CollectorInterfaces />} />} />
          <Route path={`/${Page.COLLECTOR_CONFIG_STATUS}`} element={<ProtectedRoute element={<ConfigDeliveryStatus />} />} />
          <Route path={`/${Page.COLLECTOR_EDGE_ALERTS}`} element={<ProtectedRoute element={<EdgeAlertManager />} />} />
          <Route path={`/${Page.COLLECTOR_TASKS}`} element={<ProtectedRoute element={<TaskRuntimeStatus />} />} />

          {/* Stream Computing Routes */}
          <Route path="/computing" element={<ProtectedRoute element={<Navigate to={`/${Page.COMPUTING_NATIVE}`} replace />} />} />
          <Route path={`/${Page.COMPUTING_NATIVE}`} element={<ProtectedRoute element={<ComputingNative />} />} />
          <Route path={`/${Page.COMPUTING_FLINK_JOBS}`} element={<ProtectedRoute element={<ComputingFlinkJobs />} />} />
          <Route path={`/${Page.COMPUTING_FLINK_SQL}`} element={<ProtectedRoute element={<ComputingFlinkSQL />} />} />
          <Route path={`/${Page.COMPUTING_TOPOLOGY}`} element={<ProtectedRoute element={<ComputingTopology />} />} />
          <Route path={`/${Page.COMPUTING_MONITOR}`} element={<ProtectedRoute element={<ComputingMonitor />} />} />

          {/* Unified Query Service Routes */}
          <Route path="/query" element={<ProtectedRoute element={<Navigate to={`/${Page.QUERY_WORKBENCH}`} replace />} />} />
          <Route path={`/${Page.QUERY_WORKBENCH}`} element={<ProtectedRoute element={<QueryWorkbench />} />} />
          <Route path={`/${Page.QUERY_REPORTS}`} element={<ProtectedRoute element={<QueryReports />} />} />
          <Route path={`/${Page.QUERY_API}`} element={<ProtectedRoute element={<QueryApi />} />} />
          <Route path={`/${Page.QUERY_VIRTUAL_VIEWS}`} element={<ProtectedRoute element={<QueryVirtualViews />} />} />
          <Route path={`/${Page.QUERY_SNIPPETS}`} element={<ProtectedRoute element={<QuerySnippets />} />} />
          
          {/* Metadata Routes */}
          <Route path="/metadata" element={<ProtectedRoute element={<Navigate to={`/${Page.METADATA_MAP}`} replace />} />} />
          <Route path={`/${Page.METADATA_MAP}`} element={<ProtectedRoute element={<MetadataMap />} />} />
          <Route path={`/${Page.METADATA_LIFECYCLE}`} element={<ProtectedRoute element={<MetadataLifecycle />} />} />
          <Route path={`/${Page.METADATA_SCHEMA}`} element={<ProtectedRoute element={<MetadataSchema />} />} />
          <Route path={`/${Page.METADATA_LINEAGE}`} element={<ProtectedRoute element={<MetadataLineage />} />} />

          {/* Operations Routes */}
          <Route path="/operations" element={<ProtectedRoute element={<Navigate to={`/${Page.OPERATIONS_CLUSTER}`} replace />} />} />
          <Route path={`/${Page.OPERATIONS_CLUSTER}`} element={<ProtectedRoute element={<OperationsCluster />} />} />
          <Route path={`/${Page.OPERATIONS_NODES}`} element={<ProtectedRoute element={<OperationsNodes />} />} />
          <Route path={`/${Page.OPERATIONS_DATA}`} element={<ProtectedRoute element={<OperationsData />} />} />
          <Route path={`/${Page.OPERATIONS_SLOW_QUERY}`} element={<ProtectedRoute element={<OperationsSlowQuery />} />} />
          <Route path={`/${Page.OPERATIONS_LOGS}`} element={<ProtectedRoute element={<OperationsLogs />} />} />
          <Route path={`/${Page.OPERATIONS_TENANTS}`} element={<ProtectedRoute element={<OperationsTenants />} />} />
          <Route path={`/${Page.OPERATIONS_ALERTS}`} element={<ProtectedRoute element={<OperationsAlerts />} />} />
          <Route path={`/${Page.OPERATIONS_BACKUP}`} element={<ProtectedRoute element={<OperationsBackup />} />} />

          {/* System Management Routes */}
          <Route path="/system" element={<ProtectedRoute element={<Navigate to={`/${Page.SYSTEM_SETTINGS}`} replace />} />} />
          <Route path={`/${Page.SYSTEM_SETTINGS}`} element={<ProtectedRoute element={<SystemSettings />} />} />
          <Route path={`/${Page.SYSTEM_CONNECT}`} element={<ProtectedRoute element={<SystemConnect />} />} />
          <Route path={`/${Page.SYSTEM_NOTIFICATIONS}`} element={<ProtectedRoute element={<SystemNotifications />} />} />
          <Route path={`/${Page.SYSTEM_SECURITY}`} element={<ProtectedRoute element={<SystemSecurity />} />} />

          {/* User Settings Routes */}
          <Route path="/settings" element={<ProtectedRoute element={<Navigate to="/settings/profile" replace />} />} />
          <Route path="/settings/:tab" element={<ProtectedRoute element={<SettingsPage />} />} />

          {/* Help Center Routes */}
          <Route path={`/${Page.HELP_CENTER}`} element={<ProtectedRoute element={<HelpCenter />} />} />
          <Route path={`/${Page.HELP_DOCS}`} element={<ProtectedRoute element={<HelpDocs />} />} />
          <Route path={`/${Page.HELP_API}`} element={<ProtectedRoute element={<HelpApiRef />} />} />
          <Route path={`/${Page.HELP_COMMUNITY}`} element={<ProtectedRoute element={<HelpCommunity />} />} />

          <Route path={`/${Page.ECOSYSTEM}`} element={<ProtectedRoute element={<Ecosystem />} />} />
          
          {/* 捕获所有未匹配路由，重定向到登录页 */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </HashRouter>
      </ThemeProvider>
    </SystemProvider>
  );
};

export default App;
