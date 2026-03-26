package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CollectorPointMetadata 采集点与元数据关联表
// 打通采集配置与数据目录的关联，支持智能推荐和一致性检查
type CollectorPointMetadata struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// 采集点信息
	CollectorID string `json:"collector_id" gorm:"index:idx_collector_point;not null;comment:采集器ID"`
	InterfaceID string `json:"interface_id" gorm:"index:idx_collector_point;not null;comment:接口ID"`
	PointName   string `json:"point_name" gorm:"index:idx_collector_point;not null;comment:采集点名称"`

	// 关联的元数据
	DatabaseName    string `json:"database_name" gorm:"comment:目标数据库名"`
	SuperTableName  string `json:"super_table_name" gorm:"comment:目标超级表名"`
	SubTableName    string `json:"sub_table_name" gorm:"comment:目标子表名"`
	ColumnName      string `json:"column_name" gorm:"comment:目标列名"`

	// 映射配置
	MappingType     string `json:"mapping_type" gorm:"default:'auto';comment:映射类型: auto/manual/none"`
	MappingStatus   string `json:"mapping_status" gorm:"default:'pending';comment:映射状态: pending/mapped/conflict/invalid"`
	MappingScore    float64 `json:"mapping_score" gorm:"default:0;comment:映射匹配度分数(0-1)"`

	// 元数据缓存
	DataType        string `json:"data_type" gorm:"comment:数据类型"`
	Unit            string `json:"unit" gorm:"comment:单位"`
	Description     string `json:"description" gorm:"comment:描述"`

	// 统计信息
	LastSyncAt      *time.Time `json:"last_sync_at" gorm:"comment:最后同步时间"`
	DataCount       int64      `json:"data_count" gorm:"default:0;comment:数据条数统计"`
	LastDataAt      *time.Time `json:"last_data_at" gorm:"comment:最后数据时间"`

	// 标签信息(JSON)
	TagsJSON        string `json:"tags_json" gorm:"type:jsonb;default:'{}';comment:子表标签配置"`
}

// TableName 指定表名
func (CollectorPointMetadata) TableName() string {
	return "collector_point_metadata"
}

// BeforeCreate 创建前的钩子
func (c *CollectorPointMetadata) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

// PointMappingStatus 映射状态常量
const (
	MappingStatusPending  = "pending"   // 待映射
	MappingStatusMapped   = "mapped"    // 已映射
	MappingStatusConflict = "conflict"  // 冲突
	MappingStatusInvalid  = "invalid"   // 无效
)

// MappingType 映射类型常量
const (
	MappingTypeAuto    = "auto"    // 自动映射
	MappingTypeManual  = "manual"  // 手动映射
	MappingTypeNone    = "none"    // 无映射
)

// CollectorPointMetadataQuery 查询条件
type CollectorPointMetadataQuery struct {
	CollectorID    string
	InterfaceID    string
	PointName      string
	DatabaseName   string
	SuperTableName string
	MappingStatus  string
	MappingType    string
	Page           int
	PageSize       int
}

// PointMetadataSyncResult 同步结果
type PointMetadataSyncResult struct {
	TotalPoints   int `json:"total_points"`
	MappedPoints  int `json:"mapped_points"`
	ConflictPoints int `json:"conflict_points"`
	NewMappings   int `json:"new_mappings"`
	Errors        []string `json:"errors,omitempty"`
}

// PointMetadataRecommendation 智能推荐结果
type PointMetadataRecommendation struct {
	PointName       string  `json:"point_name"`
	RecommendedDB   string  `json:"recommended_db"`
	RecommendedST   string  `json:"recommended_st"`
	Confidence      float64 `json:"confidence"`
	Reason          string  `json:"reason"`
	ExistingMapping *CollectorPointMetadata `json:"existing_mapping,omitempty"`
}