package main

import (
	"fmt"
	"net"
	"net/http"
	"time"
)

func main() {
	fmt.Println("========================================")
	fmt.Println("    TDengine端口和连接类型检查")
	fmt.Println("========================================")
	fmt.Println()

	host := "192.168.237.145"
	
	// 检查原生连接端口 (6030)
	fmt.Println("🔍 检查原生连接端口 (6030)...")
	checkTCPPort(host, 6030)
	
	// 检查REST连接端口 (6041)
	fmt.Println("\n🔍 检查REST连接端口 (6041)...")
	checkTCPPort(host, 6041)
	
	// 检查REST API
	fmt.Println("\n🔍 检查REST API...")
	checkRESTAPI(host, 6041)
	
	// 检查WebSocket
	fmt.Println("\n🔍 检查WebSocket...")
	checkWebSocket(host, 6041)
	
	fmt.Println("\n========================================")
	fmt.Println("检查完成!")
}

func checkTCPPort(host string, port int) {
	address := fmt.Sprintf("%s:%d", host, port)
	
	conn, err := net.DialTimeout("tcp", address, 5*time.Second)
	if err != nil {
		fmt.Printf("❌ 端口 %d 不可访问: %v\n", port, err)
		return
	}
	defer conn.Close()
	
	fmt.Printf("✅ 端口 %d 可访问\n", port)
}

func checkRESTAPI(host string, port int) {
	url := fmt.Sprintf("http://%s:%d/rest/sql", host, port)
	
	client := &http.Client{
		Timeout: 5 * time.Second,
	}
	
	resp, err := client.Get(url)
	if err != nil {
		fmt.Printf("❌ REST API 不可访问: %v\n", err)
		return
	}
	defer resp.Body.Close()
	
	fmt.Printf("✅ REST API 可访问 (状态码: %d)\n", resp.StatusCode)
	
	// 检查是否需要认证
	if resp.StatusCode == 401 {
		fmt.Println("ℹ️  需要认证 (这是正常的)")
	}
}

func checkWebSocket(host string, port int) {
	url := fmt.Sprintf("http://%s:%d/rest/ws", host, port)
	
	client := &http.Client{
		Timeout: 5 * time.Second,
	}
	
	resp, err := client.Get(url)
	if err != nil {
		fmt.Printf("❌ WebSocket端点不可访问: %v\n", err)
		return
	}
	defer resp.Body.Close()
	
	fmt.Printf("✅ WebSocket端点可访问 (状态码: %d)\n", resp.StatusCode)
	
	// WebSocket通常返回400或426状态码，表示需要升级协议
	if resp.StatusCode == 400 || resp.StatusCode == 426 {
		fmt.Println("ℹ️  WebSocket协议升级请求 (这是正常的)")
	}
}