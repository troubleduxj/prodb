package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

func main() {
	baseURL := "http://localhost:3002"
	
	fmt.Println("🔗 测试后端API连接")
	fmt.Println("==================")
	
	// 测试ping端点
	fmt.Println("\n1. 测试Ping端点...")
	testEndpoint("GET", baseURL+"/ping", "")
	
	// 测试API健康检查
	fmt.Println("\n2. 测试API健康检查...")
	testEndpoint("GET", baseURL+"/api/v1/health/summary", "")
	
	// 测试数据库连接列表
	fmt.Println("\n3. 测试数据库连接列表...")
	testEndpoint("GET", baseURL+"/api/v1/database/connections", "")
	
	// 测试连接状态
	fmt.Println("\n4. 测试连接状态...")
	testEndpoint("GET", baseURL+"/api/v1/database/connections/status", "")
	
	// 测试连接测试功能
	fmt.Println("\n5. 测试连接测试功能...")
	testData := `{
		"name": "测试连接",
		"host": "localhost",
		"port": 6041,
		"username": "root",
		"password": "taosdata",
		"database": "",
		"max_open_conns": 20,
		"max_idle_conns": 10,
		"conn_timeout": 30,
		"is_default": false
	}`
	testEndpoint("POST", baseURL+"/api/v1/database/connections/test", testData)
}

func testEndpoint(method, url, body string) {
	client := &http.Client{
		Timeout: 10 * time.Second,
	}
	
	var req *http.Request
	var err error
	
	if body != "" {
		req, err = http.NewRequest(method, url, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req, err = http.NewRequest(method, url, nil)
	}
	
	if err != nil {
		fmt.Printf("❌ 创建请求失败: %v\n", err)
		return
	}
	
	fmt.Printf("📤 %s %s\n", method, url)
	
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("❌ 请求失败: %v\n", err)
		return
	}
	defer resp.Body.Close()
	
	fmt.Printf("📥 状态码: %d %s\n", resp.StatusCode, resp.Status)
	fmt.Printf("📋 Content-Type: %s\n", resp.Header.Get("Content-Type"))
	
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("❌ 读取响应失败: %v\n", err)
		return
	}
	
	// 检查是否是JSON响应
	if strings.Contains(resp.Header.Get("Content-Type"), "application/json") {
		var jsonData interface{}
		if err := json.Unmarshal(bodyBytes, &jsonData); err == nil {
			prettyJSON, _ := json.MarshalIndent(jsonData, "", "  ")
			fmt.Printf("📄 响应内容:\n%s\n", string(prettyJSON))
		} else {
			fmt.Printf("📄 响应内容 (非JSON):\n%s\n", string(bodyBytes[:min(500, len(bodyBytes))]))
		}
	} else {
		// 如果不是JSON，只显示前500个字符
		content := string(bodyBytes)
		if len(content) > 500 {
			content = content[:500] + "..."
		}
		fmt.Printf("📄 响应内容:\n%s\n", content)
	}
	
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		fmt.Println("✅ 请求成功")
	} else {
		fmt.Println("❌ 请求失败")
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}