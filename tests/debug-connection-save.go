package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type TDengineConnectionRequest struct {
	Name           string `json:"name"`
	Host           string `json:"host"`
	Port           int    `json:"port"`
	Username       string `json:"username"`
	Password       string `json:"password"`
	Database       string `json:"database"`
	MaxOpenConns   int    `json:"max_open_conns"`
	MaxIdleConns   int    `json:"max_idle_conns"`
	ConnTimeout    int    `json:"conn_timeout"`
	IsDefault      bool   `json:"is_default"`
	Description    string `json:"description"`
}

func main() {
	fmt.Println("========================================")
	fmt.Println("    调试TDengine连接保存问题")
	fmt.Println("========================================")
	fmt.Println()

	// 测试连接数据
	connectionData := TDengineConnectionRequest{
		Name:         "测试连接-" + time.Now().Format("20060102-150405"),
		Host:         "192.168.237.145",
		Port:         6030,
		Username:     "root",
		Password:     "taosdata",
		Database:     "industrial_data",
		MaxOpenConns: 20,
		MaxIdleConns: 10,
		ConnTimeout:  30,
		IsDefault:    false,
		Description:  "调试测试连接",
	}

	// 序列化为JSON
	jsonData, err := json.Marshal(connectionData)
	if err != nil {
		fmt.Printf("❌ JSON序列化失败: %v\n", err)
		return
	}

	fmt.Printf("📤 发送请求数据:\n%s\n\n", string(jsonData))

	// 发送POST请求
	url := "http://localhost:3001/api/v1/database/connections"
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("❌ 请求发送失败: %v\n", err)
		fmt.Println("💡 请确保后端服务正在运行 (端口3001)")
		return
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("❌ 读取响应失败: %v\n", err)
		return
	}

	fmt.Printf("📥 响应状态码: %d\n", resp.StatusCode)
	fmt.Printf("📥 响应头: %v\n", resp.Header)
	fmt.Printf("📥 响应内容:\n%s\n\n", string(body))

	// 分析响应
	if resp.StatusCode == 201 {
		fmt.Println("✅ 连接创建成功!")
		
		// 解析响应JSON
		var response map[string]interface{}
		if err := json.Unmarshal(body, &response); err == nil {
			if data, ok := response["data"].(map[string]interface{}); ok {
				if id, ok := data["id"].(string); ok {
					fmt.Printf("🆔 新连接ID: %s\n", id)
					
					// 测试获取连接
					testGetConnection(id)
				}
			}
		}
	} else {
		fmt.Printf("❌ 连接创建失败 (状态码: %d)\n", resp.StatusCode)
		
		// 尝试解析错误信息
		var errorResponse map[string]interface{}
		if err := json.Unmarshal(body, &errorResponse); err == nil {
			if message, ok := errorResponse["message"].(string); ok {
				fmt.Printf("错误信息: %s\n", message)
			}
			if errorMsg, ok := errorResponse["error"].(string); ok {
				fmt.Printf("详细错误: %s\n", errorMsg)
			}
		}
	}
}

func testGetConnection(id string) {
	fmt.Println("\n🔍 测试获取连接...")
	
	url := fmt.Sprintf("http://localhost:3001/api/v1/database/connections/%s", id)
	resp, err := http.Get(url)
	if err != nil {
		fmt.Printf("❌ 获取连接失败: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("❌ 读取响应失败: %v\n", err)
		return
	}

	fmt.Printf("📥 获取连接响应 (状态码: %d):\n%s\n", resp.StatusCode, string(body))

	if resp.StatusCode == 200 {
		fmt.Println("✅ 连接获取成功!")
	} else {
		fmt.Printf("❌ 连接获取失败 (状态码: %d)\n", resp.StatusCode)
	}
}