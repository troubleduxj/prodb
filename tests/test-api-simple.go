package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

func main() {
	fmt.Println("🧪 测试后端API接口...")
	
	client := &http.Client{
		Timeout: 10 * time.Second,
	}
	
	// 等待后端启动
	fmt.Println("⏳ 等待后端服务启动...")
	time.Sleep(3 * time.Second)
	
	// 测试基本连接
	fmt.Println("\n1. 测试基本连接 (/ping)")
	testEndpoint(client, "http://localhost:3001/ping")
	
	// 测试数据库API
	fmt.Println("\n2. 测试数据库API (/api/v1/tdengine/databases)")
	testEndpoint(client, "http://localhost:3001/api/v1/tdengine/databases")
	
	// 测试趋势API
	fmt.Println("\n3. 测试趋势API (/api/v1/trends/parameters)")
	testEndpoint(client, "http://localhost:3001/api/v1/trends/parameters")
	
	fmt.Println("\n✅ 测试完成！")
}

func testEndpoint(client *http.Client, url string) {
	resp, err := client.Get(url)
	if err != nil {
		fmt.Printf("❌ 请求失败: %v\n", err)
		return
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("❌ 读取响应失败: %v\n", err)
		return
	}
	
	fmt.Printf("📊 状态码: %d\n", resp.StatusCode)
	
	if resp.StatusCode == 200 {
		fmt.Printf("✅ 请求成功\n")
		
		// 尝试解析JSON
		var result map[string]interface{}
		if err := json.Unmarshal(body, &result); err == nil {
			if status, ok := result["status"]; ok {
				fmt.Printf("📋 响应状态: %v\n", status)
			}
			if data, ok := result["data"]; ok {
				fmt.Printf("📦 数据类型: %T\n", data)
			}
		}
	} else {
		fmt.Printf("❌ 请求失败\n")
		fmt.Printf("📄 响应内容: %s\n", string(body))
	}
}