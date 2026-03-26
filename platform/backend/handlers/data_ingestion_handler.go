package handlers

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// DataPoint 数据点结构
type DataPoint struct {
	CollectorID string                 `json:"collector_id"`
	NodeID      string                 `json:"node_id"`
	NodeName    string                 `json:"node_name"`
	Name        string                 `json:"name"`
	Value       interface{}            `json:"value"`
	DataType    string                 `json:"data_type"`
	Quality     string                 `json:"quality"`
	Timestamp   time.Time              `json:"timestamp"`
	Unit        string                 `json:"unit"`
	Tags        map[string]string      `json:"tags"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// CollectorData 采集器数据
type CollectorData struct {
	CollectorID string      `json:"collector_id"`
	Timestamp   time.Time   `json:"timestamp"`
	DataPoints  []DataPoint `json:"data_points"`
}

// DataBatch 数据批次
type DataBatch struct {
	CollectorID string      `json:"collector_id"`
	BatchID     string      `json:"batch_id"`
	Timestamp   time.Time   `json:"timestamp"`
	DataPoints  []DataPoint `json:"data_points"`
}

// HeartbeatData 心跳数据
type HeartbeatData struct {
	CollectorID string                 `json:"collector_id"`
	Timestamp   time.Time              `json:"timestamp"`
	Status      string                 `json:"status"`
	Metrics     map[string]interface{} `json:"metrics"`
}

// DataIngestionHandler 数据接收处理器
type DataIngestionHandler struct {
	receivedData      []DataPoint                    // 简单存储，实际应该存储到TDengine
	realtimeData      map[string][]DataPoint         // 实时数据缓存 collectorID -> 最新数据
	collectorHandler  *CollectorRegistrationHandler // 采集器处理器
	mutex             sync.RWMutex                   // 读写锁
}

// NewDataIngestionHandler 创建数据接收处理器
func NewDataIngestionHandler(collectorHandler *CollectorRegistrationHandler) *DataIngestionHandler {
	return &DataIngestionHandler{
		receivedData:     make([]DataPoint, 0),
		realtimeData:     make(map[string][]DataPoint),
		collectorHandler: collectorHandler,
	}
}

// ReceiveData 接收单个数据点
func (h *DataIngestionHandler) ReceiveData(c *gin.Context) {
	var dataPoint DataPoint
	if err := c.ShouldBindJSON(&dataPoint); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid data format: " + err.Error(),
		})
		return
	}

	// 设置接收时间戳
	if dataPoint.Timestamp.IsZero() {
		dataPoint.Timestamp = time.Now()
	}

	// 存储数据点
	h.receivedData = append(h.receivedData, dataPoint)

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"message":   "Data received successfully",
		"timestamp": time.Now(),
	})
}

// ReceiveBatch 接收数据批次
func (h *DataIngestionHandler) ReceiveBatch(c *gin.Context) {
	var batch DataBatch
	if err := c.ShouldBindJSON(&batch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid batch format: " + err.Error(),
		})
		return
	}

	// 设置批次时间戳
	if batch.Timestamp.IsZero() {
		batch.Timestamp = time.Now()
	}

	// 处理批次中的每个数据点
	for _, dataPoint := range batch.DataPoints {
		if dataPoint.Timestamp.IsZero() {
			dataPoint.Timestamp = batch.Timestamp
		}
		if dataPoint.CollectorID == "" {
			dataPoint.CollectorID = batch.CollectorID
		}
		h.receivedData = append(h.receivedData, dataPoint)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"message":      "Batch received successfully",
		"batch_id":     batch.BatchID,
		"data_points":  len(batch.DataPoints),
		"timestamp":    time.Now(),
	})
}

// GetReceivedData 获取接收到的数据
func (h *DataIngestionHandler) GetReceivedData(c *gin.Context) {
	collectorID := c.Query("collector_id")
	limit := 100 // 默认限制100条

	var filteredData []DataPoint
	count := 0
	
	// 从最新的数据开始返回
	for i := len(h.receivedData) - 1; i >= 0 && count < limit; i-- {
		dataPoint := h.receivedData[i]
		if collectorID == "" || dataPoint.CollectorID == collectorID {
			filteredData = append(filteredData, dataPoint)
			count++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       filteredData,
		"count":      len(filteredData),
		"total":      len(h.receivedData),
		"timestamp":  time.Now(),
	})
}

// IngestData 接收采集器数据
func (h *DataIngestionHandler) IngestData(c *gin.Context) {
	// 验证采集器认证
	collectorID := c.GetHeader("X-Collector-ID")
	secretKey := c.GetHeader("X-Collector-Secret")
	
	if collectorID == "" || secretKey == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Missing collector credentials",
		})
		return
	}

	// 验证采集器
	if !h.collectorHandler.AuthenticateCollector(collectorID, secretKey) {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Invalid collector credentials",
		})
		return
	}

	var collectorData CollectorData
	if err := c.ShouldBindJSON(&collectorData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid data format: " + err.Error(),
		})
		return
	}

	h.mutex.Lock()
	defer h.mutex.Unlock()

	// 处理数据点
	for _, dataPoint := range collectorData.DataPoints {
		if dataPoint.CollectorID == "" {
			dataPoint.CollectorID = collectorData.CollectorID
		}
		if dataPoint.Timestamp.IsZero() {
			dataPoint.Timestamp = collectorData.Timestamp
		}
		
		// 存储到历史数据
		h.receivedData = append(h.receivedData, dataPoint)
	}

	// 更新实时数据缓存（保留最新50个数据点）
	h.realtimeData[collectorData.CollectorID] = append(h.realtimeData[collectorData.CollectorID], collectorData.DataPoints...)
	if len(h.realtimeData[collectorData.CollectorID]) > 50 {
		h.realtimeData[collectorData.CollectorID] = h.realtimeData[collectorData.CollectorID][len(h.realtimeData[collectorData.CollectorID])-50:]
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"message":     "Data ingested successfully",
		"data_points": len(collectorData.DataPoints),
		"timestamp":   time.Now(),
	})
}

// HandleHeartbeat 处理心跳
func (h *DataIngestionHandler) HandleHeartbeat(c *gin.Context) {
	// 验证采集器认证
	collectorID := c.GetHeader("X-Collector-ID")
	secretKey := c.GetHeader("X-Collector-Secret")
	
	if collectorID == "" || secretKey == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Missing collector credentials",
		})
		return
	}

	// 验证采集器
	if !h.collectorHandler.AuthenticateCollector(collectorID, secretKey) {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Invalid collector credentials",
		})
		return
	}

	var heartbeat HeartbeatData
	if err := c.ShouldBindJSON(&heartbeat); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Invalid heartbeat format: " + err.Error(),
		})
		return
	}

	// 更新采集器状态
	// 这里应该调用采集器处理器的更新状态方法
	// 暂时简单返回成功

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"message":   "Heartbeat received",
		"timestamp": time.Now(),
	})
}

// GetRealtimeData 获取实时数据
func (h *DataIngestionHandler) GetRealtimeData(c *gin.Context) {
	collectorID := c.Param("collector_id")
	
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	data, exists := h.realtimeData[collectorID]
	if !exists {
		c.JSON(http.StatusOK, gin.H{
			"success":    true,
			"data":       []DataPoint{},
			"count":      0,
			"timestamp":  time.Now(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       data,
		"count":      len(data),
		"timestamp":  time.Now(),
	})
}

// GetDataStatistics 获取数据统计
func (h *DataIngestionHandler) GetDataStatistics(c *gin.Context) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	collectorStats := make(map[string]int)
	nodeStats := make(map[string]int)
	
	for _, dataPoint := range h.receivedData {
		collectorStats[dataPoint.CollectorID]++
		nodeStats[dataPoint.NodeID]++
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"statistics": map[string]interface{}{
			"total_data_points":     len(h.receivedData),
			"collectors":            len(collectorStats),
			"nodes":                 len(nodeStats),
			"collector_statistics":  collectorStats,
			"node_statistics":       nodeStats,
		},
		"timestamp": time.Now(),
	})
}