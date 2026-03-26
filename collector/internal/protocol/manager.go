package protocol

import (
	"context"
	"fmt"
	"sync"
	"time"

	"prodb/collector/internal/config"
	"prodb/collector/internal/logger"
)

// ProtocolManager manages all protocol instances and collection tasks
type ProtocolManager struct {
	protocols map[string]Protocol
	tasks     map[string]*CollectionTask
	logger    *logger.Logger
	
	mutex     sync.RWMutex
	ctx       context.Context
	cancel    context.CancelFunc
	wg        sync.WaitGroup
	
	// Metrics
	metrics   *ProtocolMetrics
}

// Protocol defines the interface that all protocol implementations must satisfy
type Protocol interface {
	// Connect establishes connection to the data source
	Connect(config map[string]interface{}) error
	
	// Collect reads data from the specified data points
	Collect(points []config.DataPointConfig) ([]DataValue, error)
	
	// Disconnect closes the connection to the data source
	Disconnect() error
	
	// IsConnected returns true if the protocol is currently connected
	IsConnected() bool
	
	// GetName returns the protocol name
	GetName() string
	
	// Validate validates the protocol-specific configuration
	Validate(config map[string]interface{}) error
}

// CollectionTask represents a data collection task
type CollectionTask struct {
	ID          string
	Name        string
	Protocol    Protocol
	Config      config.CollectionTaskConfig
	Enabled     bool
	
	// Runtime state
	lastRun     time.Time
	nextRun     time.Time
	runCount    int64
	errorCount  int64
	lastError   error
	
	// Control
	ctx         context.Context
	cancel      context.CancelFunc
	ticker      *time.Ticker
}

// DataValue represents a collected data value
type DataValue struct {
	DeviceID    string                 `json:"device_id"`
	PointName   string                 `json:"point_name"`
	Timestamp   time.Time              `json:"timestamp"`
	Value       interface{}            `json:"value"`
	Quality     int                    `json:"quality"`     // 0=bad, 1=good, 2=uncertain
	DataType    string                 `json:"data_type"`
	Unit        string                 `json:"unit"`
	Tags        map[string]string      `json:"tags"`
	RawValue    interface{}            `json:"raw_value,omitempty"`
}

// ProtocolMetrics contains protocol manager metrics
type ProtocolMetrics struct {
	ActiveTasks     int                    `json:"active_tasks"`
	TotalTasks      int                    `json:"total_tasks"`
	SuccessfulReads int64                  `json:"successful_reads"`
	FailedReads     int64                  `json:"failed_reads"`
	TaskMetrics     map[string]*TaskMetrics `json:"task_metrics"`
}

// TaskMetrics contains metrics for individual tasks
type TaskMetrics struct {
	TaskID         string    `json:"task_id"`
	RunCount       int64     `json:"run_count"`
	ErrorCount     int64     `json:"error_count"`
	LastRun        time.Time `json:"last_run"`
	NextRun        time.Time `json:"next_run"`
	LastError      string    `json:"last_error,omitempty"`
	SuccessRate    float64   `json:"success_rate"`
	AvgDuration    float64   `json:"avg_duration_ms"`
}

// NewProtocolManager creates a new protocol manager
func NewProtocolManager(logger *logger.Logger) *ProtocolManager {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &ProtocolManager{
		protocols: make(map[string]Protocol),
		tasks:     make(map[string]*CollectionTask),
		logger:    logger.WithGroup("protocol_manager"),
		ctx:       ctx,
		cancel:    cancel,
		metrics: &ProtocolMetrics{
			TaskMetrics: make(map[string]*TaskMetrics),
		},
	}
}

// RegisterProtocol registers a protocol implementation
func (pm *ProtocolManager) RegisterProtocol(name string, protocol Protocol) error {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()
	
	if _, exists := pm.protocols[name]; exists {
		return fmt.Errorf("protocol %s already registered", name)
	}
	
	pm.protocols[name] = protocol
	pm.logger.Info("Protocol registered", "protocol", name)
	
	return nil
}

// Start starts the protocol manager
func (pm *ProtocolManager) Start(ctx context.Context) error {
	pm.logger.Info("Starting protocol manager")
	
	// Register built-in protocols
	if err := pm.registerBuiltinProtocols(); err != nil {
		return fmt.Errorf("failed to register builtin protocols: %w", err)
	}
	
	pm.logger.Info("Protocol manager started")
	return nil
}

// Stop stops the protocol manager and all tasks
func (pm *ProtocolManager) Stop() {
	pm.logger.Info("Stopping protocol manager")
	
	pm.cancel()
	pm.wg.Wait()
	
	// Stop all tasks
	pm.mutex.Lock()
	for _, task := range pm.tasks {
		pm.stopTask(task)
	}
	pm.mutex.Unlock()
	
	pm.logger.Info("Protocol manager stopped")
}

// UpdateConfig updates the protocol manager configuration
func (pm *ProtocolManager) UpdateConfig(taskConfigs []config.CollectionTaskConfig) error {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()
	
	pm.logger.Info("Updating protocol manager configuration", "task_count", len(taskConfigs))
	
	// Stop existing tasks that are not in the new configuration
	existingTaskIDs := make(map[string]bool)
	for _, taskConfig := range taskConfigs {
		existingTaskIDs[taskConfig.TaskID] = true
	}
	
	for taskID, task := range pm.tasks {
		if !existingTaskIDs[taskID] {
			pm.logger.Info("Removing task", "task_id", taskID)
			pm.stopTask(task)
			delete(pm.tasks, taskID)
			delete(pm.metrics.TaskMetrics, taskID)
		}
	}
	
	// Create or update tasks
	for _, taskConfig := range taskConfigs {
		if err := pm.createOrUpdateTask(taskConfig); err != nil {
			pm.logger.Error("Failed to create/update task", "task_id", taskConfig.TaskID, "error", err)
			continue
		}
	}
	
	pm.updateMetrics()
	pm.logger.Info("Protocol manager configuration updated")
	
	return nil
}

// GetMetrics returns protocol manager metrics
func (pm *ProtocolManager) GetMetrics() *ProtocolMetrics {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()
	
	pm.updateMetrics()
	return pm.metrics
}

// createOrUpdateTask creates a new task or updates an existing one
func (pm *ProtocolManager) createOrUpdateTask(taskConfig config.CollectionTaskConfig) error {
	// Get protocol implementation
	protocol, exists := pm.protocols[taskConfig.Protocol]
	if !exists {
		return fmt.Errorf("protocol %s not found", taskConfig.Protocol)
	}
	
	// Validate protocol configuration
	if err := protocol.Validate(taskConfig.Connection); err != nil {
		return fmt.Errorf("invalid protocol configuration: %w", err)
	}
	
	// Check if task already exists
	if existingTask, exists := pm.tasks[taskConfig.TaskID]; exists {
		// Update existing task
		pm.logger.Info("Updating existing task", "task_id", taskConfig.TaskID)
		pm.stopTask(existingTask)
		delete(pm.tasks, taskConfig.TaskID)
	}
	
	// Create new task
	taskCtx, taskCancel := context.WithCancel(pm.ctx)
	
	task := &CollectionTask{
		ID:       taskConfig.TaskID,
		Name:     taskConfig.Name,
		Protocol: protocol,
		Config:   taskConfig,
		Enabled:  taskConfig.Enabled,
		ctx:      taskCtx,
		cancel:   taskCancel,
	}
	
	pm.tasks[taskConfig.TaskID] = task
	
	// Initialize task metrics
	pm.metrics.TaskMetrics[taskConfig.TaskID] = &TaskMetrics{
		TaskID: taskConfig.TaskID,
	}
	
	// Start task if enabled
	if task.Enabled {
		pm.wg.Add(1)
		go pm.runTask(task)
	}
	
	pm.logger.Info("Task created", "task_id", taskConfig.TaskID, "enabled", task.Enabled)
	
	return nil
}

// runTask runs a collection task
func (pm *ProtocolManager) runTask(task *CollectionTask) {
	defer pm.wg.Done()
	defer task.cancel()
	
	taskLogger := pm.logger.With("task_id", task.ID, "task_name", task.Name)
	taskLogger.Info("Starting collection task")
	
	// Connect to protocol
	if err := task.Protocol.Connect(task.Config.Connection); err != nil {
		taskLogger.Error("Failed to connect protocol", "error", err)
		task.lastError = err
		task.errorCount++
		return
	}
	defer task.Protocol.Disconnect()
	
	// Create ticker for scheduled collection
	interval := task.Config.Schedule.GetScheduleInterval()
	task.ticker = time.NewTicker(interval)
	defer task.ticker.Stop()
	
	taskLogger.Info("Collection task started", "interval", interval)
	
	// Run collection loop
	for {
		select {
		case <-task.ctx.Done():
			taskLogger.Info("Collection task stopped")
			return
			
		case <-task.ticker.C:
			pm.executeCollection(task, taskLogger)
		}
	}
}

// executeCollection executes a single collection cycle
func (pm *ProtocolManager) executeCollection(task *CollectionTask, logger *logger.Logger) {
	startTime := time.Now()
	task.lastRun = startTime
	task.runCount++
	
	// Update next run time
	interval := task.Config.Schedule.GetScheduleInterval()
	task.nextRun = startTime.Add(interval)
	
	logger.Debug("Executing collection", "data_points", len(task.Config.DataPoints))
	
	// Collect data
	dataValues, err := task.Protocol.Collect(task.Config.DataPoints)
	if err != nil {
		logger.Error("Collection failed", "error", err)
		task.lastError = err
		task.errorCount++
		pm.metrics.FailedReads++
		return
	}
	
	// Process collected data
	processedData := pm.processCollectedData(task, dataValues)
	
	// TODO: Send data to buffer for further processing
	logger.Debug("Collection completed", 
		"data_points_collected", len(processedData),
		"duration", time.Since(startTime))
	
	pm.metrics.SuccessfulReads += int64(len(processedData))
}

// processCollectedData processes raw collected data
func (pm *ProtocolManager) processCollectedData(task *CollectionTask, dataValues []DataValue) []DataValue {
	processedData := make([]DataValue, 0, len(dataValues))
	
	for _, data := range dataValues {
		// Add task-specific tags
		if data.Tags == nil {
			data.Tags = make(map[string]string)
		}
		
		// Add target tags from configuration
		for key, value := range task.Config.Target.Tags {
			data.Tags[key] = value
		}
		
		// Add collector metadata
		data.Tags["task_id"] = task.ID
		data.Tags["protocol"] = task.Config.Protocol
		
		processedData = append(processedData, data)
	}
	
	return processedData
}

// stopTask stops a collection task
func (pm *ProtocolManager) stopTask(task *CollectionTask) {
	if task.cancel != nil {
		task.cancel()
	}
	
	if task.ticker != nil {
		task.ticker.Stop()
	}
	
	if task.Protocol.IsConnected() {
		task.Protocol.Disconnect()
	}
}

// updateMetrics updates the protocol manager metrics
func (pm *ProtocolManager) updateMetrics() {
	activeTasks := 0
	
	for taskID, task := range pm.tasks {
		if task.Enabled {
			activeTasks++
		}
		
		// Update task metrics
		taskMetrics := pm.metrics.TaskMetrics[taskID]
		taskMetrics.RunCount = task.runCount
		taskMetrics.ErrorCount = task.errorCount
		taskMetrics.LastRun = task.lastRun
		taskMetrics.NextRun = task.nextRun
		
		if task.lastError != nil {
			taskMetrics.LastError = task.lastError.Error()
		}
		
		// Calculate success rate
		if task.runCount > 0 {
			taskMetrics.SuccessRate = float64(task.runCount-task.errorCount) / float64(task.runCount) * 100
		}
	}
	
	pm.metrics.ActiveTasks = activeTasks
	pm.metrics.TotalTasks = len(pm.tasks)
}

// registerBuiltinProtocols registers built-in protocol implementations
func (pm *ProtocolManager) registerBuiltinProtocols() error {
	// Register placeholder protocols - actual implementations will be registered separately
	protocols := map[string]Protocol{
		"modbus_tcp": NewModbusTCPProtocol(pm.logger),
		"modbus_rtu": NewModbusRTUProtocol(pm.logger),
		"opcua":      NewOPCUAProtocol(pm.logger),
		"mqtt":       NewMQTTProtocol(pm.logger),
	}
	
	for name, protocol := range protocols {
		if err := pm.RegisterProtocol(name, protocol); err != nil {
			return err
		}
	}
	
	// Register actual protocol implementations
	if err := pm.registerActualProtocols(); err != nil {
		pm.logger.Warn("Failed to register actual protocol implementations", "error", err)
	}
	
	return nil
}

// registerActualProtocols registers the actual protocol implementations
func (pm *ProtocolManager) registerActualProtocols() error {
	// Register actual MQTT implementation
	if err := pm.registerMQTTProtocol(); err != nil {
		pm.logger.Warn("Failed to register MQTT protocol implementation", "error", err)
	}
	
	// Import and register actual OPC-UA implementation
	// This will replace the placeholder implementation
	return pm.registerOPCUAProtocol()
}

// registerMQTTProtocol registers the actual MQTT protocol implementation
func (pm *ProtocolManager) registerMQTTProtocol() error {
	// The actual MQTT implementation is now in protocols.go
	// This method is kept for consistency but doesn't need to do anything
	pm.logger.Info("MQTT protocol implementation available")
	return nil
}

// registerOPCUAProtocol registers the actual OPC-UA protocol implementation
func (pm *ProtocolManager) registerOPCUAProtocol() error {
	// This is a placeholder for the actual registration
	// In a real implementation, you would import the opcua package and register it
	pm.logger.Info("OPC-UA protocol implementation available")
	return nil
}