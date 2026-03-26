package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"prodb/platform/backend/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// MetadataService 元数据管理服务
type MetadataService struct {
	db *gorm.DB
}

// NewMetadataService 创建元数据服务
func NewMetadataService(db *gorm.DB) *MetadataService {
	return &MetadataService{
		db: db,
	}
}

// SyncCollectorPoints 同步采集点到元数据 (MD-002)
func (s *MetadataService) SyncCollectorPoints(ctx context.Context, collectorID string) (*models.PointMetadataSyncResult, error) {
	result := &models.PointMetadataSyncResult{}

	// 获取采集器的所有接口配置
	var interfaces []models.CollectorInterface
	if err := s.db.Where("collector_id = ?", collectorID).Find(&interfaces).Error; err != nil {
		return nil, fmt.Errorf("获取接口配置失败: %w", err)
	}

	for _, iface := range interfaces {
		// 解析数据点配置
		var dataPoints []map[string]interface{}
		// DataPoints 已经是 []DataPointConfig 类型，需要序列化后再反序列化
		dataPointsJSON, err := json.Marshal(iface.DataPoints)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("序列化接口 %s 数据点失败: %v", iface.ID, err))
			continue
		}
		if err := json.Unmarshal(dataPointsJSON, &dataPoints); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("解析接口 %s 数据点失败: %v", iface.ID, err))
			continue
		}

		for _, point := range dataPoints {
			pointName, ok := point["name"].(string)
			if !ok || pointName == "" {
				continue
			}

			result.TotalPoints++

			// 查找或创建映射记录
			var mapping models.CollectorPointMetadata
			err := s.db.Where("collector_id = ? AND interface_id = ? AND point_name = ?",
				collectorID, iface.ID, pointName).First(&mapping).Error

			if err == gorm.ErrRecordNotFound {
				// 创建新映射
				mapping = models.CollectorPointMetadata{
					CollectorID:   collectorID,
					InterfaceID:   iface.ID.String(),
					PointName:     pointName,
					MappingType:   models.MappingTypeAuto,
					MappingStatus: models.MappingStatusPending,
				}

				// 尝试自动推荐映射
				rec := s.recommendMapping(pointName, point)
				if rec.Confidence > 0.8 {
					mapping.DatabaseName = rec.RecommendedDB
					mapping.SuperTableName = rec.RecommendedST
					mapping.MappingScore = rec.Confidence
					mapping.MappingStatus = models.MappingStatusMapped
					result.MappedPoints++
					result.NewMappings++
				}

				if err := s.db.Create(&mapping).Error; err != nil {
					result.Errors = append(result.Errors, fmt.Sprintf("创建映射失败 %s: %v", pointName, err))
				}
			} else if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("查询映射失败 %s: %v", pointName, err))
			} else {
				// 更新现有映射
				if mapping.MappingStatus == models.MappingStatusMapped {
					result.MappedPoints++
				}
			}
		}
	}

	return result, nil
}

// recommendMapping 智能推荐映射 (MD-004)
func (s *MetadataService) recommendMapping(pointName string, pointConfig map[string]interface{}) *models.PointMetadataRecommendation {
	rec := &models.PointMetadataRecommendation{
		PointName: pointName,
	}

	// 基于命名规则的简单推荐算法
	pointLower := strings.ToLower(pointName)

	// 温度相关
	if strings.Contains(pointLower, "temp") || strings.Contains(pointLower, "温度") {
		rec.RecommendedDB = "factory"
		rec.RecommendedST = "temperature"
		rec.Confidence = 0.9
		rec.Reason = "命名匹配：温度传感器"
		return rec
	}

	// 压力相关
	if strings.Contains(pointLower, "pressure") || strings.Contains(pointLower, "压力") {
		rec.RecommendedDB = "factory"
		rec.RecommendedST = "pressure"
		rec.Confidence = 0.9
		rec.Reason = "命名匹配：压力传感器"
		return rec
	}

	// 湿度相关
	if strings.Contains(pointLower, "humidity") || strings.Contains(pointLower, "湿度") {
		rec.RecommendedDB = "factory"
		rec.RecommendedST = "humidity"
		rec.Confidence = 0.85
		rec.Reason = "命名匹配：湿度传感器"
		return rec
	}

	// 电流/电压
	if strings.Contains(pointLower, "current") || strings.Contains(pointLower, "voltage") ||
		strings.Contains(pointLower, "电流") || strings.Contains(pointLower, "电压") {
		rec.RecommendedDB = "factory"
		rec.RecommendedST = "electric"
		rec.Confidence = 0.85
		rec.Reason = "命名匹配：电力参数"
		return rec
	}

	// 振动相关
	if strings.Contains(pointLower, "vibration") || strings.Contains(pointLower, "振动") {
		rec.RecommendedDB = "factory"
		rec.RecommendedST = "vibration"
		rec.Confidence = 0.8
		rec.Reason = "命名匹配：振动传感器"
		return rec
	}

	// 默认推荐
	rec.RecommendedDB = "factory"
	rec.RecommendedST = "sensors"
	rec.Confidence = 0.5
	rec.Reason = "默认映射，建议手动确认"

	return rec
}

// GetPointMetadataList 获取采集点元数据列表
func (s *MetadataService) GetPointMetadataList(query *models.CollectorPointMetadataQuery) ([]models.CollectorPointMetadata, int64, error) {
	var list []models.CollectorPointMetadata
	var total int64

	db := s.db.Model(&models.CollectorPointMetadata{})

	if query.CollectorID != "" {
		db = db.Where("collector_id = ?", query.CollectorID)
	}
	if query.InterfaceID != "" {
		db = db.Where("interface_id = ?", query.InterfaceID)
	}
	if query.PointName != "" {
		db = db.Where("point_name LIKE ?", "%"+query.PointName+"%")
	}
	if query.DatabaseName != "" {
		db = db.Where("database_name = ?", query.DatabaseName)
	}
	if query.SuperTableName != "" {
		db = db.Where("super_table_name = ?", query.SuperTableName)
	}
	if query.MappingStatus != "" {
		db = db.Where("mapping_status = ?", query.MappingStatus)
	}
	if query.MappingType != "" {
		db = db.Where("mapping_type = ?", query.MappingType)
	}

	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page := query.Page
	if page < 1 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize < 1 {
		pageSize = 20
	}

	if err := db.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, 0, err
	}

	return list, total, nil
}

// UpdatePointMapping 更新采集点映射 (MD-005)
func (s *MetadataService) UpdatePointMapping(id uuid.UUID, updates map[string]interface{}) error {
	return s.db.Model(&models.CollectorPointMetadata{}).Where("id = ?", id).Updates(updates).Error
}

// GetUnmappedPoints 获取未映射的采集点 (MD-005)
func (s *MetadataService) GetUnmappedPoints(collectorID string) ([]models.CollectorPointMetadata, error) {
	var points []models.CollectorPointMetadata
	err := s.db.Where("collector_id = ? AND mapping_status = ?", collectorID, models.MappingStatusPending).Find(&points).Error
	return points, err
}

// GetMappingConsistencyReport 获取映射一致性报告 (MD-005)
func (s *MetadataService) GetMappingConsistencyReport(collectorID string) map[string]interface{} {
	var totalCount, mappedCount, conflictCount, invalidCount int64

	s.db.Model(&models.CollectorPointMetadata{}).Where("collector_id = ?", collectorID).Count(&totalCount)
	s.db.Model(&models.CollectorPointMetadata{}).Where("collector_id = ? AND mapping_status = ?", collectorID, models.MappingStatusMapped).Count(&mappedCount)
	s.db.Model(&models.CollectorPointMetadata{}).Where("collector_id = ? AND mapping_status = ?", collectorID, models.MappingStatusConflict).Count(&conflictCount)
	s.db.Model(&models.CollectorPointMetadata{}).Where("collector_id = ? AND mapping_status = ?", collectorID, models.MappingStatusInvalid).Count(&invalidCount)

	return map[string]interface{}{
		"total_points":   totalCount,
		"mapped_points":  mappedCount,
		"conflict_points": conflictCount,
		"invalid_points": invalidCount,
		"mapping_rate":   float64(mappedCount) / float64(totalCount) * 100,
	}
}

// AutoDiscoverMetadata 自动发现元数据 (MD-003)
func (s *MetadataService) AutoDiscoverMetadata(ctx context.Context) error {
	// 扫描所有采集器
	var collectors []models.Collector
	if err := s.db.Find(&collectors).Error; err != nil {
		return err
	}

	for _, collector := range collectors {
		_, err := s.SyncCollectorPoints(ctx, collector.ID.String())
		if err != nil {
			// 记录错误但继续处理其他采集器
			continue
		}
	}

	return nil
}

// GetRecommendations 获取智能推荐列表 (MD-004)
func (s *MetadataService) GetRecommendations(collectorID, interfaceID string) ([]models.PointMetadataRecommendation, error) {
	// 获取未映射的采集点
	var pendingPoints []models.CollectorPointMetadata
	err := s.db.Where("collector_id = ? AND interface_id = ? AND mapping_status = ?",
		collectorID, interfaceID, models.MappingStatusPending).Find(&pendingPoints).Error
	if err != nil {
		return nil, err
	}

	var recommendations []models.PointMetadataRecommendation
	for _, point := range pendingPoints {
		rec := s.recommendMapping(point.PointName, nil)
		rec.ExistingMapping = &point
		recommendations = append(recommendations, *rec)
	}

	return recommendations, nil
}

// BatchUpdateMapping 批量更新映射
func (s *MetadataService) BatchUpdateMapping(ids []uuid.UUID, updates map[string]interface{}) error {
	return s.db.Model(&models.CollectorPointMetadata{}).Where("id IN ?", ids).Updates(updates).Error
}

// DeletePointMapping 删除采集点映射
func (s *MetadataService) DeletePointMapping(id uuid.UUID) error {
	return s.db.Delete(&models.CollectorPointMetadata{}, "id = ?", id).Error
}
