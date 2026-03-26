# 日志管理系统设计方案

## 1. 概述

随着采集器和数据库管理平台的功能日趋复杂，对系统产生的日志进行有效管理变得至关重要。一个健全的日志系统不仅能帮助开发人员快速定位和解决问题，还能为系统运维提供状态监控、性能分析和安全审计的依据。

本文档旨在设计一个集中式、可扩展、易于查询的日志管理方案，以满足项目当前和未来的需求。

## 2. 设计目标

- **集中收集**：能够从所有分布式组件（采集器实例、平台后端服务）自动收集日志。
- **结构化日志**：日志应采用结构化格式（如 JSON），方便机器解析和查询。
- **高效存储与索引**：能够经济高效地存储大量日志数据，并提供快速的查询能力。
- **实时查询与分析**：提供一个用户友好的界面，支持对日志进行实时搜索、过滤、聚合和可视化。
- **可扩展性**：方案应具备良好的水平扩展能力，以应对未来日志量的增长。
- **低侵入性**：对现有应用代码的侵入性应尽可能小。

## 3. 方案选型：Grafana Loki 技术栈

经过对多种方案（如传统的 ELK/EFK、基于数据库存储、云服务等）的评估，我们推荐采用 **Grafana Loki** 技术栈作为本项目的日志管理解决方案。

**核心组件:**

1.  **Loki**: 日志聚合系统。负责存储日志流并处理查询。
2.  **Promtail**: 日志收集代理。负责发现目标、附加标签（元数据）并将日志流推送给 Loki。
3.  **Grafana**: 可视化平台。负责查询和展示日志，并与系统监控指标（如 Prometheus）集成。

**选择 Loki 的主要优势:**

- **轻量级与高性价比**：Loki 的核心设计哲学是**只对元数据（标签）建立索引，而不是对完整的日志内容**。这使得它的索引体积非常小，存储成本远低于 Elasticsearch 等全文索引方案，同时保持了极快的查询速度（基于标签过滤）。
- **与监控生态无缝集成**：Loki 是 Grafana Labs 的核心产品之一，与 Grafana 和 Prometheus 监控系统天然集成。可以在同一个 Grafana 仪表盘中无缝切换和关联应用的 Metrics（指标）、Logs（日志）和 Traces（追踪），形成强大的可观测性闭环。
- **易于部署和运维**：相比于 ELK 庞大的组件体系，Loki + Promtail 的架构非常简洁，资源消耗小，运维复杂度低。
- **强大的查询语言 (LogQL)**：LogQL 是一种受 PromQL 启发的查询语言，允许用户通过标签过滤日志流，并能从日志内容中提取指标进行计算，功能强大且灵活。

## 4. 架构设计

![Loki Architecture](https://grafana.com/docs/loki/latest/fundamentals/architecture/architecture.png)
*(图片来源: Grafana Loki 官方文档)*

1.  **应用层 (采集器 & 平台后端)**:
    - 各个应用服务使用标准日志库（如 Go 的 `logrus`, `zap`）将日志以 **JSON 格式**输出到标准输出（`stdout`）或本地日志文件。
    - **推荐**：输出到 `stdout`，以便于容器化部署（如 Docker, Kubernetes）环境下的日志收集。

2.  **收集层 (Promtail)**:
    - 在运行应用服务的每台主机或容器中，部署一个 `Promtail` 代理。
    - `Promtail` 配置服务发现机制（如基于文件、Docker API、Kubernetes API），自动发现需要收集日志的应用。
    - `Promtail` 会“跟踪”日志输出，为每个日志流附加一组关键的**标签**（元数据），例如：
        - `service="platform-backend"`
        - `instance="host-1:8080"`
        - `level="error"`
        - `collector_id="uuid-of-collector"` (对于采集器日志)
    - `Promtail` 将带有标签的日志流通过 HTTP/2 (gRPC) 推送给 Loki。

3.  **存储与查询层 (Loki)**:
    - Loki 接收到日志流后，会将标签和日志内容分开处理。
    - **索引 (Index)**: Loki 将标签（如 `service`, `level`）存储在一个高效的键值存储中（如 BoltDB 或云存储的索引服务）。
    - **块 (Chunks)**: Loki 将原始的日志内容压缩后，存储在对象存储（如本地文件系统、S3、GCS）的“块”中。
    - 当收到查询请求时，Loki 首先通过索引快速找到匹配标签的日志块，然后再在这些块内部对日志内容进行 `grep` 风格的搜索。

4.  **展示层 (Grafana)**:
    - 在 Grafana 中添加 Loki 作为数据源。
    - 用户通过 Grafana 的 `Explore` 界面，使用 LogQL 查询语言进行交互式日志查询。
    - 可以创建专门的日志仪表盘，将常用的查询结果以图表、列表等形式固定下来，用于日常监控。

## 5. 日志规范

为了充分利用此架构，所有应用都应遵循统一的日志格式。

**推荐的 JSON 日志结构:**

```json
{
  "ts": "2025-09-05T10:30:00.123Z", // 时间戳 (Timestamp)
  "level": "info",                   // 日志级别 (Level)
  "service": "collector",            // 服务名称 (Service Name)
  "caller": "main.go:150",           // 代码位置 (Caller)
  "msg": "Successfully connected to TDengine", // 日志消息 (Message)
  "collector_id": "a1b2c3d4-...",   // 采集器ID (Contextual Info)
  "task_id": "task-5678",            // 任务ID (Contextual Info)
  "duration_ms": 120                 // 操作耗时 (Metrics in logs)
}
```

- **关键字段 (`ts`, `level`, `service`, `msg`)** 必须存在。
- `level` 和 `service` 等字段非常适合作为 Promtail 的**标签**，用于高效过滤。
- 其他业务相关的上下文信息（如 `collector_id`, `task_id`）可以作为日志内容的一部分，通过 LogQL 在查询时进行过滤或提取。

## 6. 实施建议

1.  **部署 Loki & Grafana**: 使用 Docker Compose 或 Kubernetes Helm 在服务器上快速部署 Loki 和 Grafana 实例。
2.  **配置 Promtail**: 为平台后端和采集器分别编写 `promtail-config.yaml` 配置文件，定义服务发现和日志标签规则。
3.  **改造应用日志输出**: 统一应用中的日志库，配置其输出为上述规范的 JSON 格式。
4.  **在 Grafana 中配置数据源**: 将 Loki 添加为 Grafana 的数据源，并开始探索日志。
5.  **创建仪表盘**: 为关键服务创建日志监控仪表盘，例如，一个专门展示所有 `level="error"` 日志的面板。
