# 运维管理-数据运维页面后端设计文档

## 一、功能需求分析

### 1.1 页面结构概览

```
OperationsData.tsx
├── Sidebar Tree (左侧树形结构)
│   ├── Database List (数据库列表)
│   ├── Super Table List (超级表列表)
│   └── Child Table List (子表列表)
├── SQL Console (SQL控制台 - 可折叠)
└── Main Content Panel (主内容区)
    ├── Database Settings (数据库设置)
    ├── Super Table Details (超级表详情)
    │   ├── Data Preview (数据预览)
    │   ├── Schema Editor (Schema编辑)
    │   └── Data Quality (数据质量)
    └── Child Table Details (子表详情)
        ├── Data Preview (数据预览)
        ├── Tag Attributes (标签属性)
        └── View Schema (查看Schema)
```

### 1.2 功能点识别

| 功能模块 | 具体功能 | 当前状态 | 后端支持需求 |
|---------|---------|---------|-------------|
| **数据库树** | 获取数据库列表 | Mock数据 | ✅ 已有API |
| | 获取超级表列表 | Mock数据 | ✅ 已有API |
| | 获取子表列表 | Mock数据 | ❌ 需要新增 |
| **数据库设置** | 获取数据库配置 | Mock UI | ❌ 需要新增 |
| | 更新数据库配置 | Mock UI | ❌ 需要新增 |
| | 删除数据库 | Mock UI | ✅ 已有API |
| **超级表管理** | 获取Schema | Mock数据 | ✅ 已有API |
| | 添加列/标签 | Mock弹窗 | ❌ 需要新增 |
| | 删除列/标签 | Mock按钮 | ❌ 需要新增 |
| | 数据预览 | Mock数据 | ❌ 需要新增 |
| | 数据质量分析 | Mock数据 | ❌ 需要新增 |
| **子表管理** | 获取子表信息 | Mock数据 | ✅ 已有API |
| | 获取/更新标签 | Mock UI | ❌ 需要完善 |
| | 数据预览 | Mock数据 | ❌ 需要新增 |
| **SQL控制台** | 执行SQL | Mock UI | ✅ 已有API |

---

## 二、API架构设计

### 2.1 现有API评估

#### 已有且可直接使用的API：
```go
// 数据库管理
GET    /api/v1/tdengine/databases                          // 获取数据库列表
GET    /api/v1/tdengine/databases/:database                 // 获取数据库信息
DELETE /api/v1/tdengine/databases/:database                 // 删除数据库
GET    /api/v1/tdengine/databases/:database/statistics      // 获取数据库统计

// 超级表管理
GET    /api/v1/tdengine/db/:database/supertables            // 获取超级表列表
GET    /api/v1/tdengine/db/:database/supertables/:supertable           // 获取超级表信息
GET    /api/v1/tdengine/db/:database/supertables/:supertable/schema    // 获取超级表Schema
DELETE /api/v1/tdengine/db/:database/supertables/:supertable           // 删除超级表
PUT    /api/v1/tdengine/db/:database/supertables/:supertable           // 修改超级表

// 子表管理
GET    /api/v1/tdengine/db/:database/subtables/:subtable    // 获取子表信息
DELETE /api/v1/tdengine/db/:database/subtables/:subtable    // 删除子表
PUT    /api/v1/tdengine/db/:database/subtables/:subtable/tags/:tag     // 更新标签

// 数据操作
POST   /api/v1/tdengine/query                               // 执行SQL查询
GET    /api/v1/tdengine/data/latest                         // 获取最新数据
```

#### 需要新增的API：

### 2.2 新增API设计

#### 2.2.1 数据库配置管理

```go
// 获取数据库配置详情
GET /api/v1/tdengine/databases/:database/config

Response:
{
  "status": "success",
  "data": {
    "name": "power_db",
    "keep": 365,              // 数据保留天数
    "duration": 10,           // 数据块存储时长
    "replica": 3,             // 副本数
    "wal_level": 2,           // WAL级别
    "vgroups": 4,             // vgroups数量
    "created_at": "2024-01-15T08:30:00Z",
    "tables": 4,              // 超级表数量
    "nTables": 15475          // 子表总数
  }
}

// 更新数据库配置
PUT /api/v1/tdengine/databases/:database/config

Request:
{
  "keep": 365,
  "duration": 10,
  "replica": 3,
  "wal_level": 2,
  "vgroups": 4
}

Response:
{
  "status": "success",
  "message": "Database configuration updated successfully"
}
```

#### 2.2.2 超级表数据预览

```go
// 获取超级表数据预览（聚合所有子表）
GET /api/v1/tdengine/db/:database/supertables/:supertable/preview

Query Parameters:
- limit: 返回记录数 (默认: 100, 最大: 1000)
- offset: 偏移量 (默认: 0)
- order_by: 排序字段 (默认: ts)
- order: asc/desc (默认: desc)

Response:
{
  "status": "success",
  "data": {
    "columns": [
      {"name": "ts", "type": "TIMESTAMP"},
      {"name": "current", "type": "FLOAT"},
      {"name": "voltage", "type": "INT"},
      {"name": "phase", "type": "FLOAT"},
      {"name": "location", "type": "BINARY", "is_tag": true},
      {"name": "group_id", "type": "INT", "is_tag": true}
    ],
    "rows": [
      {
        "ts": "2024-03-27T10:15:00Z",
        "current": 10.25,
        "voltage": 220,
        "phase": 0.523,
        "location": "California_DC_01",
        "group_id": 100
      }
    ],
    "total": 1000,
    "child_tables_count": 15000
  }
}
```

#### 2.2.3 超级表Schema编辑

```go
// 添加列到超级表
POST /api/v1/tdengine/db/:database/supertables/:supertable/columns

Request:
{
  "name": "engine_temp",
  "type": "FLOAT",
  "is_tag": false  // false = metric列, true = tag列
}

Response:
{
  "status": "success",
  "message": "Column 'engine_temp' added successfully"
}

// 删除超级表列
DELETE /api/v1/tdengine/db/:database/supertables/:supertable/columns/:column

Response:
{
  "status": "success",
  "message": "Column 'engine_temp' removed successfully"
}
```

#### 2.2.4 数据质量分析

```go
// 获取超级表数据质量指标
GET /api/v1/tdengine/db/:database/supertables/:supertable/quality

Response:
{
  "status": "success",
  "data": {
    "score": 92,
    "metrics": {
      "out_of_order_rate": 0.5,     // 乱序率 %
      "null_rate": 1.2,              // 空值率 %
      "duplication_rate": 0.1,       // 重复率 %
      "completeness": 98.5,          // 数据完整度 %
      "consistency": 99.2            // 数据一致性 %
    },
    "trend": [90, 91, 92, 91, 92, 93, 92],  // 7天质量分数趋势
    "last_analyzed": "2024-03-27T10:00:00Z",
    "suggestions": [
      {
        "type": "RULE",
        "message": "Quality is excellent. Indicators are within healthy ranges."
      }
    ]
  }
}

// AI数据质量分析
POST /api/v1/tdengine/db/:database/supertables/:supertable/quality/analyze

Request:
{
  "metrics": {
    "out_of_order": 0.5,
    "null_rate": 1.2,
    "duplication": 0.1
  }
}

Response:
{
  "status": "success",
  "data": {
    "suggestion": "The data quality is excellent with minimal out-of-order records...",
    "recommendations": [
      "Continue current data ingestion patterns",
      "Monitor null rate in voltage column"
    ],
    "confidence": 0.95
  }
}
```

#### 2.2.5 子表管理增强

```go
// 获取子表列表（用于树形展开）
GET /api/v1/tdengine/db/:database/supertables/:supertable/subtables

Query Parameters:
- limit: 数量限制 (默认: 100)
- offset: 偏移量
- filter: 名称过滤

Response:
{
  "status": "success",
  "data": {
    "subtables": [
      {
        "name": "meters_device_100",
        "tags": {
          "location": "California_DC_01",
          "group_id": 100
        },
        "created_at": "2024-01-15T08:30:00Z",
        "row_count": 15420
      }
    ],
    "total": 15000,
    "has_more": true
  }
}

// 获取子表标签值
GET /api/v1/tdengine/db/:database/subtables/:subtable/tags

Response:
{
  "status": "success",
  "data": {
    "subtable": "meters_device_100",
    "tags": {
      "location": "California_DC_01",
      "group_id": 100
    }
  }
}

// 批量更新子表标签
PUT /api/v1/tdengine/db/:database/subtables/:subtable/tags

Request:
{
  "tags": {
    "location": "Nevada_Site_B",
    "group_id": 101
  }
}

Response:
{
  "status": "success",
  "message": "Tags updated successfully"
}

// 获取子表数据预览
GET /api/v1/tdengine/db/:database/subtables/:subtable/preview

Query Parameters:
- limit: 返回记录数 (默认: 100)
- start_time: 开始时间 (ISO 8601)
- end_time: 结束时间 (ISO 8601)

Response:
{
  "status": "success",
  "data": {
    "columns": [
      {"name": "ts", "type": "TIMESTAMP"},
      {"name": "current", "type": "FLOAT"},
      {"name": "voltage", "type": "INT"},
      {"name": "phase", "type": "FLOAT"}
    ],
    "rows": [
      {
        "ts": "2024-03-27T10:15:00Z",
        "current": 10.25,
        "voltage": 220,
        "phase": 0.523
      }
    ],
    "total": 15420
  }
}
```

---

## 三、数据模型设计

### 3.1 请求/响应模型

```go
// platform/backend/models/operations_data.go

package models

import "time"

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Name      string    `json:"name"`
	Keep      int       `json:"keep"`      // 数据保留天数
	Duration  int       `json:"duration"`  // 数据块存储时长(天)
	Replica   int       `json:"replica"`   // 副本数
	WALLevel  int       `json:"wal_level"` // WAL级别
	VGroups   int       `json:"vgroups"`   // vgroups数量
	CreatedAt time.Time `json:"created_at"`
	Tables    int       `json:"tables"`    // 超级表数量
	NTables   int       `json:"nTables"`   // 子表总数
}

// UpdateDatabaseConfigRequest 更新数据库配置请求
type UpdateDatabaseConfigRequest struct {
	Keep     *int `json:"keep,omitempty"`
	Duration *int `json:"duration,omitempty"`
	Replica  *int `json:"replica,omitempty"`
	WALLevel *int `json:"wal_level,omitempty"`
	VGroups  *int `json:"vgroups,omitempty"`
}

// ColumnInfo 列信息
type ColumnInfo struct {
	Name   string `json:"name"`
	Type   string `json:"type"`
	Length int    `json:"length,omitempty"`
	IsTag  bool   `json:"is_tag"`
	Note   string `json:"note,omitempty"`
}

// TableSchema 表Schema
type TableSchema struct {
	Metrics []ColumnInfo `json:"metrics"`
	Tags    []ColumnInfo `json:"tags"`
}

// AddColumnRequest 添加列请求
type AddColumnRequest struct {
	Name   string `json:"name" binding:"required"`
	Type   string `json:"type" binding:"required"`
	Length int    `json:"length,omitempty"`
	IsTag  bool   `json:"is_tag"`
}

// DataPreviewResponse 数据预览响应
type DataPreviewResponse struct {
	Columns          []ColumnInfo           `json:"columns"`
	Rows             []map[string]interface{} `json:"rows"`
	Total            int64                  `json:"total"`
	ChildTablesCount int64                  `json:"child_tables_count,omitempty"`
}

// DataQualityMetrics 数据质量指标
type DataQualityMetrics struct {
	OutOfOrderRate   float64 `json:"out_of_order_rate"`
	NullRate         float64 `json:"null_rate"`
	DuplicationRate  float64 `json:"duplication_rate"`
	Completeness     float64 `json:"completeness"`
	Consistency      float64 `json:"consistency"`
}

// DataQualityResponse 数据质量响应
type DataQualityResponse struct {
	Score          int                `json:"score"`
	Metrics        DataQualityMetrics `json:"metrics"`
	Trend          []int              `json:"trend"`
	LastAnalyzed   time.Time          `json:"last_analyzed"`
	Suggestions    []QualitySuggestion `json:"suggestions"`
}

// QualitySuggestion 质量建议
type QualitySuggestion struct {
	Type    string `json:"type"`    // RULE | AI
	Message string `json:"message"`
}

// AIAnalyzeRequest AI分析请求
type AIAnalyzeRequest struct {
	Metrics struct {
		OutOfOrder  float64 `json:"out_of_order"`
		NullRate    float64 `json:"null_rate"`
		Duplication float64 `json:"duplication"`
	} `json:"metrics"`
}

// AIAnalyzeResponse AI分析响应
type AIAnalyzeResponse struct {
	Suggestion      string   `json:"suggestion"`
	Recommendations []string `json:"recommendations"`
	Confidence      float64  `json:"confidence"`
}

// SubTableInfo 子表信息
type SubTableInfo struct {
	Name      string                 `json:"name"`
	Tags      map[string]interface{} `json:"tags"`
	CreatedAt time.Time              `json:"created_at"`
	RowCount  int64                  `json:"row_count"`
}

// SubTableListResponse 子表列表响应
type SubTableListResponse struct {
	SubTables []SubTableInfo `json:"subtables"`
	Total     int64          `json:"total"`
	HasMore   bool           `json:"has_more"`
}

// UpdateTagsRequest 更新标签请求
type UpdateTagsRequest struct {
	Tags map[string]interface{} `json:"tags" binding:"required"`
}
```

---

## 四、服务层设计

### 4.1 服务接口定义

```go
// platform/backend/services/operations_data_service.go

package services

import (
	"context"
	"prodb/platform/backend/models"
)

// OperationsDataService 数据运维服务接口
type OperationsDataService interface {
	// 数据库配置管理
	GetDatabaseConfig(ctx context.Context, dbName string) (*models.DatabaseConfig, error)
	UpdateDatabaseConfig(ctx context.Context, dbName string, req *models.UpdateDatabaseConfigRequest) error
	
	// 超级表数据操作
	GetSuperTablePreview(ctx context.Context, dbName, stName string, limit, offset int) (*models.DataPreviewResponse, error)
	AddColumnToSuperTable(ctx context.Context, dbName, stName string, req *models.AddColumnRequest) error
	RemoveColumnFromSuperTable(ctx context.Context, dbName, stName, columnName string, isTag bool) error
	
	// 数据质量分析
	GetDataQuality(ctx context.Context, dbName, stName string) (*models.DataQualityResponse, error)
	AnalyzeWithAI(ctx context.Context, dbName, stName string, metrics *models.AIAnalyzeRequest) (*models.AIAnalyzeResponse, error)
	
	// 子表管理
	ListSubTables(ctx context.Context, dbName, stName string, limit, offset int, filter string) (*models.SubTableListResponse, error)
	GetSubTableTags(ctx context.Context, dbName, subTableName string) (map[string]interface{}, error)
	UpdateSubTableTags(ctx context.Context, dbName, subTableName string, tags map[string]interface{}) error
	GetSubTablePreview(ctx context.Context, dbName, subTableName string, limit int, startTime, endTime *time.Time) (*models.DataPreviewResponse, error)
}
```

### 4.2 服务实现结构

```go
// platform/backend/services/operations_data_service_impl.go

type operationsDataService struct {
	tdengineService *tdengine.TDengineService
	aiService       AIService  // AI分析服务接口
}

// NewOperationsDataService 创建服务实例
func NewOperationsDataService(tdengineSvc *tdengine.TDengineService, aiSvc AIService) OperationsDataService {
	return &operationsDataService{
		tdengineService: tdengineSvc,
		aiservice:       aiSvc,
	}
}
```

---

## 五、Handler层设计

### 5.1 Handler结构

```go
// platform/backend/handlers/operations_data_handler.go

package handlers

import (
	"net/http"
	"prodb/platform/backend/services"
	"strconv"
	"time"
	
	"github.com/gin-gonic/gin"
)

// OperationsDataHandler 数据运维Handler
type OperationsDataHandler struct {
	service services.OperationsDataService
}

// NewOperationsDataHandler 创建Handler
func NewOperationsDataHandler(service services.OperationsDataService) *OperationsDataHandler {
	return &OperationsDataHandler{service: service}
}

// RegisterRoutes 注册路由
func (h *OperationsDataHandler) RegisterRoutes(router *gin.RouterGroup) {
	// 数据库配置
	router.GET("/databases/:database/config", h.GetDatabaseConfig)
	router.PUT("/databases/:database/config", h.UpdateDatabaseConfig)
	
	// 超级表数据预览
	router.GET("/db/:database/supertables/:supertable/preview", h.GetSuperTablePreview)
	
	// 超级表Schema编辑
	router.POST("/db/:database/supertables/:supertable/columns", h.AddColumn)
	router.DELETE("/db/:database/supertables/:supertable/columns/:column", h.RemoveColumn)
	
	// 数据质量
	router.GET("/db/:database/supertables/:supertable/quality", h.GetDataQuality)
	router.POST("/db/:database/supertables/:supertable/quality/analyze", h.AnalyzeWithAI)
	
	// 子表管理
	router.GET("/db/:database/supertables/:supertable/subtables", h.ListSubTables)
	router.GET("/db/:database/subtables/:subtable/tags", h.GetSubTableTags)
	router.PUT("/db/:database/subtables/:subtable/tags", h.UpdateSubTableTags)
	router.GET("/db/:database/subtables/:subtable/preview", h.GetSubTablePreview)
}
```

---

## 六、AI集成设计

### 6.1 AI分析服务接口

```go
// platform/backend/services/ai_service.go

type AIService interface {
	AnalyzeDataQuality(ctx context.Context, tableName string, metrics DataQualityMetrics) (*AIAnalyzeResponse, error)
}

// aiServiceImpl AI服务实现
type aiServiceImpl struct {
	geminiAPIKey string
	endpoint     string
}

func (s *aiServiceImpl) AnalyzeDataQuality(ctx context.Context, tableName string, metrics DataQualityMetrics) (*AIAnalyzeResponse, error) {
	// 调用Gemini API进行数据分析
	// 复用现有的geminiService逻辑
}
```

---

## 七、实施计划

### 7.1 优先级划分

**P0 - 核心功能（必须实现）**
1. ✅ 获取数据库列表 - 已有API
2. ✅ 获取超级表列表 - 已有API
3. ❌ 获取子表列表 - 新增API
4. ❌ 超级表数据预览 - 新增API
5. ❌ 子表数据预览 - 新增API
6. ❌ 获取/更新标签 - 完善API

**P1 - 配置管理（重要）**
7. ❌ 获取数据库配置 - 新增API
8. ❌ 更新数据库配置 - 新增API
9. ❌ Schema编辑（添加/删除列）- 新增API

**P2 - 高级功能（可选）**
10. ❌ 数据质量分析 - 新增API
11. ❌ AI智能分析 - 新增API（依赖Gemini）

### 7.2 文件变更清单

| 文件路径 | 操作 | 说明 |
|---------|------|------|
| `platform/backend/models/operations_data.go` | 新增 | 数据模型定义 |
| `platform/backend/services/operations_data_service.go` | 新增 | 服务接口 |
| `platform/backend/services/operations_data_service_impl.go` | 新增 | 服务实现 |
| `platform/backend/handlers/operations_data_handler.go` | 新增 | Handler实现 |
| `platform/backend/main.go` | 修改 | 注册新路由 |

### 7.3 测试用例

```go
// 主要测试场景
1. TestGetDatabaseConfig - 获取数据库配置
2. TestUpdateDatabaseConfig - 更新数据库配置
3. TestGetSuperTablePreview - 超级表数据预览
4. TestAddColumnToSuperTable - 添加列
5. TestRemoveColumnFromSuperTable - 删除列
6. TestGetDataQuality - 获取数据质量
7. TestListSubTables - 获取子表列表
8. TestUpdateSubTableTags - 更新子表标签
9. TestGetSubTablePreview - 子表数据预览
```

---

## 八、API端点汇总

| 方法 | 端点 | 功能 | 优先级 |
|------|------|------|--------|
| GET | `/api/v1/tdengine/databases` | 获取数据库列表 | ✅ 已有 |
| GET | `/api/v1/tdengine/databases/:database/config` | 获取数据库配置 | P1 |
| PUT | `/api/v1/tdengine/databases/:database/config` | 更新数据库配置 | P1 |
| GET | `/api/v1/tdengine/db/:database/supertables` | 获取超级表列表 | ✅ 已有 |
| GET | `/api/v1/tdengine/db/:database/supertables/:supertable/schema` | 获取Schema | ✅ 已有 |
| GET | `/api/v1/tdengine/db/:database/supertables/:supertable/preview` | 超级表数据预览 | P0 |
| POST | `/api/v1/tdengine/db/:database/supertables/:supertable/columns` | 添加列 | P1 |
| DELETE | `/api/v1/tdengine/db/:database/supertables/:supertable/columns/:column` | 删除列 | P1 |
| GET | `/api/v1/tdengine/db/:database/supertables/:supertable/quality` | 数据质量 | P2 |
| POST | `/api/v1/tdengine/db/:database/supertables/:supertable/quality/analyze` | AI分析 | P2 |
| GET | `/api/v1/tdengine/db/:database/supertables/:supertable/subtables` | 获取子表列表 | P0 |
| GET | `/api/v1/tdengine/db/:database/subtables/:subtable/tags` | 获取标签 | P0 |
| PUT | `/api/v1/tdengine/db/:database/subtables/:subtable/tags` | 更新标签 | P0 |
| GET | `/api/v1/tdengine/db/:database/subtables/:subtable/preview` | 子表数据预览 | P0 |
| POST | `/api/v1/tdengine/query` | SQL查询 | ✅ 已有 |

---

## 九、注意事项

1. **权限控制**：所有数据库操作需要验证用户权限
2. **SQL注入防护**：SQL查询参数需要严格校验
3. **性能优化**：大数据量预览需要分页和限制
4. **错误处理**：提供清晰的错误信息和状态码
5. **AI服务降级**：Gemini服务不可用时提供规则-based分析
