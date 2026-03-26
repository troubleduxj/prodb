package tdengine

import (
	"context"
	"testing"
	"time"
)

func TestQuerySystem_ExecuteSQL(t *testing.T) {
	// Create a mock service for testing
	service := createMockTDengineService(t)
	querySystem := NewQuerySystem(service, nil)

	tests := []struct {
		name    string
		request *SQLQueryRequest
		wantErr bool
	}{
		{
			name: "Valid SQL query",
			request: &SQLQueryRequest{
				SQL:      "SELECT * FROM test_table LIMIT 10",
				Database: "test_db",
				Timeout:  30 * time.Second,
				UseCache: true,
			},
			wantErr: false,
		},
		{
			name: "Empty SQL query",
			request: &SQLQueryRequest{
				SQL:      "",
				Database: "test_db",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			result, err := querySystem.ExecuteSQL(ctx, tt.request)
			
			if tt.wantErr {
				if err == nil {
					t.Errorf("ExecuteSQL() expected error, got nil")
				}
				return
			}
			
			if err != nil {
				t.Errorf("ExecuteSQL() unexpected error: %v", err)
				return
			}
			
			if result == nil {
				t.Errorf("ExecuteSQL() expected result, got nil")
			}
		})
	}
}

func TestQuerySystem_ExecuteStructuredQuery(t *testing.T) {
	service := createMockTDengineService(t)
	querySystem := NewQuerySystem(service, nil)

	tests := []struct {
		name    string
		request *StructuredQueryRequest
		wantErr bool
	}{
		{
			name: "Valid structured query",
			request: &StructuredQueryRequest{
				Database: "test_db",
				Table:    "test_table",
				Columns:  []string{"ts", "value", "quality"},
				Conditions: &QueryConditions{
					TimeRange: &TimeRangeCondition{
						Start: time.Now().Add(-1 * time.Hour),
						End:   time.Now(),
					},
				},
				OrderBy: []OrderByClause{
					{Column: "ts", Direction: "DESC"},
				},
				Limit:    100,
				UseCache: true,
			},
			wantErr: false,
		},
		{
			name: "Missing database",
			request: &StructuredQueryRequest{
				Table: "test_table",
			},
			wantErr: true,
		},
		{
			name: "Missing table",
			request: &StructuredQueryRequest{
				Database: "test_db",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			result, err := querySystem.ExecuteStructuredQuery(ctx, tt.request)
			
			if tt.wantErr {
				if err == nil {
					t.Errorf("ExecuteStructuredQuery() expected error, got nil")
				}
				return
			}
			
			if err != nil {
				t.Errorf("ExecuteStructuredQuery() unexpected error: %v", err)
				return
			}
			
			if result == nil {
				t.Errorf("ExecuteStructuredQuery() expected result, got nil")
			}
		})
	}
}

func TestQuerySystem_ExecuteAggregationQuery(t *testing.T) {
	service := createMockTDengineService(t)
	querySystem := NewQuerySystem(service, nil)

	tests := []struct {
		name    string
		request *AggregationQueryRequest
		wantErr bool
	}{
		{
			name: "Valid aggregation query",
			request: &AggregationQueryRequest{
				Database: "test_db",
				Table:    "test_table",
				Aggregations: []AggregationFunction{
					{
						Function: "AVG",
						Column:   "value",
						Alias:    "avg_value",
					},
					{
						Function: "COUNT",
						Column:   "*",
						Alias:    "count",
					},
				},
				TimeWindow: &TimeWindowConfig{
					Interval: "1h",
					Start:    time.Now().Add(-24 * time.Hour),
					End:      time.Now(),
					Fill:     "NULL",
				},
				GroupBy: []string{"device_id"},
				Conditions: &QueryConditions{
					Tags: map[string]interface{}{
						"location": "workshop_a",
					},
				},
				UseCache: true,
			},
			wantErr: false,
		},
		{
			name: "Missing aggregations",
			request: &AggregationQueryRequest{
				Database: "test_db",
				Table:    "test_table",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			result, err := querySystem.ExecuteAggregationQuery(ctx, tt.request)
			
			if tt.wantErr {
				if err == nil {
					t.Errorf("ExecuteAggregationQuery() expected error, got nil")
				}
				return
			}
			
			if err != nil {
				t.Errorf("ExecuteAggregationQuery() unexpected error: %v", err)
				return
			}
			
			if result == nil {
				t.Errorf("ExecuteAggregationQuery() expected result, got nil")
			}
		})
	}
}

func TestQuerySystem_ExecuteWithPagination(t *testing.T) {
	service := createMockTDengineService(t)
	querySystem := NewQuerySystem(service, nil)

	request := &StructuredQueryRequest{
		Database: "test_db",
		Table:    "test_table",
		Columns:  []string{"ts", "value"},
		UseCache: true,
	}

	tests := []struct {
		name       string
		pagination *PaginationRequest
		wantErr    bool
	}{
		{
			name: "Valid pagination",
			pagination: &PaginationRequest{
				Page: 1,
				Size: 20,
			},
			wantErr: false,
		},
		{
			name: "Zero page defaults to 1",
			pagination: &PaginationRequest{
				Page: 0,
				Size: 20,
			},
			wantErr: false,
		},
		{
			name: "Zero size defaults to 20",
			pagination: &PaginationRequest{
				Page: 1,
				Size: 0,
			},
			wantErr: false,
		},
		{
			name: "Large size limited to 1000",
			pagination: &PaginationRequest{
				Page: 1,
				Size: 2000,
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			result, err := querySystem.ExecuteWithPagination(ctx, request, tt.pagination)
			
			if tt.wantErr {
				if err == nil {
					t.Errorf("ExecuteWithPagination() expected error, got nil")
				}
				return
			}
			
			if err != nil {
				t.Errorf("ExecuteWithPagination() unexpected error: %v", err)
				return
			}
			
			if result == nil {
				t.Errorf("ExecuteWithPagination() expected result, got nil")
				return
			}

			// Validate pagination fields
			if result.Page != tt.pagination.Page && tt.pagination.Page > 0 {
				t.Errorf("ExecuteWithPagination() page = %d, want %d", result.Page, tt.pagination.Page)
			}
			
			expectedSize := tt.pagination.Size
			if expectedSize <= 0 {
				expectedSize = 20
			}
			if expectedSize > 1000 {
				expectedSize = 1000
			}
			
			if result.Size != expectedSize {
				t.Errorf("ExecuteWithPagination() size = %d, want %d", result.Size, expectedSize)
			}
		})
	}
}

func TestQuerySystem_QueryLatestByTags(t *testing.T) {
	service := createMockTDengineService(t)
	querySystem := NewQuerySystem(service, nil)

	tests := []struct {
		name     string
		database string
		table    string
		tags     map[string]string
		limit    int
		wantErr  bool
	}{
		{
			name:     "Valid query with tags",
			database: "test_db",
			table:    "test_table",
			tags: map[string]string{
				"collector_id": "collector-001",
				"location":     "workshop_a",
			},
			limit:   50,
			wantErr: false,
		},
		{
			name:     "Empty tags",
			database: "test_db",
			table:    "test_table",
			tags:     map[string]string{},
			limit:    100,
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			result, err := querySystem.QueryLatestByTags(ctx, tt.database, tt.table, tt.tags, tt.limit)
			
			if tt.wantErr {
				if err == nil {
					t.Errorf("QueryLatestByTags() expected error, got nil")
				}
				return
			}
			
			if err != nil {
				t.Errorf("QueryLatestByTags() unexpected error: %v", err)
				return
			}
			
			if result == nil {
				t.Errorf("QueryLatestByTags() expected result, got nil")
			}
		})
	}
}

func TestQuerySystem_QueryTimeRange(t *testing.T) {
	service := createMockTDengineService(t)
	querySystem := NewQuerySystem(service, nil)

	start := time.Now().Add(-2 * time.Hour)
	end := time.Now().Add(-1 * time.Hour)

	tests := []struct {
		name       string
		database   string
		table      string
		start      time.Time
		end        time.Time
		conditions map[string]interface{}
		wantErr    bool
	}{
		{
			name:     "Valid time range query",
			database: "test_db",
			table:    "test_table",
			start:    start,
			end:      end,
			conditions: map[string]interface{}{
				"device_id": "device-001",
			},
			wantErr: false,
		},
		{
			name:       "No conditions",
			database:   "test_db",
			table:      "test_table",
			start:      start,
			end:        end,
			conditions: nil,
			wantErr:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			result, err := querySystem.QueryTimeRange(ctx, tt.database, tt.table, tt.start, tt.end, tt.conditions)
			
			if tt.wantErr {
				if err == nil {
					t.Errorf("QueryTimeRange() expected error, got nil")
				}
				return
			}
			
			if err != nil {
				t.Errorf("QueryTimeRange() unexpected error: %v", err)
				return
			}
			
			if result == nil {
				t.Errorf("QueryTimeRange() expected result, got nil")
			}
		})
	}
}

func TestQuerySystem_QueryAggregationWithTimeWindow(t *testing.T) {
	service := createMockTDengineService(t)
	querySystem := NewQuerySystem(service, nil)

	start := time.Now().Add(-24 * time.Hour)
	end := time.Now()

	tests := []struct {
		name       string
		database   string
		table      string
		aggFunc    string
		column     string
		interval   string
		start      time.Time
		end        time.Time
		conditions map[string]interface{}
		wantErr    bool
	}{
		{
			name:     "Valid aggregation with time window",
			database: "test_db",
			table:    "test_table",
			aggFunc:  "AVG",
			column:   "value",
			interval: "1h",
			start:    start,
			end:      end,
			conditions: map[string]interface{}{
				"location": "workshop_a",
			},
			wantErr: false,
		},
		{
			name:     "Different aggregation function",
			database: "test_db",
			table:    "test_table",
			aggFunc:  "MAX",
			column:   "value",
			interval: "30m",
			start:    start,
			end:      end,
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			result, err := querySystem.QueryAggregationWithTimeWindow(
				ctx, tt.database, tt.table, tt.aggFunc, tt.column, 
				tt.interval, tt.start, tt.end, tt.conditions,
			)
			
			if tt.wantErr {
				if err == nil {
					t.Errorf("QueryAggregationWithTimeWindow() expected error, got nil")
				}
				return
			}
			
			if err != nil {
				t.Errorf("QueryAggregationWithTimeWindow() unexpected error: %v", err)
				return
			}
			
			if result == nil {
				t.Errorf("QueryAggregationWithTimeWindow() expected result, got nil")
			}
		})
	}
}

func TestQuerySystem_Statistics(t *testing.T) {
	service := createMockTDengineService(t)
	querySystem := NewQuerySystem(service, nil)

	// Test getting statistics
	stats := querySystem.GetQueryStatistics()
	if stats == nil {
		t.Errorf("GetQueryStatistics() expected statistics, got nil")
	}

	cacheStats := querySystem.GetCacheStatistics()
	if cacheStats == nil {
		t.Errorf("GetCacheStatistics() expected cache statistics, got nil")
	}

	// Test clearing cache
	querySystem.ClearCache()
	
	// Verify cache was cleared
	newCacheStats := querySystem.GetCacheStatistics()
	if size, ok := newCacheStats["size"].(int); ok && size != 0 {
		t.Errorf("ClearCache() expected cache size 0, got %d", size)
	}
}

// createMockTDengineService creates a mock service for testing
func createMockTDengineService(t *testing.T) *TDengineService {
	// Create a mock manager
	config := &TDengineConfig{
		Host:     "localhost",
		Port:     6030,
		Username: "root",
		Password: "taosdata",
		Database: "test",
	}

	manager, err := NewTDengineManager(config)
	if err != nil {
		t.Skipf("Skipping test: TDengine not available: %v", err)
	}

	return NewTDengineService(manager)
}

func TestBuildStructuredSQL(t *testing.T) {
	service := createMockTDengineService(t)
	querySystem := NewQuerySystem(service, nil)

	tests := []struct {
		name    string
		request *StructuredQueryRequest
		want    string
		wantErr bool
	}{
		{
			name: "Simple SELECT",
			request: &StructuredQueryRequest{
				Database: "test_db",
				Table:    "test_table",
				Columns:  []string{"ts", "value"},
			},
			want:    "SELECT ts, value FROM test_table",
			wantErr: false,
		},
		{
			name: "SELECT with WHERE",
			request: &StructuredQueryRequest{
				Database: "test_db",
				Table:    "test_table",
				Conditions: &QueryConditions{
					Tags: map[string]interface{}{
						"device_id": "device-001",
					},
				},
			},
			want:    "SELECT * FROM test_table WHERE device_id = 'device-001'",
			wantErr: false,
		},
		{
			name: "SELECT with ORDER BY and LIMIT",
			request: &StructuredQueryRequest{
				Database: "test_db",
				Table:    "test_table",
				OrderBy: []OrderByClause{
					{Column: "ts", Direction: "DESC"},
				},
				Limit: 100,
			},
			want:    "SELECT * FROM test_table ORDER BY ts DESC LIMIT 100",
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := querySystem.buildStructuredSQL(tt.request)
			
			if tt.wantErr {
				if err == nil {
					t.Errorf("buildStructuredSQL() expected error, got nil")
				}
				return
			}
			
			if err != nil {
				t.Errorf("buildStructuredSQL() unexpected error: %v", err)
				return
			}
			
			if got != tt.want {
				t.Errorf("buildStructuredSQL() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestBuildAggregationSQL(t *testing.T) {
	service := createMockTDengineService(t)
	querySystem := NewQuerySystem(service, nil)

	tests := []struct {
		name    string
		request *AggregationQueryRequest
		wantErr bool
	}{
		{
			name: "Simple aggregation",
			request: &AggregationQueryRequest{
				Database: "test_db",
				Table:    "test_table",
				Aggregations: []AggregationFunction{
					{Function: "AVG", Column: "value", Alias: "avg_value"},
				},
			},
			wantErr: false,
		},
		{
			name: "Aggregation with time window",
			request: &AggregationQueryRequest{
				Database: "test_db",
				Table:    "test_table",
				Aggregations: []AggregationFunction{
					{Function: "COUNT", Column: "*", Alias: "count"},
				},
				TimeWindow: &TimeWindowConfig{
					Interval: "1h",
					Fill:     "NULL",
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := querySystem.buildAggregationSQL(tt.request)
			
			if tt.wantErr {
				if err == nil {
					t.Errorf("buildAggregationSQL() expected error, got nil")
				}
				return
			}
			
			if err != nil {
				t.Errorf("buildAggregationSQL() unexpected error: %v", err)
				return
			}
			
			if got == "" {
				t.Errorf("buildAggregationSQL() returned empty SQL")
			}
		})
	}
}