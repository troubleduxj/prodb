package main

import (
	"fmt"
	"net/http"
)

func main() {
	fmt.Println("测试ProDB后端路由...")

	// 测试现有路由
	routes := []string{
		"http://localhost:3001/api/v1/collectors/list",
		"http://localhost:3001/api/v1/data/statistics",
		"http://localhost:3001/api/v1/data/realtime/opcua-collector-001",
	}

	for _, route := range routes {
		resp, err := http.Get(route)
		if err != nil {
			fmt.Printf("❌ %s - 错误: %v\n", route, err)
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode == 200 {
			fmt.Printf("✅ %s - 状态码: %d\n", route, resp.StatusCode)
		} else {
			fmt.Printf("❌ %s - 状态码: %d\n", route, resp.StatusCode)
		}
	}
}