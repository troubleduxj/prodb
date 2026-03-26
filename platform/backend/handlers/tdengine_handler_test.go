package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"prodb/platform/backend/tdengine"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockTDengineService is a mock implementation of TDengineService for testing
type MockTDengineService struct {
	mock.Mock
}

func (m *MockTDengineService) GetHealthStatus() map[string]interface{} {
	args := m.Called()
	return args.Get(0).(map[string]interface{})
}

func (m *MockTDengineService) GetMetrics() map[string]interface{} {
	args := m.Called()
	return args.Get(0).(map[string]interface{})
}

func (m *MockTDengineService) DatabaseExists(ctx context.Context, name string) (bool, error) {
	args := m.Called(ctx, name)
	return args.Bool(0), args.Error(1)
}

func (m *MockTDengineService) CreateDatabase(ctx context.Context, name string, options *tdengine.DatabaseOptions) error {
	args := m.Called(ctx, name, options)
	return args.Error(0)
}

func (m *MockTDengineService) DropDatabase(ctx context.Context, name string) error {
	args := m.Called(ctx, name)
	return args.Error(0)
}

func (m *MockTDengineService) GetDatabaseInfo(ctx context.Context, name string) (*tdengine.DatabaseInfo, error) {
	args := m.Called(ctx, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*tdengine.DatabaseInfo), args.Error(1)
}

func (m *MockTDengineService) ListDatabases(ctx context.Context) ([]map[string]interface{}, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]map[string]interface{}), args.Error(1)
}

func (m *MockTDengineService) SuperTableExists(ctx context.Context, database, name string) (bool, error) {
	args := m.Called(ctx, database, name)
	return args.Bool(0), args.Error(1)
}

func (m *MockTDengineService) CreateSuperTable(ctx context.Context, database string, schema *tdengine.SuperTableSchema, options *tdengine.SuperTableOptions) error {
	args := m.Called(ctx, database, schema, options)
	return args.Error(0)
}

func (m *MockTDengineService) GetSuperTableInfo(ctx context.Context, database, name string) (*tdengine.SuperTableInfo, error) {
	args := m.Called(ctx, database, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*tdengine.SuperTableInfo), args.Error(1)
}

func (m *MockTDengineService) SubTableExists(ctx context.Context, database, name string) (bool, error) {
	args := m.Called(ctx, database, name)
	return args.Bool(0), args.Error(1)
}

func (m *MockTDengineService) CreateSubTable(ctx context.Context, database, supertable, name string, tags map[string]interface{}, options *tdengine.SubTableOptions) error {
	args := m.Called(ctx, database, supertable, name, tags, options)
	return args.Error(0)
}

func (m *MockTDengineService) GetSubTableInfo(ctx context.Context, database, name string) (*tdengine.SubTableInfo, error) {
	args := m.Called(ctx, database, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*tdengine.SubTableInfo), args.Error(1)
}

func (m *MockTDengineService) DropSubTable(ctx context.Context, database, name string) error {
	args := m.Called(ctx, database, name)
	return args.Error(0)
}

func (m *MockTDengineService) ListSubTables(ctx context.Context, database, supertable string, filter *tdengine.SubTableFilter, page, size int) (*tdengine.SubTableListResult, error) {
	args := m.Called(ctx, database, supertable, filter, page, size)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*tdengine.SubTableListResult), args.Error(1)
}

func (m *MockTDengineService) GetSubTablesByTags(ctx context.Context, database, supertable string, tags map[string]interface{}) ([]string, error) {
	args := m.Called(ctx, database, supertable, tags)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]string), args.Error(1)
}

func (m *MockTDengineService) AutoCreateSubTable(ctx context.Context, database, supertable string, dataPoint tdengine.DataPoint) (string, error) {
	args := m.Called(ctx, database, supertable, dataPoint)
	return args.String(0), args.Error(1)
}

func (m *MockTDengineService) ApplyLifecyclePolicy(ctx context.Context, database, supertable string, policy *tdengine.SubTableLifecyclePolicy) error {
	args := m.Called(ctx, database, supertable, policy)
	return args.Error(0)
}

func (m *MockTDengineService) GetSubTableCount(ctx context.Context, database, supertable string) (int, error) {
	args := m.Called(ctx, database, supertable)
	return args.Int(0), args.Error(1)
}

// Setup test router
func setupTestRouter(handler *TDengineHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	
	// Health and metrics
	router.GET("/health", handler.GetHealthStatus)
	router.GET("/metrics", handler.GetMetrics)
	
	// Database management
	router.GET("/databases", handler.GetDatabases)
	router.POST("/databases", handler.CreateDatabase)
	router.GET("/databases/:name", handler.GetDatabaseInfo)
	router.DELETE("/databases/:name", handler.DropDatabase)
	router.GET("/databases/:name/exists", handler.CheckDatabaseExists)
	
	// Super table management
	router.POST("/databases/:database/supertables", handler.CreateSuperTable)
	router.GET("/databases/:database/supertables/:supertable", handler.GetSuperTableInfo)
	router.DELETE("/databases/:database/supertables/:supertable", handler.DropSuperTable)
	router.GET("/databases/:database/supertables/:supertable/exists", handler.CheckSuperTableExists)
	
	// Sub-table management
	router.POST("/databases/:database/supertables/:supertable/subtables", handler.CreateSubTable)
	router.GET("/databases/:database/supertables/:supertable/subtables", handler.ListSubTables)
	router.GET("/databases/:database/subtables/:subtable", handler.GetSubTableInfo)
	router.DELETE("/databases/:database/subtables/:subtable", handler.DropSubTable)
	router.POST("/databases/:database/supertables/:supertable/subtables/by-tags", handler.GetSubTablesByTags)
	router.GET("/databases/:database/subtables/:subtable/exists", handler.CheckSubTableExists)
	router.POST("/databases/:database/supertables/:supertable/auto-create", handler.AutoCreateSubTableFromData)
	router.POST("/databases/:database/supertables/:supertable/lifecycle", handler.ApplySubTableLifecyclePolicy)
	
	return router
}

// Test Health Status
func TestGetHealthStatus(t *testing.T) {
	mockService := new(MockTDengineService)
	handler := NewTDengineHandler(nil) // We'll use mock
	handler.service = mockService.(*MockTDengineService)
	
	mockService.On("GetHealthStatus").Return(map[string]interface{}{
		"status": "healthy",
		"connections": 5,
	})
	
	router := setupTestRouter(handler)
	
	req, _ := http.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])
	
	mockService.AssertExpectations(t)
}

// Test Create Database - Success
func TestCreateDatabase_Success(t *testing.T) {
	mockService := new(MockTDengineService)
	handler := NewTDengineHandler(nil)
	handler.service = mockService.(*MockTDengineService)
	
	dbName := "test_db"
	mockService.On("DatabaseExists", mock.Anything, dbName).Return(false, nil)
	mockService.On("CreateDatabase", mock.Anything, dbName, mock.Anything).Return(nil)
	mockService.On("GetDatabaseInfo", mock.Anything, dbName).Return(&tdengine.DatabaseInfo{
		Name: dbName,
		Status: "ready",
	}, nil)
	
	router := setupTestRouter(handler)
	
	requestBody := map[string]interface{}{
		"name": dbName,
	}
	jsonBody, _ := json.Marshal(requestBody)
	
	req, _ := http.NewRequest("POST", "/databases", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusCreated, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])
	
	mockService.AssertExpectations(t)
}

// Test Create Database - Already Exists
func TestCreateDatabase_AlreadyExists(t *testing.T) {
	mockService := new(MockTDengineService)
	handler := NewTDengineHandler(nil)
	handler.service = mockService.(*MockTDengineService)
	
	dbName := "existing_db"
	mockService.On("DatabaseExists", mock.Anything, dbName).Return(true, nil)
	
	router := setupTestRouter(handler)
	
	requestBody := map[string]interface{}{
		"name": dbName,
	}
	jsonBody, _ := json.Marshal(requestBody)
	
	req, _ := http.NewRequest("POST", "/databases", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusConflict, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "error", response["status"])
	
	mockService.AssertExpectations(t)
}

// Test Create Sub-Table - Success
func TestCreateSubTable_Success(t *testing.T) {
	mockService := new(MockTDengineService)
	handler := NewTDengineHandler(nil)
	handler.service = mockService.(*MockTDengineService)
	
	dbName := "test_db"
	stName := "sensors"
	subName := "sensor_001"
	tags := map[string]interface{}{
		"location": "factory_a",
		"type": "temperature",
	}
	
	mockService.On("SuperTableExists", mock.Anything, dbName, stName).Return(true, nil)
	mockService.On("SubTableExists", mock.Anything, dbName, subName).Return(false, nil)
	mockService.On("CreateSubTable", mock.Anything, dbName, stName, subName, tags, mock.Anything).Return(nil)
	mockService.On("GetSubTableInfo", mock.Anything, dbName, subName).Return(&tdengine.SubTableInfo{
		Name: subName,
		SuperTable: stName,
		Tags: tags,
	}, nil)
	
	router := setupTestRouter(handler)
	
	requestBody := map[string]interface{}{
		"name": subName,
		"tags": tags,
	}
	jsonBody, _ := json.Marshal(requestBody)
	
	req, _ := http.NewRequest("POST", fmt.Sprintf("/databases/%s/supertables/%s/subtables", dbName, stName), bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusCreated, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])
	
	mockService.AssertExpectations(t)
}

// Test List Sub-Tables
func TestListSubTables(t *testing.T) {
	mockService := new(MockTDengineService)
	handler := NewTDengineHandler(nil)
	handler.service = mockService.(*MockTDengineService)
	
	dbName := "test_db"
	stName := "sensors"
	
	mockService.On("SuperTableExists", mock.Anything, dbName, stName).Return(true, nil)
	mockService.On("ListSubTables", mock.Anything, dbName, stName, mock.Anything, 1, 20).Return(&tdengine.SubTableListResult{
		SubTables: []tdengine.SubTableInfo{
			{Name: "sensor_001", SuperTable: stName},
			{Name: "sensor_002", SuperTable: stName},
		},
		Total: 2,
		Page: 1,
		Size: 20,
	}, nil)
	
	router := setupTestRouter(handler)
	
	req, _ := http.NewRequest("GET", fmt.Sprintf("/databases/%s/supertables/%s/subtables", dbName, stName), nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])
	
	mockService.AssertExpectations(t)
}

// Test Get Sub-Table Info
func TestGetSubTableInfo(t *testing.T) {
	mockService := new(MockTDengineService)
	handler := NewTDengineHandler(nil)
	handler.service = mockService.(*MockTDengineService)
	
	dbName := "test_db"
	subName := "sensor_001"
	
	mockService.On("GetSubTableInfo", mock.Anything, dbName, subName).Return(&tdengine.SubTableInfo{
		Name: subName,
		SuperTable: "sensors",
		Tags: map[string]interface{}{
			"location": "factory_a",
		},
	}, nil)
	
	router := setupTestRouter(handler)
	
	req, _ := http.NewRequest("GET", fmt.Sprintf("/databases/%s/subtables/%s", dbName, subName), nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])
	
	mockService.AssertExpectations(t)
}

// Test Drop Sub-Table
func TestDropSubTable(t *testing.T) {
	mockService := new(MockTDengineService)
	handler := NewTDengineHandler(nil)
	handler.service = mockService.(*MockTDengineService)
	
	dbName := "test_db"
	subName := "sensor_001"
	
	mockService.On("SubTableExists", mock.Anything, dbName, subName).Return(true, nil)
	mockService.On("GetSubTableInfo", mock.Anything, dbName, subName).Return(&tdengine.SubTableInfo{
		Name: subName,
	}, nil)
	mockService.On("DropSubTable", mock.Anything, dbName, subName).Return(nil)
	
	router := setupTestRouter(handler)
	
	req, _ := http.NewRequest("DELETE", fmt.Sprintf("/databases/%s/subtables/%s", dbName, subName), nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])
	
	mockService.AssertExpectations(t)
}

// Test Get Sub-Tables By Tags
func TestGetSubTablesByTags(t *testing.T) {
	mockService := new(MockTDengineService)
	handler := NewTDengineHandler(nil)
	handler.service = mockService.(*MockTDengineService)
	
	dbName := "test_db"
	stName := "sensors"
	tags := map[string]interface{}{
		"location": "factory_a",
	}
	
	mockService.On("SuperTableExists", mock.Anything, dbName, stName).Return(true, nil)
	mockService.On("GetSubTablesByTags", mock.Anything, dbName, stName, tags).Return([]string{
		"sensor_001",
		"sensor_002",
	}, nil)
	
	router := setupTestRouter(handler)
	
	requestBody := map[string]interface{}{
		"tags": tags,
	}
	jsonBody, _ := json.Marshal(requestBody)
	
	req, _ := http.NewRequest("POST", fmt.Sprintf("/databases/%s/supertables/%s/subtables/by-tags", dbName, stName), bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])
	
	mockService.AssertExpectations(t)
}

// Test Auto-Create Sub-Table
func TestAutoCreateSubTable(t *testing.T) {
	mockService := new(MockTDengineService)
	handler := NewTDengineHandler(nil)
	handler.service = mockService.(*MockTDengineService)
	
	dbName := "test_db"
	stName := "sensors"
	dataPoint := tdengine.DataPoint{
		Timestamp: time.Now(),
		Tags: map[string]interface{}{
			"location": "factory_a",
		},
		Fields: map[string]interface{}{
			"temperature": 25.5,
		},
	}
	
	mockService.On("SuperTableExists", mock.Anything, dbName, stName).Return(true, nil)
	mockService.On("AutoCreateSubTable", mock.Anything, dbName, stName, dataPoint).Return("sensor_auto_001", nil)
	mockService.On("GetSubTableInfo", mock.Anything, dbName, "sensor_auto_001").Return(&tdengine.SubTableInfo{
		Name: "sensor_auto_001",
		SuperTable: stName,
	}, nil)
	
	router := setupTestRouter(handler)
	
	requestBody := map[string]interface{}{
		"data_point": dataPoint,
	}
	jsonBody, _ := json.Marshal(requestBody)
	
	req, _ := http.NewRequest("POST", fmt.Sprintf("/databases/%s/supertables/%s/auto-create", dbName, stName), bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])
	
	mockService.AssertExpectations(t)
}

// Test Apply Lifecycle Policy
func TestApplyLifecyclePolicy(t *testing.T) {
	mockService := new(MockTDengineService)
	handler := NewTDengineHandler(nil)
	handler.service = mockService.(*MockTDengineService)
	
	dbName := "test_db"
	stName := "sensors"
	policy := &tdengine.SubTableLifecyclePolicy{
		MaxAge: 30 * 24 * time.Hour,
		MaxSize: 1000000,
	}
	
	mockService.On("SuperTableExists", mock.Anything, dbName, stName).Return(true, nil)
	mockService.On("ApplyLifecyclePolicy", mock.Anything, dbName, stName, policy).Return(nil)
	
	router := setupTestRouter(handler)
	
	requestBody := map[string]interface{}{
		"policy": policy,
	}
	jsonBody, _ := json.Marshal(requestBody)
	
	req, _ := http.NewRequest("POST", fmt.Sprintf("/databases/%s/supertables/%s/lifecycle", dbName, stName), bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])
	
	mockService.AssertExpectations(t)
}

// Test Check Sub-Table Exists
func TestCheckSubTableExists(t *testing.T) {
	mockService := new(MockTDengineService)
	handler := NewTDengineHandler(nil)
	handler.service = mockService.(*MockTDengineService)
	
	dbName := "test_db"
	subName := "sensor_001"
	
	mockService.On("SubTableExists", mock.Anything, dbName, subName).Return(true, nil)
	
	router := setupTestRouter(handler)
	
	req, _ := http.NewRequest("GET", fmt.Sprintf("/databases/%s/subtables/%s/exists", dbName, subName), nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "success", response["status"])
	
	data := response["data"].(map[string]interface{})
	assert.Equal(t, true, data["exists"])
	
	mockService.AssertExpectations(t)
}
