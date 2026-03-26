-- ============================================
-- 手动修复 collectors 表 agent_id 字段
-- ============================================
-- 问题: 添加 agent_id NOT NULL 字段时，现有数据会导致迁移失败
-- 解决: 先添加可空字段，填充数据，再添加约束

-- 步骤 1: 添加可空的 agent_id 字段（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'collectors' 
        AND column_name = 'agent_id'
    ) THEN
        ALTER TABLE collectors ADD COLUMN agent_id varchar(100);
        RAISE NOTICE 'Added agent_id column';
    ELSE
        RAISE NOTICE 'agent_id column already exists';
    END IF;
END $$;

-- 步骤 2: 为现有记录生成 agent_id（使用 ID 作为基础）
-- 格式: collector-{uuid}
UPDATE collectors 
SET agent_id = 'collector-' || id::text 
WHERE agent_id IS NULL;

-- 检查更新结果
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count 
    FROM collectors 
    WHERE agent_id IS NULL;
    
    IF updated_count > 0 THEN
        RAISE WARNING 'Still have % records with NULL agent_id', updated_count;
    ELSE
        RAISE NOTICE 'All records now have agent_id';
    END IF;
END $$;

-- 步骤 3: 删除已存在的重复 agent_id（保留最早创建的）
WITH duplicates AS (
    SELECT id, agent_id,
           ROW_NUMBER() OVER (PARTITION BY agent_id ORDER BY created_at, id) as rn
    FROM collectors
    WHERE agent_id IN (
        SELECT agent_id 
        FROM collectors 
        GROUP BY agent_id 
        HAVING COUNT(*) > 1
    )
)
UPDATE collectors 
SET agent_id = 'collector-' || id::text || '-' || floor(random() * 1000)::int::text
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 步骤 4: 添加唯一索引（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_collectors_agent_id'
    ) THEN
        CREATE UNIQUE INDEX idx_collectors_agent_id ON collectors(agent_id);
        RAISE NOTICE 'Created unique index on agent_id';
    ELSE
        RAISE NOTICE 'Unique index already exists';
    END IF;
END $$;

-- 验证结果
SELECT 
    COUNT(*) as total_records,
    COUNT(agent_id) as with_agent_id,
    COUNT(*) - COUNT(agent_id) as null_agent_id
FROM collectors;

-- 检查是否有重复
SELECT agent_id, COUNT(*) as count
FROM collectors
GROUP BY agent_id
HAVING COUNT(*) > 1;
