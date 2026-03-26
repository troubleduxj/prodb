// Package configsync 配置同步相关功能
package configsync

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// TaskState 任务状态
type TaskState string

const (
	TaskStateStopped TaskState = "stopped"
	TaskStateRunning TaskState = "running"
	TaskStateError   TaskState = "error"
	TaskStatePaused  TaskState = "paused"
)

// Task 采集任务
type Task struct {
	ID          string
	Config      map[string]interface{}
	State       TaskState
	StartTime   *time.Time
	StopTime    *time.Time
	ErrorCount  int
	LastError   string
	cancelFunc  context.CancelFunc
}

// TaskLifecycleManager 任务生命周期管理器
type TaskLifecycleManager struct {
	tasks       map[string]*Task
	mu          sync.RWMutex
	logger      interface {
		Info(msg string, keysAndValues ...interface{})
		Error(msg string, keysAndValues ...interface{})
		Warn(msg string, keysAndValues ...interface{})
	}
	
	// 任务执行器
	executor    TaskExecutor
	
	// 任务状态回调
	stateCallbacks []StateChangeCallback
}

// TaskExecutor 任务执行器接口
type TaskExecutor interface {
	StartTask(ctx context.Context, taskID string, config map[string]interface{}) error
	StopTask(taskID string) error
	UpdateTaskConfig(taskID string, config map[string]interface{}) error
	GetTaskStatus(taskID string) (TaskState, error)
}

// StateChangeCallback 状态变更回调
type StateChangeCallback func(taskID string, oldState, newState TaskState)

// NewTaskLifecycleManager 创建任务生命周期管理器
func NewTaskLifecycleManager(logger interface {
	Info(msg string, keysAndValues ...interface{})
	Error(msg string, keysAndValues ...interface{})
	Warn(msg string, keysAndValues ...interface{})
}) *TaskLifecycleManager {
	return &TaskLifecycleManager{
		tasks:          make(map[string]*Task),
		logger:         logger,
		stateCallbacks: make([]StateChangeCallback, 0),
	}
}

// SetExecutor 设置任务执行器
func (tm *TaskLifecycleManager) SetExecutor(executor TaskExecutor) {
	tm.executor = executor
}

// RegisterStateCallback 注册状态变更回调
func (tm *TaskLifecycleManager) RegisterStateCallback(callback StateChangeCallback) {
	tm.stateCallbacks = append(tm.stateCallbacks, callback)
}

// StartTask 启动任务
func (tm *TaskLifecycleManager) StartTask(ctx context.Context, taskID string, config map[string]interface{}) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	// 检查任务是否已存在
	if task, exists := tm.tasks[taskID]; exists && task.State == TaskStateRunning {
		return fmt.Errorf("task %s is already running", taskID)
	}
	
	// 创建任务上下文
	taskCtx, cancel := context.WithCancel(ctx)
	
	// 创建任务
	now := time.Now()
	task := &Task{
		ID:         taskID,
		Config:     config,
		State:      TaskStateRunning,
		StartTime:  &now,
		cancelFunc: cancel,
	}
	
	// 保存任务
	tm.tasks[taskID] = task
	
	// 启动任务执行
	if tm.executor != nil {
		if err := tm.executor.StartTask(taskCtx, taskID, config); err != nil {
			task.State = TaskStateError
			task.LastError = err.Error()
			cancel()
			return fmt.Errorf("failed to start task %s: %w", taskID, err)
		}
	}
	
	tm.logger.Info("Task started", "task_id", taskID)
	tm.notifyStateChange(taskID, TaskStateStopped, TaskStateRunning)
	
	// 启动监控协程
	go tm.monitorTask(taskCtx, taskID)
	
	return nil
}

// StopTask 停止任务
func (tm *TaskLifecycleManager) StopTask(taskID string) error {
	tm.mu.Lock()
	task, exists := tm.tasks[taskID]
	if !exists {
		tm.mu.Unlock()
		return fmt.Errorf("task %s not found", taskID)
	}
	
	if task.State != TaskStateRunning {
		tm.mu.Unlock()
		return fmt.Errorf("task %s is not running", taskID)
	}
	
	oldState := task.State
	
	// 取消任务上下文
	if task.cancelFunc != nil {
		task.cancelFunc()
	}
	
	// 停止任务执行
	if tm.executor != nil {
		if err := tm.executor.StopTask(taskID); err != nil {
			tm.mu.Unlock()
			return fmt.Errorf("failed to stop task %s: %w", taskID, err)
		}
	}
	
	now := time.Now()
	task.State = TaskStateStopped
	task.StopTime = &now
	
	tm.mu.Unlock()
	
	tm.logger.Info("Task stopped", "task_id", taskID)
	tm.notifyStateChange(taskID, oldState, TaskStateStopped)
	
	return nil
}

// UpdateTaskConfig 更新任务配置
func (tm *TaskLifecycleManager) UpdateTaskConfig(taskID string, changes []ConfigChange) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	task, exists := tm.tasks[taskID]
	if !exists {
		return fmt.Errorf("task %s not found", taskID)
	}
	
	// 更新配置
	for _, change := range changes {
		switch change.EntityType {
		case "schedule":
			if newSchedule, ok := change.NewValue.(map[string]interface{}); ok {
				task.Config["schedule"] = newSchedule
			}
		case "edge_processing":
			if newEdge, ok := change.NewValue.(map[string]interface{}); ok {
				task.Config["edge_processing"] = newEdge
			}
		}
	}
	
	// 应用更新
	if tm.executor != nil {
		if err := tm.executor.UpdateTaskConfig(taskID, task.Config); err != nil {
			return fmt.Errorf("failed to update task config %s: %w", taskID, err)
		}
	}
	
	tm.logger.Info("Task config updated", "task_id", taskID, "changes", len(changes))
	return nil
}

// GetTask 获取任务
func (tm *TaskLifecycleManager) GetTask(taskID string) (*Task, error) {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	
	task, exists := tm.tasks[taskID]
	if !exists {
		return nil, fmt.Errorf("task %s not found", taskID)
	}
	
	return task, nil
}

// ListTasks 列出所有任务
func (tm *TaskLifecycleManager) ListTasks() []*Task {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	
	tasks := make([]*Task, 0, len(tm.tasks))
	for _, task := range tm.tasks {
		tasks = append(tasks, task)
	}
	
	return tasks
}

// GetRunningTasks 获取运行中的任务
func (tm *TaskLifecycleManager) GetRunningTasks() []*Task {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	
	var running []*Task
	for _, task := range tm.tasks {
		if task.State == TaskStateRunning {
			running = append(running, task)
		}
	}
	
	return running
}

// StopAllTasks 停止所有任务
func (tm *TaskLifecycleManager) StopAllTasks() error {
	tm.mu.RLock()
	taskIDs := make([]string, 0, len(tm.tasks))
	for id, task := range tm.tasks {
		if task.State == TaskStateRunning {
			taskIDs = append(taskIDs, id)
		}
	}
	tm.mu.RUnlock()
	
	var lastErr error
	for _, id := range taskIDs {
		if err := tm.StopTask(id); err != nil {
			lastErr = err
			tm.logger.Error("Failed to stop task", "task_id", id, "error", err)
		}
	}
	
	return lastErr
}

// RestartTask 重启任务
func (tm *TaskLifecycleManager) RestartTask(ctx context.Context, taskID string) error {
	// 停止任务
	if err := tm.StopTask(taskID); err != nil {
		tm.logger.Warn("Failed to stop task for restart", "task_id", taskID, "error", err)
	}
	
	// 等待任务完全停止
	time.Sleep(100 * time.Millisecond)
	
	// 获取任务配置
	tm.mu.RLock()
	task, exists := tm.tasks[taskID]
	tm.mu.RUnlock()
	
	if !exists {
		return fmt.Errorf("task %s not found", taskID)
	}
	
	// 重新启动
	return tm.StartTask(ctx, taskID, task.Config)
}

// monitorTask 监控任务状态
func (tm *TaskLifecycleManager) monitorTask(ctx context.Context, taskID string) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			tm.checkTaskHealth(taskID)
		}
	}
}

// checkTaskHealth 检查任务健康状态
func (tm *TaskLifecycleManager) checkTaskHealth(taskID string) {
	tm.mu.RLock()
	task, exists := tm.tasks[taskID]
	tm.mu.RUnlock()
	
	if !exists || task.State != TaskStateRunning {
		return
	}
	
	// 通过执行器检查状态
	if tm.executor != nil {
		state, err := tm.executor.GetTaskStatus(taskID)
		if err != nil {
			tm.logger.Error("Failed to get task status", "task_id", taskID, "error", err)
			task.ErrorCount++
			task.LastError = err.Error()
			
			// 连续错误超过阈值，标记为错误状态
			if task.ErrorCount >= 3 {
				tm.mu.Lock()
				oldState := task.State
				task.State = TaskStateError
				tm.mu.Unlock()
				tm.notifyStateChange(taskID, oldState, TaskStateError)
			}
			return
		}
		
		// 状态变更
		if state != task.State {
			tm.mu.Lock()
			oldState := task.State
			task.State = state
			tm.mu.Unlock()
			tm.notifyStateChange(taskID, oldState, state)
		}
		
		// 重置错误计数
		if state == TaskStateRunning {
			task.ErrorCount = 0
		}
	}
}

// notifyStateChange 通知状态变更
func (tm *TaskLifecycleManager) notifyStateChange(taskID string, oldState, newState TaskState) {
	for _, callback := range tm.stateCallbacks {
		go callback(taskID, oldState, newState)
	}
}

// GetTaskStatistics 获取任务统计
func (tm *TaskLifecycleManager) GetTaskStatistics() map[string]interface{} {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	
	stats := map[string]interface{}{
		"total":   len(tm.tasks),
		"running": 0,
		"stopped": 0,
		"error":   0,
		"paused":  0,
	}
	
	for _, task := range tm.tasks {
		switch task.State {
		case TaskStateRunning:
			stats["running"] = stats["running"].(int) + 1
		case TaskStateStopped:
			stats["stopped"] = stats["stopped"].(int) + 1
		case TaskStateError:
			stats["error"] = stats["error"].(int) + 1
		case TaskStatePaused:
			stats["paused"] = stats["paused"].(int) + 1
		}
	}
	
	return stats
}