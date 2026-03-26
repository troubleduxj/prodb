package main

import (
	"bufio"
	"fmt"
	"os"
	"prodb/platform/backend/config"
	"prodb/platform/backend/tdengine"
	"strconv"
	"strings"
	"time"
)

func main() {
	fmt.Println("========================================")
	fmt.Println("    TDengine 配置工具")
	fmt.Println("========================================")
	fmt.Println()
	
	reader := bufio.NewReader(os.Stdin)
	
	// Load existing config or create default
	configPath := "platform/backend/config/tdengine.json"
	existingConfig, err := config.LoadTDengineConfig(configPath)
	if err != nil {
		fmt.Printf("无法加载现有配置: %v\n", err)
		fmt.Println("将创建新的配置...")
		existingConfig = tdengine.DefaultTDengineConfig()
	} else {
		fmt.Println("已加载现有配置")
	}
	
	fmt.Printf("当前配置:\n")
	fmt.Printf("  主机: %s\n", existingConfig.Host)
	fmt.Printf("  端口: %d\n", existingConfig.Port)
	fmt.Printf("  用户名: %s\n", existingConfig.Username)
	fmt.Printf("  数据库: %s\n", existingConfig.Database)
	fmt.Println()
	
	// Ask if user wants to modify
	fmt.Print("是否要修改配置? (y/N): ")
	response, _ := reader.ReadString('\n')
	response = strings.TrimSpace(response)
	
	if strings.ToLower(response) != "y" && strings.ToLower(response) != "yes" {
		fmt.Println("配置未修改")
		return
	}
	
	// Create new config
	newConfig := &tdengine.TDengineConfig{}
	
	// Host
	fmt.Printf("TDengine 主机地址 [%s]: ", existingConfig.Host)
	host, _ := reader.ReadString('\n')
	host = strings.TrimSpace(host)
	if host == "" {
		newConfig.Host = existingConfig.Host
	} else {
		newConfig.Host = host
	}
	
	// Port
	fmt.Printf("TDengine 端口 [%d]: ", existingConfig.Port)
	portStr, _ := reader.ReadString('\n')
	portStr = strings.TrimSpace(portStr)
	if portStr == "" {
		newConfig.Port = existingConfig.Port
	} else {
		port, err := strconv.Atoi(portStr)
		if err != nil {
			fmt.Printf("无效端口，使用默认值: %d\n", existingConfig.Port)
			newConfig.Port = existingConfig.Port
		} else {
			newConfig.Port = port
		}
	}
	
	// Username
	fmt.Printf("用户名 [%s]: ", existingConfig.Username)
	username, _ := reader.ReadString('\n')
	username = strings.TrimSpace(username)
	if username == "" {
		newConfig.Username = existingConfig.Username
	} else {
		newConfig.Username = username
	}
	
	// Password
	fmt.Printf("密码 [%s]: ", existingConfig.Password)
	password, _ := reader.ReadString('\n')
	password = strings.TrimSpace(password)
	if password == "" {
		newConfig.Password = existingConfig.Password
	} else {
		newConfig.Password = password
	}
	
	// Database
	fmt.Printf("数据库名称 [%s]: ", existingConfig.Database)
	database, _ := reader.ReadString('\n')
	database = strings.TrimSpace(database)
	if database == "" {
		newConfig.Database = existingConfig.Database
	} else {
		newConfig.Database = database
	}
	
	// Use existing values for other settings
	newConfig.MaxOpenConns = existingConfig.MaxOpenConns
	newConfig.MaxIdleConns = existingConfig.MaxIdleConns
	newConfig.ConnTimeout = existingConfig.ConnTimeout
	newConfig.IdleTimeout = existingConfig.IdleTimeout
	newConfig.MaxLifetime = existingConfig.MaxLifetime
	newConfig.HealthCheckInterval = existingConfig.HealthCheckInterval
	newConfig.MaxRetries = existingConfig.MaxRetries
	newConfig.RetryInterval = existingConfig.RetryInterval
	newConfig.EnableAutoReconnect = existingConfig.EnableAutoReconnect
	newConfig.ReconnectInterval = existingConfig.ReconnectInterval
	newConfig.MaxReconnectAttempts = existingConfig.MaxReconnectAttempts
	
	// Validate configuration
	if err := newConfig.Validate(); err != nil {
		fmt.Printf("配置验证失败: %v\n", err)
		return
	}
	
	fmt.Println("\n新配置:")
	fmt.Printf("  主机: %s\n", newConfig.Host)
	fmt.Printf("  端口: %d\n", newConfig.Port)
	fmt.Printf("  用户名: %s\n", newConfig.Username)
	fmt.Printf("  数据库: %s\n", newConfig.Database)
	fmt.Printf("  DSN: %s\n", newConfig.DSN())
	
	// Test connection
	fmt.Print("\n是否测试连接? (Y/n): ")
	testResponse, _ := reader.ReadString('\n')
	testResponse = strings.TrimSpace(testResponse)
	
	if strings.ToLower(testResponse) != "n" && strings.ToLower(testResponse) != "no" {
		fmt.Println("测试连接中...")
		
		manager, err := tdengine.NewTDengineManager(newConfig)
		if err != nil {
			fmt.Printf("创建管理器失败: %v\n", err)
		} else {
			if err := manager.Start(); err != nil {
				fmt.Printf("启动管理器失败: %v\n", err)
			} else {
				fmt.Println("连接测试成功!")
				
				// Test basic query
				conn, err := manager.GetConnection()
				if err != nil {
					fmt.Printf("获取连接失败: %v\n", err)
				} else {
					defer conn.Close()
					rows, err := conn.Query("SELECT SERVER_VERSION()")
					if err != nil {
						fmt.Printf("查询失败: %v\n", err)
					} else {
						defer rows.Close()
						if rows.Next() {
							var version string
							if err := rows.Scan(&version); err == nil {
								fmt.Printf("TDengine 版本: %s\n", version)
							}
						}
					}
				}
				
				manager.Stop()
			}
		}
	}
	
	// Save configuration
	fmt.Print("\n是否保存配置? (Y/n): ")
	saveResponse, _ := reader.ReadString('\n')
	saveResponse = strings.TrimSpace(saveResponse)
	
	if strings.ToLower(saveResponse) != "n" && strings.ToLower(saveResponse) != "no" {
		// Create config directory if it doesn't exist
		if err := os.MkdirAll("platform/backend/config", 0755); err != nil {
			fmt.Printf("创建配置目录失败: %v\n", err)
			return
		}
		
		if err := config.SaveTDengineConfig(newConfig, configPath); err != nil {
			fmt.Printf("保存配置失败: %v\n", err)
		} else {
			fmt.Printf("配置已保存到: %s\n", configPath)
		}
	}
	
	fmt.Println("\n配置完成!")
}