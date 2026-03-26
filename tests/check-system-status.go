package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"prodb/platform/backend/config"
	"prodb/platform/backend/tdengine"
	"time"

	_ "github.com/lib/pq"
)

func main() {
	fmt.Println("========================================")
	fmt.Println("    ProDB 系统状态检查")
	fmt.Println("========================================")
	fmt.Println()
	
	// Check TDengine
	checkTDengine()
	fmt.Println()
	
	// Check Backend API
	checkBackendAPI()
	fmt.Println()
	
	// Check Frontend
	checkFrontend()
	fmt.Println()
	
	fmt.Println("系统状态检查完成!")
}

func checkTDengine() {
	fmt.Println("🔍 检查 TDengine 连接...")
	
	// Load TDengine config
	configPath := "platform/backend/config/tdengine.json"
	tdengineConfig, err := config.LoadTDengineConfig(configPath)
	if err != nil {
		fmt.Printf("❌ 无法加载TDengine配置: %v\n", err)
		return
	}
	
	fmt.Printf("📍 TDengine地址: %s:%d\n", tdengineConfig.Host, tdengineConfig.Port)
	
	// Test connection
	manager, err := tdengine.NewTDengineManager(tdengineConfig)
	if err != nil {
		fmt.Printf("❌ 创建TDengine管理器失败: %v\n", err)
		return
	}
	
	if err := manager.Start(); err != nil {
		fmt.Printf("❌ 启动TDengine管理器失败: %v\n", err)
		return
	}
	defer manager.Stop()
	
	// Test basic connection
	conn, err := manager.GetConnection()
	if err != nil {
		fmt.Printf("❌ 获取TDengine连接失败: %v\n", err)
		return
	}
	defer conn.Close()
	
	// Test query
	rows, err := conn.Query("SELECT SERVER_VERSION()")
	if err != nil {
		fmt.Printf("❌ TDengine查询失败: %v\n", err)
		return
	}
	defer rows.Close()
	
	if rows.Next() {
		var version string
		if err := rows.Scan(&version); err == nil {
			fmt.Printf("✅ TDengine连接成功! 版本: %s\n", version)
		}
	}
	
	// Get health status
	status := manager.GetHealthStatus()
	fmt.Printf("📊 健康状态: %v\n", status.IsHealthy)
	
	// Get metrics
	metrics := manager.GetMetrics()
	fmt.Printf("📈 连接统计: 活跃=%d, 总计=%d, 失败=%d\n", 
		metrics.ActiveConnections, metrics.TotalConnections, metrics.FailedConnections)
}

func checkBackendAPI() {
	fmt.Println("🔍 检查后端API服务...")
	
	client := &http.Client{Timeout: 5 * time.Second}
	
	// Check ping endpoint
	resp, err := client.Get("http://localhost:3001/ping")
	if err != nil {
		fmt.Printf("❌ 后端API服务不可用: %v\n", err)
		fmt.Println("💡 请运行 start-backend.bat 启动后端服务")
		return
	}
	defer resp.Body.Close()
	
	if resp.StatusCode == 200 {
		fmt.Printf("✅ 后端API服务运行正常 (端口: 3001)\n")
	} else {
		fmt.Printf("⚠️  后端API服务响应异常 (状态码: %d)\n", resp.StatusCode)
	}
	
	// Check API v1 endpoints
	endpoints := []string{
		"/api/v1/collectors",
		"/api/v1/database/connections",
		"/api/v1/tdengine/health",
	}
	
	for _, endpoint := range endpoints {
		url := "http://localhost:3001" + endpoint
		resp, err := client.Get(url)
		if err != nil {
			fmt.Printf("❌ API端点 %s 不可用: %v\n", endpoint, err)
			continue
		}
		resp.Body.Close()
		
		if resp.StatusCode < 500 {
			fmt.Printf("✅ API端点 %s 可用\n", endpoint)
		} else {
			fmt.Printf("⚠️  API端点 %s 响应异常 (状态码: %d)\n", endpoint, resp.StatusCode)
		}
	}
}

func checkFrontend() {
	fmt.Println("🔍 检查前端服务...")
	
	client := &http.Client{Timeout: 5 * time.Second}
	
	// Common frontend ports
	ports := []string{"3000", "5173", "5174", "4173"}
	
	frontendRunning := false
	for _, port := range ports {
		url := fmt.Sprintf("http://localhost:%s", port)
		resp, err := client.Get(url)
		if err != nil {
			continue
		}
		resp.Body.Close()
		
		if resp.StatusCode == 200 {
			fmt.Printf("✅ 前端服务运行正常 (端口: %s)\n", port)
			fmt.Printf("🌐 访问地址: %s\n", url)
			frontendRunning = true
			break
		}
	}
	
	if !frontendRunning {
		fmt.Printf("❌ 前端服务不可用\n")
		fmt.Println("💡 请进入 platform/frontend 目录运行:")
		fmt.Println("   npm install")
		fmt.Println("   npm run dev")
	}
}

func checkPostgreSQL() {
	fmt.Println("🔍 检查 PostgreSQL 连接...")
	
	// This would require database configuration
	// For now, just show a placeholder
	fmt.Println("💡 PostgreSQL检查需要配置数据库连接信息")
}