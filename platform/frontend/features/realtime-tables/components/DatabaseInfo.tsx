import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Loader2 } from 'lucide-react';
import { api } from '../../../src/services/api';

interface DatabaseInfoProps {
  dbName: string;
  isDark: boolean;
}

export const DatabaseInfo: React.FC<DatabaseInfoProps> = ({ dbName, isDark }) => {
  const { t } = useTranslation();
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDbInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.tdengine.getDatabase(dbName);
        
        if (!result.success) {
          setError(result.error || '获取数据库信息失败');
          setInfo(null);
          return;
        }

        // 提取数据库信息 - 支持多种数据结构
        let dbInfo = null;
        const data = result.data;

        if (data) {
          if (data.data?.name || data.data?.Name) {
            // 结构: { data: { name, created_time, ... } }
            dbInfo = data.data;
          } else if (data.name || data.Name) {
            // 结构: { name, created_time, ... }
            dbInfo = data;
          }
        }

        if (!dbInfo) {
          setError('数据格式错误');
          setInfo(null);
          return;
        }

        setInfo(dbInfo);
      } catch (error) {
        console.error('Error fetching database info:', error);
        setError('获取失败');
        setInfo(null);
      } finally {
        setLoading(false);
      }
    };

    if (dbName) {
      fetchDbInfo();
    }
  }, [dbName]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-32 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-2" />
        {t('common.loading', '加载中...')}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 rounded-lg border ${isDark ? "bg-red-900/20 border-red-700" : "bg-red-50 border-red-200"}`}>
        <div className={`flex flex-col items-center justify-center ${isDark ? 'text-red-400' : 'text-red-600'}`}>
          <Database className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm font-medium">{error}</p>
          <p className="text-xs mt-1 opacity-75">{dbName}</p>
        </div>
      </div>
    );
  }

  // Helper to format value
  const formatValue = (val: any, key?: string) => {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    // 格式化时间字段
    if (key === 'created_time' && val) {
      try {
        const date = new Date(val);
        return date.toLocaleString('zh-CN');
      } catch {
        return String(val);
      }
    }
    return String(val);
  };

  // 安全获取字段值（支持驼峰和下划线命名）
  const getValue = (obj: any, ...keys: string[]) => {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) {
        return obj[key];
      }
    }
    return undefined;
  };

  // Database parameters to display
  const dbParams = info ? [
    { label: t('realtimeTables.dbName', '数据库名称'), key: 'name', value: getValue(info, 'name', 'Name') || dbName },
    { label: t('realtimeTables.createdTime', '创建时间'), key: 'created_time', value: getValue(info, 'created_time', 'createdTime', 'CreatedTime') },
    { label: t('realtimeTables.ntables', '表数量'), key: 'ntables', value: getValue(info, 'ntables', 'nTables', 'NTables') },
    { label: t('realtimeTables.vgroups', '虚拟组数'), key: 'vgroups', value: getValue(info, 'vgroups', 'vGroups', 'VGroups') },
    { label: t('realtimeTables.replica', '副本数'), key: 'replica', value: getValue(info, 'replica', 'Replica') },
    { label: t('realtimeTables.quorum', '仲裁数'), key: 'quorum', value: getValue(info, 'quorum', 'Quorum') },
    { label: t('realtimeTables.duration', 'Duration'), key: 'duration', value: getValue(info, 'duration', 'Duration') },
    { label: t('realtimeTables.keep', '数据保留时长'), key: 'keep', value: getValue(info, 'keep', 'Keep') },
    { label: t('realtimeTables.buffer', 'Buffer'), key: 'buffer', value: getValue(info, 'buffer', 'Buffer') },
    { label: t('realtimeTables.pages', 'Pages'), key: 'pages', value: getValue(info, 'pages', 'Pages') },
    { label: t('realtimeTables.pagesize', 'PageSize'), key: 'pagesize', value: getValue(info, 'pagesize', 'PageSize') },
    { label: t('realtimeTables.minrows', '最小行数'), key: 'minrows', value: getValue(info, 'minrows', 'minRows', 'MinRows') },
    { label: t('realtimeTables.maxrows', '最大行数'), key: 'maxrows', value: getValue(info, 'maxrows', 'maxRows', 'MaxRows') },
    { label: t('realtimeTables.comp', '压缩级别'), key: 'comp', value: getValue(info, 'comp', 'Comp') },
    { label: t('realtimeTables.precision', '时间精度'), key: 'precision', value: getValue(info, 'precision', 'Precision') },
    { label: t('realtimeTables.wallevel', 'WAL级别'), key: 'wallevel', value: getValue(info, 'wallevel', 'walLevel', 'WalLevel') },
    { label: t('realtimeTables.wal_retention_period', 'WAL保留周期'), key: 'wal_retention_period', value: getValue(info, 'wal_retention_period', 'WalRetentionPeriod') },
    { label: t('realtimeTables.wal_fsync_period', 'WAL同步周期'), key: 'wal_fsync_period', value: getValue(info, 'wal_fsync_period', 'WalFsyncPeriod') },
    { label: t('realtimeTables.stt_trigger', 'STT触发器'), key: 'stt_trigger', value: getValue(info, 'stt_trigger', 'SttTrigger') },
    { label: t('realtimeTables.cachemodel', '缓存模型'), key: 'cachemodel', value: getValue(info, 'cachemodel', 'CacheModel') },
    { label: t('realtimeTables.cachesize', '缓存大小'), key: 'cachesize', value: getValue(info, 'cachesize', 'CacheSize') },
    { label: t('realtimeTables.strict', 'Strict'), key: 'strict', value: getValue(info, 'strict', 'Strict') },
    { label: t('realtimeTables.status', '状态'), key: 'status', value: getValue(info, 'status', 'Status') },
  ] : [];


  return (
    <div className={`p-6 rounded-lg border ${isDark ? "bg-gray-900/50 border-gray-700" : "bg-white border-gray-200"}`}>
      <h4 className={`text-lg font-semibold mb-6 flex items-center ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
        <Database className="w-5 h-5 mr-2 text-yellow-500" />
        {dbName}
        <span className={`ml-3 text-xs px-2 py-1 rounded ${isDark ? 'bg-green-600/20 text-green-400' : 'bg-green-100 text-green-700'}`}>
          {t('realtimeTables.database', '数据库')}
        </span>
      </h4>
      
      {info ? (
        <div className="space-y-6">
          {/* Basic Info Section */}
          <div>
            <h5 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('realtimeTables.basicInfo', '基本信息')}
            </h5>
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-4`}>
              {dbParams.slice(0, 4).map((param) => (
                <div key={param.key} className={`p-3 rounded ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{param.label}</div>
                  <div className={`text-sm font-mono mt-1 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                    {formatValue(param.value, param.key)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Configuration Section */}
          <div>
            <h5 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('realtimeTables.configuration', '配置参数')}
            </h5>
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-4`}>
              {dbParams.slice(4, 12).map((param) => (
                <div key={param.key} className={`p-3 rounded ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{param.label}</div>
                  <div className={`text-sm font-mono mt-1 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                    {formatValue(param.value, param.key)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Advanced Section */}
          <div>
            <h5 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {t('realtimeTables.advancedSettings', '高级设置')}
            </h5>
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-4`}>
              {dbParams.slice(12).map((param) => (
                <div key={param.key} className={`p-3 rounded ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{param.label}</div>
                  <div className={`text-sm font-mono mt-1 ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                    {formatValue(param.value, param.key)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            {t('realtimeTables.dbInfoHint', '选择超级表或子表查看详细结构')}
          </div>
        </div>
      ) : (
        <div className={`flex flex-col items-center justify-center h-32 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          <Database className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">{t('realtimeTables.noDbInfo', '暂无数据库信息')}</p>
        </div>
      )}
    </div>
  );
};

export default DatabaseInfo;
