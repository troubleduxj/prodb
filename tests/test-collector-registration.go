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
	fmt.Println("========================================")
	fmt.Println("采集器注册测试")
	fmt.Println("========================================")
	fmt.Println()

	baseURL := "http://localhost:3001/api/v1"
	client := &http.Client{Timeout: 10 * time.Second}

	// 1. 测试注册采集器
	fmt.Println("1. 注册采集器...")
	registrationData := map[string]interface{}{
		"collector_id": "opcua-test-collector",
		"name":         "OPC UA测试采集器",
		"description":  "用于测试OPC UA数据采集的采集器",
		"version":      "1.0.0",
		"location":     "测试环境",
		"environment":  "development",
		"secret_key":   "test-secret-key-123",
		"protocols": []map[string]interface{}{
			{
				"protocol": "opcua",
				"enabled":  true,
				"version":  "1.04",
				"capabilities": map[string]interface{}{
					"max_connections":            10,
					"supports_subscriptions":     true,
					"supports_security":          false,
					"max_nodes_per_subscription": 1000,
				},
			},
		},
		"tags": map[string]string{
			"department":  "engineering",
			"project":     "prodb",
			"environment": "test",
		},
		"capabilities": map[string]interface{}{
			"max_data_points":   1000,
			"buffer_size":       "10MB",
			"compression":       true,
			"encryption":        false,
			"batch_processing":  true,
		},
	}

	jsonData, _ := json.Marshal(registrationData)
	resp, err := client.Post(baseURL+"/collectors/register", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("❌ 注册失败: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("✓ 注册响应: %s\n", string(body))

	// 2. 测试获取采集器列表
	fmt.Println("\n2. 获取采集器列表...")
	resp, err = client.Get(baseURL + "/collectors/list")
	if err != nil {
		fmt.Printf("❌ 获取列表失败: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, _ = io.ReadAll(resp.Body)
	fmt.Printf("✓ 采集器列表: %s\n", string(body))

	// 3. 测试获取采集器密钥
	fmt.Println("\n3. 获取采集器密钥...")
	resp, err = client.Get(baseURL + "/collectors/opcua-test-collector/secret")
	if err != nil {
		fmt.Printf("❌ 获取密钥失败: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, _ = io.ReadAll(resp.Body)
	fmt.Printf("✓ 密钥响应: %s\n", string(body))

	// 4. 测试认证
	fmt.Println("\n4. 测试采集器认证...")
	authData := map[string]interface{}{
		"collector_id": "opcua-test-collector",
		"secret_key":   "test-secret-key-123",
	}

	jsonData, _ = json.Marshal(authData)
	resp, err = client.Post(baseURL+"/auth/authenticate", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("❌ 认证失败: %v\n", err)
		return
	}
	defer resp.Body.Close()

	body, _ = io.ReadAll(resp.Body)
	fmt.Printf("✓ 认证响应: %s\n", string(body))

	fmt.Println("\n========================================")
	fmt.Println("✅ 采集器注册测试完成!")
	fmt.Println("========================================")
}