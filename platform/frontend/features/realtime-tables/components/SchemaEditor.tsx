import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Tag, Plus, Trash2, Edit3, Check, X } from 'lucide-react';
import type { ColumnInfo, TagInfo } from '../types';

interface SchemaEditorProps {
  columns: ColumnInfo[];
  tags: TagInfo[];
  tagValues?: Record<string, any>;
  isDark: boolean;
  readOnly?: boolean;
  canEditStructure?: boolean;  // Can add/delete columns and tags (super table only)
  canEditTagValues?: boolean;  // Can edit tag values (sub table only)
  onAddColumn?: () => void;
  onAddTag?: () => void;
  onDeleteColumn?: (name: string) => void;
  onDeleteTag?: (name: string) => void;
  onUpdateTagValue?: (tagName: string, value: any) => void;
}

export const SchemaEditor: React.FC<SchemaEditorProps> = ({
  columns,
  tags,
  tagValues,
  isDark,
  readOnly = false,
  canEditStructure = false,
  canEditTagValues = false,
  onAddColumn,
  onAddTag,
  onDeleteColumn,
  onDeleteTag,
  onUpdateTagValue
}) => {
  const { t } = useTranslation();
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const handleStartEdit = (tagName: string, currentValue: any) => {
    setEditingTag(tagName);
    setEditValue(currentValue !== undefined ? String(currentValue) : '');
  };

  const handleSaveEdit = (tagName: string) => {
    if (onUpdateTagValue) {
      onUpdateTagValue(tagName, editValue);
    }
    setEditingTag(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingTag(null);
    setEditValue('');
  };

  // Determine if we should show the actions column (always show for consistent column widths)
  const showActionsColumn = canEditStructure || canEditTagValues;

  return (
    <div className="space-y-8">
      {/* Columns Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className={`text-sm font-bold uppercase tracking-wider flex items-center ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            <Activity className="w-4 h-4 mr-2 text-blue-400" /> 
            {t("realtimeTables.dataColumns", "数据列 (Metrics)")}
            {canEditTagValues && (
              <span className={`ml-2 text-xs normal-case px-2 py-0.5 rounded ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
                {t("realtimeTables.inherited", "继承自超级表，不可修改")}
              </span>
            )}
          </h4>
          {canEditStructure && onAddColumn && (
            <button 
              onClick={onAddColumn} 
              className="text-xs flex items-center bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 px-3 py-1.5 rounded transition-colors border border-blue-600/30"
            >
              <Plus className="w-3 h-3 mr-1" /> {t("common.add", "添加列")}
            </button>
          )}
        </div>
        <div className={`rounded-lg overflow-hidden border ${isDark ? "bg-gray-900/50 border-gray-700" : "bg-white border-gray-200"}`}>
          <table className="w-full text-left text-sm table-fixed">
            <colgroup>
              <col className="w-[25%]" />
              <col className="w-[20%]" />
              <col className="w-[15%]" />
              <col className="w-[30%]" />
              {showActionsColumn && <col className="w-[10%]" />}
            </colgroup>
            <thead className={`text-xs uppercase ${isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"}`}>
              <tr>
                <th className="p-3 font-medium">{t("common.name", "名称")}</th>
                <th className="p-3 font-medium">{t("common.dataType", "数据类型")}</th>
                <th className="p-3 font-medium">{t("common.length", "长度")}</th>
                <th className="p-3 font-medium">{t("common.note", "备注")}</th>
                {showActionsColumn && <th className="p-3 font-medium text-right">{t("common.actions", "操作")}</th>}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-gray-800" : "divide-gray-200"}`}>
              {columns.length > 0 ? columns.map((col) => (
                <tr key={col.name} className={`group ${isDark ? "hover:bg-gray-800/50" : "hover:bg-gray-50"}`}>
                  <td className={`p-3 font-mono truncate ${isDark ? "text-gray-200" : "text-gray-900"}`}>{col.name}</td>
                  <td className="p-3 text-yellow-500 font-mono text-xs truncate">{col.type}</td>
                  <td className={`p-3 text-xs truncate ${isDark ? "text-gray-500" : "text-gray-600"}`}>{col.length || "-"}</td>
                  <td className={`p-3 text-xs truncate ${isDark ? "text-gray-500" : "text-gray-600"}`}>{col.note || "-"}</td>
                  {showActionsColumn && (
                    <td className="p-3 text-right">
                      {canEditStructure && col.name !== "ts" && onDeleteColumn && (
                        <button 
                          onClick={() => onDeleteColumn(col.name)}
                          className={`p-1 opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? "text-gray-600 hover:text-red-400" : "text-gray-400 hover:text-red-500"}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )) : (
                <tr>
                  <td colSpan={showActionsColumn ? 5 : 4} className={`p-3 text-center ${isDark ? "text-gray-500" : "text-gray-600"}`}>
                    {t("realtimeTables.noColumns", "暂无列信息")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tags Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className={`text-sm font-bold uppercase tracking-wider flex items-center ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            <Tag className="w-4 h-4 mr-2 text-purple-400" /> 
            {t("realtimeTables.tags", "标签 (Tags)")}
            {canEditTagValues && (
              <span className={`ml-2 text-xs normal-case px-2 py-0.5 rounded ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                {t("realtimeTables.canEditValues", "仅可修改值")}
              </span>
            )}
          </h4>
          {canEditStructure && onAddTag && (
            <button 
              onClick={onAddTag}
              className="text-xs flex items-center bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 px-3 py-1.5 rounded transition-colors border border-purple-600/30"
            >
              <Plus className="w-3 h-3 mr-1" /> {t("common.add", "添加标签")}
            </button>
          )}
        </div>
        <div className={`rounded-lg overflow-hidden border ${isDark ? "bg-gray-900/50 border-gray-700" : "bg-white border-gray-200"}`}>
          <table className="w-full text-left text-sm table-fixed">
            <colgroup>
              <col className="w-[25%]" />
              <col className="w-[20%]" />
              <col className="w-[15%]" />
              <col className="w-[30%]" />
              {showActionsColumn && <col className="w-[10%]" />}
            </colgroup>
            <thead className={`text-xs uppercase ${isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"}`}>
              <tr>
                <th className="p-3 font-medium">{t("common.name", "名称")}</th>
                <th className="p-3 font-medium">{t("common.dataType", "数据类型")}</th>
                <th className="p-3 font-medium">{t("common.length", "长度")}</th>
                <th className="p-3 font-medium">{t("realtimeTables.value", "值")}</th>
                {showActionsColumn && <th className="p-3 font-medium text-right">{t("common.actions", "操作")}</th>}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-gray-800" : "divide-gray-200"}`}>
              {tags.length > 0 ? tags.map((tag) => (
                <tr key={tag.name} className={`group ${isDark ? "hover:bg-gray-800/50" : "hover:bg-gray-50"}`}>
                  <td className={`p-3 font-mono truncate ${isDark ? "text-gray-200" : "text-gray-900"}`}>{tag.name}</td>
                  <td className="p-3 text-purple-500 font-mono text-xs truncate">{tag.type}</td>
                  <td className={`p-3 text-xs truncate ${isDark ? "text-gray-500" : "text-gray-600"}`}>{tag.length || "-"}</td>
                  <td className="p-3">
                    {editingTag === tag.name ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className={`w-full px-2 py-1 text-sm rounded border ${
                          isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'
                        }`}
                        autoFocus
                      />
                    ) : (
                      <span className={`text-xs truncate block ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        {tagValues?.[tag.name] !== undefined ? String(tagValues[tag.name]) : "-"}
                      </span>
                    )}
                  </td>
                  {showActionsColumn && (
                    <td className="p-3 text-right">
                      {editingTag === tag.name ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleSaveEdit(tag.name)}
                            className={`p-1 ${isDark ? "text-green-400 hover:text-green-300" : "text-green-600 hover:text-green-700"}`}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className={`p-1 ${isDark ? "text-gray-400 hover:text-gray-300" : "text-gray-600 hover:text-gray-700"}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          {canEditTagValues && (
                            <button
                              onClick={() => handleStartEdit(tag.name, tagValues?.[tag.name])}
                              className={`p-1 opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {canEditStructure && onDeleteTag && (
                            <button 
                              onClick={() => onDeleteTag(tag.name)}
                              className={`p-1 opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? "text-gray-600 hover:text-red-400" : "text-gray-400 hover:text-red-500"}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              )) : (
                <tr>
                  <td colSpan={showActionsColumn ? 5 : 4} className={`p-3 text-center ${isDark ? "text-gray-500" : "text-gray-600"}`}>
                    {t("realtimeTables.noTags", "暂无标签")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SchemaEditor;
