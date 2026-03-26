package database

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"prodb/platform/backend/database/migrations"
	"prodb/platform/backend/models"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Collector represents the collectors table
type Collector struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;"`
	Name           string    `gorm:"size:100;not null"`
	SecretKey      string    `gorm:"size:255;not null"`
	Status         string    `gorm:"size:20;default:'offline'"`
	LastHeartbeat  *time.Time
	ConfigJSON     string `gorm:"type:jsonb"`
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// BeforeCreate will set a UUID rather than numeric ID.
func (c *Collector) BeforeCreate(tx *gorm.DB) (err error) {
	c.ID = uuid.New()
	return
}

// Interface represents the interfaces table
type Interface struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	CollectorID uuid.UUID `gorm:"type:uuid;not null" json:"collector_id"`
	Name        string    `gorm:"size:100;not null" json:"name"`
	Type        string    `gorm:"size:50;not null" json:"type"`
	Config      string    `gorm:"type:jsonb" json:"config"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}


var DB *gorm.DB

func Connect() {
	dsn := "host=localhost user=postgres password=Hanatech@123 dbname=prodbmanager port=5432 sslmode=disable TimeZone=Asia/Shanghai"
	
	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	fmt.Println("Database connection successfully opened.")
}

func Migrate() {
	fmt.Println("Running database migrations...")
	
	// Run custom migrations before AutoMigrate
	if err := migrations.MigrateCollectorAgentID(DB); err != nil {
		log.Printf("Warning: Failed to migrate collector agent_id: %v", err)
	}
	
	err := DB.AutoMigrate(
		&models.User{},
		&models.Role{},
		&models.PermissionGroup{},
		&models.Permission{},
		&models.Collector{},
		&Interface{},
		// 配置统一架构新表
		&models.CollectorInterface{},
		&models.InterfaceConfigHistory{},
		&models.InterfaceConfigDelivery{},
		&models.EdgeAlertRule{},
		&models.EdgeAlertEvent{},
		&models.ConfigTemplate{},
		&models.ConfigTemplateVersion{},
		&models.CollectionTask{},
		&models.ConfigDelivery{},
		&models.ConfigVersion{},
		&models.CollectorHeartbeat{},
		&models.CollectorStatus{},
		&models.CollectorMetricsHistory{},
		&models.CollectorAlert{},
		&models.AuditLog{},
		&models.SecurityEvent{},
		&models.LoginAttempt{},
		&models.TDengineConnection{},
		&models.QueryTemplate{},
		&models.QueryHistory{},
		&models.ExportJob{},
		&models.CollectorAuthStatus{},
		&models.AuthenticationRule{},
		&models.AuthenticationLog{},
		&models.NodePoint{},
		&models.BatchOperation{},
	)
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}
	fmt.Println("Database migration completed.")
}

func Seed() {
	// Check if admin role exists
	var adminRole models.Role
	if err := DB.Where("name = ?", "admin").First(&adminRole).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create admin role
			adminRole = models.Role{Name: "admin", Description: "System Administrator"}
			if err := DB.Create(&adminRole).Error; err != nil {
				log.Fatal("Failed to seed admin role:", err)
			}
			fmt.Println("Admin role seeded.")
		} else {
			log.Fatal("Database error:", err)
		}
	}

	// Check if admin user exists
	var adminUser models.User
	if err := DB.Where("username = ?", "admin").First(&adminUser).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Hash the password
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte("Hanatech@123"), bcrypt.DefaultCost)
			if err != nil {
				log.Fatal("Failed to hash password:", err)
			}

			// Create admin user
			adminUser = models.User{
				Username:     "admin",
				PasswordHash: string(hashedPassword),
				FullName:     "Super Admin",
				Email:        "admin@prodb.com",
				Status:       1,
				Roles:        []*models.Role{&adminRole},
			}
			if err := DB.Create(&adminUser).Error; err != nil {
				log.Fatal("Failed to seed admin user:", err)
			}

			// Associate the admin role with the admin user
			if err := DB.Model(&adminUser).Association("Roles").Append(&adminRole); err != nil {
				log.Fatal("Failed to associate admin role with admin user:", err)
			}

			fmt.Println("Admin user seeded.")
		} else {
			log.Fatal("Database error:", err)
		}
	}

	// Seed a collector for testing
	var collector models.Collector
	if err := DB.Where("name = ?", "Test Collector").First(&collector).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create a new collector
			collector = models.Collector{
				Name:       "Test Collector",
				SecretKey:  uuid.New().String(),
				Status:     "online",
				ConfigJSON: `{"setting": "value"}`,
			}
			if err := DB.Create(&collector).Error; err != nil {
				log.Fatal("Failed to seed collector:", err)
			}
			fmt.Println("Test collector seeded.")

			// Seed interfaces for the collector
			interfaces := []Interface{
				{CollectorID: collector.ID, Name: "OPC DA Server", Type: "OPC DA", Config: `{"server": "localhost"}`},
				{CollectorID: collector.ID, Name: "Modbus Device", Type: "Modbus", Config: `{"host": "192.168.1.10"}`},
			}
			if err := DB.Create(&interfaces).Error; err != nil {
				log.Fatal("Failed to seed interfaces:", err)
			}
			fmt.Println("Test interfaces seeded.")
		} else {
			log.Fatal("Database error:", err)
		}
	}

	// Seed configuration templates for testing
	var modbusTemplate models.ConfigTemplate
	if err := DB.Where("name = ?", "Standard Modbus TCP Template").First(&modbusTemplate).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			templateConfig := map[string]interface{}{
				"connection": map[string]interface{}{
					"host":     "{{host}}",
					"port":     502,
					"slave_id": 1,
					"timeout":  3000,
				},
				"schedule": map[string]interface{}{
					"interval": 5,
					"unit":     "seconds",
				},
				"data_points": []map[string]interface{}{
					{
						"name":      "{{point_name}}",
						"address":   "{{address}}",
						"data_type": "{{data_type}}",
						"scale":     1.0,
						"unit":      "{{unit}}",
					},
				},
				"target": map[string]interface{}{
					"database":    "industrial_data",
					"super_table": "modbus_metrics",
					"tags": map[string]interface{}{
						"location":    "{{location}}",
						"device_type": "plc",
					},
				},
			}
			configJSON, _ := json.Marshal(templateConfig)
			tags := []string{"modbus", "plc", "industrial"}
			tagsJSON, _ := json.Marshal(tags)

			modbusTemplate = models.ConfigTemplate{
				Name:           "Standard Modbus TCP Template",
				Description:    "Standard template for Modbus TCP data collection",
				Protocol:       "modbus_tcp",
				TemplateConfig: string(configJSON),
				Version:        "1.0.0",
				CreatedBy:      adminUser.ID,
				Status:         "active",
				Tags:           string(tagsJSON),
			}
			if err := DB.Create(&modbusTemplate).Error; err != nil {
				log.Fatal("Failed to seed Modbus template:", err)
			}
			fmt.Println("Modbus template seeded.")
		}
	}
}
