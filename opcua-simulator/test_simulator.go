package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// TestClient OPC UA模拟器测试客户端
type TestClient struct {
	baseURL string
	client  *http.Client
}

// NewTestClient 创建测试客户端
func NewTestClient(baseURL string) *TestClient {
	return &TestClient{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// GetStatus 获取服务器状态
func (tc *TestClient) GetStatus() error {
	resp, err := tc.client.Get(tc.baseURL + "/opcua/status")
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	fmt.Println("=== Server Status ===")
	fmt.Println(string(body))
	return nil
}

// GetAllNodes 获取所有节点
func (tc *TestClient) GetAllNodes() error {
	resp, err := tc.client.Get(tc.baseURL + "/opcua/nodes")
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	fmt.Println("\n=== All Nodes ===")
	
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return err
	}

	if data, ok := result["data"].(map[string]interface{}); ok {
		for nodeID, nodeInfo := range data {
			if info, ok := nodeInfo.(map[string]interface{}); ok {
				fmt.Printf("Node: %s\n", nodeID)
				fmt.Printf("  Name: %v\n", info["name"])
				fmt.Printf("  Value: %v\n", info["value"])
				fmt.Printf("  Type: %v\n", info["dataType"])
				fmt.Printf("  Unit: %v\n", info["unit"])
				fmt.Println()
			}
		}
	}
	return nil
}

// GetNode 获取单个节点
func (tc *TestClient) GetNode(nodeID string) error {
	resp, err := tc.client.Get(tc.baseURL + "/opcua/node/" + nodeID)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	fmt.Printf("\n=== Node: %s ===\n", nodeID)
	fmt.Println(string(body))
	return nil
}

// BrowseNodes 浏览节点
func (tc *TestClient) BrowseNodes() error {
	resp, err := tc.client.Get(tc.baseURL + "/opcua/browse")
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	fmt.Println("\n=== Browse Nodes ===")
	fmt.Println(string(body))
	return nil
}

// ReadNodes 读取多个节点值
func (tc *TestClient) ReadNodes(nodeIDs []string) error {
	requestBody := map[string]interface{}{
		"nodeIds": nodeIDs,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return err
	}

	resp, err := tc.client.Post(
		tc.baseURL+"/opcua/read",
		"application/json",
		strings.NewReader(string(jsonData)),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	fmt.Println("\n=== Read Nodes ===")
	fmt.Println(string(body))
	return nil
}

func main() {
	// 等待服务器启动
	fmt.Println("Waiting for simulator to start...")
	time.Sleep(2 * time.Second)

	client := NewTestClient("http://localhost:8080")

	// 测试服务器状态
	if err := client.GetStatus(); err != nil {
		fmt.Printf("Error getting status: %v\n", err)
		return
	}

	// 测试获取所有节点
	if err := client.GetAllNodes(); err != nil {
		fmt.Printf("Error getting all nodes: %v\n", err)
		return
	}

	// 测试获取单个节点
	if err := client.GetNode("Temperature_Sensor_01"); err != nil {
		fmt.Printf("Error getting node: %v\n", err)
		return
	}

	// 测试浏览节点
	if err := client.BrowseNodes(); err != nil {
		fmt.Printf("Error browsing nodes: %v\n", err)
		return
	}

	// 测试读取多个节点
	nodeIDs := []string{
		"ns=2;s=Temperature_Sensor_01",
		"ns=2;s=Pressure_Sensor_01",
		"ns=2;s=Motor_01_Status",
	}
	if err := client.ReadNodes(nodeIDs); err != nil {
		fmt.Printf("Error reading nodes: %v\n", err)
		return
	}

	fmt.Println("\n=== Test completed successfully ===")
}