package main

import (
	"fmt"
	"log"
	"prodb/platform/backend/database"
	"prodb/platform/backend/models"

	"gorm.io/gorm"
)

func main() {
	fmt.Println("========================================")
	fmt.Println("    检查数据库表结构")
	fmt.Println("========================================")
	fmt.Println()

	// 连接数据库
	database.Connect()
	
	// 检查TDengineConnection表是否存在
	if database.DB.Migrator().HasTable(&models.TDengineConnection{}) {
		fmt.Println("✅ TDengineConnection表存在")
		
		// 获取表结构信息
		var columns []struct {
			ColumnName string `gorm:"column:column_name"`
			DataType   string `gorm:"column:data_type"`
			IsNullable string `gorm:"column:is_nullable"`
		}
		
		err := database.DB.Raw(`
			SELECT column_name, data_type, is_nullable 
			FROM information_schema.columns 
			WHERE table_name = 'tdengine_connections' 
			ORDER BY ordinal_position
		`).Scan(&columns).Error
		
		if err != nil {
			fmt.Printf("❌ 获取表结构失败: %v\n", err)
		} else {
			fmt.Println("\n📋 表结构:")
			for _, col := range columns {
				fmt.Printf("  - %s (%s) %s\n", col.ColumnName, col.DataType, 
					map[string]string{"YES": "NULL", "NO": "NOT NULL"}[col.IsNullable])
			}
		}
		
		// 检查表中的数据
		var count int64
		database.DB.Model(&models.TDengineConnection{}).Count(&count)
		fmt.Printf("\n📊 表中记录数: %d\n", count)
		
		// 如果有数据，显示前几条
		if count > 0 {
			var connections []models.TDengineConnection
			database.DB.Limit(5).Find(&connections)
			
			fmt.Println("\n📝 前5条记录:")
			for i, conn := range connections {
				fmt.Printf("  %d. ID: %s, Name: %s, Host: %s:%d\n", 
					i+1, conn.ID.String(), conn.Name, conn.Host, conn.Port)
			}
		}
		
	} else {
		fmt.Println("❌ TDengineConnection表不存在")
		fmt.Println("💡 尝试运行数据库迁移...")
		
		// 尝试创建表
		err := database.DB.AutoMigrate(&models.TDengineConnection{})
		if err != nil {
			fmt.Printf("❌ 数据库迁移失败: %v\n", err)
		} else {
			fmt.Println("✅ 数据库迁移成功")
		}
	}
	
	// 检查其他相关表
	checkTable("CollectorHeartbeat", &models.CollectorHeartbeat{})
	checkTable("CollectorStatus", &models.CollectorStatus{})
	checkTable("CollectorMetricsHistory", &models.CollectorMetricsHistory{})
	checkTable("CollectorAlert", &models.CollectorAlert{})
	
	fmt.Println("\n数据库检查完成!")
}

func checkTable(name string, model interface{}) {
	fmt.Printf("\n🔍 检查 %s 表...\n", name)
	
	if database.DB.Migrator().HasTable(model) {
		fmt.Printf("✅ %s表存在\n", name)
		
		// 获取记录数
		var count int64
		database.DB.Model(model).Count(&count)
		fmt.Printf("📊 记录数: %d\n", count)
	} else {
		fmt.Printf("❌ %s表不存在\n", name)
		
		// 尝试创建表
		err := database.DB.AutoMigrate(model)
		if err != nil {
			fmt.Printf("❌ 创建%s表失败: %v\n", name, err)
		} else {
			fmt.Printf("✅ 创建%s表成功\n", name)
		}
	}
}