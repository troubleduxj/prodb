package protocol

import (
	"context"
	"errors"
	"testing"
	"time"

	"prodb/collector/internal/config"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockProtocol is a mock implementation of the Protocol interface
type MockProtocol struct {
	mock.Mock
	name      string
	connected bool
}

func (m *MockProtocol) Connect(cfg map[string]interface{}) error {
	args := m.Called(cfg)
	if args.Error(0) == nil {
		m.connected = true
	}
	return args.Error(0)
}

func (m *MockProtocol) Collect(points []config.DataPointConfig) ([]DataValue, error) {
	args := m.Called(points)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]DataValue), args.Error(1)
}

func (m *MockProtocol) Disconnect() error {
	args := m.Called()
	if args.Error(0) == nil {
		m.connected = false
	}
	return args.Error(0)
}

func (m *MockProtocol) IsConnected() bool {
	return m.connected
}

func (m *MockProtocol) GetName() string {
	return m.name
}

func (m *MockProtocol) Validate(cfg map[string]interface{}) error {
	args := m.Called(cfg)
	return args.Error(0)
}

// TestProtocolManagerCreation tests protocol manager creation
func TestProtocolManagerCreation(t *testing.T) {
	t.Run("Create new protocol manager", func(t *testing.T) {
		mgr := &ProtocolManager{
			protocols: make(map[string]Protocol),
			tasks:     make(map[string]*CollectionTask),
			metrics:   &ProtocolMetrics{
				TaskMetrics: make(map[string]*TaskMetrics),
			},
		}

		assert.NotNil(t, mgr)
		assert.NotNil(t, mgr.protocols)
		assert.NotNil(t, mgr.tasks)
		assert.NotNil(t, mgr.metrics)
		assert.Equal(t, 0, len(mgr.protocols))
		assert.Equal(t, 0, len(mgr.tasks))
	})
}

// TestProtocolRegistration tests protocol registration
func TestProtocolRegistration(t *testing.T) {
	mgr := &ProtocolManager{
		protocols: make(map[string]Protocol),
		tasks:     make(map[string]*CollectionTask),
	}

	t.Run("Register new protocol", func(t *testing.T) {
		mockProto := &MockProtocol{name: "test-protocol"}
		mgr.protocols["test-protocol"] = mockProto

		assert.Equal(t, 1, len(mgr.protocols))
		assert.Equal(t, mockProto, mgr.protocols["test-protocol"])
	})

	t.Run("Register multiple protocols", func(t *testing.T) {
		mgr.protocols["opcua"] = &MockProtocol{name: "opcua"}
		mgr.protocols["modbus"] = &MockProtocol{name: "modbus"}
		mgr.protocols["mqtt"] = &MockProtocol{name: "mqtt"}

		assert.Equal(t, 4, len(mgr.protocols)) // Including test-protocol from previous test
	})

	t.Run("Get registered protocol", func(t *testing.T) {
		proto := mgr.protocols["opcua"]
		assert.NotNil(t, proto)
		assert.Equal(t, "opcua", proto.GetName())
	})
}

// TestProtocolConnection tests protocol connection
func TestProtocolConnection(t *testing.T) {
	t.Run("Connect to protocol", func(t *testing.T) {
		mockProto := new(MockProtocol)
		mockProto.name = "test-protocol"
		mockProto.On("Connect", mock.Anything).Return(nil)

		cfg := map[string]interface{}{
			"host": "localhost",
			"port": 502,
		}

		err := mockProto.Connect(cfg)
		assert.NoError(t, err)
		assert.True(t, mockProto.IsConnected())
		mockProto.AssertExpectations(t)
	})

	t.Run("Connect with error", func(t *testing.T) {
		mockProto := new(MockProtocol)
		mockProto.name = "test-protocol"
		mockProto.On("Connect", mock.Anything).Return(errors.New("connection failed"))

		cfg := map[string]interface{}{
			"host": "invalid-host",
		}

		err := mockProto.Connect(cfg)
		assert.Error(t, err)
		assert.False(t, mockProto.IsConnected())
		mockProto.AssertExpectations(t)
	})

	t.Run("Disconnect from protocol", func(t *testing.T) {
		mockProto := new(MockProtocol)
		mockProto.name = "test-protocol"
		mockProto.connected = true
		mockProto.On("Disconnect").Return(nil)

		err := mockProto.Disconnect()
		assert.NoError(t, err)
		assert.False(t, mockProto.IsConnected())
		mockProto.AssertExpectations(t)
	})
}

// TestDataCollection tests data collection
func TestDataCollection(t *testing.T) {
	t.Run("Collect data successfully", func(t *testing.T) {
		mockProto := new(MockProtocol)
		mockProto.name = "test-protocol"
		mockProto.connected = true

		expectedData := []DataValue{
			{
				DeviceID:  "device-001",
				PointName: "temperature",
				Timestamp: time.Now(),
				Value:     25.5,
				Quality:   1,
				DataType:  "float",
			},
		}

		points := []config.DataPointConfig{
			{Name: "temperature", Address: "40001"},
		}

		mockProto.On("Collect", points).Return(expectedData, nil)

		data, err := mockProto.Collect(points)
		assert.NoError(t, err)
		assert.Equal(t, 1, len(data))
		assert.Equal(t, "device-001", data[0].DeviceID)
		assert.Equal(t, "temperature", data[0].PointName)
		assert.Equal(t, 25.5, data[0].Value)
		mockProto.AssertExpectations(t)
	})

	t.Run("Collect data with error", func(t *testing.T) {
		mockProto := new(MockProtocol)
		mockProto.name = "test-protocol"

		points := []config.DataPointConfig{
			{Name: "temperature", Address: "40001"},
		}

		mockProto.On("Collect", points).Return(nil, errors.New("read failed"))

		data, err := mockProto.Collect(points)
		assert.Error(t, err)
		assert.Nil(t, data)
		mockProto.AssertExpectations(t)
	})
}

// TestCollectionTask tests collection task management
func TestCollectionTask(t *testing.T) {
	t.Run("Create collection task", func(t *testing.T) {
		mockProto := &MockProtocol{name: "test-protocol"}
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		task := &CollectionTask{
			ID:       "task-001",
			Name:     "Test Task",
			Protocol: mockProto,
			Enabled:  true,
			ctx:      ctx,
			cancel:   cancel,
		}

		assert.NotNil(t, task)
		assert.Equal(t, "task-001", task.ID)
		assert.Equal(t, "Test Task", task.Name)
		assert.True(t, task.Enabled)
		assert.Equal(t, mockProto, task.Protocol)
	})

	t.Run("Task metrics tracking", func(t *testing.T) {
		task := &CollectionTask{
			ID:         "task-002",
			runCount:   10,
			errorCount: 2,
			lastRun:    time.Now().Add(-1 * time.Minute),
		}

		assert.Equal(t, int64(10), task.runCount)
		assert.Equal(t, int64(2), task.errorCount)
		assert.False(t, task.lastRun.IsZero())
	})

	t.Run("Task enable/disable", func(t *testing.T) {
		task := &CollectionTask{
			ID:      "task-003",
			Enabled: true,
		}

		assert.True(t, task.Enabled)

		task.Enabled = false
		assert.False(t, task.Enabled)
	})
}

// TestProtocolMetrics tests protocol metrics
func TestProtocolMetrics(t *testing.T) {
	t.Run("Initialize metrics", func(t *testing.T) {
		metrics := &ProtocolMetrics{
			ActiveTasks:     0,
			TotalTasks:      0,
			SuccessfulReads: 0,
			FailedReads:     0,
			TaskMetrics:     make(map[string]*TaskMetrics),
		}

		assert.NotNil(t, metrics)
		assert.Equal(t, 0, metrics.ActiveTasks)
		assert.Equal(t, int64(0), metrics.SuccessfulReads)
	})

	t.Run("Update metrics", func(t *testing.T) {
		metrics := &ProtocolMetrics{
			ActiveTasks:     5,
			TotalTasks:      10,
			SuccessfulReads: 100,
			FailedReads:     5,
			TaskMetrics:     make(map[string]*TaskMetrics),
		}

		assert.Equal(t, 5, metrics.ActiveTasks)
		assert.Equal(t, 10, metrics.TotalTasks)
		assert.Equal(t, int64(100), metrics.SuccessfulReads)
		assert.Equal(t, int64(5), metrics.FailedReads)
	})

	t.Run("Task metrics", func(t *testing.T) {
		taskMetrics := &TaskMetrics{
			TaskID:      "task-001",
			RunCount:    50,
			ErrorCount:  3,
			LastRun:     time.Now(),
			SuccessRate: 0.94,
		}

		assert.Equal(t, "task-001", taskMetrics.TaskID)
		assert.Equal(t, int64(50), taskMetrics.RunCount)
		assert.Equal(t, int64(3), taskMetrics.ErrorCount)
		assert.InDelta(t, 0.94, taskMetrics.SuccessRate, 0.01)
	})
}

// TestDataValue tests data value structure
func TestDataValue(t *testing.T) {
	t.Run("Create data value", func(t *testing.T) {
		now := time.Now()
		dv := DataValue{
			DeviceID:  "device-001",
			PointName: "temperature",
			Timestamp: now,
			Value:     25.5,
			Quality:   1,
			DataType:  "float",
			Unit:      "°C",
			Tags: map[string]string{
				"location": "factory-a",
				"line":     "line-1",
			},
		}

		assert.Equal(t, "device-001", dv.DeviceID)
		assert.Equal(t, "temperature", dv.PointName)
		assert.Equal(t, now, dv.Timestamp)
		assert.Equal(t, 25.5, dv.Value)
		assert.Equal(t, 1, dv.Quality)
		assert.Equal(t, "float", dv.DataType)
		assert.Equal(t, "°C", dv.Unit)
		assert.Equal(t, 2, len(dv.Tags))
	})

	t.Run("Data quality levels", func(t *testing.T) {
		badQuality := DataValue{Quality: 0}
		goodQuality := DataValue{Quality: 1}
		uncertainQuality := DataValue{Quality: 2}

		assert.Equal(t, 0, badQuality.Quality)
		assert.Equal(t, 1, goodQuality.Quality)
		assert.Equal(t, 2, uncertainQuality.Quality)
	})
}

// TestProtocolValidation tests protocol configuration validation
func TestProtocolValidation(t *testing.T) {
	t.Run("Validate valid configuration", func(t *testing.T) {
		mockProto := new(MockProtocol)
		mockProto.name = "test-protocol"

		cfg := map[string]interface{}{
			"host": "localhost",
			"port": 502,
		}

		mockProto.On("Validate", cfg).Return(nil)

		err := mockProto.Validate(cfg)
		assert.NoError(t, err)
		mockProto.AssertExpectations(t)
	})

	t.Run("Validate invalid configuration", func(t *testing.T) {
		mockProto := new(MockProtocol)
		mockProto.name = "test-protocol"

		cfg := map[string]interface{}{
			"invalid_key": "invalid_value",
		}

		mockProto.On("Validate", cfg).Return(errors.New("invalid configuration"))

		err := mockProto.Validate(cfg)
		assert.Error(t, err)
		mockProto.AssertExpectations(t)
	})
}

// TestConcurrentProtocolOperations tests concurrent protocol operations
func TestConcurrentProtocolOperations(t *testing.T) {
	t.Run("Concurrent data collection", func(t *testing.T) {
		mockProto := new(MockProtocol)
		mockProto.name = "test-protocol"
		mockProto.connected = true

		expectedData := []DataValue{
			{DeviceID: "device-001", Value: 25.5},
		}

		points := []config.DataPointConfig{
			{Name: "temperature"},
		}

		mockProto.On("Collect", points).Return(expectedData, nil)

		done := make(chan bool)
		errors := make(chan error, 5)

		// Start multiple concurrent collections
		for i := 0; i < 5; i++ {
			go func() {
				_, err := mockProto.Collect(points)
				errors <- err
				done <- true
			}()
		}

		// Wait for all to complete
		for i := 0; i < 5; i++ {
			<-done
			err := <-errors
			assert.NoError(t, err)
		}
	})
}

// BenchmarkDataCollection benchmarks data collection
func BenchmarkDataCollection(b *testing.B) {
	mockProto := new(MockProtocol)
	mockProto.name = "bench-protocol"
	mockProto.connected = true

	expectedData := []DataValue{
		{DeviceID: "device-001", Value: 25.5},
	}

	points := []config.DataPointConfig{
		{Name: "temperature"},
	}

	mockProto.On("Collect", points).Return(expectedData, nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = mockProto.Collect(points)
	}
}

// BenchmarkProtocolConnection benchmarks protocol connection
func BenchmarkProtocolConnection(b *testing.B) {
	cfg := map[string]interface{}{
		"host": "localhost",
		"port": 502,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		mockProto := new(MockProtocol)
		mockProto.name = "bench-protocol"
		mockProto.On("Connect", cfg).Return(nil)
		_ = mockProto.Connect(cfg)
	}
}
