package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

func main() {
	fmt.Println("Quick test for OPC UA Simulator...")
	
	// 等待服务器启动
	fmt.Println("Waiting for server to start...")
	time.Sleep(2 * time.Second)
	
	// 测试服务器状态
	resp, err := http.Get("http://localhost:8080/opcua/status")
	if err != nil {
		fmt.Printf("Error connecting to simulator: %v\n", err)
		fmt.Println("Make sure the simulator is running on port 8080")
		return
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading response: %v\n", err)
		return
	}
	
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		fmt.Printf("Error parsing JSON: %v\n", err)
		return
	}
	
	fmt.Println("✓ Simulator is running!")
	
	if data, ok := result["data"].(map[string]interface{}); ok {
		fmt.Printf("  - Node count: %.0f\n", data["nodeCount"])
		fmt.Printf("  - Endpoint: %s\n", data["endpoint"])
		fmt.Printf("  - HTTP Port: %s\n", data["httpPort"])
	}
	
	// 测试获取节点列表
	resp, err = http.Get("http://localhost:8080/opcua/nodes")
	if err != nil {
		fmt.Printf("Error getting nodes: %v\n", err)
		return
	}
	defer resp.Body.Close()
	
	body, err = io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("Error reading nodes response: %v\n", err)
		return
	}
	
	if err := json.Unmarshal(body, &result); err != nil {
		fmt.Printf("Error parsing nodes JSON: %v\n", err)
		return
	}
	
	fmt.Println("✓ Node list retrieved successfully!")
	
	if result["status"] == "success" {
		fmt.Printf("  - Total nodes: %.0f\n", result["count"])
	}
	
	fmt.Println("\n=== Test completed successfully! ===")
	fmt.Println("The OPC UA Simulator is working correctly.")
	fmt.Println("You can now use it with your collector or other OPC UA clients.")
}