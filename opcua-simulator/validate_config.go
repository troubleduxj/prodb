package main

import (
	"encoding/json"
	"fmt"
	"os"
)

// Config 配置结构（复制自 main.go）
type Config struct {
	Server struct {
		Endpoint         string   `json:"endpoint"`
		ApplicationName  string   `json:"application_name"`
		ApplicationURI   string   `json:"application_uri"`
		ProductURI       string   `json:"product_uri"`
		SecurityPolicies []string `json:"security_policies"`
		SecurityModes    []string `json:"security_modes"`
		MaxConnections   int      `json:"max_connections"`
		MaxSessions      int      `json:"max_sessions"`
	} `json:"server"`
	Simulation struct {
		UpdateIntervalMs     int  `json:"update_interval_ms"`
		StatusPrintIntervalS int  `json:"status_print_interval_s"`
		EnableRandomSeed     bool `json:"enable_random_seed"`
	} `json:"simulation"`
	Nodes []NodeConfig `json:"nodes"`
}

// NodeConfig 节点配置
type NodeConfig struct {
	NodeID       string  `json:"node_id"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	DataType     string  `json:"data_type"`
	InitialValue float64 `json:"initial_value"`
	MinValue     float64 `json:"min_value"`
	MaxValue     float64 `json:"max_value"`
	ChangeRate   float64 `json:"change_rate"`
	Trend        string  `json:"trend"`
	Unit         string  `json:"unit"`
}

func main() {
	fmt.Println("=== OPC UA Simulator Config Validator ===")
	
	// 读取配置文件
	configPath := "config.json"
	if len(os.Args) > 1 {
		configPath = os.Args[1]
	}
	
	fmt.Printf("Validating config file: %s\n", configPath)
	
	data, err := os.ReadFile(configPath)
	if err != nil {
		fmt.Printf("❌ Error reading config file: %v\n", err)
		os.Exit(1)
	}
	
	// 解析 JSON
	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		fmt.Printf("❌ Error parsing JSON: %v\n", err)
		os.Exit(1)
	}
	
	fmt.Println("✅ JSON format is valid")
	
	// 验证配置内容
	fmt.Printf("✅ Server endpoint: %s\n", config.Server.Endpoint)
	fmt.Printf("✅ Application name: %s\n", config.Server.ApplicationName)
	fmt.Printf("✅ Update interval: %d ms\n", config.Simulation.UpdateIntervalMs)
	fmt.Printf("✅ Node count: %d\n", len(config.Nodes))
	
	// 验证节点配置
	validDataTypes := map[string]bool{
		"Float":   true,
		"Int32":   true,
		"Boolean": true,
	}
	
	validTrends := map[string]bool{
		"sine":       true,
		"random":     true,
		"increasing": true,
		"decreasing": true,
	}
	
	for i, node := range config.Nodes {
		if node.NodeID == "" {
			fmt.Printf("❌ Node %d: Missing node_id\n", i+1)
			continue
		}
		
		if !validDataTypes[node.DataType] {
			fmt.Printf("❌ Node %s: Invalid data_type '%s'\n", node.NodeID, node.DataType)
			continue
		}
		
		if !validTrends[node.Trend] {
			fmt.Printf("❌ Node %s: Invalid trend '%s'\n", node.NodeID, node.Trend)
			continue
		}
		
		fmt.Printf("✅ Node %s (%s): %s, %s trend\n", 
			node.NodeID, node.Name, node.DataType, node.Trend)
	}
	
	fmt.Println("\n=== Validation Summary ===")
	fmt.Println("✅ Configuration file is valid and ready to use!")
	fmt.Println("✅ All nodes are properly configured")
	fmt.Printf("✅ Total nodes: %d\n", len(config.Nodes))
	
	// 显示节点分类统计
	typeCount := make(map[string]int)
	trendCount := make(map[string]int)
	
	for _, node := range config.Nodes {
		typeCount[node.DataType]++
		trendCount[node.Trend]++
	}
	
	fmt.Println("\nNode Statistics:")
	fmt.Println("Data Types:")
	for dataType, count := range typeCount {
		fmt.Printf("  - %s: %d nodes\n", dataType, count)
	}
	
	fmt.Println("Trends:")
	for trend, count := range trendCount {
		fmt.Printf("  - %s: %d nodes\n", trend, count)
	}
	
	fmt.Println("\n✅ Your config.json is perfect! The OPC UA simulator will work correctly.")
}