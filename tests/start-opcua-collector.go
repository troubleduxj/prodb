package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// DataPoint 数据点
type DataPoint struct {
	NodeID    string      `json:"node_id"`
	Name      string      `json:"name"`
	Value     interface{} `json:"value"`
	Quality   string      `json:"quality"`
	Timestamp time.Time   `json:"timestamp"`
	Unit      string      `json:"unit"`
}

// CollectorData 采集器数据
type CollectorData struct {
	CollectorID string      `json:"collector_id"`
	Timestamp   time.Time   `json:"timestamp"`
	DataPoints  []DataPoint `json:"data_points"`
}

func main() {
	fmt.Println("启动OPC UA数据采集器...")

	collectorID := "opcua-collector-001"
	secretKey := "opcua-secret-key-12345"

	// 模拟数据点
	nodeConfigs := []struct {
		NodeID string
		Name   string
		Unit   string
	}{
		{"Temperature_Sensor_01", "温度传感器1", "°C"},
		{"Temperature_Sensor_02", "温度传感器2", "°C"},
		{"Pressure_Sensor_01", "压力传感器1", "Bar"},
		{"Flow_Sensor_01", "流量传感器1", "L/min"},
		{"Motor_01_Status", "电机1状态", ""},
	}

	// 启动数据采集循环
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	fmt.Printf("开始采集数据，采集器ID: %s\n", collectorID)

	for {
		select {
		case <-ticker.C:
			// 生成模拟数据
			dataPoints := make([]DataPoint, len(nodeConfigs))
			for i, config := range nodeConfigs {
				var value interface{}
				
				switch config.NodeID {
				case "Temperature_Sensor_01":
					value = 20.0 + float64(time.Now().Unix()%10)
				case "Temperature_Sensor_02":
					value = 25.0 + float64(time.Now().Unix()%8)
				case "Pressure_Sensor_01":
					value = 1.5 + float64(time.Now().Unix()%5)/10.0
				case "Flow_Sensor_01":
					value = 15.5 + float64(time.Now().Unix()%20)
				case "Motor_01_Status":
					value = time.Now().Unix()%2 == 0
				default:
					value = 0
				}

				dataPoints[i] = DataPoint{
					NodeID:    config.NodeID,
					Name:      config.Name,
					Value:     value,
					Quality:   "Good",
					Timestamp: time.Now(),
					Unit:      config.Unit,
				}
			}

			// 创建采集数据
			collectorData := CollectorData{
				CollectorID: collectorID,
				Timestamp:   time.Now(),
				DataPoints:  dataPoints,
			}

			// 发送数据到平台
			if err := sendDataToPlatform(collectorData, secretKey); err != nil {
				log.Printf("发送数据失败: %v", err)
			} else {
				fmt.Printf("[%s] 成功发送 %d 个数据点\n", 
					time.Now().Format("15:04:05"), len(dataPoints))
			}

			// 发送心跳
			if err := sendHeartbeat(collectorID, secretKey); err != nil {
				log.Printf("发送心跳失败: %v", err)
			}
		}
	}
}

func sendDataToPlatform(data CollectorData, secretKey string) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", "http://localhost:3001/api/v1/data/ingest", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Collector-ID", data.CollectorID)
	req.Header.Set("X-Collector-Secret", secretKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

func sendHeartbeat(collectorID, secretKey string) error {
	heartbeatData := map[string]interface{}{
		"collector_id": collectorID,
		"timestamp":    time.Now(),
		"status":       "online",
		"metrics": map[string]interface{}{
			"cpu_usage":         15.5,
			"memory_usage":      128 * 1024 * 1024, // 128MB
			"active_connections": 1,
			"data_points_per_sec": 2.5,
		},
	}

	jsonData, err := json.Marshal(heartbeatData)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", "http://localhost:3001/api/v1/collectors/heartbeat", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Collector-ID", collectorID)
	req.Header.Set("X-Collector-Secret", secretKey)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}