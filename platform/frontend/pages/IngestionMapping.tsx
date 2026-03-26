import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { useSearchParams } from 'react-router-dom';
import { GitMerge, ArrowRight, FileJson, Table, Save, Link as LinkIcon, Trash2, X, AlertCircle, Check, ChevronLeft, Search, Plus, Calendar, MoreVertical, LayoutGrid, List as ListIcon, Database, Filter, Layers, Info, Download, Upload, FileText, AlertTriangle, FileSpreadsheet, CheckCircle, ShieldAlert, MousePointer2, Edit3 } from 'lucide-react';
import { MOCK_DATA_SOURCES, MOCK_SUPER_TABLES } from '../constants';
import { MappingRule, DataSource } from '../types';

// --- Types & Constants ---

const DEFAULT_SOURCE_JSON = {
  "device_id": "unknown",
  "data": { "value": 0 }
};

// Mock schemas for different target tables
const TABLE_SCHEMAS: Record<string, { name: string, type: string, kind: string }[]> = {
  meters: [
    { name: 'ts', type: 'TIMESTAMP', kind: 'Metric' },
    { name: 'current', type: 'FLOAT', kind: 'Metric' },
    { name: 'voltage', type: 'INT', kind: 'Metric' },
    { name: 'phase', type: 'FLOAT', kind: 'Metric' },
    { name: 'location', type: 'BINARY(20)', kind: 'Tag' },
    { name: 'group_id', type: 'INT', kind: 'Tag' },
    { name: 'device_sn', type: 'BINARY(20)', kind: 'Tag' },
    { name: 'status_code', type: 'INT', kind: 'Metric' },
  ],
  // ... other tables (omitted for brevity, assume same as before)
};

// Helper to get schema
const getTargetInfo = (tableName: string, colName: string) => {
    return TABLE_SCHEMAS[tableName]?.find(c => c.name === colName);
};

// --- Helper: Flatten JSON keys ---
const getFlattenedKeys = (obj: any, prefix = ''): { path: string, type: string }[] => {
  let keys: { path: string, type: string }[] = [];
  for (const k in obj) {
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(getFlattenedKeys(obj[k], prefix + k + '.'));
    } else {
      keys.push({ path: prefix + k, type: typeof obj[k] });
    }
  }
  return keys;
};

// --- Component: Mapping List View ---
const MappingListView = ({ onSelect, onCreate, isDark }: { onSelect: (id: string) => void, onCreate: () => void, isDark: boolean }) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [viewType, setViewType] = useState<'grid' | 'list'>('grid');

    const configs = MOCK_DATA_SOURCES.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('ingestion.mapping.mappingConfigurations', 'Mapping Configurations')}</h1>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('ingestion.mapping.manageDataTransformationRules', 'Manage data transformation rules for ingestion pipelines.')}</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('ingestion.mapping.searchConfigs', 'Search configs...')}
                            className={`pl-9 pr-4 py-2 rounded-lg text-sm outline-none w-64 ${isDark ? 'bg-gray-800 border-gray-700 text-gray-200 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500 border'}`}
                        />
                    </div>
                    <div className={`flex rounded-lg p-1 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300 border'}`}>
                        <button onClick={() => setViewType('grid')} className={`p-1.5 rounded ${viewType === 'grid' ? (isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 shadow') : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900')}`}><LayoutGrid className="w-4 h-4" /></button>
                        <button onClick={() => setViewType('list')} className={`p-1.5 rounded ${viewType === 'list' ? (isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 shadow') : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900')}`}><ListIcon className="w-4 h-4" /></button>
                    </div>
                    <button 
                        onClick={onCreate}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center shadow-lg shadow-blue-900/20"
                    >
                        <Plus className="w-4 h-4 mr-2" /> {t('ingestion.mapping.newConfiguration', 'New Configuration')}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {viewType === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {configs.map(source => (
                            <div 
                                key={source.id} 
                                onClick={() => onSelect(source.id)}
                                className={`rounded-xl p-5 hover:border-blue-500/50 cursor-pointer transition-all group flex flex-col h-full ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-lg transition-colors ${isDark ? 'bg-gray-700/50 text-gray-400 group-hover:bg-blue-900/20 group-hover:text-blue-400' : 'bg-gray-100 text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                                        <GitMerge className="w-6 h-6" />
                                    </div>
                                    <button className={`p-1 rounded hover:bg-gray-700 ${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}>
                                        <MoreVertical className="w-4 h-4" />
                                    </button>
                                </div>
                                <h3 className={`font-bold mb-1 line-clamp-1 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{source.name}</h3>
                                <p className={`text-xs mb-4 flex items-center ${isDark ? 'text-gray-500' : 'text-gray-600'}`}><Database className="w-3 h-3 mr-1" /> {t('common.source', 'Source')}: {source.type}</p>
                                <div className="mt-auto space-y-3">
                                    <div className={`flex justify-between text-xs pt-3 ${isDark ? 'border-t border-gray-700/50 text-gray-400' : 'border-t border-gray-200 text-gray-600'}`}>
                                        <span>{t('ingestion.mapping.rulesDefined', 'Rules Defined')}</span>
                                        <span className={`font-mono font-bold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{source.mappingRules?.length || 0}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div onClick={onCreate} className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer min-h-[200px] ${isDark ? 'border-gray-700 text-gray-500 hover:border-blue-500 hover:text-blue-400' : 'border-gray-300 text-gray-500 hover:border-blue-500 hover:text-blue-500'}`}>
                            <Plus className="w-8 h-8 mb-2 opacity-50" />
                            <span className="text-sm font-medium">{t('common.createNew', 'Create New')}</span>
                        </div>
                    </div>
                ) : (
                    <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
                        <table className="w-full text-left border-collapse">
                            <thead className={`text-xs uppercase font-medium ${isDark ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                                <tr>
                                    <th className="p-4">{t('ingestion.mapping.configurationName', 'Configuration Name')}</th>
                                    <th className="p-4">{t('common.sourceType', 'Source Type')}</th>
                                    <th className="p-4 text-center">{t('common.rules', 'Rules')}</th>
                                    <th className="p-4">{t('common.lastUpdated', 'Last Updated')}</th>
                                    <th className="p-4 text-right">{t('common.actions', 'Actions')}</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y text-sm ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                {configs.map(source => (
                                    <tr key={source.id} onClick={() => onSelect(source.id)} className={`cursor-pointer group ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}`}>
                                        <td className="p-4"><div className="flex items-center gap-3"><span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{source.name}</span></div></td>
                                        <td className={`p-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{source.type}</td>
                                        <td className="p-4 text-center"><span className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>{source.mappingRules?.length || 0}</span></td>
                                        <td className={`p-4 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}><div className="flex items-center gap-2"><Calendar className="w-3 h-3" /> 2023-10-25</div></td>
                                        <td className="p-4 text-right"><button className={`p-2 rounded hover:bg-gray-600 ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}><MoreVertical className="w-4 h-4" /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Component: Mode Selection Modal ---
const ModeSelectionModal = ({ onClose, onSelect, isDark }: { onClose: () => void, onSelect: (mode: 'manual' | 'bulk') => void, isDark: boolean }) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
        <div className={`rounded-2xl w-full max-w-3xl shadow-2xl p-8 relative ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
            <button onClick={onClose} className={`absolute top-4 right-4 ${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}><X className="w-6 h-6" /></button>
            <h2 className={`text-2xl font-bold text-center mb-2 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('ingestion.mapping.createNewConfiguration', 'Create New Configuration')}</h2>
            <p className={`text-center mb-10 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('ingestion.mapping.chooseHowToDefine', 'Choose how you want to define your data mapping rules.')}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div 
                    onClick={() => onSelect('manual')}
                    className={`border hover:border-blue-500 p-8 rounded-xl cursor-pointer transition-all group flex flex-col items-center text-center h-full ${isDark ? 'bg-gray-750 border-gray-600 hover:bg-gray-700' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'}`}
                >
                    <div className={`p-5 rounded-full mb-6 transition-colors ${isDark ? 'bg-gray-700 group-hover:bg-blue-600/20' : 'bg-gray-200 group-hover:bg-blue-100'}`}>
                        <MousePointer2 className={`w-10 h-10 ${isDark ? 'text-gray-400 group-hover:text-blue-400' : 'text-gray-500 group-hover:text-blue-500'}`} />
                    </div>
                    <h3 className={`text-lg font-bold mb-3 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{t('ingestion.mapping.manualMode', 'Manual Mode')}</h3>
                    <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {t('ingestion.mapping.manualModeDescription', 'Visual point-and-click interface. Ideal for exploring source data structure and mapping a few specific fields.')}
                    </p>
                </div>

                <div 
                    onClick={() => onSelect('bulk')}
                    className={`border hover:border-green-500 p-8 rounded-xl cursor-pointer transition-all group flex flex-col items-center text-center h-full ${isDark ? 'bg-gray-750 border-gray-600 hover:bg-gray-700' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'}`}
                >
                    <div className={`p-5 rounded-full mb-6 transition-colors ${isDark ? 'bg-gray-700 group-hover:bg-green-600/20' : 'bg-gray-200 group-hover:bg-green-100'}`}>
                        <FileSpreadsheet className={`w-10 h-10 ${isDark ? 'text-gray-400 group-hover:text-green-400' : 'text-gray-500 group-hover:text-green-500'}`} />
                    </div>
                    <h3 className={`text-lg font-bold mb-3 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{t('ingestion.mapping.bulkImportMode', 'Bulk Import Mode')}</h3>
                    <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {t('ingestion.mapping.bulkImportModeDescription', 'Upload a CSV template to define hundreds of rules at once. Includes validation and review table before applying.')}
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
};

// --- Component: Bulk Editor ---
interface BulkRow extends MappingRule {
    status: 'VALID' | 'INVALID' | 'OVERWRITE';
    message: string;
}

const BulkMappingEditor = ({ onBack, onSave, tableName, isDark }: { onBack: () => void, onSave: (rules: MappingRule[]) => void, tableName: string, isDark: boolean }) => {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [rows, setRows] = useState<BulkRow[]>([]);
    
    // Stats
    const stats = useMemo(() => ({
        total: rows.length,
        valid: rows.filter(r => r.status === 'VALID').length,
        overwrite: rows.filter(r => r.status === 'OVERWRITE').length,
        invalid: rows.filter(r => r.status === 'INVALID').length,
    }), [rows]);

    const handleDownloadTemplate = () => {
        const headers = "SourcePath,TargetColumn,Transform\n";
        const examples = "payload.temp,temperature,None\npayload.volt,voltage,Multiply 100\n";
        const blob = new Blob([headers + examples], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "mapping_template.csv";
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.toLowerCase().startsWith('sourcepath'));
            
            // Simulating validation against schema
            const schema = TABLE_SCHEMAS[tableName] || [];
            const validCols = new Set(schema.map(c => c.name));

            const newRows: BulkRow[] = lines.map((line, idx) => {
                const [sourcePath, targetColumn, transform] = line.split(',').map(s => s.trim());
                let status: BulkRow['status'] = 'VALID';
                let message = t('ingestion.mapping.readyToImport', 'Ready to import');

                if (!validCols.has(targetColumn)) {
                    status = 'INVALID';
                    message = t('ingestion.mapping.columnNotFound', `Column '{{column}}' not found in schema`, { column: targetColumn });
                }
                
                return {
                    id: `bulk_${Date.now()}_${idx}`,
                    sourcePath: sourcePath || '',
                    targetColumn: targetColumn || '',
                    transform: transform || 'None',
                    status,
                    message
                };
            });
            setRows(newRows);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleDeleteRow = (id: string) => {
        setRows(prev => prev.filter(r => r.id !== id));
    };

    const handleCellChange = (id: string, field: keyof BulkRow, value: string) => {
        setRows(prev => prev.map(row => {
            if (row.id !== id) return row;
            const updated = { ...row, [field]: value };
            
            // Re-validate simple check
            if (field === 'targetColumn') {
                const schema = TABLE_SCHEMAS[tableName] || [];
                if (!schema.find(c => c.name === value)) {
                    updated.status = 'INVALID';
                    updated.message = t('ingestion.mapping.columnNotFound', `Column '{{column}}' not found`, { column: value });
                } else {
                    updated.status = 'VALID';
                    updated.message = t('ingestion.mapping.readyToImport', 'Ready to import');
                }
            }
            return updated;
        }));
    };

    return (
        <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'}`}>
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className={`text-2xl font-bold flex items-center ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            {t('ingestion.mapping.bulkImportEditor', 'Bulk Import Editor')}
                            <span className="ml-3 text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Beta</span>
                        </h1>
                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('ingestion.mapping.batchProcessMappingRules', 'Batch process mapping rules via CSV.')}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileImport} />
                    <button onClick={handleDownloadTemplate} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center border ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'}`}>
                        <FileSpreadsheet className="w-4 h-4 mr-2" /> {t('ingestion.mapping.downloadTemplate', 'Download Template')}
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium flex items-center shadow-lg shadow-blue-900/20">
                        <Upload className="w-4 h-4 mr-2" /> {t('ingestion.mapping.uploadCSV', 'Upload CSV')}
                    </button>
                </div>
            </div>

            {rows.length === 0 ? (
                <div className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center bg-gray-800/30 ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-300 text-gray-500 bg-gray-50'}`}>
                    <Upload className="w-16 h-16 mb-4 opacity-30" />
                    <p className="text-lg font-medium">{t('ingestion.mapping.noDataLoaded', 'No Data Loaded')}</p>
                    <p className="text-sm mt-2">{t('ingestion.mapping.uploadCSVToStart', 'Upload a CSV file to start reviewing rules.')}</p>
                </div>
            ) : (
                <div className="flex-1 flex flex-col gap-6 min-h-0">
                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-4 shrink-0">
                        <div className={`p-4 rounded-xl text-center ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
                            <p className={`text-xs uppercase font-bold ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('ingestion.mapping.totalRows', 'Total Rows')}</p>
                            <p className={`text-2xl font-bold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{stats.total}</p>
                        </div>
                        <div className="bg-green-900/10 p-4 rounded-xl border border-green-500/20 text-center">
                            <p className="text-xs text-green-500 uppercase font-bold">{t('ingestion.mapping.validNew', 'Valid New')}</p>
                            <p className="text-2xl font-bold text-green-400">{stats.valid}</p>
                        </div>
                        <div className="bg-yellow-900/10 p-4 rounded-xl border border-yellow-500/20 text-center">
                            <p className="text-xs text-yellow-500 uppercase font-bold">{t('ingestion.mapping.overwrite', 'Overwrite')}</p>
                            <p className="text-2xl font-bold text-yellow-400">{stats.overwrite}</p>
                        </div>
                        <div className="bg-red-900/10 p-4 rounded-xl border border-red-500/20 text-center">
                            <p className="text-xs text-red-500 uppercase font-bold">{t('ingestion.mapping.invalid', 'Invalid')}</p>
                            <p className="text-2xl font-bold text-red-400">{stats.invalid}</p>
                        </div>
                    </div>

                    {/* Table Editor */}
                    <div className={`flex-1 rounded-xl overflow-hidden flex flex-col ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
                        <div className={`p-3 border-b flex justify-between items-center ${isDark ? 'bg-gray-750 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                            <span className={`text-sm font-bold pl-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('ingestion.mapping.reviewAdjust', 'Review & Adjust')}</span>
                            <button onClick={() => setRows([])} className="text-xs text-red-400 hover:text-red-300 flex items-center"><Trash2 className="w-3 h-3 mr-1"/> {t('common.clearAll', 'Clear All')}</button>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead className={`text-xs uppercase sticky top-0 z-10 shadow-sm ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                                    <tr>
                                        <th className={`p-3 w-12 text-center ${isDark ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}>#</th>
                                        <th className={`p-3 w-1/4 ${isDark ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}>{t('ingestion.mapping.sourcePath', 'Source Path')}</th>
                                        <th className={`p-3 w-1/4 ${isDark ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}>{t('ingestion.mapping.targetColumn', 'Target Column')}</th>
                                        <th className={`p-3 w-1/6 ${isDark ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}>{t('ingestion.mapping.transform', 'Transform')}</th>
                                        <th className={`p-3 ${isDark ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}>{t('ingestion.mapping.statusMessage', 'Status / Message')}</th>
                                        <th className={`p-3 w-12 ${isDark ? 'border-b border-gray-700' : 'border-b border-gray-200'}`}></th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${isDark ? 'divide-gray-700 bg-gray-800/50' : 'divide-gray-200 bg-white/50'}`}>
                                    {rows.map((row, idx) => (
                                        <tr key={row.id} className={`group ${row.status === 'INVALID' ? 'bg-red-900/5' : ''} ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                                            <td className={`p-3 text-center ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{idx + 1}</td>
                                            <td className="p-3">
                                                <input 
                                                    type="text" 
                                                    value={row.sourcePath}
                                                    onChange={(e) => handleCellChange(row.id, 'sourcePath', e.target.value)}
                                                    className={`w-full bg-transparent border-b border-transparent hover:border-gray-600 focus:border-blue-500 outline-none text-sm transition-colors font-mono ${isDark ? 'text-gray-200' : 'text-gray-900'}`}
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input 
                                                    type="text" 
                                                    value={row.targetColumn}
                                                    onChange={(e) => handleCellChange(row.id, 'targetColumn', e.target.value)}
                                                    className={`w-full bg-transparent border-b border-transparent hover:border-gray-600 focus:border-blue-500 outline-none text-sm transition-colors font-mono font-bold ${
                                                        row.status === 'INVALID' ? 'text-red-400' : 'text-purple-300'
                                                    }`}
                                                />
                                            </td>
                                            <td className="p-3">
                                                <input 
                                                    type="text" 
                                                    value={row.transform}
                                                    onChange={(e) => handleCellChange(row.id, 'transform', e.target.value)}
                                                    className={`w-full bg-transparent border-b border-transparent hover:border-gray-600 focus:border-blue-500 outline-none text-sm transition-colors ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                                                />
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    {row.status === 'VALID' && <CheckCircle className="w-4 h-4 text-green-500" />}
                                                    {row.status === 'OVERWRITE' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                                                    {row.status === 'INVALID' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                                    <span className={`text-xs ${
                                                        row.status === 'VALID' ? 'text-green-400' : 
                                                        row.status === 'OVERWRITE' ? 'text-yellow-400' : 'text-red-400'
                                                    }`}>
                                                        {row.message}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-right">
                                                <button 
                                                    onClick={() => handleDeleteRow(row.id)}
                                                    className={`opacity-0 group-hover:opacity-100 transition-all p-1 ${isDark ? 'text-gray-600 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className={`p-4 border-t flex justify-end gap-3 ${isDark ? 'bg-gray-750 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                            <button onClick={onBack} className={`px-4 py-2 text-sm ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}>{t('common.cancel', 'Cancel')}</button>
                            <button 
                                onClick={() => onSave(rows.filter(r => r.status !== 'INVALID'))}
                                disabled={stats.valid + stats.overwrite === 0}
                                className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded text-sm font-medium shadow-lg shadow-green-900/20 flex items-center transition-all"
                            >
                                <CheckCircle className="w-4 h-4 mr-2" /> {t('ingestion.mapping.confirmImport', 'Confirm Import')} ({stats.valid + stats.overwrite} {t('common.rules', 'Rules')})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Main Component ---
export const IngestionMapping: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceIdParam = searchParams.get('sourceId');

  // Modes: list, editor-manual, editor-bulk
  const [viewMode, setViewMode] = useState<'list' | 'editor-manual' | 'editor-bulk'>('list');
  const [showModeModal, setShowModeModal] = useState(false);
  
  // Editor State
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [dataSourceName, setDataSourceName] = useState<string>(t('common.unknownSource', 'Unknown Source'));
  const [mappings, setMappings] = useState<MappingRule[]>([]);
  const [sourceData, setSourceData] = useState<Record<string, any>>(DEFAULT_SOURCE_JSON);
  
  // Manual Editor Specific
  const [selectedSourcePath, setSelectedSourcePath] = useState<string | null>(null);
  const [selectedTargetCol, setSelectedTargetCol] = useState<string | null>(null);
  const [activeMappingId, setActiveMappingId] = useState<string | null>(null);
  const [targetDb, setTargetDb] = useState<string>('power_db');
  const [targetTable, setTargetTable] = useState<string>('meters');
  
  // Routing State
  const [tableNamePattern, setTableNamePattern] = useState('d_${device_id}');
  const [autoCreate, setAutoCreate] = useState(true);

  const [sourceFilter, setSourceFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');

  // Initialization
  useEffect(() => {
      if (sourceIdParam) {
          handleSelectConfig(sourceIdParam); // Default to manual view for existing
      } else {
          setViewMode('list');
      }
  }, [sourceIdParam]);

  const handleSelectConfig = (id: string, mode: 'manual' | 'bulk' = 'manual') => {
      setSelectedSourceId(id);
      const source = MOCK_DATA_SOURCES.find(s => s.id === id);
      if (source) {
          setDataSourceName(source.name);
          if (source.sampleData) setSourceData(source.sampleData);
          setMappings(source.mappingRules || []);
      } else {
          // New
          setDataSourceName(t('ingestion.mapping.newConfiguration', "New Configuration"));
          setSourceData(DEFAULT_SOURCE_JSON);
          setMappings([]);
      }
      
      setViewMode(mode === 'bulk' ? 'editor-bulk' : 'editor-manual');
      // Reset selections
      setSelectedSourcePath(null);
      setSelectedTargetCol(null);
      setActiveMappingId(null);
  };

  const handleCreateNewClick = () => {
      setShowModeModal(true);
  };

  const handleModeSelected = (mode: 'manual' | 'bulk') => {
      setShowModeModal(false);
      handleSelectConfig('new_temp_id', mode);
  };

  const handleBackToList = () => {
      setSearchParams({});
      setViewMode('list');
      setSelectedSourceId(null);
  };

  const handleBulkSave = (newRules: MappingRule[]) => {
      // Merge rules: Remove duplicates based on targetColumn
      const existingTargets = new Set(mappings.map(m => m.targetColumn));
      // For bulk save, we might want to REPLACE or APPEND. Let's Append but overwrite if target collision.
      const newTargets = new Set(newRules.map(r => r.targetColumn));
      
      const keptOldRules = mappings.filter(m => !newTargets.has(m.targetColumn));
      const finalRules = [...keptOldRules, ...newRules];
      
      setMappings(finalRules);
      // Switch to manual view to see result? Or just stay in list?
      // User expectation: "Rule Effective".
      alert(t('ingestion.mapping.successfullyImportedRules', `Successfully imported {{count}} rules.`, { count: newRules.length }));
      setViewMode('list'); // Return to list for now
  };

  // --- Manual Editor Helpers ---
  const sourceKeys = useMemo(() => getFlattenedKeys(sourceData), [sourceData]);
  const currentSchema = useMemo(() => TABLE_SCHEMAS[targetTable] || [], [targetTable]);
  
  const filteredSourceKeys = useMemo(() => {
      if (!sourceFilter) return sourceKeys;
      return sourceKeys.filter(k => k.path.toLowerCase().includes(sourceFilter.toLowerCase()));
  }, [sourceKeys, sourceFilter]);

  const filteredTargetSchema = useMemo(() => {
      if (!targetFilter) return currentSchema;
      return currentSchema.filter(c => c.name.toLowerCase().includes(targetFilter.toLowerCase()));
  }, [targetFilter, currentSchema]);

  const handleCreateManualMapping = () => {
    if (!selectedSourcePath || !selectedTargetCol) return;
    const existing = mappings.find(m => m.targetColumn === selectedTargetCol);
    if (existing) {
      alert(t('ingestion.mapping.targetAlreadyMapped', `Target '{{target}}' is already mapped.`, { target: selectedTargetCol }));
      return;
    }
    const newMapping: MappingRule = {
      id: `m_${Date.now()}`,
      sourcePath: selectedSourcePath,
      targetColumn: selectedTargetCol,
      transform: 'None'
    };
    setMappings([...mappings, newMapping]);
    setActiveMappingId(newMapping.id);
    setSelectedSourcePath(null);
    setSelectedTargetCol(null);
  };

  const handleDeleteMapping = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMappings(prev => prev.filter(m => m.id !== id));
    if (activeMappingId === id) setActiveMappingId(null);
  };

  const activeMapping = mappings.find(m => m.id === activeMappingId);
  const isSourceMapped = (path: string) => mappings.some(m => m.sourcePath === path);
  const isTargetMapped = (col: string) => mappings.some(m => m.targetColumn === col);

  // --- RENDER ---

  return (
    <div className="h-[calc(100vh-8rem)]">
        {/* Modal */}
        {showModeModal && (
            <ModeSelectionModal 
                onClose={() => setShowModeModal(false)} 
                onSelect={handleModeSelected}
                isDark={isDark}
            />
        )}

        {/* View: List */}
        {viewMode === 'list' && (
            <MappingListView onSelect={(id) => handleSelectConfig(id, 'manual')} onCreate={handleCreateNewClick} isDark={isDark} />
        )}

        {/* View: Bulk Editor */}
        {viewMode === 'editor-bulk' && (
            <BulkMappingEditor 
                onBack={handleBackToList} 
                onSave={handleBulkSave} 
                tableName={targetTable}
                isDark={isDark}
            />
        )}

        {/* View: Manual Editor (Original) */}
        {viewMode === 'editor-manual' && (
            <div className="space-y-6 h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                   <button 
                        onClick={handleBackToList}
                        className={`p-2 rounded-lg transition-colors border border-transparent ${isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-white hover:border-gray-700' : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900 hover:border-gray-300'}`}
                   >
                       <ChevronLeft className="w-5 h-5" />
                   </button>
                   <div>
                       <div className="flex items-center gap-2">
                           <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('ingestion.mapping.editMapping', 'Edit Mapping')}</h1>
                           <span className="text-xs bg-blue-600/20 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded">{t('ingestion.mapping.manualMode', 'Manual Mode')}</span>
                       </div>
                       <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('ingestion.mapping.configurationFor', 'Configuration for')}: <span className="text-blue-400 font-medium">{dataSourceName}</span></p>
                   </div>
                </div>
                <div className="flex gap-3">
                     <button className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'}`}>
                        {t('ingestion.mapping.loadJSONSample', 'Load JSON Sample')}
                     </button>
                     <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center shadow-lg shadow-blue-900/20">
                          <Save className="w-4 h-4 mr-2" /> {t('ingestion.mapping.saveConfiguration', 'Save Configuration')}
                     </button>
                </div>
              </div>

              <div className="flex-1 flex gap-4 min-h-0">
                  {/* Source Panel */}
                  <div className={`w-1/4 rounded-xl flex flex-col overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
                      <div className={`p-3 space-y-2 ${isDark ? 'border-b border-gray-700 bg-gray-750' : 'border-b border-gray-200 bg-gray-50'}`}>
                          <div className="flex items-center"><FileJson className="w-4 h-4 text-yellow-400 mr-2" /><span className={`font-semibold text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{t('ingestion.mapping.sourceData', 'Source Data')}</span></div>
                          <div className="relative"><Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} /><input type="text" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} placeholder={t('ingestion.mapping.filterKeys', 'Filter keys...')} className={`w-full border rounded pl-7 pr-2 py-1 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`} /></div>
                      </div>
                      <div className="p-2 overflow-y-auto flex-1 space-y-1">
                          {filteredSourceKeys.map((item) => {
                              const isMapped = isSourceMapped(item.path);
                              const isSelected = selectedSourcePath === item.path;
                              return (
                                  <div key={item.path} onClick={() => setSelectedSourcePath(item.path)} className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-sm font-mono ${isSelected ? 'bg-blue-600/20 border border-blue-500/50 text-white' : (isDark ? 'hover:bg-gray-700/50 border border-transparent' : 'hover:bg-gray-100 border border-transparent')} ${isMapped && !isSelected ? (isDark ? 'opacity-50 text-gray-500' : 'opacity-50 text-gray-400') : (isDark ? 'text-gray-300' : 'text-gray-700')}`}>
                                     <div className="flex items-center overflow-hidden"><span className={`w-2 h-2 rounded-full mr-2 shrink-0 ${item.type === 'number' ? 'bg-blue-400' : item.type === 'string' ? 'bg-green-400' : (isDark ? 'bg-gray-400' : 'bg-gray-500')}`}></span><span className="truncate" title={item.path}>{item.path}</span></div>
                                     {isMapped && <Check className="w-3 h-3 text-green-500 shrink-0 ml-1" />}
                                  </div>
                              );
                          })}
                      </div>
                  </div>

                  {/* Middle Panel */}
                  <div className="flex-1 flex flex-col gap-4">
                       {/* Sub-table Routing */}
                       <div className={`rounded-xl p-4 flex flex-col gap-3 shrink-0 shadow-sm ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
                            <div className="flex items-center justify-between">
                                <h3 className={`text-sm font-bold flex items-center ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                    <Layers className="w-4 h-4 mr-2 text-blue-400" />
                                    {t('ingestion.mapping.subTableRouting', 'Sub-table Routing')}
                                </h3>
                                <div className={`flex items-center text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                                    <Info className="w-3 h-3 mr-1" />
                                    {t('ingestion.mapping.dynamicRouting', 'Dynamic Routing')}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className={`p-2 rounded border ${isDark ? 'bg-gray-900/50 border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                                    <label className={`text-[10px] uppercase font-bold block mb-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('ingestion.mapping.targetSuperTable', 'Target Super Table')}</label>
                                    <div className={`flex items-center text-sm font-mono ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                                        <Database className="w-3 h-3 mr-1.5 text-yellow-500" />
                                        {targetDb}
                                        <span className={`mx-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>/</span>
                                        <Table className="w-3 h-3 mr-1.5 text-purple-500" />
                                        {targetTable}
                                    </div>
                                </div>
                                
                                <div>
                                    <label className={`text-[10px] uppercase font-bold block mb-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                                        {t('ingestion.mapping.childTableNamePattern', 'Child Table Name Pattern')}
                                    </label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            value={tableNamePattern}
                                            onChange={(e) => setTableNamePattern(e.target.value)}
                                            className={`w-full border rounded px-2 py-1.5 text-sm font-mono outline-none focus:border-blue-500 ${isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded cursor-help ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'}`} title="Use ${field} to reference source data">Var</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mt-1">
                                <input 
                                    type="checkbox" 
                                    id="autoCreate" 
                                    checked={autoCreate} 
                                    onChange={(e) => setAutoCreate(e.target.checked)}
                                    className={`rounded cursor-pointer ${isDark ? 'bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500/20' : 'bg-white border-gray-300 text-blue-600'}`}
                                />
                                <label htmlFor="autoCreate" className={`text-xs cursor-pointer select-none ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {t('ingestion.mapping.autoCreateChildTable', 'Auto-create child table using Tags if not exists')}
                                </label>
                            </div>
                       </div>

                       <div className={`h-14 rounded-xl flex items-center justify-between px-4 shrink-0 ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200 border'}`}>
                           <div className={`flex items-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                               {selectedSourcePath ? <span className={`font-mono px-2 py-0.5 rounded border ${isDark ? 'text-blue-300 bg-blue-500/10 border-blue-500/20' : 'text-blue-700 bg-blue-50 border-blue-200'}`}>{selectedSourcePath}</span> : <span className="italic">{t('ingestion.mapping.selectSource', 'Select source...')}</span>}
                               <ArrowRight className={`w-4 h-4 mx-3 ${isDark ? '' : ''}`} />
                               {selectedTargetCol ? <span className={`font-mono px-2 py-0.5 rounded border ${isDark ? 'text-purple-300 bg-purple-500/10 border-purple-500/20' : 'text-purple-700 bg-purple-50 border-purple-200'}`}>{selectedTargetCol}</span> : <span className="italic">{t('ingestion.mapping.selectTarget', 'Select target...')}</span>}
                           </div>
                           <button onClick={handleCreateManualMapping} disabled={!selectedSourcePath || !selectedTargetCol} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded text-sm font-medium transition-colors flex items-center"><LinkIcon className="w-3 h-3 mr-2" /> {t('ingestion.mapping.linkFields', 'Link Fields')}</button>
                       </div>

                       <div className={`flex-1 rounded-xl flex flex-col overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
                           <div className={`p-3 border-b flex items-center justify-between ${isDark ? 'bg-gray-750' : 'bg-gray-50'}`}>
                               <div className="flex items-center"><GitMerge className="w-4 h-4 text-blue-400 mr-2" /><span className={`font-semibold text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{t('ingestion.mapping.activeMappings', 'Active Mappings')} ({mappings.length})</span></div>
                           </div>
                           <div className="overflow-y-auto flex-1 p-2 space-y-2">
                               {mappings.length === 0 && <div className={`flex flex-col items-center justify-center h-full opacity-50 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}><LinkIcon className="w-8 h-8 mb-2" /><p className="text-sm">{t('ingestion.mapping.noMappingsDefined', 'No mappings defined')}</p></div>}
                               {mappings.map(m => (
                                  <div key={m.id} onClick={() => setActiveMappingId(m.id)} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all group ${activeMappingId === m.id ? 'bg-blue-500/10 border-blue-500/50' : (isDark ? 'bg-gray-700/30 border-gray-700/50 hover:bg-gray-700/50' : 'bg-gray-50 border-gray-200 hover:bg-gray-100')}`}>
                                      <div className="flex-1 flex items-center gap-2 font-mono text-sm"><span className={isDark ? 'text-gray-300' : 'text-gray-700'} title={m.sourcePath}>{m.sourcePath}</span><ArrowRight className={`w-3 h-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} /><span className="text-purple-300">{m.targetColumn}</span></div>
                                      <div className="flex items-center gap-3">{m.transform !== 'None' && <span className="text-xs bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/20">{m.transform}</span>}<button onClick={(e) => handleDeleteMapping(m.id, e)} className={`p-1 rounded hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-all ${isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}><Trash2 className="w-4 h-4" /></button></div>
                                  </div>
                               ))}
                           </div>
                       </div>
                  </div>

                  {/* Target Panel */}
                  <div className={`w-1/4 rounded-xl flex flex-col overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
                      <div className={`p-3 space-y-2 ${isDark ? 'border-b border-gray-700 bg-gray-750' : 'border-b border-gray-200 bg-gray-50'}`}>
                          <div className="flex items-center"><Table className="w-4 h-4 text-purple-400 mr-2" /><span className={`font-semibold text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{t('ingestion.mapping.targetSchema', 'Target Schema')}</span></div>
                          <div className="flex gap-2"><select value={targetDb} onChange={(e) => setTargetDb(e.target.value)} className={`flex-1 border rounded px-2 py-1 text-xs outline-none ${isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}><option value="power_db">power_db</option></select><select value={targetTable} onChange={(e) => setTargetTable(e.target.value)} className={`flex-1 border rounded px-2 py-1 text-xs outline-none ${isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}><option value="meters">meters</option></select></div>
                          <div className="relative"><Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} /><input type="text" value={targetFilter} onChange={(e) => setTargetFilter(e.target.value)} placeholder={t('ingestion.mapping.filterColumns', 'Filter columns...')} className={`w-full border rounded pl-7 pr-2 py-1 text-xs outline-none focus:border-purple-500 ${isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`} /></div>
                      </div>
                      <div className="p-2 overflow-y-auto flex-1 space-y-1">
                          {filteredTargetSchema.map((col) => {
                              const isMapped = isTargetMapped(col.name);
                              const isSelected = selectedTargetCol === col.name;
                              return (
                                  <div key={col.name} onClick={() => setSelectedTargetCol(col.name)} className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-sm font-mono ${isSelected ? 'bg-purple-600/20 border border-purple-500/50 text-white' : (isDark ? 'hover:bg-gray-700/50 border border-transparent' : 'hover:bg-gray-100 border border-transparent')} ${isMapped && !isSelected ? (isDark ? 'opacity-50 text-gray-500' : 'opacity-50 text-gray-400') : (isDark ? 'text-gray-300' : 'text-gray-700')}`}>
                                     <div className="flex flex-col"><span className="font-medium flex items-center">{col.name}{col.kind === 'Tag' && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-blue-400" title="Tag"></span>}</span><span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{col.type} • {col.kind}</span></div>
                                     {isMapped && <Check className="w-3 h-3 text-green-500 shrink-0" />}
                                  </div>
                              );
                          })}
                      </div>
                  </div>

                   {/* Properties Panel */}
                   {activeMapping ? (
                       <div className={`w-64 rounded-xl p-4 flex flex-col shrink-0 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
                           <h3 className={`text-sm font-medium mb-4 pb-2 border-b flex justify-between items-center ${isDark ? 'text-gray-200 border-gray-700' : 'text-gray-900 border-gray-200'}`}>{t('ingestion.mapping.properties', 'Properties')}<button onClick={() => setActiveMappingId(null)}><X className={`w-4 h-4 ${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}/></button></h3>
                           <div className="space-y-4 flex-1">
                               <div><label className={`text-xs block mb-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('ingestion.mapping.transform', 'Transform')}</label><select value={activeMapping.transform} onChange={(e) => setMappings(prev => prev.map(m => m.id === activeMappingId ? { ...m, transform: e.target.value } : m))} className={`w-full border rounded px-2 py-1.5 text-sm outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}><option value="None">None</option><option value="Multiply 100">Multiply 100</option></select></div>
                           </div>
                       </div>
                   ) : (
                        <div className={`w-64 rounded-xl p-4 flex flex-col items-center justify-center text-xs text-center shrink-0 ${isDark ? 'bg-gray-800/30 border-gray-700/50 text-gray-500' : 'bg-gray-50 border-gray-200 border text-gray-500'}`}><p>{t('ingestion.mapping.selectMappingToEdit', 'Select a mapping to edit properties')}</p></div>
                   )}
              </div>
            </div>
        )}
    </div>
  );
};
