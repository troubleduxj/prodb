package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// OPCUAClient OPC UA 客户端示例
type OPCUAClient struct {
	baseURL string
	client  *http.Client
}

// NewOPCUAClient 创建客户端
func NewOPCUAClient(baseURL string) *OPCUAClient {
	return &OPCUAClient{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// ReadNodeValue 读取单个节点值
func (c *OPCUAClient) ReadNodeValue(nodeID string) (interface{}, error) {
	resp, err := c.client.Get(fmt.Sprintf("%s/opcua/node/%s", c.baseURL, nodeID))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if result["status"] == "success" {
		if data, ok := result["data"].(map[string]interface{}); ok {
			return data["value"], nil
		}
	}

	return nil, fmt.Errorf("failed to read node value")
}

// ReadMultipleNodes 读取多个节点值
func (c *OPCUAClient) ReadMultipleNodes(nodeIDs []string) (map[string]interface{}, error) {
	requestBody := map[string]interface{}{
		"nodeIds": nodeIDs,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, err
	}

	resp, err := c.client.Post(
		c.baseURL+"/opcua/read",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	values := make(map[string]interface{})
	if data, ok := result["data"].([]interface{}); ok {
		for _, item := range data {
			if nodeData, ok := item.(map[string]interface{}); ok {
				nodeID := nodeData["nodeId"].(string)
				if nodeData["status"] == "success" {
					values[nodeID] = nodeData["value"]
				}
			}
		}
	}

	return values, nil
}

// BrowseNodes 浏览所有节点
func (c *OPCUAClient) BrowseNodes() ([]map[string]interface{}, error) {
	resp, err := c.client.Get(c.baseURL + "/opcua/browse")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if data, ok := result["data"].([]interface{}); ok {
		var nodes []map[string]interface{}
		for _, item := range data {
			if node, ok := item.(map[string]interface{}); ok {
				nodes = append(nodes, node)
			}
		}
		return nodes, nil
	}

	return nil, fmt.Errorf("failed to browse nodes")
}

// GetServerStatus 获取服务器状态
func (c *OPCUAClient) GetServerStatus() (map[string]interface{}, error) {
	resp, err := c.client.Get(c.baseURL + "/opcua/status")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if data, ok := result["data"].(map[string]interface{}); ok {
		return data, nil
	}

	return nil, fmt.Errorf("failed to get server status")
}

func main() {
	// 创建客户端
	client := NewOPCUAClient("http://localhost:8080")

	fmt.Println("=== OPC UA Client Example ===")

	// 1. 获取服务器状态
	fmt.Println("\n1. Getting server status...")
	status, err := client.GetServerStatus()
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}
	fmt.Printf("Server running: %v\n", status["running"])
	fmt.Printf("Node count: %v\n", status["nodeCount"])

	// 2. 浏览节点
	fmt.Println("\n2. Browsing nodes...")
	nodes, err := client.BrowseNodes()
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}
	fmt.Printf("Found %d nodes:\n", len(nodes))
	for i, node := range nodes {
		if i < 5 { // 只显示前5个节点
			fmt.Printf("  - %s: %s (%s)\n", node["nodeId"], node["displayName"], node["dataType"])
		}
	}
	if len(nodes) > 5 {
		fmt.Printf("  ... and %d more nodes\n", len(nodes)-5)
	}

	// 3. 读取单个节点
	fmt.Println("\n3. Reading single node...")
	value, err := client.ReadNodeValue("Temperature_Sensor_01")
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	} else {
		fmt.Printf("Temperature_Sensor_01 value: %v\n", value)
	}

	// 4. 读取多个节点
	fmt.Println("\n4. Reading multiple nodes...")
	nodeIDs := []string{
		"ns=2;s=Temperature_Sensor_01",
		"ns=2;s=Pressure_Sensor_01",
		"ns=2;s=Motor_01_Status",
		"ns=2;s=Flow_Sensor_01",
	}
	values, err := client.ReadMultipleNodes(nodeIDs)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	} else {
		fmt.Println("Multiple node values:")
		for nodeID, value := range values {
			fmt.Printf("  %s: %v\n", nodeID, value)
		}
	}

	// 5. 持续监控
	fmt.Println("\n5. Monitoring nodes (5 seconds)...")
	monitorNodes := []string{
		"ns=2;s=Temperature_Sensor_01",
		"ns=2;s=Pressure_Sensor_01",
	}

	for i := 0; i < 5; i++ {
		values, err := client.ReadMultipleNodes(monitorNodes)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			break
		}

		fmt.Printf("Time %d: ", i+1)
		for nodeID, value := range values {
			fmt.Printf("%s=%.2f ", nodeID[7:], value) // 去掉 "ns=2;s=" 前缀
		}
		fmt.Println()

		time.Sleep(1 * time.Second)
	}

	fmt.Println("\n=== Example completed ===")
}