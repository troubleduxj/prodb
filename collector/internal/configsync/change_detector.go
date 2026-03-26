// Package configsync 配置同步相关功能
package configsync

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"reflect"
)

// ChangeDetector 配置变更检测器
type ChangeDetector struct {
	oldConfig *PlatformConfig
	newConfig *PlatformConfig
}

// ConfigChange 配置变更
type ConfigChange struct {
	Type        ChangeType  `json:"type"`
	EntityType  string      `json:"entity_type"` // interface, global, edge_alert
	EntityID    string      `json:"entity_id,omitempty"`
	Field       string      `json:"field,omitempty"`
	OldValue    interface{} `json:"old_value,omitempty"`
	NewValue    interface{} `json:"new_value,omitempty"`
	Description string      `json:"description"`
}

// ChangeType 变更类型
type ChangeType string

const (
	ChangeTypeAdd     ChangeType = "add"
	ChangeTypeRemove  ChangeType = "remove"
	ChangeTypeUpdate  ChangeType = "update"
	ChangeTypeNoChange ChangeType = "no_change"
)

// InterfaceChange 接口配置变更
type InterfaceChange struct {
	InterfaceID   string          `json:"interface_id"`
	InterfaceName string          `json:"interface_name"`
	ChangeType    ChangeType      `json:"change_type"`
	Changes       []ConfigChange  `json:"changes"`
	OldInterface  *InterfaceConfig `json:"old_interface,omitempty"`
	NewInterface  *InterfaceConfig `json:"new_interface,omitempty"`
}

// NewChangeDetector 创建变更检测器
func NewChangeDetector(oldConfig, newConfig *PlatformConfig) *ChangeDetector {
	return &ChangeDetector{
		oldConfig: oldConfig,
		newConfig: newConfig,
	}
}

// DetectChanges 检测所有变更
func (cd *ChangeDetector) DetectChanges() []InterfaceChange {
	if cd.newConfig == nil {
		return nil
	}
	
	// 如果旧配置为空，所有接口都是新增的
	if cd.oldConfig == nil {
		return cd.detectAllAsNew()
	}
	
	var changes []InterfaceChange
	
	// 检测接口变更
	oldInterfaces := cd.makeInterfaceMap(cd.oldConfig.Interfaces)
	newInterfaces := cd.makeInterfaceMap(cd.newConfig.Interfaces)
	
	// 检查新增和更新的接口
	for id, newIface := range newInterfaces {
		if oldIface, exists := oldInterfaces[id]; !exists {
			// 新增接口
			changes = append(changes, InterfaceChange{
				InterfaceID:   id,
				InterfaceName: newIface.Name,
				ChangeType:    ChangeTypeAdd,
				Changes: []ConfigChange{
					{
						Type:        ChangeTypeAdd,
						EntityType:  "interface",
						EntityID:    id,
						Description: fmt.Sprintf("新增接口: %s (%s)", newIface.Name, newIface.Protocol),
					},
				},
				NewInterface: &newIface,
			})
		} else {
			// 检查接口更新
			if ifaceChanges := cd.detectInterfaceChanges(oldIface, newIface); len(ifaceChanges) > 0 {
				changes = append(changes, InterfaceChange{
					InterfaceID:   id,
					InterfaceName: newIface.Name,
					ChangeType:    ChangeTypeUpdate,
					Changes:       ifaceChanges,
					OldInterface:  &oldIface,
					NewInterface:  &newIface,
				})
			}
		}
	}
	
	// 检查删除的接口
	for id, oldIface := range oldInterfaces {
		if _, exists := newInterfaces[id]; !exists {
			changes = append(changes, InterfaceChange{
				InterfaceID:   id,
				InterfaceName: oldIface.Name,
				ChangeType:    ChangeTypeRemove,
				Changes: []ConfigChange{
					{
						Type:        ChangeTypeRemove,
						EntityType:  "interface",
						EntityID:    id,
						Description: fmt.Sprintf("删除接口: %s", oldIface.Name),
					},
				},
				OldInterface: &oldIface,
			})
		}
	}
	
	return changes
}

// HasChanges 检查是否有变更
func (cd *ChangeDetector) HasChanges() bool {
	changes := cd.DetectChanges()
	return len(changes) > 0
}

// IsFullReloadRequired 是否需要完全重新加载
func (cd *ChangeDetector) IsFullReloadRequired() bool {
	if cd.oldConfig == nil || cd.newConfig == nil {
		return true
	}
	
	changes := cd.DetectChanges()
	
	for _, change := range changes {
		// 如果有接口删除，需要完全重载
		if change.ChangeType == ChangeTypeRemove {
			return true
		}
		
		// 检查是否有连接配置的变更
		for _, c := range change.Changes {
			if c.EntityType == "connection" && c.Type == ChangeTypeUpdate {
				return true
			}
		}
	}
	
	return false
}

// detectAllAsNew 将所有接口视为新增
func (cd *ChangeDetector) detectAllAsNew() []InterfaceChange {
	var changes []InterfaceChange
	for _, iface := range cd.newConfig.Interfaces {
		changes = append(changes, InterfaceChange{
			InterfaceID:   iface.ID,
			InterfaceName: iface.Name,
			ChangeType:    ChangeTypeAdd,
			Changes: []ConfigChange{
				{
					Type:        ChangeTypeAdd,
					EntityType:  "interface",
					EntityID:    iface.ID,
					Description: fmt.Sprintf("新增接口: %s (%s)", iface.Name, iface.Protocol),
				},
			},
			NewInterface: &iface,
		})
	}
	return changes
}

// makeInterfaceMap 创建接口映射
func (cd *ChangeDetector) makeInterfaceMap(interfaces []InterfaceConfig) map[string]InterfaceConfig {
	m := make(map[string]InterfaceConfig)
	for _, iface := range interfaces {
		m[iface.ID] = iface
	}
	return m
}

// detectInterfaceChanges 检测接口配置变更
func (cd *ChangeDetector) detectInterfaceChanges(old, new InterfaceConfig) []ConfigChange {
	var changes []ConfigChange
	
	// 检测基本字段变更
	if old.Name != new.Name {
		changes = append(changes, ConfigChange{
			Type:        ChangeTypeUpdate,
			EntityType:  "interface",
			EntityID:    old.ID,
			Field:       "name",
			OldValue:    old.Name,
			NewValue:    new.Name,
			Description: fmt.Sprintf("接口名称: %s -> %s", old.Name, new.Name),
		})
	}
	
	if old.Enabled != new.Enabled {
		changes = append(changes, ConfigChange{
			Type:        ChangeTypeUpdate,
			EntityType:  "interface",
			EntityID:    old.ID,
			Field:       "enabled",
			OldValue:    old.Enabled,
			NewValue:    new.Enabled,
			Description: fmt.Sprintf("启用状态: %v -> %v", old.Enabled, new.Enabled),
		})
	}
	
	// 检测连接配置变更
	if connectionChanges := cd.detectConnectionChanges(old.ID, old.Connection, new.Connection); len(connectionChanges) > 0 {
		changes = append(changes, connectionChanges...)
	}
	
	// 检测数据点变更
	if dpChanges := cd.detectDataPointChanges(old.ID, old.DataPoints, new.DataPoints); len(dpChanges) > 0 {
		changes = append(changes, dpChanges...)
	}
	
	// 检测调度配置变更
	if !reflect.DeepEqual(old.Schedule, new.Schedule) {
		changes = append(changes, ConfigChange{
			Type:        ChangeTypeUpdate,
			EntityType:  "schedule",
			EntityID:    old.ID,
			OldValue:    old.Schedule,
			NewValue:    new.Schedule,
			Description: "调度配置已更新",
		})
	}
	
	// 检测边缘处理配置变更
	if !reflect.DeepEqual(old.EdgeProcessing, new.EdgeProcessing) {
		changes = append(changes, ConfigChange{
			Type:        ChangeTypeUpdate,
			EntityType:  "edge_processing",
			EntityID:    old.ID,
			OldValue:    old.EdgeProcessing,
			NewValue:    new.EdgeProcessing,
			Description: "边缘处理配置已更新",
		})
	}
	
	return changes
}

// detectConnectionChanges 检测连接配置变更
func (cd *ChangeDetector) detectConnectionChanges(interfaceID string, old, new ConnectionConfig) []ConfigChange {
	var changes []ConfigChange
	
	if old.Host != new.Host {
		changes = append(changes, ConfigChange{
			Type:        ChangeTypeUpdate,
			EntityType:  "connection",
			EntityID:    interfaceID,
			Field:       "host",
			OldValue:    old.Host,
			NewValue:    new.Host,
			Description: fmt.Sprintf("主机地址: %s -> %s", old.Host, new.Host),
		})
	}
	
	if old.Port != new.Port {
		changes = append(changes, ConfigChange{
			Type:        ChangeTypeUpdate,
			EntityType:  "connection",
			EntityID:    interfaceID,
			Field:       "port",
			OldValue:    old.Port,
			NewValue:    new.Port,
			Description: fmt.Sprintf("端口: %d -> %d", old.Port, new.Port),
		})
	}
	
	if old.Endpoint != new.Endpoint {
		changes = append(changes, ConfigChange{
			Type:        ChangeTypeUpdate,
			EntityType:  "connection",
			EntityID:    interfaceID,
			Field:       "endpoint",
			OldValue:    old.Endpoint,
			NewValue:    new.Endpoint,
			Description: "端点已更新",
		})
	}
	
	return changes
}

// detectDataPointChanges 检测数据点变更
func (cd *ChangeDetector) detectDataPointChanges(interfaceID string, old, new []DataPointConfig) []ConfigChange {
	var changes []ConfigChange
	
	oldMap := make(map[string]DataPointConfig)
	newMap := make(map[string]DataPointConfig)
	
	for _, dp := range old {
		oldMap[dp.Name] = dp
	}
	for _, dp := range new {
		newMap[dp.Name] = dp
	}
	
	// 检查新增
	for name, dp := range newMap {
		if _, exists := oldMap[name]; !exists {
			changes = append(changes, ConfigChange{
				Type:        ChangeTypeAdd,
				EntityType:  "datapoint",
				EntityID:    interfaceID,
				Field:       name,
				NewValue:    dp,
				Description: fmt.Sprintf("新增数据点: %s", name),
			})
		}
	}
	
	// 检查删除
	for name := range oldMap {
		if _, exists := newMap[name]; !exists {
			changes = append(changes, ConfigChange{
				Type:        ChangeTypeRemove,
				EntityType:  "datapoint",
				EntityID:    interfaceID,
				Field:       name,
				OldValue:    oldMap[name],
				Description: fmt.Sprintf("删除数据点: %s", name),
			})
		}
	}
	
	// 检查更新
	for name, newDp := range newMap {
		if oldDp, exists := oldMap[name]; exists {
			if !cd.isDataPointEqual(oldDp, newDp) {
				changes = append(changes, ConfigChange{
					Type:        ChangeTypeUpdate,
					EntityType:  "datapoint",
					EntityID:    interfaceID,
					Field:       name,
					OldValue:    oldDp,
					NewValue:    newDp,
					Description: fmt.Sprintf("更新数据点: %s", name),
				})
			}
		}
	}
	
	return changes
}

// isDataPointEqual 比较数据点是否相等
func (cd *ChangeDetector) isDataPointEqual(a, b DataPointConfig) bool {
	return a.Address == b.Address &&
		a.DataType == b.DataType &&
		a.Scale == b.Scale &&
		a.Offset == b.Offset &&
		a.Unit == b.Unit &&
		a.SamplingInterval == b.SamplingInterval
}

// CalculateChecksum 计算配置的校验和
func CalculateChecksum(config *PlatformConfig) (string, error) {
	if config == nil {
		return "", fmt.Errorf("config is nil")
	}
	
	data, err := json.Marshal(config)
	if err != nil {
		return "", err
	}
	
	hash := sha256.Sum256(data)
	return fmt.Sprintf("%x", hash), nil
}

// ValidateChecksum 验证配置校验和
func ValidateChecksum(config *PlatformConfig, expectedChecksum string) error {
	if config == nil {
		return fmt.Errorf("config is nil")
	}
	
	actualChecksum, err := CalculateChecksum(config)
	if err != nil {
		return fmt.Errorf("failed to calculate checksum: %w", err)
	}
	
	if actualChecksum != expectedChecksum {
		return fmt.Errorf("checksum mismatch: expected %s, got %s", expectedChecksum, actualChecksum)
	}
	
	return nil
}