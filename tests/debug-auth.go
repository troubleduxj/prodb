package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

func main() {
	fmt.Println("调试认证问题...")
	
	baseURL := "http://localhost:3001/api/v1"
	client := &http.Client{Timeout: 10 * time.Second}

	// 1. 先注册一个新的采集器
	fmt.Println("1. 注册新采集器...")
	registrationData := map[string]interface{}{
		"collector_id": "debug-collector",
		"name":         "调试采集器",
		"description":  "用于调试认证问题",
		"version":      "1.0.0",
		"location":     "测试",
		"environment":  "debug",
		"secret_key":   "debug-secret-123",
		"protocols": []map[string]interface{}{
			{
				"protocol": "opcua",
				"enabled":  true,
				"version":  "1.04",
			},
		},
		"tags": map[string]string{
			"type": "debug",
		},
		"capabilities": map[string]interface{}{
			"max_data_points": 100,
		},
	}

	jsonData, _ := json.Marshal(registrationData)
	resp, err := client.Post(baseURL+"/collectors/register", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("注册失败: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("注册响应: %s\n", string(body))

	// 2. 立即尝试认证
	fmt.Println("\n2. 尝试认证...")
	authData := map[string]interface{}{
		"collector_id": "debug-collector",
		"secret_key":   "debug-secret-123",
	}

	jsonData, _ = json.Marshal(authData)
	resp, err = client.Post(baseURL+"/auth/authenticate", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("认证请求失败: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, _ = io.ReadAll(resp.Body)
	fmt.Printf("认证响应: %s\n", string(body))
	fmt.Printf("HTTP状态码: %d\n", resp.StatusCode)

	// 3. 验证采集器是否在列表中
	fmt.Println("\n3. 检查采集器列表...")
	resp, err = client.Get(baseURL + "/collectors/list")
	if err != nil {
		fmt.Printf("获取列表失败: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, _ = io.ReadAll(resp.Body)
	fmt.Printf("采集器列表: %s\n", string(body))
}