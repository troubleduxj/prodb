import React, { useState } from 'react';
import { useTheme } from '../src/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { 
  GitBranch, Clock, ShieldAlert, Check, X, RotateCcw, 
  History, ChevronDown, ChevronUp, ArrowRightLeft, Plus, Minus,
  Database, AlertCircle, FileCode, Layers, GitCompare
} from 'lucide-react';

// Schema变更日志
const SCHEMA_LOGS = [
  { id: 1, table: 'meters', type: 'ADD COLUMN', detail: 'harmonic_factor (FLOAT)', user: 'system (SML)', time: '10 mins ago', status: 'Pending', version: 'v2.1.4' },
  { id: 2, table: 'vehicles', type: 'MODIFY TYPE', detail: 'speed_kmh (INT -> FLOAT)', user: 'admin', time: '2 hours ago', status: 'Applied', version: 'v2.1.3' },
  { id: 3, table: 'sensors', type: 'ADD TAG', detail: 'installation_date (TIMESTAMP)', user: 'admin', time: '1 day ago', status: 'Applied', version: 'v2.1.2' },
  { id: 4, table: 'meters', type: 'DROP COLUMN', detail: 'legacy_field (VARCHAR)', user: 'admin', time: '2 days ago', status: 'Applied', version: 'v2.1.1' },
];

// Schema版本历史
const SCHEMA_VERSIONS = [
  { 
    version: 'v2.1.4', 
    date: '2024-01-15 14:30:00', 
    author: 'system', 
    changes: ['Add harmonic_factor column to meters', 'Update index on timestamp'],
    stats: { added: 1, modified: 0, deleted: 0 }
  },
  { 
    version: 'v2.1.3', 
    date: '2024-01-15 12:00:00', 
    author: 'admin', 
    changes: ['Change speed_kmh type from INT to FLOAT'],
    stats: { added: 0, modified: 1, deleted: 0 }
  },
  { 
    version: 'v2.1.2', 
    date: '2024-01-14 09:30:00', 
    author: 'admin', 
    changes: ['Add installation_date tag to sensors'],
    stats: { added: 1, modified: 0, deleted: 0 }
  },
  { 
    version: 'v2.1.1', 
    date: '2024-01-13 16:45:00', 
    author: 'admin', 
    changes: ['Remove legacy_field from meters', 'Optimize table partition'],
    stats: { added: 0, modified: 1, deleted: 1 }
  },
  { 
    version: 'v2.1.0', 
    date: '2024-01-10 10:00:00', 
    author: 'system', 
    changes: ['Initial schema setup', 'Create base tables'],
    stats: { added: 15, modified: 0, deleted: 0 }
  },
];

// 模拟版本对比数据
const VERSION_COMPARISON = {
  from: 'v2.1.2',
  to: 'v2.1.4',
  additions: [
    { table: 'meters', column: 'harmonic_factor', type: 'FLOAT', nullable: true },
    { table: 'meters', column: 'power_quality_index', type: 'INT', nullable: true },
  ],
  modifications: [
    { table: 'vehicles', column: 'speed_kmh', fromType: 'INT', toType: 'FLOAT' },
  ],
  deletions: [
    { table: 'meters', column: 'legacy_field', type: 'VARCHAR(50)' },
  ]
};

interface SchemaVersion {
  version: string;
  date: string;
  author: string;
  changes: string[];
  stats: { added: number; modified: number; deleted: number };
}

export const MetadataSchema: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';
  
  const [selectedVersions, setSelectedVersions] = useState<string[]>(['v2.1.2', 'v2.1.4']);
  const [showVersionHistory, setShowVersionHistory] = useState(true);
  const [showComparison, setShowComparison] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<number[]>([1]);

  const toggleLogExpansion = (id: number) => {
    setExpandedLogs(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleVersionSelect = (version: string) => {
    setSelectedVersions(prev => {
      if (prev.includes(version)) {
        return prev.filter(v => v !== version);
      }
      if (prev.length >= 2) {
        return [prev[1], version];
      }
      return [...prev, version];
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            {t('metadata.schema.dynamicSchemaEvolution', 'Dynamic Schema Evolution')}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {t('metadata.schema.manageVersionControl', 'Manage version control and auto-schema policies with detailed change tracking.')}
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowComparison(!showComparison)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showComparison 
                ? 'bg-blue-600 text-white' 
                : isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <GitCompare className="w-4 h-4" />
            {t('metadata.schema.compareVersions', 'Compare Versions')}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
              <Database className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('metadata.schema.totalTables', 'Total Tables')}</p>
              <p className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>24</p>
            </div>
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDark ? 'bg-green-500/10' : 'bg-green-50'}`}>
              <Layers className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('metadata.schema.currentVersion', 'Current Version')}</p>
              <p className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>v2.1.4</p>
            </div>
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('metadata.schema.pendingChanges', 'Pending Changes')}</p>
              <p className={`text-xl font-bold text-yellow-500`}>1</p>
            </div>
          </div>
        </div>
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
              <FileCode className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('metadata.schema.totalVersions', 'Total Versions')}</p>
              <p className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>28</p>
            </div>
          </div>
        </div>
      </div>

      {/* Version Comparison Panel */}
      {showComparison && (
        <div className={`rounded-xl border p-6 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold flex items-center ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              <ArrowRightLeft className="w-5 h-5 mr-2 text-blue-400" />
              {t('metadata.schema.versionComparison', 'Version Comparison')}
            </h3>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('metadata.schema.selectTwoVersions', 'Select 2 versions to compare:')}
              </span>
            </div>
          </div>

          {/* Version Selection */}
          <div className="flex flex-wrap gap-2 mb-6">
            {SCHEMA_VERSIONS.map((v) => (
              <button
                key={v.version}
                onClick={() => handleVersionSelect(v.version)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedVersions.includes(v.version)
                    ? 'bg-blue-600 text-white'
                    : isDark 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {v.version}
              </button>
            ))}
          </div>

          {/* Comparison Result */}
          {selectedVersions.length === 2 && (
            <div className={`rounded-lg border ${isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
              <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className={`font-mono font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{selectedVersions[0]}</span>
                    <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                    <span className={`font-mono font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{selectedVersions[1]}</span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="flex items-center gap-1 text-green-500">
                      <Plus className="w-4 h-4" /> {VERSION_COMPARISON.additions.length} additions
                    </span>
                    <span className="flex items-center gap-1 text-yellow-500">
                      <RotateCcw className="w-4 h-4" /> {VERSION_COMPARISON.modifications.length} modifications
                    </span>
                    <span className="flex items-center gap-1 text-red-500">
                      <Minus className="w-4 h-4" /> {VERSION_COMPARISON.deletions.length} deletions
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Additions */}
                {VERSION_COMPARISON.additions.length > 0 && (
                  <div>
                    <h4 className={`text-sm font-medium mb-2 flex items-center gap-2 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                      <Plus className="w-4 h-4" /> Additions
                    </h4>
                    <div className="space-y-1">
                      {VERSION_COMPARISON.additions.map((add, idx) => (
                        <div key={idx} className={`p-2 rounded text-sm ${isDark ? 'bg-green-500/10' : 'bg-green-50'}`}>
                          <code className={isDark ? 'text-green-300' : 'text-green-700'}>
                            {add.table}.{add.column} ({add.type})
                          </code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Modifications */}
                {VERSION_COMPARISON.modifications.length > 0 && (
                  <div>
                    <h4 className={`text-sm font-medium mb-2 flex items-center gap-2 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                      <RotateCcw className="w-4 h-4" /> Modifications
                    </h4>
                    <div className="space-y-1">
                      {VERSION_COMPARISON.modifications.map((mod, idx) => (
                        <div key={idx} className={`p-2 rounded text-sm ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
                          <code className={isDark ? 'text-yellow-300' : 'text-yellow-700'}>
                            {mod.table}.{mod.column}: {mod.fromType} → {mod.toType}
                          </code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Deletions */}
                {VERSION_COMPARISON.deletions.length > 0 && (
                  <div>
                    <h4 className={`text-sm font-medium mb-2 flex items-center gap-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                      <Minus className="w-4 h-4" /> Deletions
                    </h4>
                    <div className="space-y-1">
                      {VERSION_COMPARISON.deletions.map((del, idx) => (
                        <div key={idx} className={`p-2 rounded text-sm ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                          <code className={`line-through ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                            {del.table}.{del.column} ({del.type})
                          </code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Policy Config */}
        <div className="lg:col-span-1 space-y-6">
          <div className={`rounded-xl border p-6 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-semibold mb-4 flex items-center ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              <ShieldAlert className="w-5 h-5 mr-2 text-blue-400" />
              {t('metadata.schema.evolutionPolicy', 'Evolution Policy')}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Schemaless Write (SML)</p>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Auto-create metrics on ingestion</p>
                </div>
                <div className="w-11 h-6 bg-blue-600 rounded-full relative cursor-pointer">
                  <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm"></div>
                </div>
              </div>
              <hr className={isDark ? 'border-gray-700' : 'border-gray-200'} />
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Require Approval</p>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>New columns enter 'Pending' state</p>
                </div>
                <div className={`w-11 h-6 rounded-full relative cursor-pointer ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}>
                  <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm"></div>
                </div>
              </div>
              <hr className={isDark ? 'border-gray-700' : 'border-gray-200'} />
              <div>
                <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Type Conflict Resolution</p>
                <select className={`w-full border rounded text-sm p-2 ${isDark ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-700'}`}>
                  <option>Reject Write</option>
                  <option>Try Cast / Convert</option>
                  <option>Save to Dead Letter Queue</option>
                </select>
              </div>
            </div>
          </div>

          {/* Version History */}
          <div className={`rounded-xl border p-6 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowVersionHistory(!showVersionHistory)}
            >
              <h3 className={`text-lg font-semibold flex items-center ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                <History className="w-5 h-5 mr-2 text-purple-400" />
                {t('metadata.schema.versionHistory', 'Version History')}
              </h3>
              {showVersionHistory ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </div>
            
            {showVersionHistory && (
              <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
                {SCHEMA_VERSIONS.map((version, index) => (
                  <div 
                    key={version.version} 
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedVersions.includes(version.version)
                        ? isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'
                        : isDark ? 'bg-gray-900/50 border-gray-700 hover:bg-gray-700' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                    onClick={() => handleVersionSelect(version.version)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-mono font-bold text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                        {version.version}
                      </span>
                      {index === 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">
                          current
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {version.date} by {version.author}
                    </p>
                    <div className="flex gap-2 text-xs">
                      {version.stats.added > 0 && (
                        <span className="text-green-500">+{version.stats.added}</span>
                      )}
                      {version.stats.modified > 0 && (
                        <span className="text-yellow-500">~{version.stats.modified}</span>
                      )}
                      {version.stats.deleted > 0 && (
                        <span className="text-red-500">-{version.stats.deleted}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Change Log */}
        <div className="lg:col-span-2">
          <div className={`rounded-xl border p-6 h-full ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <h3 className={`text-lg font-semibold mb-4 flex items-center ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              <GitBranch className="w-5 h-5 mr-2 text-green-400" />
              {t('metadata.schema.schemaChangeLog', 'Schema Change Log')}
            </h3>
            <div className="space-y-4">
              {SCHEMA_LOGS.map(log => (
                <div 
                  key={log.id} 
                  className={`rounded-lg border transition-all ${isDark ? 'bg-gray-700/30 border-gray-700/50' : 'bg-gray-50 border-gray-200'} ${
                    expandedLogs.includes(log.id) ? 'p-5' : 'p-4'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${log.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        {log.status === 'Pending' ? <Clock className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{log.table}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>{log.type}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>{log.version}</span>
                        </div>
                        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{log.detail}</p>
                        <div className={`flex items-center gap-3 mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                          <span>User: {log.user}</span>
                          <span>•</span>
                          <span>{log.time}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleLogExpansion(log.id)}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
                      >
                        {expandedLogs.includes(log.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {log.status === 'Pending' ? (
                        <>
                          <button className="p-2 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg transition-colors" title="Approve">
                            <Check className="w-4 h-4" />
                          </button>
                          <button className="p-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg transition-colors" title="Reject">
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded transition-colors ${isDark ? 'text-gray-500 hover:text-gray-300 bg-gray-700 hover:bg-gray-600' : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'}`}>
                          <RotateCcw className="w-3 h-3" /> Rollback
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedLogs.includes(log.id) && (
                    <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <div className={`p-3 rounded-lg ${isDark ? 'bg-gray-900/50' : 'bg-gray-100'}`}>
                        <h4 className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Schema DDL</h4>
                        <code className={`text-xs font-mono block ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {log.type === 'ADD COLUMN' && `ALTER TABLE ${log.table} ADD COLUMN ${log.detail};`}
                          {log.type === 'MODIFY TYPE' && `ALTER TABLE ${log.table} MODIFY COLUMN ${log.detail};`}
                          {log.type === 'ADD TAG' && `ALTER TABLE ${log.table} ADD TAG ${log.detail};`}
                          {log.type === 'DROP COLUMN' && `ALTER TABLE ${log.table} DROP COLUMN ${log.detail};`}
                        </code>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button className={`text-xs px-3 py-1.5 rounded flex items-center gap-1 ${isDark ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                          <FileCode className="w-3 h-3" /> View Full Schema
                        </button>
                        <button className={`text-xs px-3 py-1.5 rounded flex items-center gap-1 ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                          <AlertCircle className="w-3 h-3" /> Impact Analysis
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
