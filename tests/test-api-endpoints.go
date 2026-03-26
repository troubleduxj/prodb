package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

func main() {
	fmt.Println("========================================")
	fmt.Println("    测试API端点可用性")
	fmt.Println("========================================")
	fmt.Println()

	baseURL := "http://localhost:3001/api/v1"
	
	endpoints := []struct {
		name string
		url  string
		method string
	}{
		{"后端健康检查", "http://localhost:3001/ping", "GET"},
		{"TDengine健康检查", baseURL + "/tdengine/health", "GET"},
		{"数据库列表", baseURL + "/tdengine/databases", "GET"},
		{"查询模板", baseURL + "/query/templates", "GET"},
		{"查询历史", baseURL + "/query/history", "GET"},
	}

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	for _, endpoint := range endpoints {
		fmt.Printf("🔍 测试: %s\n", endpoint.name)
		fmt.Printf("   URL: %s\n", endpoint.url)
		
		req, err := http.NewRequest(endpoint.method, endpoint.url, nil)
		if err != nil {
			fmt.Printf("   ❌ 创建请求失败: %v\n\n", err)
			continue
		}

		resp, err := client.Do(req)
		if err != nil {
			fmt.Printf("   ❌ 请求失败: %v\n\n", err)
			continue
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			fmt.Printf("   ❌ 读取响应失败: %v\n\n", err)
			continue
		}

		fmt.Printf("   📊 状态码: %d\n", resp.StatusCode)
		
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			fmt.Printf("   ✅ 请求成功\n")
			
			// 尝试解析JSON响应
			var jsonResp map[string]interface{}
			if err := json.Unmarshal(body, &jsonResp); err == nil {
				if status, ok := jsonResp["status"].(string); ok {
					fmt.Printf("   📋 响应状态: %s\n", status)
				}
				if message, ok := jsonResp["message"].(string); ok {
					fmt.Printf("   💬 消息: %s\n", message)
				}
			}
		} else {
			fmt.Printf("   ❌ 请求失败\n")
			
			// 显示错误响应
			var errorResp map[string]interface{}
			if err := json.Unmarshal(body, &errorResp); err == nil {
				if message, ok := errorResp["message"].(string); ok {
					fmt.Printf("   💬 错误消息: %s\n", message)
				}
				if errorMsg, ok := errorResp["error"].(string); ok {
					fmt.Printf("   🔍 详细错误: %s\n", errorMsg)
				}
			} else {
				// 如果不是JSON，显示原始响应
				fmt.Printf("   📄 响应内容: %s\n", string(body))
			}
		}
		
		fmt.Println()
	}

	fmt.Println("API端点测试完成!")
}