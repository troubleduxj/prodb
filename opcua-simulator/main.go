package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"
)

// OPCUASimulator OPC UA服务器模拟器
type OPCUASimulator struct {
	nodes      map[string]*SimulatedNode
	running    bool
	stopChan   chan struct{}
	httpServer *http.Server
	mu         sync.RWMutex
}

// SimulatedNode 模拟节点
type SimulatedNode struct {
	NodeID      string            `json:"node_id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	DataType    string            `json:"data_type"`
	Value       interface{}       `json:"value"`
	MinValue    float64           `json:"min_value"`
	MaxValue    float64           `json:"max_value"`
	ChangeRate  float64           `json:"change_rate"` // 变化率
	LastUpdate  time.Time         `json:"last_update"`
	Trend       string            `json:"trend"` // "increasing", "decreasing", "random", "sine"
	Unit        string            `json:"unit"`
	Tags        map[string]string `json:"tags"`
	mu          sync.RWMutex
}

// Config 配置结构
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

// NewOPCUASimulator 创建OPC UA模拟器
func NewOPCUASimulator() *OPCUASimulator {
	return &OPCUASimulator{
		nodes:    make(map[string]*SimulatedNode),
		stopChan: make(chan struct{}),
	}
}

// LoadConfig 加载配置文件
func (sim *OPCUASimulator) LoadConfig(configPath string) error {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read config file: %v", err)
	}

	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("failed to parse config file: %v", err)
	}

	// 从配置文件初始化节点
	for _, nodeConfig := range config.Nodes {
		var initialValue interface{}
		switch nodeConfig.DataType {
		case "Float":
			initialValue = nodeConfig.InitialValue
		case "Int32":
			initialValue = int32(nodeConfig.InitialValue)
		case "Boolean":
			initialValue = nodeConfig.InitialValue != 0
		default:
			initialValue = nodeConfig.InitialValue
		}

		sim.addNode(
			nodeConfig.NodeID,
			nodeConfig.Name,
			nodeConfig.Description,
			nodeConfig.DataType,
			initialValue,
			nodeConfig.MinValue,
			nodeConfig.MaxValue,
			nodeConfig.ChangeRate,
			nodeConfig.Trend,
			nodeConfig.Unit,
			make(map[string]string),
		)
	}

	log.Printf("Loaded configuration with %d nodes", len(config.Nodes))
	return nil
}

// Start 启动OPC UA模拟器（HTTP接口）
func (sim *OPCUASimulator) Start(port string) error {
	sim.mu.Lock()
	defer sim.mu.Unlock()

	if sim.running {
		return fmt.Errorf("simulator already running")
	}

	sim.running = true

	// 如果没有节点，则初始化默认节点
	if len(sim.nodes) == 0 {
		sim.initializeNodes()
	}

	// 启动数据更新循环
	go sim.dataUpdateLoop()

	// 创建HTTP服务器
	mux := http.NewServeMux()
	
	// 注册路由
	mux.HandleFunc("/opcua/nodes", sim.handleGetNodes)
	mux.HandleFunc("/opcua/node/", sim.handleGetNode)
	mux.HandleFunc("/opcua/browse", sim.handleBrowse)
	mux.HandleFunc("/opcua/read", sim.handleRead)
	mux.HandleFunc("/opcua/status", sim.handleStatus)

	sim.httpServer = &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	// 启动HTTP服务器
	go func() {
		log.Printf("Starting OPC UA simulator HTTP interface on port %s", port)
		log.Printf("OPC UA endpoint simulation: opc.tcp://localhost:4840/opcua/simulator")
		if err := sim.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("HTTP server error: %v", err)
		}
	}()

	log.Println("OPC UA simulator started successfully")
	return nil
}

// Stop 停止OPC UA模拟器
func (sim *OPCUASimulator) Stop() error {
	sim.mu.Lock()
	defer sim.mu.Unlock()

	if !sim.running {
		return nil
	}

	sim.running = false
	close(sim.stopChan)

	if sim.httpServer != nil {
		sim.httpServer.Close()
	}

	log.Println("OPC UA simulator stopped")
	return nil
}

// initializeNodes 初始化模拟节点
func (sim *OPCUASimulator) initializeNodes() {
	// 温度传感器节点
	sim.addNode("Temperature_Sensor_01", "温度传感器1", "车间1号温度传感器", "Float", 20.0, 0.0, 100.0, 0.5, "sine", "°C", map[string]string{"location": "workshop_1", "type": "temperature"})
	sim.addNode("Temperature_Sensor_02", "温度传感器2", "车间2号温度传感器", "Float", 25.0, 0.0, 100.0, 0.3, "random", "°C", map[string]string{"location": "workshop_2", "type": "temperature"})
	sim.addNode("Temperature_Sensor_03", "温度传感器3", "车间3号温度传感器", "Float", 22.0, 0.0, 100.0, 0.4, "increasing", "°C", map[string]string{"location": "workshop_3", "type": "temperature"})

	// 压力传感器节点
	sim.addNode("Pressure_Sensor_01", "压力传感器1", "主管道压力传感器", "Float", 1.5, 0.0, 10.0, 0.1, "decreasing", "Bar", map[string]string{"location": "main_pipeline", "type": "pressure"})
	sim.addNode("Pressure_Sensor_02", "压力传感器2", "副管道压力传感器", "Float", 2.3, 0.0, 10.0, 0.2, "sine", "Bar", map[string]string{"location": "secondary_pipeline", "type": "pressure"})

	// 流量传感器节点
	sim.addNode("Flow_Sensor_01", "流量传感器1", "进水流量传感器", "Float", 15.5, 0.0, 100.0, 1.0, "random", "L/min", map[string]string{"location": "inlet", "type": "flow"})
	sim.addNode("Flow_Sensor_02", "流量传感器2", "出水流量传感器", "Float", 20.2, 0.0, 100.0, 0.8, "sine", "L/min", map[string]string{"location": "outlet", "type": "flow"})

	// 液位传感器节点
	sim.addNode("Level_Sensor_01", "液位传感器1", "储罐1液位传感器", "Float", 75.0, 0.0, 100.0, 0.5, "decreasing", "%", map[string]string{"location": "tank_1", "type": "level"})
	sim.addNode("Level_Sensor_02", "液位传感器2", "储罐2液位传感器", "Float", 60.0, 0.0, 100.0, 0.3, "increasing", "%", map[string]string{"location": "tank_2", "type": "level"})

	// 电机状态节点
	sim.addNode("Motor_01_Status", "电机1状态", "主泵电机运行状态", "Boolean", true, 0, 1, 0, "random", "", map[string]string{"location": "pump_station", "type": "motor_status", "equipment": "main_pump"})
	sim.addNode("Motor_02_Status", "电机2状态", "副泵电机运行状态", "Boolean", false, 0, 1, 0, "random", "", map[string]string{"location": "pump_station", "type": "motor_status", "equipment": "backup_pump"})

	// 电机转速节点
	sim.addNode("Motor_01_Speed", "电机1转速", "主泵电机转速", "Int32", int32(1500), 0, 3000, 50, "sine", "RPM", map[string]string{"location": "pump_station", "type": "motor_speed", "equipment": "main_pump"})
	sim.addNode("Motor_02_Speed", "电机2转速", "副泵电机转速", "Int32", int32(1200), 0, 3000, 30, "random", "RPM", map[string]string{"location": "pump_station", "type": "motor_speed", "equipment": "backup_pump"})

	// 阀门开度节点
	sim.addNode("Valve_01_Opening", "阀门1开度", "进水阀门开度", "Float", 50.0, 0.0, 100.0, 2.0, "sine", "%", map[string]string{"location": "inlet", "type": "valve_opening", "equipment": "inlet_valve"})
	sim.addNode("Valve_02_Opening", "阀门2开度", "出水阀门开度", "Float", 75.0, 0.0, 100.0, 1.5, "random", "%", map[string]string{"location": "outlet", "type": "valve_opening", "equipment": "outlet_valve"})

	// 设备运行时间节点
	sim.addNode("Device_Runtime", "设备运行时间", "系统累计运行时间", "Int32", int32(0), 0, 999999, 1, "increasing", "秒", map[string]string{"type": "runtime"})

	// 报警状态节点
	sim.addNode("Alarm_Temperature_High", "高温报警", "温度超过阈值报警", "Boolean", false, 0, 1, 0, "random", "", map[string]string{"type": "alarm", "category": "temperature", "severity": "high"})
	sim.addNode("Alarm_Pressure_Low", "低压报警", "压力低于阈值报警", "Boolean", false, 0, 1, 0, "random", "", map[string]string{"type": "alarm", "category": "pressure", "severity": "medium"})

	log.Printf("Initialized %d simulation nodes", len(sim.nodes))
}

// addNode 添加模拟节点
func (sim *OPCUASimulator) addNode(nodeID, name, description, dataType string, initialValue interface{}, minVal, maxVal, changeRate float64, trend, unit string, tags map[string]string) {
	node := &SimulatedNode{
		NodeID:      nodeID,
		Name:        name,
		Description: description,
		DataType:    dataType,
		Value:       initialValue,
		MinValue:    minVal,
		MaxValue:    maxVal,
		ChangeRate:  changeRate,
		LastUpdate:  time.Now(),
		Trend:       trend,
		Unit:        unit,
		Tags:        tags,
	}

	sim.nodes[nodeID] = node
	log.Printf("Added node: %s (%s) - Initial value: %v", nodeID, name, initialValue)
}

// dataUpdateLoop 数据更新循环
func (sim *OPCUASimulator) dataUpdateLoop() {
	ticker := time.NewTicker(1 * time.Second) // 每秒更新一次数据
	defer ticker.Stop()

	for {
		select {
		case <-sim.stopChan:
			return
		case <-ticker.C:
			sim.updateAllNodes()
		}
	}
}

// updateAllNodes 更新所有节点数据
func (sim *OPCUASimulator) updateAllNodes() {
	sim.mu.RLock()
	defer sim.mu.RUnlock()

	for _, node := range sim.nodes {
		sim.updateNodeValue(node)
	}
}

// updateNodeValue 更新单个节点值
func (sim *OPCUASimulator) updateNodeValue(node *SimulatedNode) {
	node.mu.Lock()
	defer node.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(node.LastUpdate).Seconds()

	switch node.DataType {
	case "Float":
		currentVal := node.Value.(float64)
		newVal := sim.calculateNewFloatValue(currentVal, node, elapsed)
		node.Value = newVal

	case "Int32":
		currentVal := float64(node.Value.(int32))
		newVal := sim.calculateNewFloatValue(currentVal, node, elapsed)
		node.Value = int32(newVal)

	case "Boolean":
		// 布尔值随机变化（10%概率）
		if rand.Float64() < 0.1 {
			node.Value = !node.Value.(bool)
		}
	}

	node.LastUpdate = now
}

// calculateNewFloatValue 计算新的浮点数值
func (sim *OPCUASimulator) calculateNewFloatValue(currentVal float64, node *SimulatedNode, elapsed float64) float64 {
	var newVal float64

	switch node.Trend {
	case "increasing":
		newVal = currentVal + node.ChangeRate*elapsed
		if newVal > node.MaxValue {
			newVal = node.MinValue + (newVal-node.MaxValue)
		}

	case "decreasing":
		newVal = currentVal - node.ChangeRate*elapsed
		if newVal < node.MinValue {
			newVal = node.MaxValue - (node.MinValue-newVal)
		}

	case "sine":
		// 正弦波变化
		amplitude := (node.MaxValue - node.MinValue) / 2
		center := (node.MaxValue + node.MinValue) / 2
		frequency := 0.1 // 频率
		newVal = center + amplitude*math.Sin(2*math.Pi*frequency*float64(time.Now().Unix()))

	case "random":
		// 随机变化
		change := (rand.Float64() - 0.5) * node.ChangeRate * elapsed * 2
		newVal = currentVal + change
		if newVal > node.MaxValue {
			newVal = node.MaxValue
		}
		if newVal < node.MinValue {
			newVal = node.MinValue
		}

	default:
		newVal = currentVal
	}

	return newVal
}

// GetNodeValue 获取节点值（供外部查询）
func (sim *OPCUASimulator) GetNodeValue(nodeID string) (interface{}, error) {
	sim.mu.RLock()
	defer sim.mu.RUnlock()

	node, exists := sim.nodes[nodeID]
	if !exists {
		return nil, fmt.Errorf("node %s not found", nodeID)
	}

	node.mu.RLock()
	defer node.mu.RUnlock()

	return node.Value, nil
}

// ListNodes 列出所有节点
func (sim *OPCUASimulator) ListNodes() map[string]interface{} {
	sim.mu.RLock()
	defer sim.mu.RUnlock()

	result := make(map[string]interface{})
	for nodeID, node := range sim.nodes {
		node.mu.RLock()
		result[nodeID] = map[string]interface{}{
			"name":        node.Name,
			"description": node.Description,
			"value":       node.Value,
			"dataType":    node.DataType,
			"lastUpdate":  node.LastUpdate,
			"trend":       node.Trend,
			"minValue":    node.MinValue,
			"maxValue":    node.MaxValue,
			"unit":        node.Unit,
			"tags":        node.Tags,
		}
		node.mu.RUnlock()
	}

	return result
}

// printStatus 打印状态信息
func (sim *OPCUASimulator) printStatus() {
	sim.mu.RLock()
	defer sim.mu.RUnlock()

	fmt.Println("\n=== OPC UA Simulator Status ===")
	fmt.Printf("Running: %v\n", sim.running)
	fmt.Printf("Total Nodes: %d\n", len(sim.nodes))
	fmt.Println("\nNode Values:")

	for nodeID, node := range sim.nodes {
		node.mu.RLock()
		fmt.Printf("  %-25s | %-20s | %v\n", nodeID, node.Name, node.Value)
		node.mu.RUnlock()
	}
	fmt.Println("================================\n")
}

// HTTP接口处理函数

// handleGetNodes 获取所有节点
func (sim *OPCUASimulator) handleGetNodes(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	
	nodes := sim.ListNodes()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"data":   nodes,
		"count":  len(nodes),
	})
}

// handleGetNode 获取单个节点
func (sim *OPCUASimulator) handleGetNode(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	
	// 从URL路径中提取节点ID
	path := strings.TrimPrefix(r.URL.Path, "/opcua/node/")
	nodeID := strings.TrimSuffix(path, "/")
	
	if nodeID == "" {
		http.Error(w, "Node ID is required", http.StatusBadRequest)
		return
	}
	
	value, err := sim.GetNodeValue(nodeID)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "error",
			"error":  err.Error(),
		})
		return
	}
	
	sim.mu.RLock()
	node := sim.nodes[nodeID]
	sim.mu.RUnlock()
	
	if node != nil {
		node.mu.RLock()
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "success",
			"data": map[string]interface{}{
				"nodeId":      node.NodeID,
				"name":        node.Name,
				"description": node.Description,
				"value":       value,
				"dataType":    node.DataType,
				"lastUpdate":  node.LastUpdate,
				"unit":        node.Unit,
				"tags":        node.Tags,
			},
		})
		node.mu.RUnlock()
	}
}

// handleBrowse 浏览节点
func (sim *OPCUASimulator) handleBrowse(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	
	sim.mu.RLock()
	defer sim.mu.RUnlock()
	
	var nodeList []map[string]interface{}
	for nodeID, node := range sim.nodes {
		node.mu.RLock()
		nodeList = append(nodeList, map[string]interface{}{
			"nodeId":      fmt.Sprintf("ns=2;s=%s", nodeID),
			"displayName": node.Name,
			"description": node.Description,
			"dataType":    node.DataType,
			"unit":        node.Unit,
		})
		node.mu.RUnlock()
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"data":   nodeList,
	})
}

// handleRead 读取节点值
func (sim *OPCUASimulator) handleRead(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		NodeIds []string `json:"nodeIds"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	
	var results []map[string]interface{}
	for _, nodeIdStr := range request.NodeIds {
		// 解析节点ID (ns=2;s=NodeName)
		nodeID := nodeIdStr
		if strings.HasPrefix(nodeIdStr, "ns=2;s=") {
			nodeID = strings.TrimPrefix(nodeIdStr, "ns=2;s=")
		}
		
		value, err := sim.GetNodeValue(nodeID)
		result := map[string]interface{}{
			"nodeId": nodeIdStr,
		}
		
		if err != nil {
			result["status"] = "error"
			result["error"] = err.Error()
		} else {
			result["status"] = "success"
			result["value"] = value
			result["timestamp"] = time.Now()
		}
		
		results = append(results, result)
	}
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"data":   results,
	})
}

// handleStatus 获取服务器状态
func (sim *OPCUASimulator) handleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	
	sim.mu.RLock()
	defer sim.mu.RUnlock()
	
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"data": map[string]interface{}{
			"running":     sim.running,
			"nodeCount":   len(sim.nodes),
			"endpoint":    "opc.tcp://localhost:4840/opcua/simulator",
			"httpPort":    "8080",
			"startTime":   time.Now().Format("2006-01-02 15:04:05"),
			"description": "ProDB OPC UA Simulator",
		},
	})
}

func main() {
	// 创建模拟器
	simulator := NewOPCUASimulator()

	// 加载配置文件
	configPath := "config.json"
	if len(os.Args) > 1 {
		configPath = os.Args[1]
	}

	// 尝试加载配置文件，如果失败则使用默认配置
	if err := simulator.LoadConfig(configPath); err != nil {
		log.Printf("Failed to load config file %s: %v", configPath, err)
		log.Println("Using default configuration...")
		// 注意：initializeNodes 会在 Start() 方法中调用
	}

	// 设置信号处理
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// 启动服务器
	port := "8080"
	if err := simulator.Start(port); err != nil {
		log.Fatalf("Failed to start OPC UA simulator: %v", err)
	}

	log.Println("=== OPC UA Simulator Started ===")
	log.Printf("HTTP API: http://localhost:%s", port)
	log.Println("OPC UA Endpoint: opc.tcp://localhost:4840/opcua/simulator")
	log.Println("Available endpoints:")
	log.Println("  GET  /opcua/status   - Server status")
	log.Println("  GET  /opcua/nodes    - List all nodes")
	log.Println("  GET  /opcua/node/{id} - Get specific node")
	log.Println("  GET  /opcua/browse   - Browse nodes")
	log.Println("  POST /opcua/read     - Read node values")
	log.Println("Press Ctrl+C to stop...")

	// 状态打印循环
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-sigChan:
				return
			case <-ticker.C:
				simulator.printStatus()
			}
		}
	}()

	// 等待退出信号
	<-sigChan
	log.Println("Received shutdown signal...")

	// 停止服务器
	if err := simulator.Stop(); err != nil {
		log.Printf("Error stopping simulator: %v", err)
	}

	log.Println("OPC UA simulator shutdown complete")
}