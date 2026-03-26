package tdengine

import (
	"strings"
	"testing"
)

func TestQueryOptimizer_OptimizeSQL(t *testing.T) {
	optimizer := NewQueryOptimizer(nil)

	tests := []struct {
		name     string
		sql      string
		contains []string // Strings that should be present in optimized SQL
	}{
		{
			name: "Time range query optimization",
			sql:  "SELECT * FROM test_table WHERE ts >= '2024-01-01 00:00:00' AND ts <= '2024-01-01 23:59:59'",
			contains: []string{
				"/*+ PARTITION_PRUNING */",
			},
		},
		{
			name: "SELECT * optimization",
			sql:  "SELECT * FROM test_table WHERE device_id = 'device-001'",
			contains: []string{
				"/*+ COLUMN_PRUNING */",
			},
		},
		{
			name: "WHERE clause optimization",
			sql:  "SELECT value FROM test_table WHERE device_id = 'device-001' AND location = 'workshop_a'",
			contains: []string{
				"/*+ PREDICATE_PUSHDOWN */",
			},
		},
		{
			name: "Tag-based query optimization",
			sql:  "SELECT * FROM test_table WHERE collector_id = 'collector-001'",
			contains: []string{
				"/*+ USE_TAG_INDEX */",
			},
		},
		{
			name: "Multiple optimizations",
			sql:  "SELECT * FROM test_table WHERE ts >= '2024-01-01 00:00:00' AND ts <= '2024-01-01 23:59:59' AND collector_id = 'collector-001'",
			contains: []string{
				"/*+ PARTITION_PRUNING */",
				"/*+ PREDICATE_PUSHDOWN */",
				"/*+ USE_TAG_INDEX */",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			optimized := optimizer.OptimizeSQL(tt.sql)
			
			for _, expected := range tt.contains {
				if !strings.Contains(optimized, expected) {
					t.Errorf("OptimizeSQL() expected to contain %s, got %s", expected, optimized)
				}
			}
		})
	}
}

func TestQueryOptimizer_Disabled(t *testing.T) {
	config := &QueryOptimizerConfig{
		Enabled: false,
	}
	optimizer := NewQueryOptimizer(config)

	sql := "SELECT * FROM test_table WHERE ts >= '2024-01-01 00:00:00' AND ts <= '2024-01-01 23:59:59'"
	optimized := optimizer.OptimizeSQL(sql)

	// Should return original SQL when disabled
	if optimized != sql {
		t.Errorf("OptimizeSQL() when disabled expected original SQL, got %s", optimized)
	}
}

func TestTimePartitioningRule(t *testing.T) {
	rule := &TimePartitioningRule{}

	tests := []struct {
		name     string
		sql      string
		expected bool // Whether optimization should be applied
	}{
		{
			name:     "Time range query",
			sql:      "SELECT * FROM test_table WHERE ts >= '2024-01-01 00:00:00' AND ts <= '2024-01-01 23:59:59'",
			expected: true,
		},
		{
			name:     "No time range",
			sql:      "SELECT * FROM test_table WHERE device_id = 'device-001'",
			expected: false,
		},
		{
			name:     "Already optimized",
			sql:      "SELECT /*+ PARTITION_PRUNING */ * FROM test_table WHERE ts >= '2024-01-01 00:00:00' AND ts <= '2024-01-01 23:59:59'",
			expected: false, // Should not add duplicate hint
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := rule.Apply(tt.sql)
			
			hasHint := strings.Contains(result, "/*+ PARTITION_PRUNING */")
			if tt.expected && !hasHint {
				t.Errorf("Apply() expected partition pruning hint to be added")
			}
			if !tt.expected && hasHint && !strings.Contains(tt.sql, "/*+ PARTITION_PRUNING */") {
				t.Errorf("Apply() unexpected partition pruning hint added")
			}
		})
	}
}

func TestColumnPruningRule(t *testing.T) {
	rule := &ColumnPruningRule{}

	tests := []struct {
		name     string
		sql      string
		expected bool
	}{
		{
			name:     "SELECT * query",
			sql:      "SELECT * FROM test_table WHERE device_id = 'device-001'",
			expected: true,
		},
		{
			name:     "Specific columns",
			sql:      "SELECT ts, value FROM test_table WHERE device_id = 'device-001'",
			expected: false,
		},
		{
			name:     "Complex query with JOIN",
			sql:      "SELECT * FROM test_table t1 JOIN other_table t2 ON t1.id = t2.id",
			expected: false, // Should not optimize complex queries
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := rule.Apply(tt.sql)
			
			hasHint := strings.Contains(result, "/*+ COLUMN_PRUNING */")
			if tt.expected && !hasHint {
				t.Errorf("Apply() expected column pruning hint to be added")
			}
			if !tt.expected && hasHint && !strings.Contains(tt.sql, "/*+ COLUMN_PRUNING */") {
				t.Errorf("Apply() unexpected column pruning hint added")
			}
		})
	}
}

func TestPredicatePushdownRule(t *testing.T) {
	rule := &PredicatePushdownRule{}

	tests := []struct {
		name     string
		sql      string
		expected bool
	}{
		{
			name:     "Query with WHERE clause",
			sql:      "SELECT * FROM test_table WHERE device_id = 'device-001'",
			expected: true,
		},
		{
			name:     "Query without WHERE clause",
			sql:      "SELECT * FROM test_table",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := rule.Apply(tt.sql)
			
			hasHint := strings.Contains(result, "/*+ PREDICATE_PUSHDOWN */")
			if tt.expected && !hasHint {
				t.Errorf("Apply() expected predicate pushdown hint to be added")
			}
			if !tt.expected && hasHint {
				t.Errorf("Apply() unexpected predicate pushdown hint added")
			}
		})
	}
}

func TestIndexHintRule(t *testing.T) {
	rule := &IndexHintRule{}

	tests := []struct {
		name     string
		sql      string
		expected bool
	}{
		{
			name:     "Query with collector_id",
			sql:      "SELECT * FROM test_table WHERE collector_id = 'collector-001'",
			expected: true,
		},
		{
			name:     "Query with device_id",
			sql:      "SELECT * FROM test_table WHERE device_id = 'device-001'",
			expected: true,
		},
		{
			name:     "Query with location",
			sql:      "SELECT * FROM test_table WHERE location = 'workshop_a'",
			expected: true,
		},
		{
			name:     "Query without tag columns",
			sql:      "SELECT * FROM test_table WHERE value > 100",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := rule.Apply(tt.sql)
			
			hasHint := strings.Contains(result, "/*+ USE_TAG_INDEX */")
			if tt.expected && !hasHint {
				t.Errorf("Apply() expected tag index hint to be added")
			}
			if !tt.expected && hasHint {
				t.Errorf("Apply() unexpected tag index hint added")
			}
		})
	}
}

func TestAggregationOptimizationRule(t *testing.T) {
	rule := &AggregationOptimizationRule{}

	tests := []struct {
		name     string
		sql      string
		expected bool
	}{
		{
			name:     "COUNT aggregation",
			sql:      "SELECT COUNT(*) FROM test_table",
			expected: true,
		},
		{
			name:     "AVG aggregation",
			sql:      "SELECT AVG(value) FROM test_table GROUP BY device_id",
			expected: true,
		},
		{
			name:     "Multiple aggregations",
			sql:      "SELECT COUNT(*), SUM(value), MAX(value) FROM test_table",
			expected: true,
		},
		{
			name:     "No aggregation",
			sql:      "SELECT * FROM test_table WHERE device_id = 'device-001'",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := rule.Apply(tt.sql)
			
			hasHint := strings.Contains(result, "/*+ AGGREGATION_OPT */")
			if tt.expected && !hasHint {
				t.Errorf("Apply() expected aggregation optimization hint to be added")
			}
			if !tt.expected && hasHint {
				t.Errorf("Apply() unexpected aggregation optimization hint added")
			}
		})
	}
}

func TestLimitOptimizationRule(t *testing.T) {
	rule := &LimitOptimizationRule{}

	tests := []struct {
		name     string
		sql      string
		expected bool
	}{
		{
			name:     "Query with LIMIT",
			sql:      "SELECT * FROM test_table LIMIT 100",
			expected: true,
		},
		{
			name:     "Query with LIMIT and OFFSET",
			sql:      "SELECT * FROM test_table LIMIT 100 OFFSET 50",
			expected: true,
		},
		{
			name:     "Query without LIMIT",
			sql:      "SELECT * FROM test_table WHERE device_id = 'device-001'",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := rule.Apply(tt.sql)
			
			hasHint := strings.Contains(result, "/*+ EARLY_TERMINATION */")
			if tt.expected && !hasHint {
				t.Errorf("Apply() expected early termination hint to be added")
			}
			if !tt.expected && hasHint {
				t.Errorf("Apply() unexpected early termination hint added")
			}
		})
	}
}

func TestQueryOptimizer_GetOptimizationSuggestions(t *testing.T) {
	optimizer := NewQueryOptimizer(nil)

	tests := []struct {
		name            string
		sql             string
		expectedCount   int
		expectedContains []string
	}{
		{
			name:          "SELECT * without LIMIT",
			sql:           "SELECT * FROM test_table",
			expectedCount: 2,
			expectedContains: []string{
				"LIMIT clause",
				"specific columns",
			},
		},
		{
			name:          "Missing time range filter",
			sql:           "SELECT value FROM test_table WHERE device_id = 'device-001'",
			expectedCount: 1,
			expectedContains: []string{
				"time range filter",
			},
		},
		{
			name:          "ORDER BY without LIMIT",
			sql:           "SELECT * FROM test_table ORDER BY ts DESC",
			expectedCount: 3,
			expectedContains: []string{
				"ORDER BY without LIMIT",
				"LIMIT clause",
				"specific columns",
			},
		},
		{
			name:          "Complex WHERE clause",
			sql:           "SELECT * FROM test_table WHERE a = 1 AND b = 2 AND c = 3 AND d = 4 AND e = 5 AND f = 6",
			expectedCount: 2,
			expectedContains: []string{
				"Complex WHERE clause",
			},
		},
		{
			name:          "GROUP BY without aggregation",
			sql:           "SELECT device_id FROM test_table GROUP BY device_id",
			expectedCount: 2,
			expectedContains: []string{
				"GROUP BY without aggregation",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			suggestions := optimizer.GetOptimizationSuggestions(tt.sql)
			
			if len(suggestions) < tt.expectedCount {
				t.Errorf("GetOptimizationSuggestions() expected at least %d suggestions, got %d", tt.expectedCount, len(suggestions))
			}
			
			for _, expected := range tt.expectedContains {
				found := false
				for _, suggestion := range suggestions {
					if strings.Contains(suggestion, expected) {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("GetOptimizationSuggestions() expected suggestion containing '%s', not found in %v", expected, suggestions)
				}
			}
		})
	}
}

func TestQueryOptimizer_EstimateQueryCost(t *testing.T) {
	optimizer := NewQueryOptimizer(nil)

	tests := []struct {
		name         string
		sql          string
		expectedMin  int
		expectedMax  int
	}{
		{
			name:        "Simple query",
			sql:         "SELECT ts, value FROM test_table WHERE ts >= '2024-01-01' LIMIT 100",
			expectedMin: 1,
			expectedMax: 3,
		},
		{
			name:        "Complex query with JOIN",
			sql:         "SELECT * FROM test_table t1 JOIN other_table t2 ON t1.id = t2.id ORDER BY t1.ts",
			expectedMin: 8,
			expectedMax: 15,
		},
		{
			name:        "Expensive query",
			sql:         "SELECT DISTINCT * FROM test_table t1 JOIN other_table t2 ON t1.id = t2.id WHERE t1.a = 1 AND t1.b = 2 AND t1.c = 3 ORDER BY t1.ts",
			expectedMin: 10,
			expectedMax: 20,
		},
		{
			name:        "Optimized query",
			sql:         "SELECT value FROM test_table WHERE ts >= '2024-01-01' AND collector_id = 'collector-001' LIMIT 50",
			expectedMin: 1,
			expectedMax: 4,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cost := optimizer.EstimateQueryCost(tt.sql)
			
			if cost < tt.expectedMin {
				t.Errorf("EstimateQueryCost() = %d, expected >= %d", cost, tt.expectedMin)
			}
			if cost > tt.expectedMax {
				t.Errorf("EstimateQueryCost() = %d, expected <= %d", cost, tt.expectedMax)
			}
		})
	}
}

func TestQueryOptimizer_AddRule(t *testing.T) {
	optimizer := NewQueryOptimizer(nil)
	
	initialRuleCount := len(optimizer.GetRules())
	
	// Add a custom rule
	customRule := &TestOptimizationRule{}
	optimizer.AddRule(customRule)
	
	newRuleCount := len(optimizer.GetRules())
	if newRuleCount != initialRuleCount+1 {
		t.Errorf("AddRule() expected rule count %d, got %d", initialRuleCount+1, newRuleCount)
	}
	
	// Test that the custom rule is applied
	sql := "SELECT * FROM test_table"
	optimized := optimizer.OptimizeSQL(sql)
	
	if !strings.Contains(optimized, "/*+ CUSTOM_RULE */") {
		t.Errorf("OptimizeSQL() expected custom rule to be applied")
	}
}

func TestQueryOptimizer_GetStatistics(t *testing.T) {
	config := &QueryOptimizerConfig{
		Enabled:                 true,
		EnableIndexHints:        true,
		EnableTimePartitioning:  true,
		EnableColumnPruning:     false,
		EnablePredicatePushdown: true,
	}
	optimizer := NewQueryOptimizer(config)
	
	stats := optimizer.GetStatistics()
	
	if stats["enabled"] != true {
		t.Errorf("GetStatistics() enabled expected true, got %v", stats["enabled"])
	}
	
	if stats["enable_index_hints"] != true {
		t.Errorf("GetStatistics() enable_index_hints expected true, got %v", stats["enable_index_hints"])
	}
	
	if stats["enable_column_pruning"] != false {
		t.Errorf("GetStatistics() enable_column_pruning expected false, got %v", stats["enable_column_pruning"])
	}
	
	rulesCount, ok := stats["rules_count"].(int)
	if !ok || rulesCount <= 0 {
		t.Errorf("GetStatistics() rules_count expected positive integer, got %v", stats["rules_count"])
	}
}

// TestOptimizationRule is a custom rule for testing
type TestOptimizationRule struct{}

func (r *TestOptimizationRule) Apply(sql string) string {
	if !strings.Contains(strings.ToUpper(sql), "/*+ CUSTOM_RULE */") {
		return strings.Replace(sql, "SELECT", "SELECT /*+ CUSTOM_RULE */", 1)
	}
	return sql
}

func (r *TestOptimizationRule) Description() string {
	return "Test optimization rule"
}