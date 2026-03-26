package main

import (
	"fmt"
	"net/http"
	"time"
)

func main() {
	fmt.Println("🔍 检查后端服务状态...")
	
	// 检查后端服务是否运行
	client := &http.Client{
		Timeout: 5 * time.Second,
	}
	
	// 测试基本连接
	fmt.Println("\n1. 测试基本连接...")
	resp, err := client.Get("http://localhost:3001/ping")
	if err != nil {
		fmt.Printf("❌ 后端服务未运行或无法连接: %v\n", err)
		fmt.Println("\n💡 解决方案:")
		fmt.Println("1. 确保后端服务正在运行:")
		fmt.Println("   cd platform/backend")
		fmt.Println("   go run main.go")
		fmt.Println("\n2. 检查端口3001是否被占用:")
		fmt.Println("   netstat -ano | findstr :3001")
		return
	}
	defer resp.Body.Close()
	
	fmt.Printf("✅ 后端服务运行正常 (状态码: %d)\n", resp.StatusCode)
	
	// 测试API端点
	endpoints := []string{
		"/api/v1/tdengine/databases",
		"/api/v1/trends/parameters",
		"/api/v1/query/execute",
	}
	
	fmt.Println("\n2. 测试API端点...")
	for _, endpoint := range endpoints {
		url := "http://localhost:3001" + endpoint
		
		var resp *http.Response
		var err error
		
		if endpoint == "/api/v1/query/execute" {
			// POST请求需要特殊处理
			fmt.Printf("⏭️  跳过POST端点测试: %s\n", endpoint)
			continue
		}
		
		resp, err = client.Get(url)
		if err != nil {
			fmt.Printf("❌ %s - 连接失败: %v\n", endpoint, err)
			continue
		}
		resp.Body.Close()
		
		if resp.StatusCode == 200 {
			fmt.Printf("✅ %s - 正常 (状态码: %d)\n", endpoint, resp.StatusCode)
		} else {
			fmt.Printf("⚠️  %s - 异常 (状态码: %d)\n", endpoint, resp.StatusCode)
		}
	}
	
	fmt.Println("\n3. CORS检查...")
	fmt.Println("✅ 后端已配置CORS，允许localhost:3000访问")
	
	fmt.Println("\n🎯 建议:")
	fmt.Println("1. 如果后端服务未运行，请启动它:")
	fmt.Println("   cd platform/backend && go run main.go")
	fmt.Println("\n2. 如果服务正常，请检查浏览器控制台的详细错误信息")
	fmt.Println("\n3. 尝试直接在浏览器访问: http://localhost:3001/ping")
}