package tdengine

import (
	"regexp"
	"strings"
)

// QueryOptimizer provides query optimization capabilities
type QueryOptimizer struct {
	config *QueryOptimizerConfig
	rules  []OptimizationRule
}

// QueryOptimizerConfig holds optimizer configuration
type QueryOptimizerConfig struct {
	Enabled                bool `json:"enabled"`
	EnableIndexHints       bool `json:"enable_index_hints"`
	EnableTimePartitioning bool `json:"enable_time_partitioning"`
	EnableColumnPruning    bool `json:"enable_column_pruning"`
	EnablePredicatePushdown bool `json:"enable_predicate_pushdown"`
}

// OptimizationRule represents a query optimization rule
type OptimizationRule interface {
	Apply(sql string) string
	Description() string
}

// DefaultQueryOptimizerConfig returns default optimizer configuration
func DefaultQueryOptimizerConfig() *QueryOptimizerConfig {
	return &QueryOptimizerConfig{
		Enabled:                 true,
		EnableIndexHints:        true,
		EnableTimePartitioning:  true,
		EnableColumnPruning:     true,
		EnablePredicatePushdown: true,
	}
}

// NewQueryOptimizer creates a new query optimizer
func NewQueryOptimizer(config *QueryOptimizerConfig) *QueryOptimizer {
	if config == nil {
		config = DefaultQueryOptimizerConfig()
	}

	optimizer := &QueryOptimizer{
		config: config,
		rules:  make([]OptimizationRule, 0),
	}

	// Add optimization rules
	if config.EnableTimePartitioning {
		optimizer.rules = append(optimizer.rules, &TimePartitioningRule{})
	}
	if config.EnableColumnPruning {
		optimizer.rules = append(optimizer.rules, &ColumnPruningRule{})
	}
	if config.EnablePredicatePushdown {
		optimizer.rules = append(optimizer.rules, &PredicatePushdownRule{})
	}
	if config.EnableIndexHints {
		optimizer.rules = append(optimizer.rules, &IndexHintRule{})
	}

	return optimizer
}

// OptimizeSQL optimizes a SQL query
func (qo *QueryOptimizer) OptimizeSQL(sql string) string {
	if !qo.config.Enabled {
		return sql
	}

	optimizedSQL := sql
	for _, rule := range qo.rules {
		optimizedSQL = rule.Apply(optimizedSQL)
	}

	return optimizedSQL
}

// AddRule adds a custom optimization rule
func (qo *QueryOptimizer) AddRule(rule OptimizationRule) {
	qo.rules = append(qo.rules, rule)
}

// GetRules returns all optimization rules
func (qo *QueryOptimizer) GetRules() []OptimizationRule {
	return qo.rules
}

// TimePartitioningRule optimizes queries with time-based partitioning
type TimePartitioningRule struct{}

func (r *TimePartitioningRule) Apply(sql string) string {
	// Add time-based partition pruning hints
	// Look for time range conditions and optimize them
	
	// Pattern to match time range conditions
	timeRangePattern := regexp.MustCompile(`(?i)ts\s*>=\s*'([^']+)'\s*AND\s*ts\s*<=\s*'([^']+)'`)
	
	if timeRangePattern.MatchString(sql) {
		// Add partition pruning hint
		if !strings.Contains(strings.ToUpper(sql), "/*+ PARTITION_PRUNING */") {
			sql = strings.Replace(sql, "SELECT", "SELECT /*+ PARTITION_PRUNING */", 1)
		}
	}

	return sql
}

func (r *TimePartitioningRule) Description() string {
	return "Adds partition pruning hints for time-based queries"
}

// ColumnPruningRule optimizes column selection
type ColumnPruningRule struct{}

func (r *ColumnPruningRule) Apply(sql string) string {
	// Replace SELECT * with specific columns when possible
	// This is a simplified implementation - in practice, you'd need schema information
	
	if strings.Contains(strings.ToUpper(sql), "SELECT *") {
		// Check if this is a simple query that could benefit from column pruning
		if strings.Count(sql, "JOIN") == 0 && strings.Count(sql, "UNION") == 0 {
			// Add hint for column pruning
			if !strings.Contains(strings.ToUpper(sql), "/*+ COLUMN_PRUNING */") {
				sql = strings.Replace(sql, "SELECT", "SELECT /*+ COLUMN_PRUNING */", 1)
			}
		}
	}

	return sql
}

func (r *ColumnPruningRule) Description() string {
	return "Optimizes column selection to reduce data transfer"
}

// PredicatePushdownRule pushes predicates down to reduce data scanning
type PredicatePushdownRule struct{}

func (r *PredicatePushdownRule) Apply(sql string) string {
	// Look for WHERE clauses that can be pushed down
	// Add predicate pushdown hints
	
	wherePattern := regexp.MustCompile(`(?i)WHERE\s+`)
	
	if wherePattern.MatchString(sql) {
		// Add predicate pushdown hint
		if !strings.Contains(strings.ToUpper(sql), "/*+ PREDICATE_PUSHDOWN */") {
			sql = strings.Replace(sql, "SELECT", "SELECT /*+ PREDICATE_PUSHDOWN */", 1)
		}
	}

	return sql
}

func (r *PredicatePushdownRule) Description() string {
	return "Pushes predicates down to reduce data scanning"
}

// IndexHintRule adds index hints for better performance
type IndexHintRule struct{}

func (r *IndexHintRule) Apply(sql string) string {
	// Add index hints for time-based queries
	// TDengine automatically uses time-based indexing, but we can add hints
	
	// Look for tag-based filtering
	tagPattern := regexp.MustCompile(`(?i)(collector_id|device_id|location)\s*=`)
	
	if tagPattern.MatchString(sql) {
		// Add tag index hint
		if !strings.Contains(strings.ToUpper(sql), "/*+ USE_TAG_INDEX */") {
			sql = strings.Replace(sql, "SELECT", "SELECT /*+ USE_TAG_INDEX */", 1)
		}
	}

	return sql
}

func (r *IndexHintRule) Description() string {
	return "Adds index hints for tag-based queries"
}

// AggregationOptimizationRule optimizes aggregation queries
type AggregationOptimizationRule struct{}

func (r *AggregationOptimizationRule) Apply(sql string) string {
	// Optimize aggregation functions
	aggPattern := regexp.MustCompile(`(?i)(COUNT|SUM|AVG|MAX|MIN)\s*\(`)
	
	if aggPattern.MatchString(sql) {
		// Add aggregation optimization hint
		if !strings.Contains(strings.ToUpper(sql), "/*+ AGGREGATION_OPT */") {
			sql = strings.Replace(sql, "SELECT", "SELECT /*+ AGGREGATION_OPT */", 1)
		}
	}

	return sql
}

func (r *AggregationOptimizationRule) Description() string {
	return "Optimizes aggregation function execution"
}

// QueryRewriteRule rewrites queries for better performance
type QueryRewriteRule struct{}

func (r *QueryRewriteRule) Apply(sql string) string {
	// Rewrite inefficient patterns
	
	// Replace DISTINCT with GROUP BY when appropriate
	distinctPattern := regexp.MustCompile(`(?i)SELECT\s+DISTINCT\s+(\w+)\s+FROM`)
	if distinctPattern.MatchString(sql) {
		sql = distinctPattern.ReplaceAllString(sql, "SELECT $1 FROM")
		// Add GROUP BY if not present
		if !strings.Contains(strings.ToUpper(sql), "GROUP BY") {
			// This is a simplified rewrite - in practice, you'd need more sophisticated parsing
			sql = strings.Replace(sql, " ORDER BY", " GROUP BY $1 ORDER BY", 1)
		}
	}

	return sql
}

func (r *QueryRewriteRule) Description() string {
	return "Rewrites queries for better performance patterns"
}

// LimitOptimizationRule optimizes LIMIT clauses
type LimitOptimizationRule struct{}

func (r *LimitOptimizationRule) Apply(sql string) string {
	// Add early termination hints for LIMIT queries
	limitPattern := regexp.MustCompile(`(?i)LIMIT\s+\d+`)
	
	if limitPattern.MatchString(sql) {
		// Add early termination hint
		if !strings.Contains(strings.ToUpper(sql), "/*+ EARLY_TERMINATION */") {
			sql = strings.Replace(sql, "SELECT", "SELECT /*+ EARLY_TERMINATION */", 1)
		}
	}

	return sql
}

func (r *LimitOptimizationRule) Description() string {
	return "Optimizes queries with LIMIT clauses for early termination"
}

// GetOptimizationSuggestions analyzes a query and provides optimization suggestions
func (qo *QueryOptimizer) GetOptimizationSuggestions(sql string) []string {
	var suggestions []string

	// Check for common anti-patterns
	upperSQL := strings.ToUpper(sql)

	// SELECT * without LIMIT
	if strings.Contains(upperSQL, "SELECT *") && !strings.Contains(upperSQL, "LIMIT") {
		suggestions = append(suggestions, "Consider adding LIMIT clause to prevent large result sets")
		suggestions = append(suggestions, "Consider selecting specific columns instead of SELECT *")
	}

	// Missing time range filter
	if !strings.Contains(upperSQL, "TS >=") && !strings.Contains(upperSQL, "TS >") {
		suggestions = append(suggestions, "Consider adding time range filter for better performance")
	}

	// ORDER BY without LIMIT
	if strings.Contains(upperSQL, "ORDER BY") && !strings.Contains(upperSQL, "LIMIT") {
		suggestions = append(suggestions, "ORDER BY without LIMIT may cause performance issues")
	}

	// Complex WHERE clauses
	whereCount := strings.Count(upperSQL, "WHERE")
	andCount := strings.Count(upperSQL, " AND ")
	orCount := strings.Count(upperSQL, " OR ")
	
	if whereCount > 0 && (andCount+orCount) >= 5 {
		suggestions = append(suggestions, "Complex WHERE clause detected - consider simplifying or using subqueries")
	}

	// Missing aggregation with GROUP BY
	if strings.Contains(upperSQL, "GROUP BY") && 
		!strings.Contains(upperSQL, "COUNT(") && 
		!strings.Contains(upperSQL, "SUM(") && 
		!strings.Contains(upperSQL, "AVG(") {
		suggestions = append(suggestions, "GROUP BY without aggregation functions may not be optimal")
	}

	return suggestions
}

// EstimateQueryCost estimates the relative cost of a query
func (qo *QueryOptimizer) EstimateQueryCost(sql string) int {
	cost := 1
	upperSQL := strings.ToUpper(sql)

	// Base cost factors
	if strings.Contains(upperSQL, "SELECT *") {
		cost += 2
	}
	
	if strings.Contains(upperSQL, "ORDER BY") {
		cost += 3
	}
	
	if strings.Contains(upperSQL, "GROUP BY") {
		cost += 2
	}
	
	// JOIN operations
	joinCount := strings.Count(upperSQL, "JOIN")
	cost += joinCount * 5

	// Subqueries
	subqueryCount := strings.Count(upperSQL, "SELECT") - 1
	cost += subqueryCount * 3

	// Complex WHERE clauses
	andCount := strings.Count(upperSQL, " AND ")
	orCount := strings.Count(upperSQL, " OR ")
	cost += (andCount + orCount) / 2

	// DISTINCT operations
	if strings.Contains(upperSQL, "DISTINCT") {
		cost += 4
	}

	// Time range filtering (reduces cost)
	if strings.Contains(upperSQL, "TS >=") || strings.Contains(upperSQL, "TS >") {
		cost -= 2
	}

	// LIMIT clause (reduces cost)
	if strings.Contains(upperSQL, "LIMIT") {
		cost -= 1
	}

	if cost < 1 {
		cost = 1
	}

	return cost
}

// GetStatistics returns optimizer statistics
func (qo *QueryOptimizer) GetStatistics() map[string]interface{} {
	return map[string]interface{}{
		"enabled":                   qo.config.Enabled,
		"rules_count":               len(qo.rules),
		"enable_index_hints":        qo.config.EnableIndexHints,
		"enable_time_partitioning":  qo.config.EnableTimePartitioning,
		"enable_column_pruning":     qo.config.EnableColumnPruning,
		"enable_predicate_pushdown": qo.config.EnablePredicatePushdown,
	}
}