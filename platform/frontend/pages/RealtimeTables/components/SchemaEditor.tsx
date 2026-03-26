import React from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Tag, Plus, Trash2 } from 'lucide-react';
import type { ColumnInfo, TagInfo } from '../types';

interface SchemaEditorProps {
  columns: ColumnInfo[];
  tags: TagInfo[];
  tagValues?: Record<string, any>;
  isDark: boolean;
  readOnly?: boolean;
  onAddColumn?: () => void;
  onAddTag?: () => void;
  onDeleteColumn?: (name: string) => void;
  onDeleteTag?: (name: string) => void;
}

export const SchemaEditor: React.FC<SchemaEditorProps> = ({
  columns,
  tags,
  tagValues,
  isDark,
  readOnly = false,
  onAddColumn,
  onAddTag,
  onDeleteColumn,
  onDeleteTag
}) => {
  const { t } = useTranslation();
  
  return (
    <div className="space-y-8">
      {/* Columns Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className={`text-sm font-bold uppercase tracking-wider flex items-center ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            <Activity className="w-4 h-4 mr-2 text-blue-400" /> 
            {t("realtimeTables.dataColumns", "数据列 (Metrics)")}
          </h4>
          {!readOnly && onAddColumn && (
            <button 
              onClick={onAddColumn} 
              className="text-xs flex items-center bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 px-3 py-1.5 rounded transition-colors border border-blue-600/30"
            >
              <Plus className="w-3 h-3 mr-1" /> {t("common.add", "添加列")}
            </button>
          )}
        </div>
        <div className={`rounded-lg overflow-hidden border ${isDark ? "bg-gray-900/50 border-gray-700" : "bg-white border-gray-200"}`}>
          <table className="w-full text-left text-sm">
            <thead className={`text-xs uppercase ${isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"}`}>
              <tr>
                <th className="p-3 font-medium">{t("common.name", "名称")}</th>
                <th className="p-3 font-medium">{t("common.dataType", "数据类型")}</th>
                <th className="p-3 font-medium">{t("common.length", "长度")}</th>
                <th className="p-3 font-medium">{t("common.note", "备注")}</th>
                {!readOnly && <th className="p-3 font-medium text-right">{t("common.actions", "操作")}</th>}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-gray-800" : "divide-gray-200"}`}>
              {columns.length > 0 ? columns.map((col) => (
                <tr key={col.name} className={`group ${isDark ? "hover:bg-gray-800/50" : "hover:bg-gray-50"}`}>
                  <td className={`p-3 font-mono ${isDark ? "text-gray-200" : "text-gray-900"}`}>{col.name}</td>
                  <td className="p-3 text-yellow-500 font-mono text-xs">{col.type}</td>
                  <td className={`p-3 text-xs ${isDark ? "text-gray-500" : "text-gray-600"}`}>{col.length || "-"}</td>
                  <td className={`p-3 text-xs ${isDark ? "text-gray-500" : "text-gray-600"}`}>{col.note || "-"}</td>
                  {!readOnly && (
                    <td className="p-3 text-right">
                      {col.name !== "ts" && onDeleteColumn && (
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
                  <td colSpan={readOnly ? 4 : 5} className={`p-3 text-center ${isDark ? "text-gray-500" : "text-gray-600"}`}>
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
          </h4>
          {!readOnly && onAddTag && (
            <button 
              onClick={onAddTag} 
              className="text-xs flex items-center bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 px-3 py-1.5 rounded transition-colors border border-purple-600/30"
            >
              <Plus className="w-3 h-3 mr-1" /> {t("common.add", "添加标签")}
            </button>
          )}
        </div>
        <div className={`rounded-lg overflow-hidden border ${isDark ? "bg-gray-900/50 border-gray-700" : "bg-white border-gray-200"}`}>
          <table className="w-full text-left text-sm">
            <thead className={`text-xs uppercase ${isDark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600"}`}>
              <tr>
                <th className="p-3 font-medium">{t("common.name", "名称")}</th>
                <th className="p-3 font-medium">{t("common.dataType", "数据类型")}</th>
                <th className="p-3 font-medium">{t("common.length", "长度")}</th>
                <th className="p-3 font-medium">{t("realtimeTables.value", "值")}</th>
                {!readOnly && <th className="p-3 font-medium text-right">{t("common.actions", "操作")}</th>}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-gray-800" : "divide-gray-200"}`}>
              {tags.length > 0 ? tags.map((tag) => (
                <tr key={tag.name} className={`group ${isDark ? "hover:bg-gray-800/50" : "hover:bg-gray-50"}`}>
                  <td className={`p-3 font-mono ${isDark ? "text-gray-200" : "text-gray-900"}`}>{tag.name}</td>
                  <td className="p-3 text-purple-400 font-mono text-xs">{tag.type}</td>
                  <td className={`p-3 text-xs ${isDark ? "text-gray-500" : "text-gray-600"}`}>{tag.length || "-"}</td>
                  <td className={`p-3 text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    {tagValues && tagValues[tag.name] !== undefined ? String(tagValues[tag.name]) : "-"}
                  </td>
                  {!readOnly && (
                    <td className="p-3 text-right">
                      {onDeleteTag && (
                        <button
                          onClick={() => onDeleteTag(tag.name)}
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
                  <td colSpan={readOnly ? 4 : 5} className={`p-3 text-center ${isDark ? "text-gray-500" : "text-gray-600"}`}>
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
