package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type CollectorRegistration struct {
	CollectorID  string                 `json:"collector_id"`
	SecretKey    string                 `json:"secret_key"`
	Name         string                 `json:"name"`
	Description  string                 `json:"description"`
	Version      string                 `json:"version"`
	Location     string                 `json:"location"`
	Environment  string                 `json:"environment"`
	Protocols    []ProtocolInfo         `json:"protocols"`
	Tags         map[string]string      `json:"tags"`
	Capabilities map[string]interface{} `json:"capabilities"`
}

type ProtocolInfo struct {
	Protocol string            `json:"protocol"`
	Version  string            `json:"version"`
	Enabled  bool              `json:"enabled"`
	MaxNodes int               `json:"max_nodes"`
	Features []string          `json:"features"`
	Config   map[string]string `json:"config"`
}

func main() {
	fmt.Println("注册OPC UA采集器到ProDB平台...")

	// 创建OPC UA采集器注册信息
	registration := CollectorRegistration{
		CollectorID: "opcua-collector-001",
		SecretKey:   "opcua-secret-key-12345",
		Name:        "ProDB OPC UA采集器",
		Description: "连接到ProDB OPC UA模拟器的数据采集器",
		Version:     "1.0.0",
		Location:    "生产车间A",
		Environment: "production",
		Protocols: []ProtocolInfo{
			{
				Protocol: "opcua",
				Version:  "1.04",
				Enabled:  true,
				MaxNodes: 100,
				Features: []string{"subscription", "browsing", "historical_data"},
				Config: map[string]string{
					"endpoint":              "opc.tcp://localhost:4840/opcua/simulator",
					"security_policy":       "None",
					"security_mode":         "None",
					"session_timeout":       "60000",
					"subscription_interval": "1000",
					"monitored_nodes":       "Temperature_Sensor_01,Temperature_Sensor_02,Pressure_Sensor_01,Flow_Sensor_01,Motor_01_Status",
				},
			},
		},
		Tags: map[string]string{
			"type":        "opcua",
			"environment": "production",
			"location":    "workshop_a",
		},
		Capabilities: map[string]interface{}{
			"max_data_points":      1000,
			"real_time_monitoring": true,
			"historical_data":      true,
			"alarm_support":        true,
		},
	}

	// 序列化为JSON
	jsonData, err := json.MarshalIndent(registration, "", "  ")
	if err != nil {
		fmt.Printf("JSON序列化失败: %v\n", err)
		return
	}

	// 发送注册请求
	resp, err := http.Post(
		"http://localhost:3001/api/v1/collectors/register",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		fmt.Printf("注册请求失败: %v\n", err)
		return
	}
	defer resp.Body.Close()

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("读取响应失败: %v\n", err)
		return
	}

	fmt.Printf("注册响应 (状态码: %d): %s\n", resp.StatusCode, string(body))

	// 等待一秒后检查采集器列表
	time.Sleep(1 * time.Second)
	
	// 检查采集器列表
	listResp, err := http.Get("http://localhost:3001/api/v1/collectors/list")
	if err != nil {
		fmt.Printf("获取采集器列表失败: %v\n", err)
		return
	}
	defer listResp.Body.Close()

	listBody, err := io.ReadAll(listResp.Body)
	if err != nil {
		fmt.Printf("读取采集器列表失败: %v\n", err)
		return
	}

	fmt.Printf("\n采集器列表: %s\n", string(listBody))
}