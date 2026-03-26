package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

func main() {
	fmt.Println("========================================")
	fmt.Println("OPC UA 连接快速测试")
	fmt.Println("========================================")
	fmt.Println()

	// 测试模拟器 HTTP API
	fmt.Println("1. 测试模拟器 HTTP API...")
	if !testSimulatorAPI() {
		fmt.Println("❌ 模拟器 API 测试失败")
		fmt.Println("请先启动模拟器: cd opcua-simulator && go run main.go config.json")
		return
	}
	fmt.Println("✓ 模拟器 API 正常")

	// 测试节点数据
	fmt.Println("\n2. 测试节点数据...")
	if !testNodeData() {
		fmt.Println("❌ 节点数据测试失败")
		return
	}
	fmt.Println("✓ 节点数据正常")

	// 测试批量读取
	fmt.Println("\n3. 测试批量读取...")
	if !testBatchRead() {
		fmt.Println("❌ 批量读取测试失败")
		return
	}
	fmt.Println("✓ 批量读取正常")

	fmt.Println("\n========================================")
	fmt.Println("✅ 所有测试通过！")
	fmt.Println("========================================")
	fmt.Println()
	fmt.Println("OPC UA 模拟器已就绪，可以启动采集器进行连接测试")
	fmt.Println("运行命令: cd collector && go run main.go -config configs/opcua-simulator.json")
}

func testSimulatorAPI() bool {
	client := &http.Client{Timeout: 5 * time.Second}
	
	resp, err := client.Get("http://localhost:8080/opcua/status")
	if err != nil {
		fmt.Printf("  连接失败: %v\n", err)
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		fmt.Printf("  HTTP状态码错误: %d\n", resp.StatusCode)
		return false
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		fmt.Printf("  JSON解析失败: %v\n", err)
		return false
	}

	if data, ok := result["data"].(map[string]interface{}); ok {
		fmt.Printf("  节点数量: %.0f\n", data["nodeCount"])
		fmt.Printf("  端点地址: %s\n", data["endpoint"])
		return true
	}

	return false
}

func testNodeData() bool {
	client := &http.Client{Timeout: 5 * time.Second}
	
	// 测试几个关键节点
	testNodes := []string{
		"Temperature_Sensor_01",
		"Pressure_Sensor_01", 
		"Motor_01_Status",
		"Flow_Sensor_01",
	}

	for _, nodeID := range testNodes {
		resp, err := client.Get(fmt.Sprintf("http://localhost:8080/opcua/node/%s", nodeID))
		if err != nil {
			fmt.Printf("  节点 %s 读取失败: %v\n", nodeID, err)
			return false
		}
		defer resp.Body.Close()

		var result map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			fmt.Printf("  节点 %s JSON解析失败: %v\n", nodeID, err)
			return false
		}

		if result["status"] == "success" {
			if data, ok := result["data"].(map[string]interface{}); ok {
				fmt.Printf("  %s: %v\n", data["name"], data["value"])
			}
		} else {
			fmt.Printf("  节点 %s 状态错误\n", nodeID)
			return false
		}
	}

	return true
}

func testBatchRead() bool {
	client := &http.Client{Timeout: 5 * time.Second}
	
	// 测试批量读取
	nodeIDs := []string{
		"ns=2;s=Temperature_Sensor_01",
		"ns=2;s=Pressure_Sensor_01",
		"ns=2;s=Motor_01_Status",
	}

	requestBody := map[string]interface{}{
		"nodeIds": nodeIDs,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		fmt.Printf("  请求数据编码失败: %v\n", err)
		return false
	}

	resp, err := client.Post(
		"http://localhost:8080/opcua/read",
		"application/json",
		strings.NewReader(string(jsonData)),
	)
	if err != nil {
		fmt.Printf("  批量读取请求失败: %v\n", err)
		return false
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("  响应读取失败: %v\n", err)
		return false
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		fmt.Printf("  响应解析失败: %v\n", err)
		return false
	}

	if result["status"] == "success" {
		if data, ok := result["data"].([]interface{}); ok {
			fmt.Printf("  成功读取 %d 个节点\n", len(data))
			for _, item := range data {
				if nodeData, ok := item.(map[string]interface{}); ok {
					if nodeData["status"] == "success" {
						fmt.Printf("    %s: %v\n", nodeData["nodeId"], nodeData["value"])
					}
				}
			}
			return true
		}
	}

	fmt.Printf("  批量读取响应格式错误\n")
	return false
}