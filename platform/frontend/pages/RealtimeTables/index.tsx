import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../src/contexts/ThemeContext';
import { api } from '../../src/services/api';
import { toast } from '../../src/hooks/use-toast';
import { Table, Settings2, Terminal, Activity, Edit3, Save, Plus, X } from 'lucide-react';

import { useTreeData } from './hooks/useTreeData';
import { useSchema } from './hooks/useSchema';
import { useDataPreview } from './hooks/useDataPreview';
import { useSubTableTags } from './hooks/useSubTableTags';

import TreeView from './components/TreeView';
import SchemaEditor from './components/SchemaEditor';
import DatabaseInfo from './components/DatabaseInfo';
import DataPreviewTable from './components/DataPreviewTable';
import TagEditor from './components/TagEditor';

import type { TreeNode, ColumnInfo, TagInfo } from './types';

export const RealtimeTables: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const navigate = useNavigate();

  // Tree data management
  const { 
    treeData, 
    setTreeData, 
    loading: treeLoading, 
    loadingNodeId, 
    fetchTreeData, 
    toggleNode 
  } = useTreeData();

  // Selected node state
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [activeTab, setActiveTab] = useState<'data' | 'manage'>('data');

  // Edit mode states
  const [editMode, setEditMode] = useState(false);
  const [isEditingColumns, setIsEditingColumns] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);

  // New column/tag form state
  const [newColumn, setNewColumn] = useState<Partial<ColumnInfo>>({
    name: '',
    type: 'FLOAT',
    length: undefined,
    note: ''
  });
  const [newTag, setNewTag] = useState<Partial<TagInfo>>({
    name: '',
    type: 'VARCHAR',
    length: 64
  });

  // Schema and data preview hooks
  const { schema, setSchema, loading: schemaLoading } = useSchema(selectedNode);
  const { dataPreview, loading: dataPreviewLoading } = useDataPreview(selectedNode);
  const { tagValues: subTableTagValues } = useSubTableTags(selectedNode);

  // Handle node selection
  const handleSelectNode = useCallback((node: TreeNode, tab: 'data' | 'manage') => {
    setSelectedNode(node);
    setActiveTab(tab);
  }, []);

  // Handle add column
  const handleAddColumn = useCallback(() => {
    if (!newColumn.name) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.nameRequired', 'Column name is required'),
        variant: 'destructive',
      });
      return;
    }

    const column: ColumnInfo = {
      name: newColumn.name,
      type: newColumn.type || 'FLOAT',
      length: newColumn.length,
      note: newColumn.note,
    };

    setSchema(prev => ({ ...prev, columns: [...prev.columns, column] }));
    setNewColumn({ name: '', type: 'FLOAT', length: undefined, note: '' });
    setIsEditingColumns(false);
    
    toast({
      title: t('common.success', 'Success'),
      description: t('realtimeTables.columnAdded', 'Column added successfully'),
    });
  }, [newColumn, setSchema, t]);

  // Handle delete column
  const handleDeleteColumn = useCallback((name: string) => {
    if (name === 'ts') {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.cannotDeleteTs', 'Cannot delete timestamp column'),
        variant: 'destructive',
      });
      return;
    }

    setSchema(prev => ({ ...prev, columns: prev.columns.filter(col => col.name !== name) }));
    
    toast({
      title: t('common.success', 'Success'),
      description: t('realtimeTables.columnDeleted', 'Column deleted successfully'),
    });
  }, [setSchema, t]);

  // Handle add tag - opens the tag editing form
  const handleAddTag = useCallback(() => {
    if (!selectedNode || (selectedNode.type !== 'STABLE' && selectedNode.type !== 'TABLE')) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.selectSuperTable', 'Please select a super table first'),
        variant: 'destructive',
      });
      return;
    }
    if (!editMode) {
      toast({
        title: t('common.info', 'Info'),
        description: t('realtimeTables.enableEditMode', 'Please enable edit mode first'),
      });
      return;
    }
    setIsEditingTags(true);
  }, [editMode, selectedNode, t]);

  // Handle save tag to backend
  const handleSaveTag = useCallback(async () => {
    if (!newTag.name) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.tagNameRequired', 'Tag name is required'),
        variant: 'destructive',
      });
      return;
    }

    // Check if tag already exists
    if (schema.tags.some(tag => tag.name === newTag.name)) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.tagExists', 'Tag already exists'),
        variant: 'destructive',
      });
      return;
    }

    if (!selectedNode || !selectedNode.dbName) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.noDatabase', 'No database selected'),
        variant: 'destructive',
      });
      return;
    }

    const dbName = selectedNode.dbName;
    const superTableName = selectedNode.type === 'STABLE'
      ? selectedNode.name
      : selectedNode.superTableName;

    if (!superTableName) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.noSuperTable', 'Cannot determine super table'),
        variant: 'destructive',
      });
      return;
    }

    // Call backend API to add tag
    const result = await api.tdengine.alterSuperTable(dbName, superTableName, {
      action: 'ADD_TAG',
      tag: {
        name: newTag.name,
        type: newTag.type || 'VARCHAR',
        length: newTag.length,
      },
    });

    if (result.success) {
      // Add to local state
      const tag: TagInfo = {
        name: newTag.name,
        type: newTag.type || 'VARCHAR',
        length: newTag.length,
      };
      setSchema(prev => ({ ...prev, tags: [...prev.tags, tag] }));
      setNewTag({ name: '', type: 'VARCHAR', length: 64 });
      setIsEditingTags(false);
      
      toast({
        title: t('common.success', 'Success'),
        description: t('realtimeTables.tagAdded', 'Tag added successfully'),
      });
    } else {
      toast({
        title: t('common.error', 'Error'),
        description: result.error || t('realtimeTables.tagAddFailed', 'Failed to add tag'),
        variant: 'destructive',
      });
    }
  }, [newTag, schema.tags, selectedNode, setSchema, t]);

  // Handle cancel tag editing
  const handleCancelTag = useCallback(() => {
    setIsEditingTags(false);
    setNewTag({ name: '', type: 'VARCHAR', length: 64 });
  }, []);

  // Handle delete tag
  const handleDeleteTag = useCallback(async (name: string) => {
    if (!editMode) {
      toast({
        title: t('common.info', 'Info'),
        description: t('realtimeTables.enableEditMode', 'Please enable edit mode first'),
      });
      return;
    }

    if (!selectedNode || !selectedNode.dbName) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.noDatabase', 'No database selected'),
        variant: 'destructive',
      });
      return;
    }

    const dbName = selectedNode.dbName;
    const superTableName = selectedNode.type === 'STABLE'
      ? selectedNode.name
      : selectedNode.superTableName;

    if (!superTableName) {
      toast({
        title: t('common.error', 'Error'),
        description: t('realtimeTables.noSuperTable', 'Cannot determine super table'),
        variant: 'destructive',
      });
      return;
    }

    // Call backend API to delete tag
    const result = await api.tdengine.alterSuperTable(dbName, superTableName, {
      action: 'DROP_TAG',
      tag: {
        name: name,
        type: 'VARCHAR',
      },
    });

    if (result.success) {
      setSchema(prev => ({ ...prev, tags: prev.tags.filter(tag => tag.name !== name) }));
      toast({
        title: t('common.success', 'Success'),
        description: t('realtimeTables.tagDeleted', 'Tag deleted successfully'),
      });
    } else {
      toast({
        title: t('common.error', 'Error'),
        description: result.error || t('realtimeTables.tagDeleteFailed', 'Failed to delete tag'),
        variant: 'destructive',
      });
    }
  }, [editMode, selectedNode, setSchema, t]);

  // Render content based on selected node type for Manage tab
  const renderManageContent = () => {
    if (!selectedNode) {
      return (
        <div className={`flex flex-col items-center justify-center h-64 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          <Settings2 className="w-12 h-12 mb-4 opacity-50" />
          <p>{t('realtimeTables.selectNodeForManage', 'Select a database, super table or sub table to manage')}</p>
        </div>
      );
    }

    if (selectedNode.type === 'DB') {
      return <DatabaseInfo dbName={selectedNode.name} isDark={isDark} />;
    }

    if (schemaLoading) {
      return (
        <div className={`flex items-center justify-center h-64 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
          {t('common.loading', 'Loading...')}
        </div>
      );
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
              {selectedNode.name}
            </h3>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              {selectedNode.type === 'STABLE'
                ? t('realtimeTables.superTableSchema', 'Super Table Schema')
                : selectedNode.type === 'TABLE'
                ? t('realtimeTables.subTableSchema', 'Sub Table Schema (Inherited from Super Table)')
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Quick Action Buttons */}
            <button
              onClick={() => navigate('/realtime-history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                isDark
                  ? 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              {t('realtimeTables.realtimeDataStream', 'Realtime Data Stream')}
            </button>
            <button
              onClick={() => navigate('/query/workbench')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                isDark
                  ? 'bg-blue-600/20 text-blue-300 hover:bg-blue-600/30'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              {t('realtimeTables.queryStudio', 'Query Studio')}
            </button>
            {editMode && (
              <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-yellow-600/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'}`}>
                {t('realtimeTables.editMode', 'Edit Mode')}
              </span>
            )}
          </div>
        </div>

        <SchemaEditor
          columns={schema.columns}
          tags={schema.tags}
          tagValues={selectedNode.type === 'TABLE' ? subTableTagValues : undefined}
          isDark={isDark}
          readOnly={!editMode}
          onAddColumn={() => setIsEditingColumns(true)}
          onAddTag={handleAddTag}
          onDeleteColumn={handleDeleteColumn}
          onDeleteTag={handleDeleteTag}
        />

        {/* Add Tag Form */}
        {isEditingTags && editMode && (
          <TagEditor
            newTag={newTag}
            isDark={isDark}
            onNameChange={(name) => setNewTag(prev => ({ ...prev, name }))}
            onTypeChange={(type) => setNewTag(prev => ({ ...prev, type }))}
            onLengthChange={(length) => setNewTag(prev => ({ ...prev, length }))}
            onSave={handleSaveTag}
            onCancel={handleCancelTag}
          />
        )}

        {/* Add Column Form */}
        {isEditingColumns && editMode && (
          <div className={`mt-6 p-4 rounded-lg border ${isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <h4 className={`text-sm font-medium mb-4 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('realtimeTables.addNewColumn', 'Add New Column')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('common.name', 'Name')}
                </label>
                <input
                  type="text"
                  value={newColumn.name}
                  onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
                  className={`w-full px-3 py-2 text-sm rounded border outline-none focus:border-blue-500 ${
                    isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder={t('realtimeTables.columnName', 'Column name')}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('common.type', 'Type')}
                </label>
                <select
                  value={newColumn.type}
                  onChange={(e) => setNewColumn({ ...newColumn, type: e.target.value })}
                  className={`w-full px-3 py-2 text-sm rounded border outline-none focus:border-blue-500 ${
                    isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="FLOAT">FLOAT</option>
                  <option value="INT">INT</option>
                  <option value="BIGINT">BIGINT</option>
                  <option value="DOUBLE">DOUBLE</option>
                  <option value="BINARY">BINARY</option>
                  <option value="TIMESTAMP">TIMESTAMP</option>
                </select>
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('common.length', 'Length')}
                </label>
                <input
                  type="number"
                  value={newColumn.length || ''}
                  onChange={(e) => setNewColumn({ ...newColumn, length: e.target.value ? parseInt(e.target.value) : undefined })}
                  className={`w-full px-3 py-2 text-sm rounded border outline-none focus:border-blue-500 ${
                    isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder={t('realtimeTables.optional', 'Optional')}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t('common.note', 'Note')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newColumn.note || ''}
                    onChange={(e) => setNewColumn({ ...newColumn, note: e.target.value })}
                    className={`flex-1 px-3 py-2 text-sm rounded border outline-none focus:border-blue-500 ${
                      isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder={t('realtimeTables.optional', 'Optional')}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAddColumn}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors"
              >
                <Plus className="w-4 h-4 inline mr-1" />
                {t('common.add', 'Add')}
              </button>
              <button
                onClick={() => {
                  setIsEditingColumns(false);
                  setNewColumn({ name: '', type: 'FLOAT', length: undefined, note: '' });
                }}
                className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                  isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <X className="w-4 h-4 inline mr-1" />
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Sidebar Tree */}
      <TreeView
        treeData={treeData}
        selectedNode={selectedNode}
        loading={treeLoading}
        loadingNodeId={loadingNodeId}
        isDark={isDark}
        onToggleNode={toggleNode}
        onSelectNode={handleSelectNode}
        onRefresh={fetchTreeData}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tabs */}
        <div className={`flex items-center gap-1 px-4 py-2 border-b rounded-t-lg ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
              activeTab === 'data'
                ? (isDark ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600')
                : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900')
            }`}
          >
            <div className="flex items-center gap-2">
              <Table className="w-4 h-4" />
              {t('realtimeTables.data', 'Data')}
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
              activeTab === 'manage'
                ? (isDark ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-50 text-blue-600')
                : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900')
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              {t('realtimeTables.manage', 'Manage')}
            </div>
          </button>
          
          {/* Edit Mode Toggle */}
          {activeTab === 'manage' && selectedNode && (selectedNode.type === 'STABLE' || selectedNode.type === 'TABLE') && (
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setEditMode(!editMode)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded transition-colors ${
                  editMode
                    ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                    : (isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700')
                }`}
              >
                {editMode ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                {editMode ? t('common.done', 'Done') : t('common.edit', 'Edit')}
              </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className={`flex-1 overflow-auto rounded-b-lg p-6 ${isDark ? 'bg-gray-800 border-x border-b border-gray-700' : 'bg-white border-x border-b border-gray-200'}`}>
          {activeTab === 'data' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                  {selectedNode ? selectedNode.name : t('realtimeTables.selectNode', 'Select a node')}
                </h3>
                {selectedNode && (selectedNode.type === 'STABLE' || selectedNode.type === 'TABLE') && (
                  <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                    {t('realtimeTables.previewLimit', 'Preview first 100 rows')}
                  </span>
                )}
              </div>
              
              {selectedNode && (selectedNode.type === 'STABLE' || selectedNode.type === 'TABLE') ? (
                <div className="flex-1 min-h-0">
                  <DataPreviewTable 
                    data={dataPreview || { columns: [], data: [], rows: 0 }} 
                    isDark={isDark} 
                    loading={dataPreviewLoading}
                  />
                </div>
              ) : (
                <div className={`flex flex-col items-center justify-center h-64 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <Table className="w-12 h-12 mb-4 opacity-50" />
                  <p>{t('realtimeTables.selectTableForData', 'Please select a super table or sub table to view data')}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'manage' && renderManageContent()}
        </div>
      </div>
    </div>
  );
};

export default RealtimeTables;
