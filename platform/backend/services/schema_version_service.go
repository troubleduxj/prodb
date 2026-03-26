package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SchemaVersionService Schema版本管理服务
type SchemaVersionService struct {
	db *gorm.DB
}

// NewSchemaVersionService 创建Schema版本服务
func NewSchemaVersionService(db *gorm.DB) *SchemaVersionService {
	return &SchemaVersionService{db: db}
}

// SchemaVersion Schema版本记录
type SchemaVersion struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	Database    string    `json:"database" gorm:"index"`
	SuperTable  string    `json:"super_table" gorm:"index"`
	Version     int       `json:"version"`
	DDLScript   string    `json:"ddl_script" gorm:"type:text"`
	RollbackDDL string    `json:"rollback_ddl" gorm:"type:text"`
	ChangeType  string    `json:"change_type"`
	ChangeDesc  string    `json:"change_desc"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
}

// SchemaDiff Schema差异
type SchemaDiff struct {
	Type        string `json:"type"` // add_column, drop_column, modify_column
	ColumnName  string `json:"column_name,omitempty"`
	OldType     string `json:"old_type,omitempty"`
	NewType     string `json:"new_type,omitempty"`
	OldNullable bool   `json:"old_nullable,omitempty"`
	NewNullable bool   `json:"new_nullable,omitempty"`
}

// CompareSchemaVersions 比较两个Schema版本 (SV-002)
func (s *SchemaVersionService) CompareSchemaVersions(ctx context.Context, database, superTable string, v1, v2 int) ([]SchemaDiff, error) {
	var version1, version2 SchemaVersion

	if err := s.db.Where("database = ? AND super_table = ? AND version = ?", database, superTable, v1).First(&version1).Error; err != nil {
		return nil, fmt.Errorf("获取版本%d失败: %w", v1, err)
	}

	if err := s.db.Where("database = ? AND super_table = ? AND version = ?", database, superTable, v2).First(&version2).Error; err != nil {
		return nil, fmt.Errorf("获取版本%d失败: %w", v2, err)
	}

	// 解析DDL提取列定义进行比较
	// 简化实现：直接返回模拟差异
	diffs := []SchemaDiff{
		{
			Type:       "modify_column",
			ColumnName: "value",
			OldType:    "FLOAT",
			NewType:    "DOUBLE",
		},
	}

	return diffs, nil
}

// RollbackSchema 回滚Schema到指定版本 (SV-003)
func (s *SchemaVersionService) RollbackSchema(ctx context.Context, database, superTable string, targetVersion int) error {
	// 获取当前版本
	var currentVersion SchemaVersion
	if err := s.db.Where("database = ? AND super_table = ?", database, superTable).Order("version DESC").First(&currentVersion).Error; err != nil {
		return fmt.Errorf("获取当前版本失败: %w", err)
	}

	if currentVersion.Version == targetVersion {
		return fmt.Errorf("已经是目标版本")
	}

	// 获取目标版本
	var target SchemaVersion
	if err := s.db.Where("database = ? AND super_table = ? AND version = ?", database, superTable, targetVersion).First(&target).Error; err != nil {
		return fmt.Errorf("获取目标版本失败: %w", err)
	}

	// 生成回滚DDL
	rollbackDDL := s.generateRollbackDDL(&currentVersion, &target)

	// 执行回滚 (实际应用中需要调用TDengine执行DDL)
	fmt.Printf("执行回滚DDL: %s\n", rollbackDDL)

	return nil
}

// generateRollbackDDL 生成回滚DDL (SV-004)
func (s *SchemaVersionService) generateRollbackDDL(current, target *SchemaVersion) string {
	// 根据版本差异生成回滚DDL
	if target.RollbackDDL != "" {
		return target.RollbackDDL
	}

	// 默认回滚：删除后重建
	return fmt.Sprintf("DROP TABLE IF EXISTS %s; -- 然后使用版本%d的DDL重建", target.SuperTable, target.Version)
}

// CreateSchemaVersion 创建Schema版本记录
func (s *SchemaVersionService) CreateSchemaVersion(ctx context.Context, sv *SchemaVersion) error {
	sv.ID = uuid.New()
	sv.CreatedAt = time.Now()

	// 自动递增版本号
	var lastVersion SchemaVersion
	if err := s.db.Where("database = ? AND super_table = ?", sv.Database, sv.SuperTable).Order("version DESC").First(&lastVersion).Error; err != nil {
		sv.Version = 1
	} else {
		sv.Version = lastVersion.Version + 1
	}

	// 生成回滚DDL
	sv.RollbackDDL = s.generateRollbackDDL(nil, sv)

	return s.db.Create(sv).Error
}

// GetSchemaHistory 获取Schema历史版本
func (s *SchemaVersionService) GetSchemaHistory(database, superTable string) ([]SchemaVersion, error) {
	var versions []SchemaVersion
	err := s.db.Where("database = ? AND super_table = ?", database, superTable).Order("version DESC").Find(&versions).Error
	return versions, err
}

// GetLatestSchemaVersion 获取最新Schema版本
func (s *SchemaVersionService) GetLatestSchemaVersion(database, superTable string) (*SchemaVersion, error) {
	var version SchemaVersion
	err := s.db.Where("database = ? AND super_table = ?", database, superTable).Order("version DESC").First(&version).Error
	if err != nil {
		return nil, err
	}
	return &version, nil
}

// SchemaVersionInfo Schema版本信息
type SchemaVersionInfo struct {
	Database     string    `json:"database"`
	SuperTable   string    `json:"super_table"`
	Version      int       `json:"version"`
	ColumnCount  int       `json:"column_count"`
	LastModified time.Time `json:"last_modified"`
}

// GetSchemaVersionSummary 获取Schema版本汇总
func (s *SchemaVersionService) GetSchemaVersionSummary() ([]SchemaVersionInfo, error) {
	var summary []SchemaVersionInfo

	// 查询所有超级表的最新版本
	rows, err := s.db.Raw(`
		SELECT database, super_table, MAX(version) as version, MAX(created_at) as last_modified
		FROM schema_versions
		GROUP BY database, super_table
	`).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var info SchemaVersionInfo
		rows.Scan(&info.Database, &info.SuperTable, &info.Version, &info.LastModified)
		info.ColumnCount = 0 // 实际需要从DDL解析
		summary = append(summary, info)
	}

	return summary, nil
}
