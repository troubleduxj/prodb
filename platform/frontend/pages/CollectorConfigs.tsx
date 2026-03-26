import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { FileText, Plus, Copy, Edit, Trash2, Check, Clock, Globe, Shield, X, Save, ChevronRight, Search, Filter, Tag, History, Box, Layers, GitBranch } from 'lucide-react';

interface InputSource {
  id: string;
  type: 'system_metrics' | 'opc_ua' | 'mqtt' | 'file_log';
  name: string;
  streamId: string; // The ID used for routing to pipelines
  config: Record<string, string>;
}

// 配置模板类型
interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  lastUpdated: string;
  appliedAgents: number;
  status: 'Active' | 'Draft' | 'Archived';
  inputs: InputSource[];
  // 新增模板管理字段
  templateType: 'standard' | 'custom';
  category: string;
  tags: string[];
  parentTemplateId?: string; // 继承自哪个模板
  versionHistory: TemplateVersion[];
  isLatest: boolean;
}

interface TemplateVersion {
  version: string;
  createdAt: string;
  changeLog: string;
  createdBy: string;
}

// 为了向后兼容，保留ConfigProfile作为别名
type ConfigProfile = ConfigTemplate;

interface Pipeline {
  id: string;
  name: string;
  description: string;
}

const MOCK_PIPELINES: Pipeline[] = [
  { id: 'pl_001', name: 'Pre-process MQTT Meters 1', description: 'Applied to: Factory A Gateway' },
  { id: 'pl_002', name: 'Pre-process MQTT Meters 2', description: 'Applied to: Factory B Gateway' },
  { id: 'pl_003', name: 'Log Sanitization', description: 'Remove sensitive data from logs' },
];

const MOCK_CONFIGS: ConfigTemplate[] = [
  {
    id: 'cfg_001',
    name: 'Default-Factory-Profile',
    description: 'Standard collection rules for factory gateways',
    version: 'v2.4',
    lastUpdated: '2025-05-10 14:30',
    appliedAgents: 145,
    status: 'Active',
    inputs: [
      { id: 'in_1', type: 'mqtt', name: 'Factory MQTT', streamId: 'mqtt_stream_factory_a', config: { topic: 'factory/#' } }
    ],
    templateType: 'standard',
    category: 'Factory',
    tags: ['mqtt', 'standard', 'factory'],
    versionHistory: [
      { version: 'v2.4', createdAt: '2025-05-10 14:30', changeLog: 'Added MQTT keepalive settings', createdBy: 'admin' },
      { version: 'v2.3', createdAt: '2025-04-15 10:20', changeLog: 'Optimized buffer size', createdBy: 'admin' },
      { version: 'v2.0', createdAt: '2025-03-01 09:00', changeLog: 'Initial stable release', createdBy: 'system' },
    ],
    isLatest: true
  },
  {
    id: 'cfg_002',
    name: 'High-Frequency-Sampling',
    description: '100ms sampling rate for critical machinery',
    version: 'v1.2',
    lastUpdated: '2025-05-08 09:15',
    appliedAgents: 12,
    status: 'Active',
    inputs: [
      { id: 'in_2', type: 'opc_ua', name: 'PLC Data', streamId: 'opc_plc_01', config: { endpoint: 'opc.tcp://192.168.1.10:4840' } }
    ],
    templateType: 'custom',
    category: 'High-Performance',
    tags: ['opcua', 'high-frequency', 'critical'],
    parentTemplateId: 'cfg_001',
    versionHistory: [
      { version: 'v1.2', createdAt: '2025-05-08 09:15', changeLog: 'Reduced sampling interval to 100ms', createdBy: 'engineer' },
      { version: 'v1.0', createdAt: '2025-04-01 11:00', changeLog: 'Initial version', createdBy: 'engineer' },
    ],
    isLatest: true
  },
  {
    id: 'cfg_003',
    name: 'Debug-Logging-Profile',
    description: 'Verbose logging enabled for troubleshooting',
    version: 'v0.9',
    lastUpdated: '2025-05-11 11:20',
    appliedAgents: 3,
    status: 'Draft',
    inputs: [],
    templateType: 'custom',
    category: 'Debug',
    tags: ['debug', 'logging', 'verbose'],
    versionHistory: [
      { version: 'v0.9', createdAt: '2025-05-11 11:20', changeLog: 'Draft version for testing', createdBy: 'developer' },
    ],
    isLatest: true
  },
  {
    id: 'cfg_004',
    name: 'Legacy-Protocol-Support',
    description: 'Includes Modbus RTU and OPC DA adapters',
    version: 'v3.1',
    lastUpdated: '2025-04-20 16:45',
    appliedAgents: 28,
    status: 'Active',
    inputs: [
      { id: 'in_3', type: 'system_metrics', name: 'Server Health', streamId: 'sys_metrics_01', config: { interval: '10s' } }
    ],
    templateType: 'standard',
    category: 'Legacy',
    tags: ['modbus', 'legacy', 'system'],
    versionHistory: [
      { version: 'v3.1', createdAt: '2025-04-20 16:45', changeLog: 'Added system metrics support', createdBy: 'admin' },
      { version: 'v3.0', createdAt: '2025-03-15 14:00', changeLog: 'Major protocol update', createdBy: 'admin' },
    ],
    isLatest: true
  },
];

// 模板分类列表
const TEMPLATE_CATEGORIES = ['All', 'Factory', 'High-Performance', 'Debug', 'Legacy', 'Custom'];

export const CollectorConfigs: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  
  const [configs, setConfigs] = useState<ConfigTemplate[]>(MOCK_CONFIGS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ConfigTemplate | null>(null);
  const [viewingConfig, setViewingConfig] = useState<ConfigTemplate | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showVersionHistory, setShowVersionHistory] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<ConfigTemplate>>({
    name: '',
    description: '',
    status: 'Draft',
    inputs: [],
    templateType: 'custom',
    category: 'Custom',
    tags: [],
    versionHistory: []
  });

  // 过滤配置
  const filteredConfigs = configs.filter(config =>
    selectedCategory === 'All' || config.category === selectedCategory
  );

  const handleOpenModal = (config?: ConfigProfile) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        name: config.name,
        description: config.description,
        status: config.status,
        inputs: config.inputs ? [...config.inputs] : []
      });
    } else {
      setEditingConfig(null);
      setFormData({
        name: '',
        description: '',
        status: 'Draft',
        inputs: []
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (editingConfig) {
      // Update existing - 创建新版本
      const newVersion = incrementVersion(editingConfig.version);
      const updatedConfig: ConfigTemplate = {
        ...editingConfig,
        ...formData as ConfigTemplate,
        version: newVersion,
        lastUpdated: new Date().toLocaleString(),
        versionHistory: [
          {
            version: newVersion,
            createdAt: new Date().toLocaleString(),
            changeLog: `Updated to ${newVersion}`,
            createdBy: 'current_user'
          },
          ...editingConfig.versionHistory
        ]
      };
      setConfigs(prev => prev.map(c => c.id === editingConfig.id ? updatedConfig : c));
    } else {
      // Create new
      const newConfig: ConfigTemplate = {
        id: `cfg_${Date.now()}`,
        name: formData.name || 'New Configuration',
        description: formData.description || '',
        version: 'v1.0',
        lastUpdated: new Date().toLocaleString(),
        appliedAgents: 0,
        status: formData.status as 'Active' | 'Draft' | 'Archived',
        inputs: formData.inputs || [],
        templateType: 'custom',
        category: formData.category || 'Custom',
        tags: formData.tags || [],
        versionHistory: [
          { version: 'v1.0', createdAt: new Date().toLocaleString(), changeLog: 'Initial version', createdBy: 'current_user' }
        ],
        isLatest: true
      };
      setConfigs(prev => [...prev, newConfig]);
    }
    setIsModalOpen(false);
  };

  // 版本号递增
  const incrementVersion = (version: string): string => {
    const match = version.match(/v(\d+)\.(\d+)/);
    if (match) {
      const major = parseInt(match[1]);
      const minor = parseInt(match[2]);
      return `v${major}.${minor + 1}`;
    }
    return 'v1.0';
  };

  // 复制模板
  const handleDuplicate = (config: ConfigTemplate) => {
    const newConfig: ConfigTemplate = {
      ...config,
      id: `cfg_${Date.now()}`,
      name: `${config.name} (Copy)`,
      version: 'v1.0',
      lastUpdated: new Date().toLocaleString(),
      appliedAgents: 0,
      status: 'Draft',
      templateType: 'custom',
      parentTemplateId: config.id,
      versionHistory: [
        { version: 'v1.0', createdAt: new Date().toLocaleString(), changeLog: `Copied from ${config.name} ${config.version}`, createdBy: 'current_user' }
      ]
    };
    setConfigs(prev => [...prev, newConfig]);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('collector.configs.confirmDelete', 'Are you sure you want to delete this configuration?'))) {
      setConfigs(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleViewDetails = (config: ConfigProfile) => {
    setViewingConfig(config);
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            {t('collector.configs.configTemplates', 'Configuration Templates')}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {t('collector.configs.manageTemplatesDesc', 'Manage reusable configuration templates with versioning and inheritance.')}
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
        >
          <Plus className="w-4 h-4" /> {t('collector.configs.createTemplate', 'Create Template')}
        </button>
      </div>

      {/* 分类过滤器 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Layers className="w-4 h-4 text-gray-400" />
        {TEMPLATE_CATEGORIES.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              selectedCategory === category
                ? 'bg-blue-500 text-white'
                : isDark
                  ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredConfigs.map(config => (
          <div key={config.id} className={`rounded-xl p-6 hover:border-blue-500/30 transition-all group flex flex-col ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-lg transition-colors ${isDark ? 'bg-gray-700/50 text-blue-400 group-hover:bg-blue-500/10 group-hover:text-blue-300' : 'bg-gray-100 text-blue-500 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                <Box className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-2">
                {/* 模板类型标签 */}
                <span className={`px-2 py-1 rounded text-xs font-medium border ${
                  config.templateType === 'standard'
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                }`}>
                  {config.templateType === 'standard' ? t('collector.configs.standard', 'Standard') : t('collector.configs.custom', 'Custom')}
                </span>
                <div className={`px-2 py-1 rounded text-xs font-medium border ${
                  config.status === 'Active' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                  config.status === 'Draft' ? (isDark ? 'bg-gray-700 text-gray-400 border-gray-600' : 'bg-gray-200 text-gray-700 border-gray-300') :
                  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                }`}>
                  {config.status}
                </div>
              </div>
            </div>

            <h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{config.name}</h3>
            <p className={`text-sm mb-3 h-10 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{config.description}</p>

            {/* 标签 */}
            {config.tags && config.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {config.tags.slice(0, 3).map((tag, idx) => (
                  <span key={idx} className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
                {config.tags.length > 3 && (
                  <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                    +{config.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            <div className="space-y-2 mb-4 flex-1">
              <div className="flex justify-between text-sm">
                <span className={isDark ? 'text-gray-500' : 'text-gray-600'}>{t('common.version', 'Version')}</span>
                <span className={`font-mono ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{config.version}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={isDark ? 'text-gray-500' : 'text-gray-600'}>{t('collector.configs.category', 'Category')}</span>
                <span className={isDark ? 'text-gray-200' : 'text-gray-900'}>{config.category}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={isDark ? 'text-gray-500' : 'text-gray-600'}>{t('collector.configs.appliedAgents', 'Applied Agents')}</span>
                <span className="text-blue-400 font-medium">{config.appliedAgents}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={isDark ? 'text-gray-500' : 'text-gray-600'}>{t('collector.configs.dataInputs', 'Data Inputs')}</span>
                <span className="text-purple-400 font-medium">{config.inputs?.length || 0} {t('common.sources', 'Sources')}</span>
              </div>
            </div>

            {/* 版本历史指示器 */}
            {config.versionHistory && config.versionHistory.length > 1 && (
              <div className={`mb-3 px-3 py-2 rounded-lg text-xs ${isDark ? 'bg-gray-900/50 text-gray-400' : 'bg-gray-50 text-gray-600'}`}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <History className="w-3 h-3" />
                    {config.versionHistory.length} {t('collector.configs.versions', 'versions')}
                  </span>
                  <button
                    onClick={() => setShowVersionHistory(showVersionHistory === config.id ? null : config.id)}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    {showVersionHistory === config.id ? t('common.hide', 'Hide') : t('common.view', 'View')}
                  </button>
                </div>
                {showVersionHistory === config.id && (
                  <div className="mt-2 space-y-1 border-t border-gray-700/50 pt-2">
                    {config.versionHistory.slice(0, 3).map((v, idx) => (
                      <div key={idx} className="flex justify-between text-[10px]">
                        <span className="font-mono">{v.version}</span>
                        <span className="truncate max-w-[150px]">{v.changeLog}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 继承关系指示 */}
            {config.parentTemplateId && (
              <div className={`mb-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${isDark ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                <GitBranch className="w-3 h-3" />
                <span>{t('collector.configs.inheritsFrom', 'Inherits from')} {configs.find(c => c.id === config.parentTemplateId)?.name || config.parentTemplateId}</span>
              </div>
            )}

            <div className={`pt-4 border-t flex justify-between items-center ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenModal(config)}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-900'}`}
                  title={t('common.edit', 'Edit')}
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDuplicate(config)}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-900'}`}
                  title={t('common.duplicate', 'Duplicate')}
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(config.id)}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-red-400' : 'hover:bg-gray-200 text-gray-500 hover:text-red-500'}`}
                  title={t('common.delete', 'Delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => handleViewDetails(config)}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center"
              >
                {t('common.viewDetails', 'View Details')} <ChevronRight className="w-3 h-3 ml-1" />
              </button>
            </div>
          </div>
        ))}

        {/* New Config Placeholder */}
        <div 
          onClick={() => handleOpenModal()}
          className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer min-h-[300px] ${isDark ? 'border-gray-700 text-gray-500 hover:border-blue-500 hover:text-blue-400' : 'border-gray-300 text-gray-500 hover:border-blue-500 hover:text-blue-500'}`}
        >
          <div className={`p-4 rounded-full mb-3 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <Plus className="w-8 h-8" />
          </div>
          <p className="font-medium">{t('collector.configs.createNewProfile', 'Create New Profile')}</p>
          <p className={`text-xs mt-1 text-center max-w-[200px] ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>{t('collector.configs.startFromScratch', 'Start from scratch or import from existing template')}</p>
        </div>
      </div>

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className={`rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
            <div className={`p-5 border-b flex justify-between items-center ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h2 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                {editingConfig ? t('collector.configs.editConfiguration', 'Edit Configuration') : t('collector.configs.createConfiguration', 'Create Configuration')}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('collector.configs.configurationName', 'Configuration Name')}</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 ${isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                  placeholder={t('collector.configs.e.g.FactoryGatewayProfile', 'e.g., Factory-Gateway-Profile')}
                />
              </div>
              
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('common.description', 'Description')}</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 min-h-[80px] ${isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                  placeholder={t('collector.configs.describePurpose', 'Describe the purpose of this configuration...')}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('common.status', 'Status')}</label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                  className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 ${isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                >
                  <option value="Draft">{t('common.draft', 'Draft')}</option>
                  <option value="Active">{t('common.active', 'Active')}</option>
                  <option value="Archived">{t('common.archived', 'Archived')}</option>
                </select>
              </div>

              <div className={`pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                 <div className="flex justify-between items-center mb-3">
                    <label className={`block text-sm font-bold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{t('collector.configs.dataInputsRouting', 'Data Inputs & Routing')}</label>
                    <button 
                      onClick={() => {
                        const newInput: InputSource = {
                          id: `in_${Date.now()}`,
                          type: 'system_metrics',
                          name: 'New Input',
                          streamId: `stream_${Date.now()}`,
                          config: {}
                        };
                        setFormData({ ...formData, inputs: [...(formData.inputs || []), newInput] });
                      }}
                      className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> {t('common.addInput', 'Add Input')}
                    </button>
                 </div>
                 <p className={`text-xs mb-3 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('collector.configs.defineMultipleDataSources', 'Define multiple data collection sources. Each source generates a stream ID that can be routed to specific pipelines.')}</p>
                 
                 <div className="space-y-3">
                    {formData.inputs?.map((input, index) => (
                      <div key={input.id} className={`rounded-lg p-3 ${isDark ? 'bg-gray-900/50 border-gray-700 border' : 'bg-gray-50 border-gray-200 border'}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                             <span className={`text-xs px-1.5 py-0.5 rounded border ${isDark ? 'bg-gray-800 text-gray-400 border-gray-700' : 'bg-gray-200 text-gray-700 border-gray-300'}`}>#{index + 1}</span>
                             <input 
                               type="text" 
                               value={input.name}
                               onChange={(e) => {
                                 const newInputs = [...(formData.inputs || [])];
                                 newInputs[index].name = e.target.value;
                                 setFormData({ ...formData, inputs: newInputs });
                               }}
                               className={`bg-transparent border-b border-transparent hover:border-gray-600 focus:border-blue-500 text-sm font-medium outline-none w-32 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}
                             />
                          </div>
                          <button 
                            onClick={() => {
                              const newInputs = formData.inputs?.filter((_, i) => i !== index);
                              setFormData({ ...formData, inputs: newInputs });
                            }}
                            className={isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-500 hover:text-red-500'}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className={`block text-[10px] uppercase mb-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('collector.configs.inputType', 'Input Type')}</label>
                            <select 
                              value={input.type}
                              onChange={(e) => {
                                const newInputs = [...(formData.inputs || [])];
                                newInputs[index].type = e.target.value as any;
                                setFormData({ ...formData, inputs: newInputs });
                              }}
                              className={`w-full border rounded px-2 py-1.5 text-xs outline-none ${isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                            >
                              <option value="system_metrics">{t('collector.configs.systemMetrics', 'System Metrics')}</option>
                              <option value="opc_ua">{t('collector.configs.opcUA', 'OPC UA')}</option>
                              <option value="mqtt">{t('collector.configs.mqtt', 'MQTT')}</option>
                              <option value="file_log">{t('collector.configs.fileLog', 'File Log')}</option>
                            </select>
                          </div>
                          <div>
                            <label className={`block text-[10px] uppercase mb-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('collector.configs.targetStreamID', 'Target Stream ID')}</label>
                            <div className={`flex items-center rounded px-2 py-1.5 ${isDark ? 'bg-gray-800 border-gray-600 border' : 'bg-white border-gray-300 border'}`}>
                              <span className={`text-xs font-mono truncate ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{input.streamId}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Dynamic Config based on Type */}
                        <div className={`rounded p-2 border ${isDark ? 'bg-gray-950/50 border-gray-800' : 'bg-gray-100 border-gray-200'}`}>
                          {input.type === 'opc_ua' && (
                             <div>
                               <label className={`block text-[10px] mb-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('collector.configs.endpointURL', 'Endpoint URL')}</label>
                               <input 
                                 type="text" 
                                 value={input.config.endpoint || ''}
                                 onChange={(e) => {
                                   const newInputs = [...(formData.inputs || [])];
                                   newInputs[index].config = { ...newInputs[index].config, endpoint: e.target.value };
                                   setFormData({ ...formData, inputs: newInputs });
                                 }}
                                 placeholder="opc.tcp://localhost:4840"
                                 className={`w-full border rounded px-2 py-1 text-xs outline-none ${isDark ? 'bg-gray-900 border-gray-700 text-gray-300' : 'bg-white border-gray-300 text-gray-900'}`}
                               />
                             </div>
                          )}
                          {input.type === 'mqtt' && (
                             <div>
                               <label className={`block text-[10px] mb-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('collector.configs.topicSubscription', 'Topic Subscription')}</label>
                               <input 
                                 type="text" 
                                 value={input.config.topic || ''}
                                 onChange={(e) => {
                                   const newInputs = [...(formData.inputs || [])];
                                   newInputs[index].config = { ...newInputs[index].config, topic: e.target.value };
                                   setFormData({ ...formData, inputs: newInputs });
                                 }}
                                 placeholder="factory/line1/#"
                                 className={`w-full border rounded px-2 py-1 text-xs outline-none ${isDark ? 'bg-gray-900 border-gray-700 text-gray-300' : 'bg-white border-gray-300 text-gray-900'}`}
                               />
                             </div>
                          )}
                          {input.type === 'system_metrics' && (
                             <div>
                               <label className={`block text-[10px] mb-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('collector.configs.collectionInterval', 'Collection Interval')}</label>
                               <input 
                                 type="text" 
                                 value={input.config.interval || ''}
                                 onChange={(e) => {
                                   const newInputs = [...(formData.inputs || [])];
                                   newInputs[index].config = { ...newInputs[index].config, interval: e.target.value };
                                   setFormData({ ...formData, inputs: newInputs });
                                 }}
                                 placeholder="10s"
                                 className={`w-full border rounded px-2 py-1 text-xs outline-none ${isDark ? 'bg-gray-900 border-gray-700 text-gray-300' : 'bg-white border-gray-300 text-gray-900'}`}
                               />
                             </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {(!formData.inputs || formData.inputs.length === 0) && (
                      <div className={`text-center py-6 border-2 border-dashed rounded-lg text-xs ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-300 text-gray-500'}`}>
                        {t('collector.configs.noInputsDefined', 'No inputs defined. Click "Add Input" to configure data collection.')}
                      </div>
                    )}
                 </div>
              </div>
            </div>

            <div className={`p-5 border-t flex justify-end gap-3 rounded-b-xl ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
              <button onClick={() => setIsModalOpen(false)} className={`px-4 py-2 text-sm ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}>{t('common.cancel', 'Cancel')}</button>
              <button 
                onClick={handleSave}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-900/20 flex items-center"
              >
                <Save className="w-4 h-4 mr-2" /> {t('collector.configs.saveConfiguration', 'Save Configuration')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewingConfig && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className={`rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
                  <div className={`p-5 border-b flex justify-between items-center rounded-t-xl ${isDark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}`}>
                      <div>
                          <h2 className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{viewingConfig.name}</h2>
                          <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{viewingConfig.id}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                                viewingConfig.status === 'Active' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                viewingConfig.status === 'Draft' ? (isDark ? 'bg-gray-700 text-gray-400 border-gray-600' : 'bg-gray-200 text-gray-700 border-gray-300') :
                                'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                              }`}>
                                {viewingConfig.status}
                              </span>
                          </div>
                      </div>
                      <button onClick={() => setViewingConfig(null)} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}><X className="w-6 h-6"/></button>
                  </div>

                  <div className="p-6 overflow-y-auto space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                          <div>
                              <h3 className={`text-sm font-bold mb-3 uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('common.metadata', 'Metadata')}</h3>
                              <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-900/30 border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                                  <div className="flex justify-between">
                                      <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('common.version', 'Version')}</span>
                                      <span className={`text-sm font-mono ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{viewingConfig.version}</span>
                                  </div>
                                  <div className="flex justify-between">
                                      <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('common.lastUpdated', 'Last Updated')}</span>
                                      <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{viewingConfig.lastUpdated}</span>
                                  </div>
                                  <div className="flex justify-between">
                                      <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('collector.configs.appliedAgents', 'Applied Agents')}</span>
                                      <span className="text-sm text-blue-400 font-bold">{viewingConfig.appliedAgents}</span>
                                  </div>
                              </div>
                          </div>
                          <div>
                              <h3 className={`text-sm font-bold mb-3 uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('common.description', 'Description')}</h3>
                              <div className={`p-4 rounded-lg border h-full ${isDark ? 'bg-gray-900/30 border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                                  <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{viewingConfig.description || t('common.noDescriptionProvided', 'No description provided.')}</p>
                              </div>
                          </div>
                      </div>

                      <div>
                          <h3 className={`text-sm font-bold mb-3 uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              <Filter className="w-4 h-4" /> {t('collector.configs.dataInputsRouting', 'Data Inputs & Routing')}
                          </h3>
                          <div className="space-y-3">
                            {viewingConfig.inputs?.map((input, idx) => (
                              <div key={input.id} className={`rounded-lg p-4 ${isDark ? 'bg-gray-900/30 border-gray-700/50 border' : 'bg-gray-50 border-gray-200 border'}`}>
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      input.type === 'system_metrics' ? 'bg-purple-900/30 text-purple-400 border border-purple-500/30' :
                                      input.type === 'opc_ua' ? 'bg-blue-900/30 text-blue-400 border border-blue-500/30' :
                                      'bg-green-900/30 text-green-400 border border-green-500/30'
                                    }`}>
                                      {input.type.replace('_', ' ')}
                                    </span>
                                    <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{input.name}</span>
                                  </div>
                                  <span className={`text-xs font-mono px-2 py-1 rounded ${isDark ? 'text-gray-500 bg-gray-800' : 'text-gray-600 bg-gray-200'}`}>ID: {input.id}</span>
                                </div>
                                
                                <div className={`flex items-center gap-2 text-xs mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                  <span>{t('collector.configs.routesToStream', 'Routes to Stream')}:</span>
                                  <span className="text-blue-400 font-mono bg-blue-900/10 px-1.5 py-0.5 rounded border border-blue-500/20">{input.streamId}</span>
                                </div>

                                {/* Show linked pipeline if stream matches */}
                                {(() => {
                                  const linkedPipeline = MOCK_PIPELINES.find(p => p.description.includes(input.streamId) || p.name.toLowerCase().includes(input.type.split('_')[0]));
                                  return linkedPipeline ? (
                                    <div className={`mt-2 pt-2 border-t flex items-center gap-2 ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                                      <Globe className={`w-3 h-3 ${isDark ? 'text-gray-500' : 'text-gray-500'}`} />
                                      <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('collector.configs.processedBy', 'Processed by')}:</span>
                                      <span className="text-xs text-blue-300 underline cursor-pointer">{linkedPipeline.name}</span>
                                    </div>
                                  ) : (
                                    <div className={`mt-2 pt-2 border-t flex items-center gap-2 ${isDark ? 'border-gray-700/50' : 'border-gray-200'}`}>
                                      <Globe className={`w-3 h-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                                      <span className={`text-xs italic ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>{t('collector.configs.noMatchingPipeline', 'No matching pipeline found for stream')} {input.streamId}</span>
                                    </div>
                                  );
                                })()}
                              </div>
                            ))}
                            {(!viewingConfig.inputs || viewingConfig.inputs.length === 0) && (
                              <div className={`text-center py-4 text-sm italic ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('collector.configs.noInputsConfigured', 'No inputs configured.')}</div>
                            )}
                          </div>
                      </div>
                      
                      <div>
                          <h3 className={`text-sm font-bold mb-3 uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              <Shield className="w-4 h-4" /> {t('collector.configs.associatedAgents', 'Associated Agents')}
                          </h3>
                          <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-900/30 border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                              {viewingConfig.appliedAgents > 0 ? (
                                  <div className="space-y-2">
                                      <div className={`flex items-center justify-between p-2 rounded border hover:border-blue-500/30 transition-colors ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}>
                                          <div className="flex items-center gap-3">
                                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                              <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Factory-Gateway-01</span>
                                          </div>
                                          <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>192.168.1.101</span>
                                      </div>
                                      <div className={`flex items-center justify-between p-2 rounded border hover:border-blue-500/30 transition-colors ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}>
                                          <div className="flex items-center gap-3">
                                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                              <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>Factory-Gateway-02</span>
                                          </div>
                                          <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>192.168.1.102</span>
                                      </div>
                                      {viewingConfig.appliedAgents > 2 && (
                                          <div className="text-center pt-2 text-xs text-blue-400 hover:text-blue-300 cursor-pointer">
                                              + {viewingConfig.appliedAgents - 2} {t('collector.configs.moreAgents', 'more agents...')}
                                          </div>
                                      )}
                                  </div>
                              ) : (
                                  <div className={`text-center py-4 text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                      {t('collector.configs.noAgentsUsing', 'No agents currently using this configuration.')}
                                  </div>
                              )}
                          </div>
                      </div>
                      
                      <div>
                          <h3 className={`text-sm font-bold mb-3 uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('collector.configs.rawConfigurationPreview', 'Raw Configuration Preview')}</h3>
                          <div className={`p-4 rounded-lg border font-mono text-xs overflow-x-auto ${isDark ? 'bg-[#0d1117] border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                              <pre>{JSON.stringify({
                                  profile_id: viewingConfig.id,
                                  version: viewingConfig.version,
                                  inputs: viewingConfig.inputs?.map(i => ({
                                    type: i.type,
                                    stream_id: i.streamId,
                                    config: i.config
                                  })),
                                  settings: {
                                      batch_size: 1000,
                                      flush_interval_ms: 500,
                                      compression: 'gzip'
                                  }
                              }, null, 2)}</pre>
                          </div>
                      </div>
                  </div>
                  
                  <div className={`p-5 border-t flex justify-end rounded-b-xl ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
                      <button 
                          onClick={() => setViewingConfig(null)} 
                          className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
                      >
                          {t('common.close', 'Close')}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
