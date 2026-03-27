import { useState, useCallback } from 'react';
import { api } from '../../../src/services/api';
import { toast } from '../../../src/hooks/use-toast';
import type { NewColumnForm, ColumnType } from '../types';

const COLUMN_TYPES: ColumnType[] = [
  'INT',
  'BIGINT',
  'FLOAT',
  'DOUBLE',
  'BOOL',
  'TIMESTAMP',
  'BINARY',
  'NCHAR',
];

export interface UseColumnManagerReturn {
  /** 是否显示添加列弹窗 */
  showAddColumnModal: boolean;
  /** 新列表单数据 */
  newCol: NewColumnForm;
  /** 可用列类型 */
  columnTypes: ColumnType[];
  /** 打开添加列弹窗 */
  openAddColumnModal: (isTag?: boolean) => void;
  /** 关闭添加列弹窗 */
  closeAddColumnModal: () => void;
  /** 更新列名 */
  setColumnName: (name: string) => void;
  /** 更新列类型 */
  setColumnType: (type: string) => void;
  /** 更新列长度 */
  setColumnLength: (length: number) => void;
  /** 处理添加列 */
  handleAddColumn: (database: string, supertable: string) => Promise<boolean>;
  /** 是否需要显示长度输入 */
  showLengthInput: boolean;
  /** 表单是否有效 */
  isFormValid: boolean;
  /** 加载状态 */
  loading: boolean;
}

/**
 * 列管理 Hook
 * 管理添加列弹窗和表单状态
 */
export const useColumnManager = (): UseColumnManagerReturn => {
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [newCol, setNewCol] = useState<NewColumnForm>({
    name: '',
    type: 'FLOAT',
    length: 64,
    isTag: false,
  });
  const [loading, setLoading] = useState(false);

  // 是否需要显示长度输入
  const showLengthInput = newCol.type === 'BINARY' || newCol.type === 'NCHAR';

  // 表单是否有效
  const isFormValid = newCol.name.trim().length > 0;

  // 打开添加列弹窗
  const openAddColumnModal = useCallback((isTag: boolean = false) => {
    setNewCol({
      name: '',
      type: 'FLOAT',
      length: 64,
      isTag,
    });
    setShowAddColumnModal(true);
  }, []);

  // 关闭添加列弹窗
  const closeAddColumnModal = useCallback(() => {
    setShowAddColumnModal(false);
    // 重置表单
    setNewCol({
      name: '',
      type: 'FLOAT',
      length: 64,
      isTag: false,
    });
  }, []);

  // 更新列名
  const setColumnName = useCallback((name: string) => {
    setNewCol(prev => ({ ...prev, name }));
  }, []);

  // 更新列类型
  const setColumnType = useCallback((type: string) => {
    setNewCol(prev => ({ ...prev, type }));
  }, []);

  // 更新列长度
  const setColumnLength = useCallback((length: number) => {
    setNewCol(prev => ({ ...prev, length }));
  }, []);

  // 处理添加列
  const handleAddColumn = useCallback(
    async (database: string, supertable: string): Promise<boolean> => {
      if (!isFormValid || !database || !supertable) return false;

      try {
        setLoading(true);

        // 构建请求数据
        const requestData = {
          action: newCol.isTag ? 'add_tag' : 'add_column',
          [newCol.isTag ? 'tag' : 'column']: {
            name: newCol.name.trim(),
            type: newCol.type,
            ...(showLengthInput && { length: newCol.length }),
          },
        };

        const result = await api.tdengine.alterSuperTableSchema(
          database,
          supertable,
          requestData
        );

        if (result.success) {
          toast({
            title: 'Success',
            description: `Column '${newCol.name}' (${newCol.type}) added successfully!`,
            variant: 'success',
          });
          closeAddColumnModal();
          return true;
        } else {
          toast({
            title: 'Error',
            description: result.error || 'Failed to add column',
            variant: 'destructive',
          });
          return false;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        toast({
          title: 'Error',
          description: 'Failed to add column: ' + errorMsg,
          variant: 'destructive',
        });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [newCol, isFormValid, showLengthInput, closeAddColumnModal]
  );

  return {
    showAddColumnModal,
    newCol,
    columnTypes: COLUMN_TYPES,
    openAddColumnModal,
    closeAddColumnModal,
    setColumnName,
    setColumnType,
    setColumnLength,
    handleAddColumn,
    showLengthInput,
    isFormValid,
    loading,
  };
};

export default useColumnManager;
