# 数据库迁移脚本

## 问题描述

当数据库中已存在数据时，添加 `agent_id` NOT NULL 字段会导致迁移失败：

```
错误: column "agent_id" of relation "collectors" contains null values (SQLSTATE 23502)
ALTER TABLE "collectors" ADD "agent_id" varchar(100) NOT NULL
```

## 解决方案

### 方案 1: 自动迁移（推荐）

项目已集成自动迁移脚本，在应用启动时会自动执行：

1. **添加可空字段** - 如果 `agent_id` 列不存在，则添加为可空列
2. **填充现有数据** - 为已有记录生成 `agent_id`（格式：`collector-{uuid}`）
3. **添加唯一索引** - 确保 agent_id 的唯一性

自动迁移会在 `database.Migrate()` 中被调用：

```go
// database/database.go
func Migrate() {
    // 运行自定义迁移
    if err := migrations.MigrateCollectorAgentID(DB); err != nil {
        log.Printf("Warning: Failed to migrate collector agent_id: %v", err)
    }
    
    // 继续运行 AutoMigrate
    err := DB.AutoMigrate(...)
}
```

### 方案 2: 手动修复 SQL

如果需要手动修复数据库，使用以下 SQL 脚本：

```bash
# 使用 psql 执行
psql -h localhost -U postgres -d prodbmanager -f platform/backend/database/migrations/fix_agent_id_manual.sql
```

或者手动执行 SQL 步骤：

```sql
-- 1. 添加可空字段
ALTER TABLE collectors ADD COLUMN agent_id varchar(100);

-- 2. 为现有记录生成 agent_id
UPDATE collectors 
SET agent_id = 'collector-' || id::text 
WHERE agent_id IS NULL;

-- 3. 添加唯一索引
CREATE UNIQUE INDEX idx_collectors_agent_id ON collectors(agent_id);
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `001_fix_collector_agent_id.go` | Go 自动迁移脚本 |
| `fix_agent_id_manual.sql` | 手动修复 SQL 脚本 |
| `README.md` | 本文档 |

## 验证

迁移完成后，验证 agent_id 字段：

```sql
-- 检查所有记录都有 agent_id
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
```

## 注意事项

1. **备份数据** - 在生产环境执行前，请确保已备份数据库
2. **事务安全** - Go 迁移脚本会自动处理事务，SQL 脚本建议手动包裹事务
3. **重复处理** - 如果存在重复 agent_id，脚本会自动处理（添加随机后缀）
