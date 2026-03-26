package repository

import (
	"context"
	"fmt"
	"time"

	"prodb/platform/backend/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CollectorInterfaceRepository 采集器接口配置数据访问层
type CollectorInterfaceRepository struct {
	db *gorm.DB
}

// NewCollectorInterfaceRepository 创建Repository实例
func NewCollectorInterfaceRepository(db *gorm.DB) *CollectorInterfaceRepository {
	return &CollectorInterfaceRepository{db: db}
}

// Create 创建接口配置
func (r *CollectorInterfaceRepository) Create(ctx context.Context, iface *models.CollectorInterface) error {
	return r.db.WithContext(ctx).Create(iface).Error
}

// GetByID 根据ID获取接口配置
func (r *CollectorInterfaceRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.CollectorInterface, error) {
	var iface models.CollectorInterface
	err := r.db.WithContext(ctx).
		Preload("Collector").
		First(&iface, "id = ?", id).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &iface, nil
}

// GetByCollectorID 获取指定采集器的所有接口配置
func (r *CollectorInterfaceRepository) GetByCollectorID(ctx context.Context, collectorID uuid.UUID) ([]models.CollectorInterface, error) {
	var interfaces []models.CollectorInterface
	err := r.db.WithContext(ctx).
		Where("collector_id = ?", collectorID).
		Order("created_at DESC").
		Find(&interfaces).Error
	return interfaces, err
}

// GetByCollectorAndName 根据采集器和名称获取接口配置
func (r *CollectorInterfaceRepository) GetByCollectorAndName(ctx context.Context, collectorID uuid.UUID, name string) (*models.CollectorInterface, error) {
	var iface models.CollectorInterface
	err := r.db.WithContext(ctx).
		Where("collector_id = ? AND name = ?", collectorID, name).
		First(&iface).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &iface, nil
}

// Update 更新接口配置
func (r *CollectorInterfaceRepository) Update(ctx context.Context, iface *models.CollectorInterface) error {
	return r.db.WithContext(ctx).Save(iface).Error
}

// Delete 删除接口配置
func (r *CollectorInterfaceRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.CollectorInterface{}, "id = ?", id).Error
}

// DeleteByCollectorID 删除指定采集器的所有接口配置
func (r *CollectorInterfaceRepository) DeleteByCollectorID(ctx context.Context, collectorID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("collector_id = ?", collectorID).
		Delete(&models.CollectorInterface{}).Error
}

// List 分页查询接口配置
func (r *CollectorInterfaceRepository) List(ctx context.Context, filter InterfaceFilter) ([]models.CollectorInterface, int64, error) {
	query := r.db.WithContext(ctx).Model(&models.CollectorInterface{})

	// 应用过滤条件
	if filter.CollectorID != nil {
		query = query.Where("collector_id = ?", *filter.CollectorID)
	}
	if filter.Protocol != nil {
		query = query.Where("protocol = ?", *filter.Protocol)
	}
	if filter.Enabled != nil {
		query = query.Where("enabled = ?", *filter.Enabled)
	}
	if filter.Keyword != nil && *filter.Keyword != "" {
		keyword := "%" + *filter.Keyword + "%"
		query = query.Where("name LIKE ?", keyword)
	}

	// 统计总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	var interfaces []models.CollectorInterface
	offset := (filter.Page - 1) * filter.PageSize
	err := query.
		Order("created_at DESC").
		Offset(offset).
		Limit(filter.PageSize).
		Find(&interfaces).Error

	return interfaces, total, err
}

// CountByCollectorID 统计采集器的接口数量
func (r *CollectorInterfaceRepository) CountByCollectorID(ctx context.Context, collectorID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.CollectorInterface{}).
		Where("collector_id = ?", collectorID).
		Count(&count).Error
	return count, err
}

// CountByProtocol 按协议统计接口数量
func (r *CollectorInterfaceRepository) CountByProtocol(ctx context.Context) (map[string]int64, error) {
	var results []struct {
		Protocol string
		Count    int64
	}

	err := r.db.WithContext(ctx).
		Model(&models.CollectorInterface{}).
		Select("protocol, COUNT(*) as count").
		Group("protocol").
		Find(&results).Error
	if err != nil {
		return nil, err
	}

	counts := make(map[string]int64)
	for _, r := range results {
		counts[r.Protocol] = r.Count
	}
	return counts, nil
}

// Enable 启用接口
func (r *CollectorInterfaceRepository) Enable(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&models.CollectorInterface{}).
		Where("id = ?", id).
		Update("enabled", true).Error
}

// Disable 禁用接口
func (r *CollectorInterfaceRepository) Disable(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&models.CollectorInterface{}).
		Where("id = ?", id).
		Update("enabled", false).Error
}

// InterfaceFilter 接口查询过滤条件
type InterfaceFilter struct {
	CollectorID *uuid.UUID
	Protocol    *string
	Enabled     *bool
	Keyword     *string
	Page        int
	PageSize    int
}

// SetDefaults 设置默认值
func (f *InterfaceFilter) SetDefaults() {
	if f.Page <= 0 {
		f.Page = 1
	}
	if f.PageSize <= 0 {
		f.PageSize = 20
	}
	if f.PageSize > 100 {
		f.PageSize = 100
	}
}

// CollectorInterfaceHistoryRepository 配置历史数据访问层
type CollectorInterfaceHistoryRepository struct {
	db *gorm.DB
}

// NewCollectorInterfaceHistoryRepository 创建Repository实例
func NewCollectorInterfaceHistoryRepository(db *gorm.DB) *CollectorInterfaceHistoryRepository {
	return &CollectorInterfaceHistoryRepository{db: db}
}

// Create 创建配置历史记录
func (r *CollectorInterfaceHistoryRepository) Create(ctx context.Context, history *models.InterfaceConfigHistory) error {
	return r.db.WithContext(ctx).Create(history).Error
}

// GetByInterfaceID 获取指定接口的所有历史版本
func (r *CollectorInterfaceHistoryRepository) GetByInterfaceID(ctx context.Context, interfaceID uuid.UUID) ([]models.InterfaceConfigHistory, error) {
	var histories []models.InterfaceConfigHistory
	err := r.db.WithContext(ctx).
		Preload("Creator").
		Where("interface_id = ?", interfaceID).
		Order("version DESC").
		Find(&histories).Error
	return histories, err
}

// GetByVersion 获取指定版本的历史记录
func (r *CollectorInterfaceHistoryRepository) GetByVersion(ctx context.Context, interfaceID uuid.UUID, version int) (*models.InterfaceConfigHistory, error) {
	var history models.InterfaceConfigHistory
	err := r.db.WithContext(ctx).
		Preload("Creator").
		Where("interface_id = ? AND version = ?", interfaceID, version).
		First(&history).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &history, nil
}

// GetLatestVersion 获取最新版本号
func (r *CollectorInterfaceHistoryRepository) GetLatestVersion(ctx context.Context, interfaceID uuid.UUID) (int, error) {
	var result struct {
		MaxVersion int
	}
	err := r.db.WithContext(ctx).
		Model(&models.InterfaceConfigHistory{}).
		Select("COALESCE(MAX(version), 0) as max_version").
		Where("interface_id = ?", interfaceID).
		Scan(&result).Error
	return result.MaxVersion, err
}

// DeleteOldVersions 删除旧版本历史（保留最近N个版本）
func (r *CollectorInterfaceHistoryRepository) DeleteOldVersions(ctx context.Context, interfaceID uuid.UUID, keepCount int) error {
	// 获取需要删除的版本ID
	var idsToDelete []uuid.UUID
	err := r.db.WithContext(ctx).
		Model(&models.InterfaceConfigHistory{}).
		Select("id").
		Where("interface_id = ?", interfaceID).
		Order("version DESC").
		Offset(keepCount).
		Pluck("id", &idsToDelete).Error
	if err != nil {
		return err
	}

	if len(idsToDelete) == 0 {
		return nil
	}

	// 删除旧版本
	return r.db.WithContext(ctx).
		Where("id IN ?", idsToDelete).
		Delete(&models.InterfaceConfigHistory{}).Error
}

// InterfaceConfigDeliveryRepository 配置下发状态数据访问层
type InterfaceConfigDeliveryRepository struct {
	db *gorm.DB
}

// NewInterfaceConfigDeliveryRepository 创建Repository实例
func NewInterfaceConfigDeliveryRepository(db *gorm.DB) *InterfaceConfigDeliveryRepository {
	return &InterfaceConfigDeliveryRepository{db: db}
}

// Create 创建下发记录
func (r *InterfaceConfigDeliveryRepository) Create(ctx context.Context, delivery *models.InterfaceConfigDelivery) error {
	return r.db.WithContext(ctx).Create(delivery).Error
}

// GetByID 根据ID获取下发记录
func (r *InterfaceConfigDeliveryRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.InterfaceConfigDelivery, error) {
	var delivery models.InterfaceConfigDelivery
	err := r.db.WithContext(ctx).
		Preload("Collector").
		Preload("Interface").
		First(&delivery, "id = ?", id).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &delivery, nil
}

// GetByCollectorID 获取采集器的所有下发记录
func (r *InterfaceConfigDeliveryRepository) GetByCollectorID(ctx context.Context, collectorID uuid.UUID, limit int) ([]models.InterfaceConfigDelivery, error) {
	var deliveries []models.InterfaceConfigDelivery
	query := r.db.WithContext(ctx).
		Where("collector_id = ?", collectorID).
		Order("created_at DESC")

	if limit > 0 {
		query = query.Limit(limit)
	}

	err := query.Find(&deliveries).Error
	return deliveries, err
}

// GetPendingDeliveries 获取待下发的配置
func (r *InterfaceConfigDeliveryRepository) GetPendingDeliveries(ctx context.Context, collectorID uuid.UUID) ([]models.InterfaceConfigDelivery, error) {
	var deliveries []models.InterfaceConfigDelivery
	err := r.db.WithContext(ctx).
		Where("collector_id = ? AND status IN ?", collectorID, []string{"pending", "failed"}).
		Where("(next_retry_at IS NULL OR next_retry_at <= ?)", time.Now()).
		Order("created_at ASC").
		Find(&deliveries).Error
	return deliveries, err
}

// Update 更新下发记录
func (r *InterfaceConfigDeliveryRepository) Update(ctx context.Context, delivery *models.InterfaceConfigDelivery) error {
	return r.db.WithContext(ctx).Save(delivery).Error
}

// GetCollectorDeliveryStatus 获取采集器的配置下发状态汇总
func (r *InterfaceConfigDeliveryRepository) GetCollectorDeliveryStatus(ctx context.Context, collectorID uuid.UUID) (*CollectorDeliveryStatus, error) {
	var status CollectorDeliveryStatus

	// 最新版本
	err := r.db.WithContext(ctx).
		Model(&models.InterfaceConfigDelivery{}).
		Select("COALESCE(MAX(config_version), 0) as latest_version").
		Where("collector_id = ?", collectorID).
		Scan(&status.LatestVersion).Error
	if err != nil {
		return nil, err
	}

	// 已应用版本
	err = r.db.WithContext(ctx).
		Model(&models.InterfaceConfigDelivery{}).
		Select("COALESCE(MAX(config_version), 0) as applied_version").
		Where("collector_id = ? AND status = ?", collectorID, "applied").
		Scan(&status.AppliedVersion).Error
	if err != nil {
		return nil, err
	}

	// 待下发数量
	err = r.db.WithContext(ctx).
		Model(&models.InterfaceConfigDelivery{}).
		Where("collector_id = ? AND status IN ?", collectorID, []string{"pending", "delivered"}).
		Count(&status.PendingCount).Error
	if err != nil {
		return nil, err
	}

	// 失败数量
	err = r.db.WithContext(ctx).
		Model(&models.InterfaceConfigDelivery{}).
		Where("collector_id = ? AND status = ?", collectorID, "failed").
		Count(&status.FailedCount).Error
	if err != nil {
		return nil, err
	}

	return &status, nil
}

// CollectorDeliveryStatus 采集器配置下发状态
type CollectorDeliveryStatus struct {
	LatestVersion  int   `json:"latest_version"`
	AppliedVersion int   `json:"applied_version"`
	PendingCount   int64 `json:"pending_count"`
	FailedCount    int64 `json:"failed_count"`
}

// IsSynced 是否已同步
func (s *CollectorDeliveryStatus) IsSynced() bool {
	return s.LatestVersion == s.AppliedVersion && s.PendingCount == 0
}

// Transaction 执行事务
func (r *CollectorInterfaceRepository) Transaction(fn func(tx *gorm.DB) error) error {
	return r.db.Transaction(fn)
}

// GetDB 获取数据库连接（用于复杂查询）
func (r *CollectorInterfaceRepository) GetDB() *gorm.DB {
	return r.db
}

// ValidateInterfaceName 验证接口名称是否可用
func (r *CollectorInterfaceRepository) ValidateInterfaceName(ctx context.Context, collectorID uuid.UUID, name string, excludeID *uuid.UUID) error {
	query := r.db.WithContext(ctx).
		Model(&models.CollectorInterface{}).
		Where("collector_id = ? AND name = ?", collectorID, name)

	if excludeID != nil {
		query = query.Where("id != ?", *excludeID)
	}

	var count int64
	if err := query.Count(&count).Error; err != nil {
		return err
	}

	if count > 0 {
		return fmt.Errorf("interface name '%s' already exists for this collector", name)
	}

	return nil
}
