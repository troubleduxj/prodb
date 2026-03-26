import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { api } from '../src/services/api';
import { toast } from '../src/hooks/use-toast';
import { 
  Play, Pause, RefreshCw, Database, Table, Server, 
  Activity, Zap, Thermometer, Droplets, Wind, 
  BarChart2, TrendingUp, GitCommit, LayoutGrid, AlertCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area
} from 'recharts';

// TDengine数据库接口
interface Database {
  name: string;
  tables: number;
  vgroups: number;
  status: string;
}

// 超级表/子表接口
interface SuperTable {
  name: string;
  stable_name?: string;
  database: string;
  columns?: TableColumn[];
}

// 表列定义
interface TableColumn {
  name: string;
  type: string;
  length?: number;
  note?: string;
}

// 查询结果数据
interface QueryResult {
  columns: string[];
  data: any[];
  rows: number;
}

// 图表字段配置
interface FieldConfig {
  key: string;
  label: string;
  color: string;
  icon: React.ElementType;
}

export const RealtimeLive: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  
  // 数据库和表选择状态
  const [databases, setDatabases] = useState<Database[]>([]);
  const [superTables, setSuperTables] = useState<SuperTable[]>([]);
  const [subTables, setSubTables] = useState<SuperTable[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>('');
  const [selectedSuperTable, setSelectedSuperTable] = useState<string>('');
  const [selectedSubTable, setSelectedSubTable] = useState<string>('');
  
  // 加载状态
  const [dbLoading, setDbLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  
  // 表结构
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [timestampColumn, setTimestampColumn] = useState<string>('ts');
  
  // 图表和数据状态
  const [refreshRate, setRefreshRate] = useState<1000 | 5000 | 10000>(5000);
  const [isPaused, setIsPaused] = useState(false);
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('line');
  const [dataPoints, setDataPoints] = useState<any[]>([]);
  const [visibleFields, setVisibleFields] = useState<string[]>([]);
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDark = resolvedTheme === 'dark';
  const maxPoints = 100;

  // 颜色配置
  const colorPalette = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
  ];

  const iconMap: Record<string, React.ElementType> = {
    'current': Zap,
    'voltage': Activity,
    'temp': Thermometer,
    'temperature': Thermometer,
    'humidity': Droplets,
    'pressure': Wind,
    'default': Activity
  };

  // 获取数据库列表
  const fetchDatabases = useCallback(async () => {
    try {
      setDbLoading(true);
      setError(null);
      const result = await api.tdengine.listDatabases();
      
      console.log('[RealtimeLive] Database API result:', result);
      
      if (result.success && result.data) {
        // 解析返回的数据 - 后端可能返回不同的结构
        let dbList: Database[] = [];
        
        // 处理嵌套的 data 结构
        let responseData = result.data;
        if (responseData.data) {
          responseData = responseData.data;
        }
        
        console.log('[RealtimeLive] Processed responseData:', responseData);
        
        if (responseData.databases && Array.isArray(responseData.databases)) {
          dbList = responseData.databases.map((db: any) => ({
            name: db.name || db,
            tables: db.ntables || db.tables || 0,
            vgroups: db.vgroups || 0,
            status: db.status || 'ready'
          }));
        } else if (Array.isArray(responseData)) {
          dbList = responseData.map((db: any) => ({
            name: db.name || db,
            tables: db.ntables || db.tables || 0,
            vgroups: db.vgroups || 0,
            status: db.status || 'ready'
          }));
        }
        
        console.log('[RealtimeLive] Parsed dbList:', dbList);
        
        setDatabases(dbList);
        if (dbList.length > 0 && !selectedDb) {
          setSelectedDb(dbList[0].name);
        }
      } else {
        setError('Failed to load databases');
      }
    } catch (err) {
      console.error('[RealtimeLive] Failed to fetch databases:', err);
      setError('Failed to connect to TDengine');
    } finally {
      setDbLoading(false);
    }
  }, [selectedDb]);

  // 获取超级表列表
  const fetchSuperTables = useCallback(async (dbName: string) => {
    if (!dbName) return;
    
    try {
      setTableLoading(true);
      setError(null);
      const result = await api.tdengine.listSuperTables(dbName);
      
      if (result.success && result.data) {
        let stList: SuperTable[] = [];
        if (result.data.supertables && Array.isArray(result.data.supertables)) {
          stList = result.data.supertables.map((st: any) => ({
            name: st.name || st.stable_name,
            stable_name: st.stable_name || st.name,
            database: dbName
          }));
        } else if (Array.isArray(result.data)) {
          stList = result.data.map((st: any) => ({
            name: st.name || st.stable_name,
            stable_name: st.stable_name || st.name,
            database: dbName
          }));
        }
        
        setSuperTables(stList);
        if (stList.length > 0) {
          setSelectedSuperTable(stList[0].name);
        } else {
          setSelectedSuperTable('');
          setSubTables([]);
        }
      }
    } catch (err) {
      console.error('[RealtimeLive] Failed to fetch super tables:', err);
      setError('Failed to load super tables');
    } finally {
      setTableLoading(false);
    }
  }, []);

  // 获取子表列表
  const fetchSubTables = useCallback(async (dbName: string, superTableName: string) => {
    if (!dbName || !superTableName) return;
    
    try {
      setTableLoading(true);
      const result = await api.tdengine.listSubTables(dbName, superTableName);
      
      if (result.success && result.data) {
        let subList: SuperTable[] = [];
        if (result.data.subtables && Array.isArray(result.data.subtables)) {
          subList = result.data.subtables.map((st: any) => ({
            name: st.name || st.table_name,
            stable_name: superTableName,
            database: dbName
          }));
        } else if (Array.isArray(result.data)) {
          subList = result.data.map((st: any) => ({
            name: st.name || st.table_name,
            stable_name: superTableName,
            database: dbName
          }));
        }
        
        setSubTables(subList);
        if (subList.length > 0) {
          setSelectedSubTable(subList[0].name);
        } else {
          setSelectedSubTable('');
        }
      }
    } catch (err) {
      console.error('[RealtimeLive] Failed to fetch sub tables:', err);
    } finally {
      setTableLoading(false);
    }
  }, []);

  // 获取表结构
  const fetchTableSchema = useCallback(async (dbName: string, tableName: string) => {
    if (!dbName || !tableName) return;
    
    try {
      // 尝试获取超级表schema
      let result = await api.tdengine.getSuperTableSchema(dbName, tableName);
      
      if (!result.success && selectedSubTable) {
        // 如果是子表，使用子表查询
        const queryResult = await api.tdengine.query(`
          DESCRIBE ${dbName}.${tableName}
        `);
        
        if (queryResult.success && queryResult.data) {
          const cols = queryResult.data.data || [];
          const parsedCols = cols.map((col: any) => ({
            name: col[0] || col.name,
            type: col[1] || col.type,
            length: col[2] || col.length,
            note: col[3] || col.note
          }));
          setColumns(parsedCols);
          
          // 找到时间戳列
          const tsCol = parsedCols.find((c: TableColumn) => 
            c.type.toLowerCase().includes('timestamp')
          );
          if (tsCol) {
            setTimestampColumn(tsCol.name);
          }
          
          // 生成字段配置
          generateFieldConfigs(parsedCols);
        }
      } else if (result.success && result.data) {
        const schema = result.data.schema || result.data;
        const cols = schema.columns || [];
        setColumns(cols);
        
        // 找到时间戳列
        const tsCol = cols.find((c: TableColumn) => 
          c.type.toLowerCase().includes('timestamp')
        );
        if (tsCol) {
          setTimestampColumn(tsCol.name);
        }
        
        // 生成字段配置
        generateFieldConfigs(cols);
      }
    } catch (err) {
      console.error('[RealtimeLive] Failed to fetch schema:', err);
    }
  }, [selectedSubTable]);

  // 生成字段配置
  const generateFieldConfigs = (cols: TableColumn[]) => {
    const numericCols = cols.filter(c => 
      ['float', 'double', 'int', 'bigint', 'smallint', 'tinyint'].some(t => 
        c.type.toLowerCase().includes(t)
      ) && !c.type.toLowerCase().includes('timestamp')
    );
    
    const configs: FieldConfig[] = numericCols.map((col, index) => {
      const lowerName = col.name.toLowerCase();
      let icon = iconMap.default;
      
      // 根据列名选择图标
      for (const [key, Icon] of Object.entries(iconMap)) {
        if (lowerName.includes(key)) {
          icon = Icon;
          break;
        }
      }
      
      return {
        key: col.name,
        label: `${col.name} (${col.type})`,
        color: colorPalette[index % colorPalette.length],
        icon
      };
    });
    
    setFieldConfigs(configs);
    // 默认显示前4个字段
    setVisibleFields(configs.slice(0, 4).map(f => f.key));
  };

  // 查询实时数据
  const fetchRealtimeData = useCallback(async () => {
    if (!selectedDb || (!selectedSuperTable && !selectedSubTable)) return;
    
    const tableName = selectedSubTable || selectedSuperTable;
    
    try {
      setDataLoading(true);
      setError(null);
      
      // 构建查询SQL - 获取最近的数据点
      const sql = `
        SELECT * FROM ${selectedDb}.${tableName} 
        ORDER BY ${timestampColumn} DESC 
        LIMIT ${maxPoints}
      `;
      
      const result = await api.tdengine.query(sql);
      
      if (result.success && result.data) {
        const queryData: QueryResult = result.data.data || result.data;
        
        if (queryData.data && Array.isArray(queryData.data)) {
          // 转换数据格式
          const formattedData = queryData.data.map((row: any) => {
            const point: any = {};
            queryData.columns.forEach((col, idx) => {
              point[col] = row[idx] !== undefined ? row[idx] : row[col];
            });
            // 格式化时间
            if (point[timestampColumn]) {
              const ts = new Date(point[timestampColumn]);
              point.time = ts.toLocaleTimeString([], { hour12: false });
              point.fullTime = point[timestampColumn];
            }
            return point;
          });
          
          // 反转数据，使时间从早到晚
          setDataPoints(formattedData.reverse());
          setLastUpdateTime(new Date());
        }
      } else {
        setError(result.error || 'Query failed');
      }
    } catch (err) {
      console.error('[RealtimeLive] Failed to fetch data:', err);
      setError('Failed to fetch data from TDengine');
    } finally {
      setDataLoading(false);
    }
  }, [selectedDb, selectedSuperTable, selectedSubTable, timestampColumn]);

  // 初始化：加载数据库列表
  useEffect(() => {
    fetchDatabases();
  }, [fetchDatabases]);

  // 数据库改变时加载超级表
  useEffect(() => {
    if (selectedDb) {
      fetchSuperTables(selectedDb);
    }
  }, [selectedDb, fetchSuperTables]);

  // 超级表改变时加载子表
  useEffect(() => {
    if (selectedDb && selectedSuperTable) {
      fetchSubTables(selectedDb, selectedSuperTable);
      fetchTableSchema(selectedDb, selectedSuperTable);
    }
  }, [selectedDb, selectedSuperTable, fetchSubTables, fetchTableSchema]);

  // 子表改变时更新
  useEffect(() => {
    if (selectedDb && selectedSubTable) {
      fetchTableSchema(selectedDb, selectedSubTable);
    }
  }, [selectedSubTable, selectedDb, fetchTableSchema]);

  // 定时刷新数据
  useEffect(() => {
    if (isPaused) return;
    
    // 立即执行一次
    fetchRealtimeData();
    
    const interval = setInterval(() => {
      fetchRealtimeData();
    }, refreshRate);
    
    return () => clearInterval(interval);
  }, [refreshRate, isPaused, fetchRealtimeData]);

  const toggleField = (fieldKey: string) => {
    setVisibleFields(prev => 
      prev.includes(fieldKey) 
        ? prev.filter(f => f !== fieldKey) 
        : [...prev, fieldKey]
    );
  };

  const chartTooltipStyle = {
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    borderColor: isDark ? '#374151' : '#e5e7eb',
    color: isDark ? '#f3f4f6' : '#1f2937',
    fontSize: '12px'
  };

  const chartGridColor = isDark ? '#374151' : '#e5e7eb';
  const chartAxisColor = isDark ? '#9ca3af' : '#6b7280';

  const getBgClass = () => isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const getSubBgClass = () => isDark ? 'bg-gray-900 border-gray-600' : 'bg-gray-100 border-gray-300';
  const getTextClass = () => isDark ? 'text-gray-200' : 'text-gray-700';
  const getSubTextClass = () => isDark ? 'text-gray-400' : 'text-gray-500';
  const getBorderClass = () => isDark ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4 animate-in fade-in duration-300">
      {/* 左侧控制面板 */}
      <div className={"w-80 rounded-xl border flex flex-col shrink-0 overflow-hidden " + getBgClass()}>
        {/* 数据库和表选择 */}
        <div className={"p-4 border-b space-y-4 " + (isDark ? "bg-gray-750 border-gray-700" : "bg-gray-50 border-gray-200")}>
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-blue-500" />
            <span className={"font-semibold " + getTextClass()}>{t('realtime.tdengineConnection', 'TDengine Connection')}</span>
          </div>
          
          {/* 数据库选择 */}
          <div className="space-y-1">
            <label className={"text-xs font-medium " + getSubTextClass()}>
              {t('realtime.database', 'Database')}
            </label>
            <select 
              value={selectedDb}
              onChange={(e) => setSelectedDb(e.target.value)}
              disabled={dbLoading}
              className={"w-full border rounded text-sm p-2 outline-none " + (isDark ? "bg-gray-900 border-gray-600 text-gray-200" : "bg-white border-gray-300 text-gray-700")}
            >
              {databases.map(db => (
                <option key={db.name} value={db.name}>{db.name}</option>
              ))}
            </select>
            {dbLoading && (
              <div className="flex items-center gap-1 text-xs text-blue-500">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {t('realtime.loadingDatabases', 'Loading databases...')}
              </div>
            )}
          </div>

          {/* 超级表选择 */}
          <div className="space-y-1">
            <label className={"text-xs font-medium " + getSubTextClass()}>
              {t('realtime.superTable', 'Super Table')}
            </label>
            <select 
              value={selectedSuperTable}
              onChange={(e) => setSelectedSuperTable(e.target.value)}
              disabled={tableLoading || !selectedDb}
              className={"w-full border rounded text-sm p-2 outline-none " + (isDark ? "bg-gray-900 border-gray-600 text-gray-200" : "bg-white border-gray-300 text-gray-700")}
            >
              <option value="">{t('realtime.selectSuperTable', 'Select Super Table')}</option>
              {superTables.map(st => (
                <option key={st.name} value={st.name}>{st.name}</option>
              ))}
            </select>
          </div>

          {/* 子表选择 */}
          {subTables.length > 0 && (
            <div className="space-y-1">
              <label className={"text-xs font-medium " + getSubTextClass()}>
                {t('realtime.subTable', 'Sub Table')} ({t('realtime.optional', 'optional')})
              </label>
              <select 
                value={selectedSubTable}
                onChange={(e) => setSelectedSubTable(e.target.value)}
                disabled={tableLoading}
                className={"w-full border rounded text-sm p-2 outline-none " + (isDark ? "bg-gray-900 border-gray-600 text-gray-200" : "bg-white border-gray-300 text-gray-700")}
              >
                <option value="">{t('realtime.allSubTables', 'All Sub Tables')}</option>
                {subTables.map(st => (
                  <option key={st.name} value={st.name}>{st.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 刷新按钮 */}
          <button
            onClick={fetchRealtimeData}
            disabled={dataLoading || !selectedDb || !selectedSuperTable}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
          >
            {dataLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {t('realtime.refreshNow', 'Refresh Now')}
          </button>
        </div>

        {/* 字段选择 */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className={"p-3 border-b " + (isDark ? "bg-gray-750 border-gray-700" : "bg-gray-50 border-gray-200")}>
            <div className="flex items-center justify-between">
              <span className={"text-xs font-medium " + getSubTextClass()}>
                {t('realtime.selectFields', 'Select Fields to Display')}
              </span>
              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded">
                {visibleFields.length} / {fieldConfigs.length}
              </span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {fieldConfigs.map(field => {
              const isSelected = visibleFields.includes(field.key);
              const Icon = field.icon;
              return (
                <button
                  key={field.key}
                  onClick={() => toggleField(field.key)}
                  className={"w-full flex items-center gap-2 p-2 rounded text-left transition-all " + (
                    isSelected
                      ? (isDark ? 'bg-blue-600/20 border border-blue-500/30' : 'bg-blue-50 border border-blue-200')
                      : (isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100')
                  )}
                >
                  <div 
                    className={"w-4 h-4 rounded border flex items-center justify-center transition-colors " + (
                      isSelected ? 'bg-blue-600 border-blue-500' : (isDark ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-white')
                    )}
                  >
                    {isSelected && <LayoutGrid className="w-3 h-3 text-white" />}
                  </div>
                  <Icon className="w-4 h-4" style={{ color: isSelected ? field.color : undefined }} />
                  <span className={"text-sm flex-1 " + (isSelected ? (isDark ? 'text-blue-200' : 'text-blue-700') : (isDark ? 'text-gray-300' : 'text-gray-700'))}>
                    {field.label}
                  </span>
                </button>
              );
            })}
            
            {fieldConfigs.length === 0 && (
              <div className={"text-center py-8 text-sm " + getSubTextClass()}>
                {t('realtime.noFields', 'Select a table to see available fields')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右侧图表区域 */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* 工具栏 */}
        <div className={"p-3 rounded-xl border flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-sm " + getBgClass()}>
          <div className="flex items-center gap-4">
            {/* 刷新频率 */}
            <div className={"flex items-center rounded-lg p-1 border " + getSubBgClass()}>
              {[1000, 5000, 10000].map(rate => (
                <button
                  key={rate}
                  onClick={() => setRefreshRate(rate as any)}
                  className={"px-3 py-1 text-xs font-medium rounded transition-colors " + (refreshRate === rate 
                    ? (isDark ? 'bg-gray-700 text-white shadow' : 'bg-white text-gray-900 shadow')
                    : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'))}
                >
                  {rate / 1000}s
                </button>
              ))}
            </div>

            <div className={"h-6 w-px " + (isDark ? 'bg-gray-700' : 'bg-gray-300')}></div>

            {/* 图表类型 */}
            <div className={"flex items-center rounded-lg p-1 border " + getSubBgClass()}>
              <button onClick={() => setChartType('line')} className={"p-1.5 rounded " + (chartType === 'line' 
                ? (isDark ? 'bg-gray-700 text-blue-400' : 'bg-white text-blue-500 shadow') 
                : (isDark ? 'text-gray-400' : 'text-gray-500'))} title={t('realtime.lineChart', 'Line Chart')}>
                <TrendingUp className="w-4 h-4"/>
              </button>
              <button onClick={() => setChartType('area')} className={"p-1.5 rounded " + (chartType === 'area' 
                ? (isDark ? 'bg-gray-700 text-blue-400' : 'bg-white text-blue-500 shadow') 
                : (isDark ? 'text-gray-400' : 'text-gray-500'))} title={t('realtime.areaChart', 'Area Chart')}>
                <Activity className="w-4 h-4"/>
              </button>
              <button onClick={() => setChartType('bar')} className={"p-1.5 rounded " + (chartType === 'bar' 
                ? (isDark ? 'bg-gray-700 text-blue-400' : 'bg-white text-blue-500 shadow') 
                : (isDark ? 'text-gray-400' : 'text-gray-500'))} title={t('realtime.barChart', 'Bar Chart')}>
                <BarChart2 className="w-4 h-4"/>
              </button>
            </div>
          </div>

          {/* 状态和控制 */}
          <div className="flex items-center gap-3">
            {lastUpdateTime && (
              <span className={"text-xs " + getSubTextClass()}>
                {t('realtime.lastUpdate', 'Last update')}: {lastUpdateTime.toLocaleTimeString()}
              </span>
            )}
            <div className={"flex items-center gap-2 text-xs px-3 py-1.5 rounded border " + (isDark ? 'text-gray-400 bg-gray-900 border-gray-700' : 'text-gray-500 bg-gray-100 border-gray-300')}>
              <span className={"w-2 h-2 rounded-full " + (isPaused ? 'bg-yellow-500' : dataLoading ? 'bg-blue-500 animate-pulse' : 'bg-green-500 animate-pulse')}></span>
              {isPaused ? t('realtime.paused', 'Paused') : dataLoading ? t('realtime.loading', 'Loading...') : t('realtime.live', 'Live')}
            </div>
            <button 
              onClick={() => setIsPaused(!isPaused)}
              className={"p-2 rounded-lg border transition-colors " + (isPaused 
                ? 'bg-green-600 hover:bg-green-500 border-green-500 text-white' 
                : 'bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400')}
            >
              {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className={"p-3 rounded-lg border flex items-center gap-2 " + (isDark ? 'bg-red-900/20 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600')}>
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-xs underline hover:no-underline"
            >
              {t('common.dismiss', 'Dismiss')}
            </button>
          </div>
        )}

        {/* 图表区域 */}
        <div className={"flex-1 min-h-[350px] rounded-xl border p-4 relative overflow-hidden flex flex-col " + getBgClass()}>
          {!selectedDb || !selectedSuperTable ? (
            <div className={"flex-1 flex flex-col items-center justify-center " + getSubTextClass()}>
              <Database className="w-16 h-16 mb-4 opacity-20" />
              <p>{t('realtime.selectDatabaseHint', 'Select a database and table to view real-time data.')}</p>
            </div>
          ) : dataPoints.length === 0 ? (
            <div className={"flex-1 flex flex-col items-center justify-center " + getSubTextClass()}>
              <TrendingUp className="w-16 h-16 mb-4 opacity-20" />
              <p>{dataLoading ? t('realtime.loadingData', 'Loading data...') : t('realtime.noData', 'No data available')}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={dataPoints}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke={chartAxisColor} 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    minTickGap={30}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend />
                  {fieldConfigs
                    .filter(f => visibleFields.includes(f.key))
                    .map(field => (
                      <Bar 
                        key={field.key}
                        dataKey={field.key}
                        name={field.label}
                        fill={field.color}
                        opacity={0.8}
                        radius={[2, 2, 0, 0]}
                      />
                    ))}
                </BarChart>
              ) : chartType === 'area' ? (
                <AreaChart data={dataPoints}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke={chartAxisColor} 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    minTickGap={30}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend />
                  {fieldConfigs
                    .filter(f => visibleFields.includes(f.key))
                    .map(field => (
                      <Area 
                        key={field.key}
                        type="monotone"
                        dataKey={field.key}
                        name={field.label}
                        stroke={field.color}
                        fill={field.color}
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    ))}
                </AreaChart>
              ) : (
                <LineChart data={dataPoints}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke={chartAxisColor} 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    minTickGap={30}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend />
                  {fieldConfigs
                    .filter(f => visibleFields.includes(f.key))
                    .map(field => (
                      <Line 
                        key={field.key}
                        type="monotone"
                        dataKey={field.key}
                        name={field.label}
                        stroke={field.color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        {/* 数据表格 */}
        {dataPoints.length > 0 && (
          <div className={"h-64 rounded-xl border flex flex-col overflow-hidden shrink-0 " + getBgClass()}>
            <div className={"px-4 py-2 border-b flex justify-between items-center " + (isDark ? "bg-gray-750 border-gray-700" : "bg-gray-50 border-gray-200")}>
              <h3 className={"text-xs font-bold uppercase " + getSubTextClass()}>
                {t('realtime.dataPreview', 'Data Preview')} ({dataPoints.length} {t('realtime.rows', 'rows')})
              </h3>
              <button 
                onClick={() => setDataPoints([])} 
                className={"text-[10px] flex items-center " + (isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500')}
              >
                <RefreshCw className="w-3 h-3 mr-1" /> {t('realtime.clear', 'Clear')}
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className={"font-medium sticky top-0 z-10 " + (isDark ? "bg-gray-800 text-gray-500" : "bg-gray-50 text-gray-500")}>
                  <tr>
                    <th className={"p-3 border-b whitespace-nowrap " + getBorderClass()}>Time</th>
                    {fieldConfigs
                      .filter(f => visibleFields.includes(f.key))
                      .map(field => (
                        <th 
                          key={field.key} 
                          className={"p-3 border-b whitespace-nowrap " + getBorderClass()}
                          style={{color: field.color}}
                        >
                          {field.key}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className={"divide-y font-mono " + (isDark ? "divide-gray-700" : "divide-gray-200")}>
                  {[...dataPoints].reverse().slice(0, 20).map((pt, idx) => (
                    <tr key={idx} className={isDark ? "hover:bg-gray-700/50" : "hover:bg-gray-50"}>
                      <td className={"p-2 pl-3 whitespace-nowrap " + (isDark ? "text-gray-400" : "text-gray-500")}>
                        {pt.time}
                      </td>
                      {fieldConfigs
                        .filter(f => visibleFields.includes(f.key))
                        .map(field => (
                          <td key={field.key} className="p-2 whitespace-nowrap">
                            {pt[field.key] !== undefined ? pt[field.key] : '-'}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealtimeLive;
