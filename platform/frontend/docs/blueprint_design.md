# 基于 TDengine 的实时数据库平台 - 系统蓝图设计

## 1. 项目概述 (Overview)

本项目旨在构建一个基于 **TDengine** 的高性能工业物联网（IIoT）数据平台。平台集成了数据采集、实时计算、存储、查询分析及运维监控于一体，为海量时序数据提供全生命周期的管理服务。

### 1.1 核心目标
- **高性能写入**：支持千万级设备的高并发数据接入。
- **实时洞察**：毫秒级查询响应，支持流式计算。
- **极简运维**：提供可视化的集群管理与健康诊断。
- **AI 赋能**：利用 LLM (Gemini) 辅助 SQL 生成与系统分析。

---

## 2. 系统架构 (System Architecture)

系统采用分层架构设计，自下而上分别为：设备层、边缘计算层、数据核心层（TDengine）、服务层和应用层。

```mermaid
graph TD
    Device[设备/传感器] --> Gateway[数据接入网关]
    Gateway --> |MQTT/HTTP/TCP| Kafka[消息队列]
    Kafka --> Adapter[数据适配服务]
    Adapter --> TDengine[TDengine 集群]
    
    subgraph Core[核心引擎]
        TDengine --> Stream[实时计算引擎]
        TDengine --> Meta[元数据中心]
    end
    
    subgraph Service[统一服务层]
        Query[统一查询服务]
        Monitor[运维监控服务]
        Eco[生态连接器]
    end
    
    TDengine --> Service
    Service --> Web[前端应用 (TypeScript + Vue3/React)]
```

---

## 3. 核心功能模块 (Core Modules)

### 3.1 数据接入网关 (Data Ingestion Gateway)
负责处理多协议、高并发的设备数据接入。
- **多协议支持**：内置 MQTT, HTTP, TCP, OPC-UA, Modbus 解析器。
- **流量削峰**：集成 Kafka/Pulsar 作为缓冲层，保护后端数据库。
- **状态管理**：实时监控接入点状态（Active/Inactive）及写入速率（Rows/s）。
- **数据清洗**：在入库前进行简单的数据格式化和异常值过滤。

### 3.2 实时计算引擎 (Real-time Computing Engine)
基于 TDengine 的流式计算（Continuous Query）能力，实现数据的实时加工。
- **滑动窗口**：支持基于时间窗口（如每1分钟、每小时）的聚合计算。
- **降采样**：自动将高频原始数据（毫秒级）降采样为分钟级/小时级统计数据。
- **告警触发**：实时监测数据流，满足条件（如温度>80℃）即刻触发告警事件。
- **可视化编排**：提供图形化界面管理流计算任务的启停与状态。

### 3.3 统一查询服务 (Unified Query Service)
提供面向开发人员和数据分析师的一站式查询接口。
- **SQL 工作台**：支持标准 SQL (TAOS SQL) 编写、执行与历史记录管理。
- **AI 辅助 (Gemini)**：
  - **Text-to-SQL**：自然语言转 SQL（例如："查询过去1小时电压平均值"）。
  - **结果解释**：AI 自动分析查询结果数据，提供业务洞察。
- **可视化呈现**：查询结果自动渲染为时序图、柱状图或表格。
- **多维分析**：支持按标签（Tags）进行分组聚合查询。

### 3.4 元数据管理中心 (Metadata Management Center)
管理时序数据的核心模型（Schema）。
- **超级表管理**：可视化创建、修改超级表（Super Table），定义 Schema 和 Tags。
- **子表管理**：查看基于超级表自动创建的子表数量与分布。
- **标签体系**：管理设备静态属性（如：地区、设备型号、固件版本）。
- **容量规划**：展示数据库、表空间的存储占用情况与压缩比。

### 3.5 运维管控平台 (Operations Control Platform)
保障 TDengine 集群的稳定运行。
- **集群概览**：可视化展示 MNode (管理节点) 和 DNode (数据节点) 的拓扑结构。
- **节点监控**：实时监控各节点的 CPU、内存、磁盘 I/O 及网络带宽。
- **健康诊断**：利用 AI 分析集群日志与状态指标，自动识别慢查询、节点离线等风险。
- **配置管理**：动态调整数据库参数（如：keep, wal_level, blocks）。

### 3.6 生态连接器 (Ecosystem Connectors)
打通 TDengine 与第三方系统的连接。
- **数据源集成**：Telegraf, EMQX 集成配置。
- **可视化对接**：Grafana 仪表盘模板一键导出。
- **大数据对接**：Spark Connector, Flink Connector 配置向导。
- **开发工具**：Python/Go/Java SDK 示例代码生成。

---

## 4. 技术栈规划 (Technology Stack)

### 前端 (Frontend)
- **语言**：TypeScript 5.x
- **框架**：Vue 3 (Composition API) 或 React 19 (Hooks) *注：根据团队偏好选择，当前演示代码基于React*
- **构建工具**：Vite
- **UI 组件库**：Tailwind CSS + Headless UI / Element Plus
- **可视化**：ECharts 或 Recharts
- **图标库**：Lucide React/Vue

### 后端 (Backend - 模拟/规划)
- **API 服务**：Golang (Gin) 或 Node.js (NestJS)
- **数据库驱动**：`taos-driver` (WebSocket/REST)
- **AI 模型**：Google Gemini 2.5/3.0 (用于 SQL 生成与分析)

---

## 5. 开发路线图 (Roadmap)

- **Phase 1: 基础框架搭建** (当前阶段)
  - 完成前端 UI 布局与导航。
  - 实现基于 Mock 数据的仪表盘展示。
  - 集成 Gemini API 实现基础的 AI SQL 生成。

- **Phase 2: 数据交互实现**
  - 对接 TDengine WebSocket 接口，实现真实数据查询。
  - 开发超级表元数据管理功能。
  - 实现流计算规则的增删改查 (CRUD)。

- **Phase 3: 高级功能与运维**
  - 集群监控大屏开发。
  - 完善数据接入网关配置界面。
  - 增加用户权限管理 (RBAC)。
