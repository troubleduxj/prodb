import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import type { NewColumnForm } from '../types';

export interface AddColumnModalProps {
  /** 是否显示 */
  show: boolean;
  /** 表单数据 */
  form: NewColumnForm;
  /** 可用列类型 */
  columnTypes: string[];
  /** 表单是否有效 */
  isValid: boolean;
  /** 是否需要显示长度输入 */
  showLengthInput: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 添加回调 */
  onAdd: () => void;
  /** 列名变化回调 */
  onNameChange: (name: string) => void;
  /** 列类型变化回调 */
  onTypeChange: (type: string) => void;
  /** 列长度变化回调 */
  onLengthChange: (length: number) => void;
  /** 是否为暗黑模式 */
  isDark: boolean;
}

/**
 * 添加列弹窗组件
 */
export const AddColumnModal: React.FC<AddColumnModalProps> = ({
  show,
  form,
  columnTypes,
  isValid,
  showLengthInput,
  onClose,
  onAdd,
  onNameChange,
  onTypeChange,
  onLengthChange,
  isDark,
}) => {
  const { t } = useTranslation();

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        className={`rounded-xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'
        }`}
      >
        {/* Header */}
        <div
          className={`p-6 flex justify-between items-center ${
            isDark ? 'border-b border-gray-700' : 'border-b border-gray-200'
          }`}
        >
          <h2 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            {t('operations.data.addNew', 'Add New')} {form.isTag ? t('operations.data.tag', 'Tag') : t('operations.data.column', 'Column')}
          </h2>
          <button
            onClick={onClose}
            className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('common.name', 'Name')}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => onNameChange(e.target.value)}
              className={`w-full border rounded px-3 py-2 outline-none focus:border-blue-500 ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-gray-100'
                  : 'bg-gray-50 border-gray-300 text-gray-900'
              }`}
              placeholder="e.g. engine_temp"
            />
          </div>

          {/* Type */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('common.dataType', 'Data Type')}
            </label>
            <select
              value={form.type}
              onChange={e => onTypeChange(e.target.value)}
              className={`w-full border rounded px-3 py-2 outline-none focus:border-blue-500 ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-gray-100'
                  : 'bg-gray-50 border-gray-300 text-gray-900'
              }`}
            >
              <option value="INT">INT</option>
              <option value="BIGINT">BIGINT</option>
              <option value="FLOAT">FLOAT</option>
              <option value="DOUBLE">DOUBLE</option>
              <option value="BOOL">BOOL</option>
              <option value="TIMESTAMP">TIMESTAMP</option>
              <option value="BINARY">BINARY ({t('common.string', 'String')})</option>
              <option value="NCHAR">NCHAR ({t('common.unicode', 'Unicode')})</option>
            </select>
          </div>

          {/* Length (for BINARY/NCHAR) */}
          {showLengthInput && (
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {t('common.length', 'Length')}
              </label>
              <input
                type="number"
                value={form.length}
                onChange={e => onLengthChange(Number(e.target.value))}
                className={`w-full border rounded px-3 py-2 outline-none focus:border-blue-500 ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-gray-100'
                    : 'bg-gray-50 border-gray-300 text-gray-900'
                }`}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`p-6 flex justify-end gap-3 rounded-b-xl ${
            isDark ? 'border-t border-gray-700 bg-gray-750' : 'border-t border-gray-200 bg-gray-50'
          }`}
        >
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm ${
              isDark ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={onAdd}
            disabled={!isValid}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium flex items-center shadow-lg disabled:opacity-50"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {t('common.add', 'Add')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddColumnModal;
