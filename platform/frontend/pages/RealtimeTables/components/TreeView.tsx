import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, RefreshCw, Database, Layers, Table, Eye, ChevronRight, ChevronDown } from 'lucide-react';
import type { TreeNode } from '../types';

interface TreeViewProps {
  treeData: TreeNode[];
  selectedNode: TreeNode | null;
  loading: boolean;
  loadingNodeId: string | null;
  isDark: boolean;
  onToggleNode: (node: TreeNode) => void;
  onSelectNode: (node: TreeNode, type: 'data' | 'manage') => void;
  onRefresh: () => void;
}

export const TreeView: React.FC<TreeViewProps> = ({
  treeData,
  selectedNode,
  loading,
  loadingNodeId,
  isDark,
  onToggleNode,
  onSelectNode,
  onRefresh,
}) => {
  const { t } = useTranslation();

  // Render tree node
  const renderTreeNode = (node: TreeNode, level: number = 0) => {
    const isSelected = selectedNode?.id === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const canExpand = node.type === 'DB' || node.type === 'CATEGORY' || node.type === 'STABLE';
    const isLoading = loadingNodeId === node.id;

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer transition-colors ${
            isSelected
              ? (isDark ? 'bg-blue-600/30 text-blue-200' : 'bg-blue-50 text-blue-700')
              : (isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700')
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            onSelectNode(node, node.type === 'TABLE' ? 'data' : 'manage');
          }}
        >
          {canExpand ? (
            isLoading ? (
              <Loader2 className="w-4 h-4 shrink-0 animate-spin text-blue-500" />
            ) : node.expanded ? (
              <ChevronDown
                className="w-4 h-4 shrink-0 cursor-pointer hover:text-blue-400"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleNode(node);
                }}
              />
            ) : (
              <ChevronRight
                className="w-4 h-4 shrink-0 cursor-pointer hover:text-blue-400"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleNode(node);
                }}
              />
            )
          ) : (
            <span className="w-4" />
          )}
          
          {node.type === 'DB' && <Database className="w-4 h-4 shrink-0 text-yellow-500" />}
          {node.type === 'STABLE' && <Layers className="w-4 h-4 shrink-0 text-blue-500" />}
          {node.type === 'TABLE' && <Table className="w-4 h-4 shrink-0 text-green-500" />}
          {node.type === 'VIEW' && <Eye className="w-4 h-4 shrink-0 text-purple-500" />}
          
          <span className="truncate text-sm">{node.name}</span>
        </div>
        
        {hasChildren && node.expanded && (
          <div>
            {node.children!.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`w-64 rounded-lg flex flex-col overflow-hidden shrink-0 ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
      <div className={`p-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="relative">
          <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder={t('common.search', 'Search...')}
            className={`w-full pl-8 pr-3 py-1.5 text-sm rounded border outline-none focus:border-blue-500 ${
              isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-gray-50 border-gray-300 text-gray-900'
            }`}
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : (
          treeData.map(node => renderTreeNode(node))
        )}
      </div>
      
      <div className={`p-2 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <button
          onClick={onRefresh}
          className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded transition-colors ${
            isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          {t('common.refresh', 'Refresh')}
        </button>
      </div>
    </div>
  );
};

export default TreeView;
