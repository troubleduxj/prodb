
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../src/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { api } from '../src/services/api';
import {
  LayoutDashboard,
  Network,
  Cpu,
  Database,
  TableProperties,
  Activity,
  Share2,
  Hexagon,
  ChevronDown,
  ChevronRight,
  Server,
  Package,
  GitMerge,
  Filter,
  Map,
  History,
  GitBranch,
  Workflow,
  Zap,
  ServerCog,
  Code2,
  Gauge,
  Terminal,
  Webhook,
  Layers,
  Scissors,
  HardDrive,
  Users,
  Bell,
  CheckCircle,
  Archive,
  LayoutGrid,
  Turtle,
  CalendarClock,
  Settings,
  Shield,
  Sliders,
  Link2,
  AlertOctagon,
  FileText,
  LogOut,
  CreditCard,
  Sparkles,
  User,
  ChevronsUpDown,
  Palette,
  Monitor,
  Wrench,
  HelpCircle,
  Compass,
  Radio,
  Table,
  TabletSmartphone,
  Bookmark
} from 'lucide-react';
import { Page } from '../types';
import { useSystem } from '../contexts/SystemContext';

interface SidebarProps {
  isOpen?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = true }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname.substring(1);
  const { platformName } = useSystem();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';
  
  // State to manage expanded menus.
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  
  // State for Tooltip (Fixed Position to avoid clipping)
  const [tooltip, setTooltip] = useState<{ top: number; text: string } | null>(null);

  // State for Profile Menu
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const expand = (id: string) => {
        setExpandedMenus(prev => prev.includes(id) ? prev : [...prev, id]);
    };

    if (currentPath.startsWith('realtime')) expand('realtime');
    if (currentPath.startsWith('ingestion')) expand('ingestion');
    if (currentPath.startsWith('metadata')) expand('metadata');
    if (currentPath.startsWith('computing')) expand('computing');
    if (currentPath.startsWith('query')) expand('query');
    if (currentPath.startsWith('operations')) expand('operations');
    if (currentPath.startsWith('system')) expand('system');
    if (currentPath.startsWith('settings')) expand('settings-bottom');
  }, [currentPath]);

  // Close profile menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
            setIsProfileOpen(false);
        }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleMenu = (id: string) => {
    // Only toggle if sidebar is open to avoid confusing UX in collapsed state
    if (isOpen) {
        setExpandedMenus(prev => 
          prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    }
  };

  const handleMouseEnter = (e: React.MouseEvent, label: string) => {
      if (!isOpen) {
          const rect = e.currentTarget.getBoundingClientRect();
          setTooltip({
              top: rect.top + rect.height / 2,
              text: label
          });
      }
  };

  const handleMouseLeave = () => {
      setTooltip(null);
  };

  const handleLogout = () => {
    api.auth.logout();
    navigate('/login');
  };

  const menuItems = [
    { id: Page.DASHBOARD, label: t('nav.dashboard'), icon: LayoutDashboard },
    {
      id: 'realtime',
      label: t('nav.realtimeExplorer'),
      icon: Compass,
      subItems: [
        { id: Page.REALTIME_LIVE, label: t('nav.liveData'), icon: Radio },
        { id: Page.REALTIME_TABLES, label: t('nav.tablesAndTags'), icon: Table },
        { id: Page.REALTIME_QUERY, label: t('nav.queryStudio'), icon: Terminal },
        { id: Page.REALTIME_DEVICES, label: t('nav.deviceExplorer'), icon: TabletSmartphone },
        { id: Page.REALTIME_STREAMS, label: t('nav.dataStreamMonitor'), icon: Activity },
        { id: Page.REALTIME_HISTORY, label: t('nav.queryHistory'), icon: History },
        { id: Page.REALTIME_VIEWS, label: t('nav.savedViews'), icon: Bookmark },
      ]
    },
    {
      id: 'ingestion',
      label: t('nav.ingestion'),
      icon: Network,
      subItems: [
        { id: Page.INGESTION_SOURCES, label: t('nav.dataSources'), icon: Server },
        { id: Page.INGESTION_PLUGINS, label: t('nav.pluginLibrary'), icon: Package },
        { id: Page.INGESTION_MAPPING, label: t('nav.mappingRules'), icon: GitMerge },
        { id: Page.INGESTION_PIPELINES, label: t('nav.pipelines'), icon: Filter },
        { id: Page.INGESTION_DLQ, label: t('nav.deadLetterQueue'), icon: AlertOctagon },
      ]
    },
    {
      id: 'collector',
      label: t('nav.collectorManagement'),
      icon: Radio,
      subItems: [
        { id: Page.COLLECTOR_AGENTS, label: t('nav.agents'), icon: Server },
        { id: Page.COLLECTOR_CONFIGS, label: t('nav.configurations'), icon: FileText },
        { id: Page.COLLECTOR_INTERFACES, label: t('nav.interfaces'), icon: Layers },
        { id: Page.COLLECTOR_CONFIG_STATUS, label: t('nav.configDeliveryStatus'), icon: CheckCircle },
        { id: Page.COLLECTOR_EDGE_ALERTS, label: t('nav.edgeAlerts'), icon: Bell },
        { id: Page.COLLECTOR_TASKS, label: t('nav.taskRuntime'), icon: Activity },
        { id: Page.COLLECTOR_MONITOR, label: t('nav.monitoring'), icon: Gauge },
      ]
    },
    {
      id: 'computing',
      label: t('nav.streamComputing'),
      icon: Cpu,
      subItems: [
        { id: Page.COMPUTING_NATIVE, label: t('nav.nativeStreams'), icon: Zap },
        { id: Page.COMPUTING_FLINK_JOBS, label: t('nav.flinkJobs'), icon: ServerCog },
        { id: Page.COMPUTING_FLINK_SQL, label: t('nav.flinkSQL'), icon: Code2 },
        { id: Page.COMPUTING_TOPOLOGY, label: t('nav.topologyLineage'), icon: Workflow },
        { id: Page.COMPUTING_MONITOR, label: t('nav.pipelineMonitor'), icon: Gauge },
      ]
    },
    {
      id: 'query',
      label: t('nav.queryService'),
      icon: Database,
      subItems: [
        { id: Page.QUERY_WORKBENCH, label: t('nav.sqlWorkbench'), icon: Terminal },
        { id: Page.QUERY_REPORTS, label: t('nav.scheduledReports'), icon: CalendarClock },
        { id: Page.QUERY_API, label: t('nav.queryAsAPI'), icon: Webhook },
        { id: Page.QUERY_VIRTUAL_VIEWS, label: t('nav.virtualViews'), icon: Layers },
        { id: Page.QUERY_SNIPPETS, label: t('nav.snippetsLibrary'), icon: Scissors },
      ]
    },
    {
      id: 'metadata',
      label: t('nav.metadata'),
      icon: TableProperties,
      subItems: [
        { id: Page.METADATA_MAP, label: t('nav.dataMap'), icon: Map },
        { id: Page.METADATA_LIFECYCLE, label: t('nav.lifecycleMgmt'), icon: History },
        { id: Page.METADATA_SCHEMA, label: t('nav.dynamicSchema'), icon: GitBranch },
        { id: Page.METADATA_LINEAGE, label: t('nav.dataLineage'), icon: Workflow },
      ]
    },
    {
        id: 'operations',
        label: t('nav.operations'),
        icon: Activity,
        subItems: [
          { id: Page.OPERATIONS_CLUSTER, label: t('nav.clusterCore'), icon: Hexagon },
          { id: Page.OPERATIONS_NODES, label: t('nav.nodeMonitor'), icon: Server },
          { id: Page.OPERATIONS_DATA, label: t('nav.dataOps'), icon: HardDrive },
          { id: Page.OPERATIONS_LOGS, label: t('nav.logCenter'), icon: FileText },
          { id: Page.OPERATIONS_SLOW_QUERY, label: t('nav.slowQueryAnalysis'), icon: Turtle },
          { id: Page.OPERATIONS_TENANTS, label: t('nav.tenantsQuotas'), icon: Users },
          { id: Page.OPERATIONS_ALERTS, label: t('nav.alerting'), icon: Bell },
          { id: Page.OPERATIONS_BACKUP, label: t('nav.disasterRecovery'), icon: Archive },
        ]
    },
    {
      id: 'system',
      label: t('nav.system'),
      icon: Sliders,
      subItems: [
        { id: Page.SYSTEM_SETTINGS, label: t('nav.system'), icon: Sliders },
        { id: Page.SYSTEM_CONNECT, label: t('nav.connectSettings'), icon: Link2 },
        { id: Page.SYSTEM_NOTIFICATIONS, label: t('nav.notifications'), icon: Bell },
        { id: Page.SYSTEM_SECURITY, label: t('nav.securitySettings'), icon: Shield },
      ]
    },
    { id: Page.ECOSYSTEM, label: 'Ecosystem', icon: Share2 },
    {
      id: 'settings-bottom',
      label: t('nav.settings'),
      icon: Settings,
      subItems: [
        { id: 'settings/profile', label: t('nav.profile'), icon: User },
        { id: 'settings/account', label: t('nav.account'), icon: Wrench },
        { id: 'settings/appearance', label: t('nav.appearance'), icon: Palette },
        { id: 'settings/notifications', label: t('nav.notifications'), icon: Bell },
        { id: 'settings/display', label: t('nav.display'), icon: Monitor },
      ]
    },
    {
      id: Page.HELP_CENTER,
      label: t('nav.helpCenter'),
      icon: HelpCircle
    }
  ];

  const renderMenuItem = (item: any) => {
    const isExpanded = expandedMenus.includes(item.id);
    const isParentActive = currentPath === item.id || (item.subItems && currentPath.startsWith(item.id));
    
    if (item.subItems) {
       return (
         <div key={item.id} className="relative group">
           <button
              onClick={() => toggleMenu(item.id)}
              onMouseEnter={(e) => handleMouseEnter(e, item.label)}
              onMouseLeave={handleMouseLeave}
              className={`w-full flex items-center rounded-lg transition-colors group/btn relative ${
                isOpen
                  ? 'justify-between px-3 py-2.5'
                  : 'justify-center p-2.5'
              } ${
                isParentActive
                  ? 'text-blue-500 dark:text-blue-400'
                  : (isDark
                      ? 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')
              }`}
            >
              <div className="flex items-center">
                <item.icon className={`w-5 h-5 shrink-0 ${isOpen ? 'mr-3' : ''} ${isParentActive ? 'text-blue-500 dark:text-blue-400' : (isDark ? 'text-gray-500 group-hover/btn:text-gray-300' : 'text-gray-400 group-hover/btn:text-gray-600')}`} />
                {isOpen && <span className="font-medium whitespace-nowrap">{item.label}</span>}
              </div>
              {isOpen && (isExpanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />)}
            </button>
            
            {/* Submenu - Only visible when open */}
            {isOpen && isExpanded && (
              <div className={`ml-4 pl-4 border-l mt-1 space-y-1 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                {item.subItems.map((sub: any) => {
                  const isSubActive = currentPath === sub.id;
                  return (
                    <Link
                      key={sub.id}
                      to={`/${sub.id}`}
                      className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                        isSubActive
                          ? (isDark ? 'bg-blue-600/10 text-blue-400' : 'bg-blue-50 text-blue-600')
                          : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900')
                      }`}
                    >
                       <sub.icon className="w-4 h-4 mr-2 opacity-70 shrink-0" />
                       {sub.label}
                    </Link>
                  )
                })}
              </div>
            )}
         </div>
       );
    }

    return (
      <div key={item.id} className="relative group">
          <Link
            to={`/${item.id}`}
            onMouseEnter={(e) => handleMouseEnter(e, item.label)}
            onMouseLeave={handleMouseLeave}
            className={`flex items-center rounded-lg transition-colors group/link relative ${
                isOpen
                    ? 'px-3 py-2.5'
                    : 'justify-center p-2.5'
            } ${
              isParentActive
                ? (isDark ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20' : 'bg-blue-50 text-blue-600 border border-blue-200')
                : (isDark
                    ? 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100 border border-transparent'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-transparent')
            }`}
          >
            <item.icon
              className={`w-5 h-5 shrink-0 ${isOpen ? 'mr-3' : ''} transition-colors ${
                isParentActive ? 'text-blue-500 dark:text-blue-400' : (isDark ? 'text-gray-500 group-hover/link:text-gray-300' : 'text-gray-400 group-hover/link:text-gray-600')
              }`}
            />
            {isOpen && <span className="font-medium whitespace-nowrap">{item.label}</span>}
          </Link>
      </div>
    );
  };

  return (
    <>
      <aside
          className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-r flex flex-col shrink-0 transition-all duration-300 overflow-visible ${
              isOpen ? 'w-64' : 'w-16'
          }`}
      >
        <div className="flex flex-col h-full w-full overflow-hidden">
          {/* Header */}
          <div className={`h-16 flex items-center border-b shrink-0 transition-all duration-300 ${isDark ? 'border-gray-700' : 'border-gray-200'} ${isOpen ? 'px-6' : 'justify-center px-0'}`}>
            <Hexagon className="w-8 h-8 text-blue-500 shrink-0" />
            <span className={`text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-cyan-400 ml-3 whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>
              {platformName}
            </span>
          </div>

          {/* Main Nav Items */}
          <nav
            className="flex-1 py-4 px-2 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-hide"
            onScroll={() => setTooltip(null)}
          >
            {menuItems.map(renderMenuItem)}
          </nav>



          {/* Footer Profile Menu */}
          <div className={`p-4 border-t shrink-0 ${isDark ? 'border-gray-700' : 'border-gray-200'}`} ref={profileRef}>
            <div className="relative">
                {isProfileOpen && (
                    <div className={`absolute bottom-full left-0 mb-4 w-64 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 ${isDark ? 'bg-[#0F172A] border border-gray-700' : 'bg-white border border-gray-200'} ${!isOpen ? 'left-14 bottom-0' : ''}`}>
                       {/* Header */}
                       <div className={`p-4 border-b flex items-center gap-3 ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50/50'}`}>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center font-bold text-sm text-white shrink-0">
                                A
                            </div>
                            <div className="overflow-hidden">
                                <p className={`text-sm font-bold truncate ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Admin User</p>
                                <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>admin@tdengine.local</p>
                            </div>
                       </div>
                       
                       {/* Upgrade */}
                       <div className="p-2">
                           <button className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors group ${isDark ? 'text-gray-200 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-100'}`}>
                               <Sparkles className="w-4 h-4 text-yellow-400 group-hover:text-yellow-500" />
                               Upgrade to Pro
                           </button>
                       </div>
                       
                       <div className={`h-px mx-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                       
                       {/* Links */}
                       <div className="p-2 space-y-0.5">
                           <button className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                               <User className="w-4 h-4" /> Account
                           </button>
                           <button className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                               <CreditCard className="w-4 h-4" /> Billing
                           </button>
                           <button className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                               <Bell className="w-4 h-4" /> Notifications
                           </button>
                       </div>

                       <div className={`h-px mx-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

                       {/* Sign Out */}
                       <div className="p-2">
                           <button
                               onClick={handleLogout}
                               className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-red-400 hover:bg-red-900/10' : 'text-red-500 hover:bg-red-50'}`}
                           >
                               <LogOut className="w-4 h-4" /> Sign out
                           </button>
                       </div>
                    </div>
                )}

                <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className={`flex items-center w-full rounded-xl transition-all duration-200 group ${
                        isOpen
                        ? `px-3 py-2 ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'}`
                        : `justify-center p-2 ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'}`
                    } ${isProfileOpen ? (isDark ? 'bg-gray-700/50' : 'bg-gray-100') : ''}`}
                >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center font-bold text-xs shrink-0 text-white shadow-lg shadow-purple-900/20">
                      A
                    </div>
                    {isOpen && (
                        <div className="ml-3 text-left flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate transition-colors ${isDark ? 'text-gray-200 group-hover:text-white' : 'text-gray-700 group-hover:text-gray-900'}`}>Admin User</p>
                          <p className={`text-xs truncate ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>admin@tdengine.local</p>
                        </div>
                    )}
                    {isOpen && (
                        <ChevronsUpDown className={`w-4 h-4 transition-transform duration-200 ${isProfileOpen ? (isDark ? 'text-gray-300' : 'text-gray-600') : (isDark ? 'text-gray-500' : 'text-gray-400')}`} />
                    )}
                </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Fixed Tooltip Portal */}
      {tooltip && !isOpen && (
        <div
            className={`fixed z-[100] px-3 py-2 text-xs font-medium rounded-md shadow-xl animate-in fade-in zoom-in-95 duration-150 pointer-events-none ${isDark ? 'bg-[#0F172A] text-white border border-gray-700' : 'bg-white text-gray-700 border border-gray-200'}`}
            style={{
                left: '4.5rem', // 16 (4rem) width + margin
                top: tooltip.top,
                transform: 'translateY(-50%)'
            }}
        >
            {tooltip.text}
            {/* Arrow */}
            <div className={`absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 transform rotate-45 ${isDark ? 'bg-[#0F172A] border-l border-b border-gray-700' : 'bg-white border-l border-b border-gray-200'}`}></div>
        </div>
      )}
    </>
  );
};
