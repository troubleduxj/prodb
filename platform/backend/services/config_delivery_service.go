package services

import (
	"context"
	"fmt"
	"time"

	"prodb/platform/backend/models"
	"prodb/platform/backend/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ConfigDeliveryService 配置下发服务
// 负责管理配置下发流程、状态追踪和失败重试
type ConfigDeliveryService struct {
	db               *gorm.DB
	interfaceRepo    *repository.CollectorInterfaceRepository
	historyRepo      *repository.CollectorInterfaceHistoryRepository
	deliveryRepo     *repository.InterfaceConfigDeliveryRepository
	configAssembler  *ConfigAssembler
}

// NewConfigDeliveryService 创建配置下发服务
func NewConfigDeliveryService(
	db *gorm.DB,
	interfaceRepo *repository.CollectorInterfaceRepository,
	historyRepo *repository.CollectorInterfaceHistoryRepository,
	deliveryRepo *repository.InterfaceConfigDeliveryRepository,
	configAssembler *ConfigAssembler,
) *ConfigDeliveryService {
	return &ConfigDeliveryService{
		db:              db,
		interfaceRepo:   interfaceRepo,
		historyRepo:     historyRepo,
		deliveryRepo:    deliveryRepo,
		configAssembler: configAssembler,
	}
}

// CreateInterface 创建接口配置
func (s *ConfigDeliveryService) CreateInterface(ctx context.Context, req *CreateInterfaceRequest) (*models.CollectorInterface, error) {
	// 1. 验证采集器存在
	var collector models.Collector
	if err := s.db.WithContext(ctx).First(&collector, "id = ?", req.CollectorID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("collector not found: %s", req.CollectorID)
		}
		return nil, fmt.Errorf("failed to get collector: %w", err)
	}

	// 2. 验证接口名称唯一性
	existing, err := s.interfaceRepo.GetByCollectorAndName(ctx, req.CollectorID, req.Name)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, fmt.Errorf("interface with name '%s' already exists", req.Name)
	}

	// 3. 创建接口配置
	iface := &models.CollectorInterface{
		CollectorID:      req.CollectorID,
		Name:             req.Name,
		Protocol:         req.Protocol,
		Enabled:          req.Enabled,
		ConnectionConfig: req.ConnectionConfig,
		DataPoints:       req.DataPoints,
		EdgeProcessing:   req.EdgeProcessing,
		ScheduleConfig:   req.ScheduleConfig,
		TargetConfig:     req.TargetConfig,
	}

	// 4. 保存到数据库
	if err := s.interfaceRepo.Create(ctx, iface); err != nil {
		return nil, fmt.Errorf("failed to create interface: %w", err)
	}

	// 5. 记录配置历史（版本1）
	if err := s.recordHistory(ctx, iface, 1, "create", req.CreatedBy); err != nil {
		// 记录历史失败不影响主流程
		fmt.Printf("failed to record history: %v\n", err)
	}

	// 6. 创建配置下发记录
	if err := s.createDeliveryRecord(ctx, req.CollectorID, &iface.ID, 1); err != nil {
		fmt.Printf("failed to create delivery record: %v\n", err)
	}

	return iface, nil
}

// UpdateInterface 更新接口配置
func (s *ConfigDeliveryService) UpdateInterface(ctx context.Context, interfaceID uuid.UUID, req *UpdateInterfaceRequest) (*models.CollectorInterface, error) {
	// 1. 获取现有配置
	iface, err := s.interfaceRepo.GetByID(ctx, interfaceID)
	if err != nil {
		return nil, err
	}
	if iface == nil {
		return nil, fmt.Errorf("interface not found: %s", interfaceID)
	}

	// 2. 验证名称唯一性（如果修改了名称）
	if req.Name != "" && req.Name != iface.Name {
		existing, err := s.interfaceRepo.GetByCollectorAndName(ctx, iface.CollectorID, req.Name)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return nil, fmt.Errorf("interface with name '%s' already exists", req.Name)
		}
		iface.Name = req.Name
	}

	// 3. 更新字段
	if req.Protocol != "" {
		iface.Protocol = req.Protocol
	}
	if req.Enabled != nil {
		iface.Enabled = *req.Enabled
	}
	if req.ConnectionConfig != nil {
		iface.ConnectionConfig = *req.ConnectionConfig
	}
	if req.DataPoints != nil {
		iface.DataPoints = *req.DataPoints
	}
	if req.EdgeProcessing != nil {
		iface.EdgeProcessing = *req.EdgeProcessing
	}
	if req.ScheduleConfig != nil {
		iface.ScheduleConfig = *req.ScheduleConfig
	}
	if req.TargetConfig != nil {
		iface.TargetConfig = *req.TargetConfig
	}

	// 4. 保存更新
	if err := s.interfaceRepo.Update(ctx, iface); err != nil {
		return nil, fmt.Errorf("failed to update interface: %w", err)
	}

	// 5. 获取新版本号
	latestVersion, err := s.historyRepo.GetLatestVersion(ctx, interfaceID)
	if err != nil {
		latestVersion = 0
	}
	newVersion := latestVersion + 1

	// 6. 记录配置历史
	if err := s.recordHistory(ctx, iface, newVersion, "update", req.UpdatedBy); err != nil {
		fmt.Printf("failed to record history: %v\n", err)
	}

	// 7. 创建新的配置下发记录
	if err := s.createDeliveryRecord(ctx, iface.CollectorID, &iface.ID, newVersion); err != nil {
		fmt.Printf("failed to create delivery record: %v\n", err)
	}

	return iface, nil
}

// DeleteInterface 删除接口配置
func (s *ConfigDeliveryService) DeleteInterface(ctx context.Context, interfaceID uuid.UUID) error {
	// 1. 获取接口配置
	iface, err := s.interfaceRepo.GetByID(ctx, interfaceID)
	if err != nil {
		return err
	}
	if iface == nil {
		return fmt.Errorf("interface not found: %s", interfaceID)
	}

	// 2. 删除接口（软删除）
	if err := s.interfaceRepo.Delete(ctx, interfaceID); err != nil {
		return fmt.Errorf("failed to delete interface: %w", err)
	}

	return nil
}

// GetConfigForDelivery 获取待下发的配置
func (s *ConfigDeliveryService) GetConfigForDelivery(ctx context.Context, collectorID uuid.UUID) (*CollectorConfig, error) {
	return s.configAssembler.AssembleCollectorConfig(ctx, collectorID)
}

// ConfirmDelivery 确认配置已下发
func (s *ConfigDeliveryService) ConfirmDelivery(ctx context.Context, deliveryID uuid.UUID) error {
	delivery, err := s.deliveryRepo.GetByID(ctx, deliveryID)
	if err != nil {
		return err
	}
	if delivery == nil {
		return fmt.Errorf("delivery record not found: %s", deliveryID)
	}

	delivery.MarkDelivered()
	return s.deliveryRepo.Update(ctx, delivery)
}

// ConfirmApplied 确认配置已应用
func (s *ConfigDeliveryService) ConfirmApplied(ctx context.Context, deliveryID uuid.UUID, collectorVersion int) error {
	delivery, err := s.deliveryRepo.GetByID(ctx, deliveryID)
	if err != nil {
		return err
	}
	if delivery == nil {
		return fmt.Errorf("delivery record not found: %s", deliveryID)
	}

	delivery.MarkApplied()
	return s.deliveryRepo.Update(ctx, delivery)
}

// MarkFailed 标记下发失败
func (s *ConfigDeliveryService) MarkFailed(ctx context.Context, deliveryID uuid.UUID, errMsg string) error {
	delivery, err := s.deliveryRepo.GetByID(ctx, deliveryID)
	if err != nil {
		return err
	}
	if delivery == nil {
		return fmt.Errorf("delivery record not found: %s", deliveryID)
	}

	delivery.MarkFailed(errMsg)
	return s.deliveryRepo.Update(ctx, delivery)
}

// GetPendingDeliveries 获取待下发的配置列表
func (s *ConfigDeliveryService) GetPendingDeliveries(ctx context.Context, collectorID uuid.UUID) ([]models.InterfaceConfigDelivery, error) {
	return s.deliveryRepo.GetPendingDeliveries(ctx, collectorID)
}

// GetCollectorConfigStatus 获取采集器配置状态
func (s *ConfigDeliveryService) GetCollectorConfigStatus(ctx context.Context, collectorID uuid.UUID) (*repository.CollectorDeliveryStatus, error) {
	return s.deliveryRepo.GetCollectorDeliveryStatus(ctx, collectorID)
}

// GetInterfaceHistory 获取接口配置历史
func (s *ConfigDeliveryService) GetInterfaceHistory(ctx context.Context, interfaceID uuid.UUID) ([]models.InterfaceConfigHistory, error) {
	return s.historyRepo.GetByInterfaceID(ctx, interfaceID)
}

// RollbackInterface 回滚接口配置到指定版本
func (s *ConfigDeliveryService) RollbackInterface(ctx context.Context, interfaceID uuid.UUID, targetVersion int, userID *uint) (*models.CollectorInterface, error) {
	// 1. 获取目标版本的历史记录
	history, err := s.historyRepo.GetByVersion(ctx, interfaceID, targetVersion)
	if err != nil {
		return nil, err
	}
	if history == nil {
		return nil, fmt.Errorf("version %d not found for interface %s", targetVersion, interfaceID)
	}

	// 2. 获取当前接口配置
	iface, err := s.interfaceRepo.GetByID(ctx, interfaceID)
	if err != nil {
		return nil, err
	}
	if iface == nil {
		return nil, fmt.Errorf("interface not found: %s", interfaceID)
	}

	// 3. 应用历史配置
	snapshot := history.ConfigSnapshot
	iface.Name = snapshot.Name
	iface.Protocol = snapshot.Protocol
	iface.Enabled = snapshot.Enabled
	iface.ConnectionConfig = snapshot.ConnectionConfig
	iface.DataPoints = snapshot.DataPoints
	iface.EdgeProcessing = snapshot.EdgeProcessing
	iface.ScheduleConfig = snapshot.ScheduleConfig
	iface.TargetConfig = snapshot.TargetConfig

	// 4. 保存更新
	if err := s.interfaceRepo.Update(ctx, iface); err != nil {
		return nil, fmt.Errorf("failed to rollback interface: %w", err)
	}

	// 5. 获取新版本号
	latestVersion, _ := s.historyRepo.GetLatestVersion(ctx, interfaceID)
	newVersion := latestVersion + 1

	// 6. 记录回滚历史
	if err := s.recordHistory(ctx, iface, newVersion, "rollback", userID); err != nil {
		fmt.Printf("failed to record rollback history: %v\n", err)
	}

	// 7. 创建新的下发记录
	if err := s.createDeliveryRecord(ctx, iface.CollectorID, &iface.ID, newVersion); err != nil {
		fmt.Printf("failed to create delivery record: %v\n", err)
	}

	return iface, nil
}

// recordHistory 记录配置历史
func (s *ConfigDeliveryService) recordHistory(
	ctx context.Context,
	iface *models.CollectorInterface,
	version int,
	changeType string,
	userID *uint,
) error {
	snapshot := models.ConfigSnapshot{
		InterfaceID:      iface.ID,
		Name:             iface.Name,
		Protocol:         iface.Protocol,
		Enabled:          iface.Enabled,
		ConnectionConfig: iface.ConnectionConfig,
		DataPoints:       iface.DataPoints,
		EdgeProcessing:   iface.EdgeProcessing,
		ScheduleConfig:   iface.ScheduleConfig,
		TargetConfig:     iface.TargetConfig,
	}

	history := &models.InterfaceConfigHistory{
		InterfaceID:    iface.ID,
		Version:        version,
		ConfigSnapshot: snapshot,
		ChangeSummary:  fmt.Sprintf("%s interface configuration", changeType),
		ChangeType:     models.ConfigChangeType(changeType),
		CreatedBy:      userID,
	}

	return s.historyRepo.Create(ctx, history)
}

// createDeliveryRecord 创建配置下发记录
func (s *ConfigDeliveryService) createDeliveryRecord(
	ctx context.Context,
	collectorID uuid.UUID,
	interfaceID *uuid.UUID,
	version int,
) error {
	// 组装配置快照（验证配置有效性）
	_, err := s.configAssembler.AssembleCollectorConfig(ctx, collectorID)
	if err != nil {
		return err
	}

	snapshot := models.ConfigSnapshot{}
	if interfaceID != nil {
		// 获取特定接口的配置
		iface, err := s.interfaceRepo.GetByID(ctx, *interfaceID)
		if err != nil {
			return err
		}
		if iface != nil {
			snapshot = models.ConfigSnapshot{
				InterfaceID:      iface.ID,
				Name:             iface.Name,
				Protocol:         iface.Protocol,
				Enabled:          iface.Enabled,
				ConnectionConfig: iface.ConnectionConfig,
				DataPoints:       iface.DataPoints,
				EdgeProcessing:   iface.EdgeProcessing,
				ScheduleConfig:   iface.ScheduleConfig,
				TargetConfig:     iface.TargetConfig,
			}
		}
	}

	delivery := &models.InterfaceConfigDelivery{
		CollectorID:    collectorID,
		InterfaceID:    interfaceID,
		ConfigVersion:  version,
		Status:         "pending",
		MaxRetries:     3,
		ConfigSnapshot: snapshot,
	}

	return s.deliveryRepo.Create(ctx, delivery)
}

// ==================== 请求/响应 DTO ====================

// CreateInterfaceRequest 创建接口请求
type CreateInterfaceRequest struct {
	CollectorID      uuid.UUID
	Name             string
	Protocol         models.ProtocolType
	Enabled          bool
	ConnectionConfig models.ConnectionConfig
	DataPoints       models.DataPoints
	EdgeProcessing   models.EdgeProcessingConfig
	ScheduleConfig   models.ScheduleConfig
	TargetConfig     models.TargetConfig
	CreatedBy        *uint
}

// UpdateInterfaceRequest 更新接口请求
type UpdateInterfaceRequest struct {
	Name             string
	Protocol         models.ProtocolType
	Enabled          *bool
	ConnectionConfig *models.ConnectionConfig
	DataPoints       *models.DataPoints
	EdgeProcessing   *models.EdgeProcessingConfig
	ScheduleConfig   *models.ScheduleConfig
	TargetConfig     *models.TargetConfig
	UpdatedBy        *uint
}

// DeliveryStatusResponse 下发状态响应
type DeliveryStatusResponse struct {
	CollectorID      uuid.UUID                    `json:"collector_id"`
	LatestVersion    int                          `json:"latest_version"`
	AppliedVersion   int                          `json:"applied_version"`
	IsSynced         bool                         `json:"is_synced"`
	PendingCount     int64                        `json:"pending_count"`
	FailedCount      int64                        `json:"failed_count"`
	RecentDeliveries []models.InterfaceConfigDelivery `json:"recent_deliveries,omitempty"`
}

// ==================== Handler 适配类型 ====================

// ConfigDeliveryRequest 配置下发请求（适配 handler）
type ConfigDeliveryRequest struct {
	CollectorID uuid.UUID              `json:"collector_id" binding:"required"`
	Config      map[string]interface{} `json:"config" binding:"required"`
	Priority    int                    `json:"priority"`
}

// ConfigDeliveryStatus 配置下发状态（适配 handler）
type ConfigDeliveryStatus struct {
	ID             uuid.UUID `json:"id"`
	CollectorID    uuid.UUID `json:"collector_id"`
	InterfaceID    *uuid.UUID `json:"interface_id,omitempty"`
	ConfigVersion  int       `json:"config_version"`
	Status         string    `json:"status"`
	DeliveredAt    *time.Time `json:"delivered_at,omitempty"`
	AppliedAt      *time.Time `json:"applied_at,omitempty"`
	ErrorMessage   string    `json:"error_message,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

// ConfigVersionInfo 配置版本信息（适配 handler）
type ConfigVersionInfo struct {
	Version       int       `json:"version"`
	CollectorID   uuid.UUID `json:"collector_id"`
	InterfaceID   uuid.UUID `json:"interface_id"`
	ChangeType    string    `json:"change_type"`
	ChangeSummary string    `json:"change_summary"`
	CreatedAt     time.Time `json:"created_at"`
	ConfigSnapshot interface{} `json:"config_snapshot,omitempty"`
}

// ToConfigDeliveryStatus 将 model 转换为 DTO
func ToConfigDeliveryStatus(delivery *models.InterfaceConfigDelivery) *ConfigDeliveryStatus {
	return &ConfigDeliveryStatus{
		ID:            delivery.ID,
		CollectorID:   delivery.CollectorID,
		InterfaceID:   delivery.InterfaceID,
		ConfigVersion: delivery.ConfigVersion,
		Status:        delivery.Status,
		DeliveredAt:   delivery.DeliveredAt,
		AppliedAt:     delivery.AppliedAt,
		ErrorMessage:  delivery.ErrorMessage,
		CreatedAt:     delivery.CreatedAt,
	}
}

// ToConfigVersionInfo 将 model 转换为 DTO
func ToConfigVersionInfo(history *models.InterfaceConfigHistory) *ConfigVersionInfo {
	return &ConfigVersionInfo{
		Version:       history.Version,
		CollectorID:   history.ConfigSnapshot.InterfaceID,
		InterfaceID:   history.InterfaceID,
		ChangeType:    string(history.ChangeType),
		ChangeSummary: history.ChangeSummary,
		CreatedAt:     history.CreatedAt,
		ConfigSnapshot: history.ConfigSnapshot,
	}
}
