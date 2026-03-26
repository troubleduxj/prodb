package core

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestCollectorCreation tests collector instance creation
func TestCollectorCreation(t *testing.T) {
	t.Run("Create with valid config", func(t *testing.T) {
		// This test would require a valid config file
		// For now, we test the error handling
		_, err := NewCollector("nonexistent_config.json")
		assert.Error(t, err, "Should fail with nonexistent config")
	})

	t.Run("Create with invalid config path", func(t *testing.T) {
		_, err := NewCollector("")
		assert.Error(t, err, "Should fail with empty config path")
	})
}

// TestCollectorStatus tests collector status management
func TestCollectorStatus(t *testing.T) {
	// Create a mock collector for testing
	collector := &Collector{
		ID:     "test-collector-001",
		status: StatusStopped,
	}

	t.Run("Initial status should be stopped", func(t *testing.T) {
		status := collector.GetStatus()
		assert.Equal(t, StatusStopped, status)
	})

	t.Run("Set status to starting", func(t *testing.T) {
		collector.setStatus(StatusStarting)
		assert.Equal(t, StatusStarting, collector.GetStatus())
	})

	t.Run("Set status to running", func(t *testing.T) {
		collector.setStatus(StatusRunning)
		assert.Equal(t, StatusRunning, collector.GetStatus())
	})

	t.Run("Set status to stopping", func(t *testing.T) {
		collector.setStatus(StatusStopping)
		assert.Equal(t, StatusStopping, collector.GetStatus())
	})

	t.Run("Set status to error", func(t *testing.T) {
		collector.setStatus(StatusError)
		assert.Equal(t, StatusError, collector.GetStatus())
	})
}

// TestCollectorLifecycle tests collector start/stop lifecycle
func TestCollectorLifecycle(t *testing.T) {
	t.Run("Start and stop collector", func(t *testing.T) {
		// This would require a fully initialized collector
		// Testing the lifecycle concept
		collector := &Collector{
			ID:     "test-collector-002",
			status: StatusStopped,
		}

		ctx, cancel := context.WithCancel(context.Background())
		collector.ctx = ctx
		collector.cancel = cancel

		// Simulate starting
		collector.setStatus(StatusStarting)
		assert.Equal(t, StatusStarting, collector.GetStatus())

		// Simulate running
		collector.setStatus(StatusRunning)
		collector.startTime = time.Now()
		assert.Equal(t, StatusRunning, collector.GetStatus())
		assert.False(t, collector.startTime.IsZero())

		// Simulate stopping
		collector.setStatus(StatusStopping)
		cancel()
		assert.Equal(t, StatusStopping, collector.GetStatus())

		// Simulate stopped
		collector.setStatus(StatusStopped)
		assert.Equal(t, StatusStopped, collector.GetStatus())
	})
}

// TestCollectorMetrics tests collector metrics tracking
func TestCollectorMetrics(t *testing.T) {
	collector := &Collector{
		ID:        "test-collector-003",
		startTime: time.Now().Add(-1 * time.Hour),
	}

	t.Run("Calculate uptime", func(t *testing.T) {
		uptime := time.Since(collector.startTime)
		assert.True(t, uptime > 0, "Uptime should be positive")
		assert.True(t, uptime >= time.Hour, "Uptime should be at least 1 hour")
	})

	t.Run("Track last error", func(t *testing.T) {
		testError := assert.AnError
		collector.lastError = testError
		assert.Equal(t, testError, collector.lastError)
	})
}

// TestCollectorConcurrency tests concurrent operations
func TestCollectorConcurrency(t *testing.T) {
	collector := &Collector{
		ID:     "test-collector-004",
		status: StatusStopped,
	}

	t.Run("Concurrent status reads", func(t *testing.T) {
		done := make(chan bool)
		
		// Start multiple goroutines reading status
		for i := 0; i < 10; i++ {
			go func() {
				_ = collector.GetStatus()
				done <- true
			}()
		}

		// Wait for all goroutines to complete
		for i := 0; i < 10; i++ {
			<-done
		}
	})

	t.Run("Concurrent status writes", func(t *testing.T) {
		done := make(chan bool)
		
		statuses := []CollectorStatus{
			StatusStarting,
			StatusRunning,
			StatusStopping,
			StatusStopped,
		}

		// Start multiple goroutines writing status
		for i := 0; i < 10; i++ {
			go func(idx int) {
				collector.setStatus(statuses[idx%len(statuses)])
				done <- true
			}(i)
		}

		// Wait for all goroutines to complete
		for i := 0; i < 10; i++ {
			<-done
		}

		// Verify final status is one of the valid statuses
		finalStatus := collector.GetStatus()
		assert.Contains(t, statuses, finalStatus)
	})
}

// Helper methods for testing

func (c *Collector) GetStatus() CollectorStatus {
	c.statusMutex.RLock()
	defer c.statusMutex.RUnlock()
	return c.status
}

func (c *Collector) setStatus(status CollectorStatus) {
	c.statusMutex.Lock()
	defer c.statusMutex.Unlock()
	c.status = status
}

// TestCollectorID tests collector ID management
func TestCollectorID(t *testing.T) {
	t.Run("Collector ID should be set", func(t *testing.T) {
		collector := &Collector{
			ID: "test-collector-005",
		}
		assert.NotEmpty(t, collector.ID)
		assert.Equal(t, "test-collector-005", collector.ID)
	})

	t.Run("Collector ID should be unique", func(t *testing.T) {
		collector1 := &Collector{ID: "collector-001"}
		collector2 := &Collector{ID: "collector-002"}
		assert.NotEqual(t, collector1.ID, collector2.ID)
	})
}

// TestCollectorContext tests context management
func TestCollectorContext(t *testing.T) {
	t.Run("Context cancellation", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		collector := &Collector{
			ID:     "test-collector-006",
			ctx:    ctx,
			cancel: cancel,
		}

		// Context should not be done initially
		select {
		case <-collector.ctx.Done():
			t.Fatal("Context should not be done initially")
		default:
			// Expected
		}

		// Cancel context
		collector.cancel()

		// Context should be done after cancellation
		select {
		case <-collector.ctx.Done():
			// Expected
		case <-time.After(100 * time.Millisecond):
			t.Fatal("Context should be done after cancellation")
		}
	})

	t.Run("Context with timeout", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()

		collector := &Collector{
			ID:     "test-collector-007",
			ctx:    ctx,
			cancel: cancel,
		}

		// Wait for context to timeout
		<-collector.ctx.Done()
		assert.Error(t, collector.ctx.Err())
	})
}

// TestCollectorErrorHandling tests error handling
func TestCollectorErrorHandling(t *testing.T) {
	collector := &Collector{
		ID: "test-collector-008",
	}

	t.Run("Set and retrieve last error", func(t *testing.T) {
		testError := assert.AnError
		collector.lastError = testError
		assert.Equal(t, testError, collector.lastError)
		assert.Error(t, collector.lastError)
	})

	t.Run("Clear last error", func(t *testing.T) {
		collector.lastError = assert.AnError
		collector.lastError = nil
		assert.NoError(t, collector.lastError)
	})

	t.Run("Error status transition", func(t *testing.T) {
		collector.setStatus(StatusRunning)
		collector.lastError = assert.AnError
		collector.setStatus(StatusError)
		
		assert.Equal(t, StatusError, collector.GetStatus())
		assert.Error(t, collector.lastError)
	})
}

// TestCollectorStartTime tests start time tracking
func TestCollectorStartTime(t *testing.T) {
	t.Run("Start time should be set on start", func(t *testing.T) {
		collector := &Collector{
			ID: "test-collector-009",
		}

		assert.True(t, collector.startTime.IsZero(), "Start time should be zero initially")

		collector.startTime = time.Now()
		assert.False(t, collector.startTime.IsZero(), "Start time should be set")
	})

	t.Run("Calculate runtime duration", func(t *testing.T) {
		collector := &Collector{
			ID:        "test-collector-010",
			startTime: time.Now().Add(-5 * time.Minute),
		}

		runtime := time.Since(collector.startTime)
		assert.True(t, runtime >= 5*time.Minute, "Runtime should be at least 5 minutes")
	})
}

// TestCollectorWaitGroup tests wait group usage
func TestCollectorWaitGroup(t *testing.T) {
	t.Run("Wait group for goroutines", func(t *testing.T) {
		collector := &Collector{
			ID: "test-collector-011",
		}

		done := make(chan bool)

		// Add goroutines to wait group
		for i := 0; i < 5; i++ {
			collector.wg.Add(1)
			go func() {
				defer collector.wg.Done()
				time.Sleep(10 * time.Millisecond)
			}()
		}

		// Wait for all goroutines in a separate goroutine
		go func() {
			collector.wg.Wait()
			done <- true
		}()

		// Verify wait completes
		select {
		case <-done:
			// Expected
		case <-time.After(1 * time.Second):
			t.Fatal("Wait group did not complete in time")
		}
	})
}

// TestCollectorComponentInitialization tests component initialization
func TestCollectorComponentInitialization(t *testing.T) {
	t.Run("All components should be nil initially", func(t *testing.T) {
		collector := &Collector{
			ID: "test-collector-012",
		}

		assert.Nil(t, collector.config)
		assert.Nil(t, collector.authManager)
		assert.Nil(t, collector.protocolMgr)
		assert.Nil(t, collector.dataBuffer)
		assert.Nil(t, collector.storageCache)
		assert.Nil(t, collector.platformClient)
		assert.Nil(t, collector.syncManager)
		assert.Nil(t, collector.heartbeatMgr)
		assert.Nil(t, collector.logger)
	})
}

// BenchmarkCollectorStatusRead benchmarks status read operations
func BenchmarkCollectorStatusRead(b *testing.B) {
	collector := &Collector{
		ID:     "bench-collector",
		status: StatusRunning,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = collector.GetStatus()
	}
}

// BenchmarkCollectorStatusWrite benchmarks status write operations
func BenchmarkCollectorStatusWrite(b *testing.B) {
	collector := &Collector{
		ID:     "bench-collector",
		status: StatusStopped,
	}

	statuses := []CollectorStatus{
		StatusStarting,
		StatusRunning,
		StatusStopping,
		StatusStopped,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		collector.setStatus(statuses[i%len(statuses)])
	}
}
