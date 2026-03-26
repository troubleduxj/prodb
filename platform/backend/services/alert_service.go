package services

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"prodb/platform/backend/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AlertService handles alert management and notifications
type AlertService struct {
	db                *gorm.DB
	notificationMutex sync.RWMutex
	notifiers         map[string]AlertNotifier
}

// AlertNotifier interface for different notification channels
type AlertNotifier interface {
	SendAlert(alert models.CollectorAlert) error
	GetType() string
}

// EmailNotifier sends alerts via email
type EmailNotifier struct {
	SMTPHost     string
	SMTPPort     int
	Username     string
	Password     string
	FromAddress  string
	ToAddresses  []string
}

// WebhookNotifier sends alerts via webhook
type WebhookNotifier struct {
	URL     string
	Headers map[string]string
	Timeout time.Duration
}

// LogNotifier logs alerts to the system log
type LogNotifier struct{}

// NewAlertService creates a new alert service
func NewAlertService(db *gorm.DB) *AlertService {
	service := &AlertService{
		db:        db,
		notifiers: make(map[string]AlertNotifier),
	}
	
	// Add default log notifier
	service.AddNotifier(&LogNotifier{})
	
	return service
}

// AddNotifier adds a notification channel
func (as *AlertService) AddNotifier(notifier AlertNotifier) {
	as.notificationMutex.Lock()
	defer as.notificationMutex.Unlock()
	
	as.notifiers[notifier.GetType()] = notifier
	log.Printf("Added alert notifier: %s", notifier.GetType())
}

// RemoveNotifier removes a notification channel
func (as *AlertService) RemoveNotifier(notifierType string) {
	as.notificationMutex.Lock()
	defer as.notificationMutex.Unlock()
	
	delete(as.notifiers, notifierType)
	log.Printf("Removed alert notifier: %s", notifierType)
}

// TriggerAlert creates and processes a new alert
func (as *AlertService) TriggerAlert(alert models.CollectorAlert) error {
	// Check if similar alert already exists and is active
	var existingAlert models.CollectorAlert
	err := as.db.Where("collector_id = ? AND alert_type = ? AND status = 'active'", 
		alert.CollectorID, alert.AlertType).First(&existingAlert).Error
	
	if err == nil {
		// Update existing alert
		existingAlert.Message = alert.Message
		existingAlert.FiredAt = alert.FiredAt
		if err := as.db.Save(&existingAlert).Error; err != nil {
			return fmt.Errorf("failed to update existing alert: %w", err)
		}
		log.Printf("Updated existing alert %s for collector %s", alert.AlertType, alert.CollectorID)
		return nil
	} else if err != gorm.ErrRecordNotFound {
		return fmt.Errorf("failed to check existing alerts: %w", err)
	}
	
	// Create new alert
	if err := as.db.Create(&alert).Error; err != nil {
		return fmt.Errorf("failed to create alert: %w", err)
	}
	
	log.Printf("Created new alert %s for collector %s", alert.AlertType, alert.CollectorID)
	
	// Send notifications
	as.sendNotifications(alert)
	
	return nil
}

// sendNotifications sends alert notifications through all configured channels
func (as *AlertService) sendNotifications(alert models.CollectorAlert) {
	as.notificationMutex.RLock()
	defer as.notificationMutex.RUnlock()
	
	for notifierType, notifier := range as.notifiers {
		go func(nt string, n AlertNotifier) {
			if err := n.SendAlert(alert); err != nil {
				log.Printf("Failed to send alert via %s: %v", nt, err)
			}
		}(notifierType, notifier)
	}
}

// AcknowledgeAlert acknowledges an alert
func (as *AlertService) AcknowledgeAlert(alertID uuid.UUID, userID uint) error {
	now := time.Now()
	
	result := as.db.Model(&models.CollectorAlert{}).
		Where("id = ? AND status = 'active'", alertID).
		Updates(map[string]interface{}{
			"status":           "acknowledged",
			"acknowledged_at":  &now,
			"acknowledged_by":  userID,
		})
	
	if result.Error != nil {
		return fmt.Errorf("failed to acknowledge alert: %w", result.Error)
	}
	
	if result.RowsAffected == 0 {
		return fmt.Errorf("alert not found or already acknowledged")
	}
	
	log.Printf("Alert %s acknowledged by user %d", alertID, userID)
	return nil
}

// ResolveAlert resolves an alert
func (as *AlertService) ResolveAlert(alertID uuid.UUID, userID uint) error {
	now := time.Now()
	
	result := as.db.Model(&models.CollectorAlert{}).
		Where("id = ? AND status IN ('active', 'acknowledged')", alertID).
		Updates(map[string]interface{}{
			"status":      "resolved",
			"resolved_at": &now,
			"resolved_by": userID,
		})
	
	if result.Error != nil {
		return fmt.Errorf("failed to resolve alert: %w", result.Error)
	}
	
	if result.RowsAffected == 0 {
		return fmt.Errorf("alert not found or already resolved")
	}
	
	log.Printf("Alert %s resolved by user %d", alertID, userID)
	return nil
}

// AutoResolveCollectorAlerts automatically resolves alerts when collector comes back online
func (as *AlertService) AutoResolveCollectorAlerts(collectorID uuid.UUID) error {
	now := time.Now()
	
	result := as.db.Model(&models.CollectorAlert{}).
		Where("collector_id = ? AND alert_type IN ('collector_offline', 'collector_warning') AND status IN ('active', 'acknowledged')", collectorID).
		Updates(map[string]interface{}{
			"status":      "resolved",
			"resolved_at": &now,
		})
	
	if result.Error != nil {
		return fmt.Errorf("failed to auto-resolve alerts: %w", result.Error)
	}
	
	if result.RowsAffected > 0 {
		log.Printf("Auto-resolved %d alerts for collector %s", result.RowsAffected, collectorID)
	}
	
	return nil
}

// GetActiveAlerts returns all active alerts
func (as *AlertService) GetActiveAlerts() ([]models.CollectorAlert, error) {
	var alerts []models.CollectorAlert
	
	err := as.db.Preload("Collector").
		Where("status IN ('active', 'acknowledged')").
		Order("fired_at DESC").
		Find(&alerts).Error
	
	return alerts, err
}

// GetCollectorAlerts returns alerts for a specific collector
func (as *AlertService) GetCollectorAlerts(collectorID uuid.UUID, limit int) ([]models.CollectorAlert, error) {
	var alerts []models.CollectorAlert
	
	query := as.db.Where("collector_id = ?", collectorID).
		Order("fired_at DESC")
	
	if limit > 0 {
		query = query.Limit(limit)
	}
	
	err := query.Find(&alerts).Error
	return alerts, err
}

// GetAlertStatistics returns alert statistics
func (as *AlertService) GetAlertStatistics(period time.Duration) (map[string]interface{}, error) {
	since := time.Now().Add(-period)
	
	stats := make(map[string]interface{})
	
	// Count alerts by severity
	var severityCounts []struct {
		Severity string
		Count    int64
	}
	
	as.db.Model(&models.CollectorAlert{}).
		Select("severity, count(*) as count").
		Where("fired_at >= ?", since).
		Group("severity").
		Scan(&severityCounts)
	
	severityMap := make(map[string]int64)
	for _, sc := range severityCounts {
		severityMap[sc.Severity] = sc.Count
	}
	stats["by_severity"] = severityMap
	
	// Count alerts by type
	var typeCounts []struct {
		AlertType string
		Count     int64
	}
	
	as.db.Model(&models.CollectorAlert{}).
		Select("alert_type, count(*) as count").
		Where("fired_at >= ?", since).
		Group("alert_type").
		Scan(&typeCounts)
	
	typeMap := make(map[string]int64)
	for _, tc := range typeCounts {
		typeMap[tc.AlertType] = tc.Count
	}
	stats["by_type"] = typeMap
	
	// Count alerts by status
	var statusCounts []struct {
		Status string
		Count  int64
	}
	
	as.db.Model(&models.CollectorAlert{}).
		Select("status, count(*) as count").
		Where("fired_at >= ?", since).
		Group("status").
		Scan(&statusCounts)
	
	statusMap := make(map[string]int64)
	for _, sc := range statusCounts {
		statusMap[sc.Status] = sc.Count
	}
	stats["by_status"] = statusMap
	
	// Total alerts
	var totalAlerts int64
	as.db.Model(&models.CollectorAlert{}).
		Where("fired_at >= ?", since).
		Count(&totalAlerts)
	stats["total"] = totalAlerts
	
	return stats, nil
}

// Implementation of AlertNotifier interface

// SendAlert sends alert via email
func (en *EmailNotifier) SendAlert(alert models.CollectorAlert) error {
	// TODO: Implement actual email sending
	log.Printf("EMAIL ALERT: [%s] %s - %s", alert.Severity, alert.Title, alert.Message)
	return nil
}

func (en *EmailNotifier) GetType() string {
	return "email"
}

// SendAlert sends alert via webhook
func (wn *WebhookNotifier) SendAlert(alert models.CollectorAlert) error {
	// TODO: Implement actual webhook sending
	alertJSON, _ := json.Marshal(alert)
	log.Printf("WEBHOOK ALERT: %s", string(alertJSON))
	return nil
}

func (wn *WebhookNotifier) GetType() string {
	return "webhook"
}

// SendAlert logs alert to system log
func (ln *LogNotifier) SendAlert(alert models.CollectorAlert) error {
	log.Printf("ALERT: [%s] %s - %s (Collector: %s, Type: %s)", 
		alert.Severity, alert.Title, alert.Message, alert.CollectorID, alert.AlertType)
	return nil
}

func (ln *LogNotifier) GetType() string {
	return "log"
}