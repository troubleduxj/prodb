import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Trash2, Save, Loader2 } from 'lucide-react';
import { api } from '../../../src/services/api';
import { toast } from '../../../src/hooks/use-toast';

export interface DatabaseSettingsProps {
  /** 数据库名称 */
  dbName: string;
  /** 是否为暗黑模式 */
  isDark: boolean;
  /** 保存回调 */
  onSave?: (config: DatabaseConfig) => void;
  /** 删除回调 */
  onDelete?: (dbName: string) => void;
}

export interface DatabaseConfig {
  keepDays: number;
  duration: number;
  replicaFactor: number;
  walLevel: number;
  vgroups: number;
}

/**
 * 数据库设置组件
 * 数据库配置表单和保留策略设置
 */
export const DatabaseSettings: React.FC<DatabaseSettingsProps> = ({
  dbName,
  isDark,
  onSave,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<DatabaseConfig>({
    keepDays: 365,
    duration: 10,
    replicaFactor: 3,
    walLevel: 2,
    vgroups: 4,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取数据库配置
  const fetchConfig = useCallback(async () => {
    if (!dbName) return;

    try {
      setLoading(true);
      setError(null);
      const result = await api.tdengine.getDatabaseConfig(dbName);

      if (result.success && result.data) {
        const data = result.data.data || result.data;
        setConfig({
          keepDays: data.keepDays || data.keep || 365,
          duration: data.duration || 10,
          replicaFactor: data.replicaFactor || data.replica || 3,
          walLevel: data.walLevel || data.wal || 2,
          vgroups: data.vgroups || 4,
        });
      } else {
        const errorMsg = result.error || 'Failed to load database config';
        setError(errorMsg);
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      toast({
        title: 'Error',
        description: 'Failed to load database config: ' + errorMsg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [dbName]);

  // 加载数据库配置
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // 保存配置
  const handleSave = async () => {
    if (!dbName) return;

    try {
      setSaving(true);
      const result = await api.tdengine.updateDatabaseConfig(dbName, config);

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Database configuration saved successfully',
          variant: 'success',
        });
        onSave?.(config);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to save database config',
          variant: 'destructive',
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Error',
        description: 'Failed to save database config: ' + errorMsg,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (
      window.confirm(
        t(
          'operations.data.confirmDeleteDatabase',
          'Are you sure you want to delete this database?'
        )
      )
    ) {
      onDelete?.(dbName);
    }
  };

  if (loading) {
    return (
      <div className={`p-6 max-w-4xl flex items-center justify-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading database configuration...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 max-w-4xl ${isDark ? 'text-red-400' : 'text-red-600'}`}>
        <p className="font-medium">Failed to load configuration</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={fetchConfig}
          className={`mt-4 px-4 py-2 rounded-lg text-sm ${
            isDark
              ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2
            className={`text-2xl font-bold flex items-center ${
              isDark ? 'text-gray-100' : 'text-gray-900'
            }`}
          >
            <Database className="w-6 h-6 mr-3 text-yellow-500" />
            {dbName}
          </h2>
          <p
            className={`text-sm mt-1 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {t(
              'operations.data.databaseConfigParams',
              'Database Configuration & Parameters'
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDelete}
            className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center ${
              isDark
                ? 'bg-red-900/20 text-red-400 border border-red-900/50 hover:bg-red-900/30'
                : 'bg-red-100 text-red-600 border border-red-200 hover:bg-red-200'
            }`}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t('operations.data.dropDatabase', 'Drop Database')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center shadow-lg shadow-blue-900/20"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {t('common.saveChanges', 'Save Changes')}
          </button>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Retention Policy */}
        <div
          className={`p-5 rounded-xl space-y-4 ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200 border'
          }`}
        >
          <h3
            className={`font-bold border-b pb-2 ${
              isDark
                ? 'text-gray-200 border-gray-700'
                : 'text-gray-900 border-gray-200'
            }`}
          >
            {t('operations.data.retentionPolicy', 'Retention Policy')}
          </h3>

          <div>
            <label
              className={`block text-xs font-medium mb-1 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              {t('operations.data.keepDays', 'Keep (Days)')}
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={config.keepDays}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    keepDays: Number(e.target.value),
                  }))
                }
                className={`flex-1 border rounded px-3 py-2 outline-none focus:border-blue-500 ${
                  isDark
                    ? 'bg-gray-900 border-gray-600 text-gray-200'
                    : 'bg-gray-50 border-gray-300 text-gray-900'
                }`}
              />
              <span
                className={`text-sm self-center ${
                  isDark ? 'text-gray-500' : 'text-gray-600'
                }`}
              >
                {t('common.days', 'days')}
              </span>
            </div>
            <p
              className={`text-[10px] mt-1 ${
                isDark ? 'text-gray-500' : 'text-gray-600'
              }`}
            >
              {t(
                'operations.data.keepDescription',
                'How long to keep raw data before automatic deletion.'
              )}
            </p>
          </div>

          <div>
            <label
              className={`block text-xs font-medium mb-1 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              {t('operations.data.durationBlocks', 'Duration (Blocks)')}
            </label>
            <input
              type="number"
              value={config.duration}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  duration: Number(e.target.value),
                }))
              }
              className={`w-full border rounded px-3 py-2 outline-none focus:border-blue-500 ${
                isDark
                  ? 'bg-gray-900 border-gray-600 text-gray-200'
                  : 'bg-gray-50 border-gray-300 text-gray-900'
              }`}
            />
          </div>
        </div>

        {/* Performance & Availability */}
        <div
          className={`p-5 rounded-xl space-y-4 ${
            isDark
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200 border'
          }`}
        >
          <h3
            className={`font-bold border-b pb-2 ${
              isDark
                ? 'text-gray-200 border-gray-700'
                : 'text-gray-900 border-gray-200'
            }`}
          >
            {t(
              'operations.data.performanceAvailability',
              'Performance & Availability'
            )}
          </h3>

          <div>
            <label
              className={`block text-xs font-medium mb-1 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              {t('operations.data.replicaFactor', 'Replica Factor')}
            </label>
            <select
              value={config.replicaFactor}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  replicaFactor: Number(e.target.value),
                }))
              }
              className={`w-full border rounded px-3 py-2 outline-none ${
                isDark
                  ? 'bg-gray-900 border-gray-600 text-gray-200'
                  : 'bg-gray-50 border-gray-300 text-gray-900'
              }`}
            >
              <option value={1}>
                1 ({t('operations.data.noHighAvailability', 'No High Availability')})
              </option>
              <option value={3}>
                3 ({t('operations.data.standardHA', 'Standard HA')})
              </option>
              <option value={5}>
                5 ({t('operations.data.highReliability', 'High Reliability')})
              </option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className={`block text-xs font-medium mb-1 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {t('operations.data.walLevel', 'WAL Level')}
              </label>
              <select
                value={config.walLevel}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    walLevel: Number(e.target.value),
                  }))
                }
                className={`w-full border rounded px-3 py-2 outline-none ${
                  isDark
                    ? 'bg-gray-900 border-gray-600 text-gray-200'
                    : 'bg-gray-50 border-gray-300 text-gray-900'
                }`}
              >
                <option value={1}>
                  1 ({t('operations.data.writeOnly', 'Write Only')})
                </option>
                <option value={2}>2 ({t('operations.data.fsync', 'Fsync')})</option>
              </select>
            </div>
            <div>
              <label
                className={`block text-xs font-medium mb-1 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {t('operations.data.vgroups', 'VGroups')}
              </label>
              <input
                type="number"
                value={config.vgroups}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    vgroups: Number(e.target.value),
                  }))
                }
                className={`w-full border rounded px-3 py-2 outline-none ${
                  isDark
                    ? 'bg-gray-900 border-gray-600 text-gray-200'
                    : 'bg-gray-50 border-gray-300 text-gray-900'
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseSettings;
