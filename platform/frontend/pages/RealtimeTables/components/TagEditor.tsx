import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, Plus, X } from 'lucide-react';
import type { TagInfo } from '../types';

interface TagEditorProps {
  newTag: Partial<TagInfo>;
  isDark: boolean;
  onNameChange: (name: string) => void;
  onTypeChange: (type: string) => void;
  onLengthChange: (length: number | undefined) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const TagEditor: React.FC<TagEditorProps> = ({
  newTag,
  isDark,
  onNameChange,
  onTypeChange,
  onLengthChange,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();

  return (
    <div className={`mt-6 p-4 rounded-lg border ${isDark ? 'bg-purple-900/20 border-purple-500/30' : 'bg-purple-50 border-purple-200'}`}>
      <h4 className={`text-sm font-medium mb-4 flex items-center ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
        <Tag className="w-4 h-4 mr-2" />
        {t('realtimeTables.addNewTag', '添加新标签')}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {t('common.name', '名称')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={newTag.name || ''}
            onChange={(e) => onNameChange(e.target.value)}
            className={`w-full px-3 py-2 text-sm rounded border outline-none focus:border-purple-500 ${
              isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'
            }`}
            placeholder={t('realtimeTables.tagName', '标签名称')}
          />
        </div>
        <div>
          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {t('common.type', '类型')}
          </label>
          <select
            value={newTag.type || 'VARCHAR'}
            onChange={(e) => onTypeChange(e.target.value)}
            className={`w-full px-3 py-2 text-sm rounded border outline-none focus:border-purple-500 ${
              isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="VARCHAR">VARCHAR</option>
            <option value="BINARY">BINARY</option>
            <option value="NCHAR">NCHAR</option>
            <option value="INT">INT</option>
            <option value="BIGINT">BIGINT</option>
            <option value="FLOAT">FLOAT</option>
            <option value="DOUBLE">DOUBLE</option>
            <option value="SMALLINT">SMALLINT</option>
            <option value="TINYINT">TINYINT</option>
            <option value="BOOL">BOOL</option>
          </select>
        </div>
        <div>
          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {t('common.length', '长度')}
          </label>
          <input
            type="number"
            value={newTag.length || ''}
            onChange={(e) => onLengthChange(e.target.value ? parseInt(e.target.value) : undefined)}
            className={`w-full px-3 py-2 text-sm rounded border outline-none focus:border-purple-500 ${
              isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'
            }`}
            placeholder={t('realtimeTables.optional', '可选')}
          />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={onSave}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded transition-colors"
        >
          <Plus className="w-4 h-4 inline mr-1" />
          {t('common.add', '添加')}
        </button>
        <button
          onClick={onCancel}
          className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
            isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <X className="w-4 h-4 inline mr-1" />
          {t('common.cancel', '取消')}
        </button>
      </div>
    </div>
  );
};

export default TagEditor;
