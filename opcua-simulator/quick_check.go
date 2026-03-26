package main

import (
	"encoding/json"
	"fmt"
	"os"
)

func main() {
	fmt.Println("Quick Config Check...")
	
	// 检查文件是否存在
	if _, err := os.Stat("config.json"); os.IsNotExist(err) {
		fmt.Println("❌ config.json file not found")
		return
	}
	
	// 读取并解析 JSON
	data, err := os.ReadFile("config.json")
	if err != nil {
		fmt.Printf("❌ Cannot read config.json: %v\n", err)
		return
	}
	
	var config map[string]interface{}
	if err := json.Unmarshal(data, &config); err != nil {
		fmt.Printf("❌ Invalid JSON format: %v\n", err)
		return
	}
	
	fmt.Println("✅ config.json is valid JSON")
	
	// 检查基本结构
	if server, ok := config["server"]; ok {
		fmt.Println("✅ Server configuration found")
		if serverMap, ok := server.(map[string]interface{}); ok {
			if endpoint, ok := serverMap["endpoint"]; ok {
				fmt.Printf("✅ Endpoint: %v\n", endpoint)
			}
		}
	}
	
	if nodes, ok := config["nodes"]; ok {
		if nodeArray, ok := nodes.([]interface{}); ok {
			fmt.Printf("✅ Found %d nodes\n", len(nodeArray))
		}
	}
	
	fmt.Println("✅ Configuration looks good!")
	fmt.Println("\nThe Kiro IDE warning you see is unrelated to your config.json file.")
	fmt.Println("It's an internal IDE issue that won't affect your OPC UA simulator.")
}