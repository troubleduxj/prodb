/**
 * RealtimeLive 功能模块 - 数据获取 Hook
 * 包含所有 TDengine 数据获取逻辑
 */

import { useState, useCallback, useEffect } from 'react';
import { api } from '../../src/services/api';
import { toast } from '../../src/hooks/use-toast';
import type {
  Database,
  SuperTable,
  TableColumn,
  FieldConfig,
  DataPoint,
  QueryResult,
  RefreshRate
} from './types';
import { colorPalette, iconMap } from './types';

export function useRealtimeData() {
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
  const [refreshRate, setRefreshRate] = useState<RefreshRate>(5000);
  const [isPaused, setIsPaused] = useState(false);
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [visibleFields, setVisibleFields] = useState<string[]>([]);
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const maxPoints = 100;

  // 获取数据库列表
  const fetchDatabases = useCallback(async () => {
    try {
      setDbLoading(true);
      setError(null);
      const result = await api.tdengine.listDatabases();

      console.log('[RealtimeLive] Database API result:', result);

      if (result.success && result.data) {
        let dbList: Database[] = [];
        let responseData = result.data.data || result.data;

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

        if (result.data.mock || responseData.mock) {
          toast({
            title: 'Warning',
            description: 'Using mock data - TDengine connection failed',
            variant: 'warning'
          });
        }
      } else {
        const errorMsg = result.error || 'Failed to load databases';
        setError(errorMsg);
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive'
        });
      }
    } catch (err) {
      console.error('[RealtimeLive] Failed to fetch databases:', err);
      setError('Failed to connect to TDengine');
    } finally {
      setDbLoading(false);
    }
  }, []);

  // 获取超级表列表
  const fetchSuperTables = useCallback(async (dbName: string) => {
    if (!dbName) return;

    try {
      setTableLoading(true);
      setError(null);
      const result = await api.tdengine.listSuperTables(dbName);

      console.log('[RealtimeLive] SuperTable API result:', result);

      if (result.success && result.data) {
        let stList: SuperTable[] = [];
        const responseData = result.data.data || result.data;
        const stData = responseData.supertables || responseData.data?.supertables || [];

        console.log('[RealtimeLive] SuperTable responseData:', responseData);
        console.log('[RealtimeLive] SuperTable stData:', stData);

        if (Array.isArray(stData)) {
          stList = stData.map((st: any) => ({
            name: st.name || st.stable_name || st.Name,
            stable_name: st.stable_name || st.name || st.Name,
            database: dbName
          }));
        }

        console.log('[RealtimeLive] Parsed super tables:', stList);

        setSuperTables(stList);
        setSelectedSuperTable('');
        setSubTables([]);
      } else {
        const errorMsg = result.error || 'Failed to load super tables';
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive'
        });
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

      console.log('[RealtimeLive] SubTable API result:', result);

      if (result.success && result.data) {
        let subList: SuperTable[] = [];
        const responseData = result.data.data || result.data;
        const subData = responseData.subtables || responseData.data?.subtables || [];

        console.log('[RealtimeLive] SubTable responseData:', responseData);
        console.log('[RealtimeLive] SubTable subData:', subData);

        if (Array.isArray(subData)) {
          subList = subData.map((st: any) => ({
            name: st.name || st.table_name || st,
            stable_name: superTableName,
            database: dbName
          }));
        }

        console.log('[RealtimeLive] Parsed sub tables:', subList);

        setSubTables(subList);
        setSelectedSubTable('');
      }
    } catch (err) {
      console.error('[RealtimeLive] Failed to fetch sub tables:', err);
    } finally {
      setTableLoading(false);
    }
  }, []);

  // 从列生成字段配置
  const createFieldConfigs = (cols: TableColumn[]): FieldConfig[] => {
    const numericCols = cols.filter(c => {
      if (!c || !c.type || !c.name) return false;
      const typeLower = c.type.toLowerCase();
      return ['float', 'double', 'int', 'bigint', 'smallint', 'tinyint'].some(t =>
        typeLower.includes(t)
      ) && !typeLower.includes('timestamp');
    });

    return numericCols.map((col, index) => {
      const lowerName = col.name.toLowerCase();
      let icon = iconMap.default;

      for (const [key, Icon] of Object.entries(iconMap)) {
        if (lowerName.includes(key)) {
          icon = Icon;
          break;
        }
      }

      return {
        key: col.name,
        label: col.name,
        color: colorPalette[index % colorPalette.length],
        icon
      };
    });
  };

  // 加载表结构
  const loadTableSchema = useCallback(async (dbName: string, tableName: string) => {
    if (!dbName || !tableName) return;

    console.log('[RealtimeLive] Loading schema for subtable:', tableName);

    try {
      const describeSql = `DESCRIBE \`${dbName}\`.\`${tableName}\``;
      console.log('[RealtimeLive] DESCRIBE SQL:', describeSql);

      const queryResult = await api.tdengine.query(describeSql);
      console.log('[RealtimeLive] DESCRIBE result:', queryResult);

      if (queryResult.success && queryResult.data) {
        const responseData = queryResult.data.data || queryResult.data;
        const cols = responseData.rows || responseData.data || responseData;

        console.log('[RealtimeLive] DESCRIBE full response:', queryResult.data);
        console.log('[RealtimeLive] DESCRIBE columns raw:', cols);

        if (cols && Array.isArray(cols) && cols.length > 0) {
          const parsedCols: TableColumn[] = cols.map((col: any) => ({
            name: col.name || col.field || col[0],
            type: col.type || col.Type || col[1],
            length: col.length || col.Length || col[2] || 0,
            note: col.note || col.Note || col[3] || ''
          }));

          console.log('[RealtimeLive] Parsed columns:', parsedCols);
          setColumns(parsedCols);

          const tsCol = parsedCols.find((c: TableColumn) =>
            c && c.type && c.type.toLowerCase().includes('timestamp')
          );
          if (tsCol) {
            console.log('[RealtimeLive] Found timestamp column:', tsCol.name);
            setTimestampColumn(tsCol.name);
          } else {
            console.warn('[RealtimeLive] No timestamp column found, using "ts" as default');
            setTimestampColumn('ts');
          }

          const configs = createFieldConfigs(parsedCols);
          console.log('[RealtimeLive] Generated field configs:', configs);
          setFieldConfigs(configs);
          setVisibleFields(configs.slice(0, 4).map(f => f.key));
        }
      }
    } catch (err) {
      console.error('[RealtimeLive] Failed to load schema:', err);
    }
  }, []);

  // 查询实时数据
  const fetchRealtimeData = useCallback(async () => {
    if (!selectedDb || !selectedSubTable) {
      console.log('[RealtimeLive] No subtable selected, skipping query');
      return;
    }

    try {
      setDataLoading(true);
      setError(null);

      const tsCol = timestampColumn || 'ts';
      const sql = `SELECT * FROM \`${selectedDb}\`.\`${selectedSubTable}\` ORDER BY \`${tsCol}\` DESC LIMIT ${maxPoints}`;

      console.log('[RealtimeLive] Executing SQL:', sql);

      const result = await api.tdengine.query(sql);

      console.log('[RealtimeLive] Query result:', result);

      if (result.success && result.data) {
        const responseData = result.data.data || result.data;
        const dataRows = responseData.rows || responseData.data || [];
        const queryData: QueryResult = {
          columns: responseData.columns,
          data: dataRows,
          rows: dataRows.length
        };

        console.log('[RealtimeLive] Query columns:', queryData.columns);
        console.log('[RealtimeLive] Query data rows:', queryData.data?.length);

        if (queryData.data && Array.isArray(queryData.data)) {
          const tsColName = timestampColumn || 'ts';
          const formattedData = queryData.data.map((row: any) => {
            const point: any = {};
            queryData.columns.forEach((col, idx) => {
              point[col] = row[idx] !== undefined ? row[idx] : row[col];
            });
            if (point[tsColName]) {
              const ts = new Date(point[tsColName]);
              point.time = ts.toLocaleTimeString([], { hour12: false });
              point.fullTime = point[tsColName];
            }
            return point;
          });

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
  }, [selectedDb, selectedSubTable, timestampColumn]);

  // 切换字段显示
  const toggleField = useCallback((fieldKey: string) => {
    setVisibleFields(prev =>
      prev.includes(fieldKey)
        ? prev.filter(f => f !== fieldKey)
        : [...prev, fieldKey]
    );
  }, []);

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
    }
  }, [selectedDb, selectedSuperTable, fetchSubTables]);

  // 子表改变时加载表结构
  useEffect(() => {
    if (selectedDb && selectedSubTable) {
      loadTableSchema(selectedDb, selectedSubTable);
    }
  }, [selectedSubTable, selectedDb, loadTableSchema]);

  // 表结构加载完成后查询初始数据
  useEffect(() => {
    if (selectedDb && selectedSubTable && columns.length > 0 && timestampColumn) {
      console.log('[RealtimeLive] Schema loaded, fetching initial data...');
      fetchRealtimeData();
    }
  }, [selectedDb, selectedSubTable, columns.length, timestampColumn, fetchRealtimeData]);

  // 定时刷新数据
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      fetchRealtimeData();
    }, refreshRate);

    return () => clearInterval(interval);
  }, [refreshRate, isPaused, fetchRealtimeData]);

  return {
    // 状态
    databases,
    superTables,
    subTables,
    selectedDb,
    selectedSuperTable,
    selectedSubTable,
    dbLoading,
    tableLoading,
    dataLoading,
    columns,
    timestampColumn,
    refreshRate,
    isPaused,
    dataPoints,
    visibleFields,
    fieldConfigs,
    lastUpdateTime,
    error,

    // 设置器
    setSelectedDb,
    setSelectedSuperTable,
    setSelectedSubTable,
    setRefreshRate,
    setIsPaused,
    setError,
    setDataPoints,

    // 操作
    fetchDatabases,
    fetchRealtimeData,
    toggleField
  };
}
