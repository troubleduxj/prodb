import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, Save } from 'lucide-react';

export interface TagAttributesEditorProps {
  /** 表名 */
  tableName: string;
  /** 初始标签值 */
  initialTags: Record<string, any>;
  /** 是否为暗黑模式 */
  isDark: boolean;
  /** 保存回调 */
  onSave?: (tags: Record<string, any>) => void;
}

/**
 * 标签属性编辑器组件
 * 编辑子表的标签值
 */
export const TagAttributesEditor: React.FC<TagAttributesEditorProps> = ({
  tableName,
  initialTags,
  isDark,
  onSave,
}) => {
  const { t } = useTranslation();
  const [tags, setTags] = React.useState<Record<string, any>>(initialTags);

  const handleSave = () => {
    onSave?.(tags);
  };

  const handleTagChange = (key: string, value: string) => {
    setTags(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <div className="p-6 max-w-3xl">
      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/20 rounded-lg flex gap-3">
        <Tag className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <h4 className={`text-sm font-bold ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
            {t('operations.data.deviceStaticAttributes', 'Device Static Attributes')}
          </h4>
          <p className={`text-xs mt-1 ${isDark ? 'text-blue-200/80' : 'text-blue-700'}`}>
            {t('operations.data.modifyingTagsHere', 'Modifying tags here will update the metadata for')}{' '}
            <strong>{tableName}</strong>{' '}
            {t('operations.data.instantlyDescription', 'instantly. This does not affect historical metric data.')}
          </p>
        </div>
      </div>

      {/* Tags Table */}
      <div
        className={`rounded-xl overflow-hidden ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'
        }`}
      >
        <div
          className={`p-4 flex justify-between items-center ${
            isDark ? 'border-b border-gray-700 bg-gray-750' : 'border-b border-gray-200 bg-gray-50'
          }`}
        >
          <h3 className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
            {t('operations.data.tagValues', 'Tag Values')}
          </h3>
          <button
            onClick={handleSave}
            className="text-xs flex items-center bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-colors"
          >
            <Save className="w-3 h-3 mr-1.5" />
            {t('common.save', 'Save Attributes')}
          </button>
        </div>

        <table className="w-full text-left text-sm">
          <thead
            className={`text-xs uppercase ${
              isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <tr>
              <th className="p-4 w-1/3">{t('common.tagName', 'Tag Name')}</th>
              <th className="p-4">{t('common.currentValue', 'Current Value')}</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
            {Object.entries(tags).map(([key, value]) => (
              <tr key={key} className={isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'}>
                <td className="p-4 font-mono text-purple-300">{key}</td>
                <td className="p-4">
                  <input
                    type="text"
                    value={value}
                    onChange={e => handleTagChange(key, e.target.value)}
                    className={`border rounded px-3 py-2 w-full max-w-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all ${
                      isDark
                        ? 'bg-gray-900 border-gray-600 text-gray-200'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TagAttributesEditor;
