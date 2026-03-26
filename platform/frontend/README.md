# TDengine Real-time Database Platform

[![React](https://img.shields.io/badge/React-18.x-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-38bdf8)](https://tailwindcss.com/)
[![TDengine](https://img.shields.io/badge/Database-TDengine-00a1ea)](https://www.taosdata.com/)
[![Powered by Gemini](https://img.shields.io/badge/AI-Google%20Gemini-8e75b2)](https://ai.google.dev/)

**TDengine Real-time Platform** 是一个专为工业物联网 (IIoT) 设计的现代化数据管理平台。它基于高性能时序数据库 **TDengine** 构建，集成了数据接入、流式计算、统一查询、元数据管理及智能运维等核心功能。

本项目前端采用 **React + TypeScript + Tailwind CSS** 构建，并深度集成了 **Google Gemini AI**，提供 Text-to-SQL、智能诊断和根因分析能力。

---

## 📸 功能概览 (Features)

### 1. 🔌 数据接入网关 (Data Ingestion)
- **多协议支持**: 管理 MQTT, Kafka, HTTP, Modbus 等多种接入插件。
- **Live Tap (实时抓包)**: 内置类似 Wireshark 的实时报文捕获工具，无需后端日志即可调试设备连接。
- **Schema Mapping**: 可视化配置 JSON 字段到 TDengine 列的映射规则。
- **DLQ 管理**: 死信队列 (Dead Letter Queue) 的查看、修复与重放。

### 2. ⚡ 实时计算引擎 (Stream Computing)
- **Native Streams**: 管理 TDengine 原生流计算任务，支持历史数据回填 (Backfill)。
- **Flink 集成**: 监控 Flink 作业状态，提供 SQL Workbench 编写流处理逻辑。
- **全链路拓扑**: 可视化展示数据从 Source -> Stream -> Aggregation -> Storage 的血缘关系。

### 3. 🔍 统一查询服务 (Unified Query)
- **AI SQL 助手**: 使用自然语言生成 SQL 查询 (Text-to-SQL)。
- **执行计划分析**: 可视化 EXPLAIN 结果，AI 辅助识别慢查询瓶颈。
- **API 发布**: 将常用 SQL 一键发布为 RESTful API。
- **虚拟视图**: 定义跨库关联查询 (Federated Queries)。

### 4. 🧬 元数据管理 (Metadata Center)
- **动态 Schema**: 追踪表结构变更历史，管理 Schema 演进策略。
- **基数分析**: 智能分析 Tag 基数 (Cardinality)，预防高基数导致的内存溢出。
- **生命周期**: 可视化配置数据 TTL 和分级存储策略 (SSD/HDD/S3)。

### 5. 🛡️ 运维管控 (Operations)
- **集群监控**: 实时监控 MNode/DNode 状态、CPU、内存及 WAL 延迟。
- **VGroup 均衡**: 可视化 VGroup 分布热力图，支持模拟负载均衡。
- **慢查询分析**: 基于指纹 (Fingerprint) 的慢查询聚合与归因分析。
- **日志中心**: 集中式日志检索与实时 Tail 功能。

---

## 🛠️ 技术栈 (Tech Stack)

*   **Core Framework**: React 18, TypeScript, Vite
*   **Styling**: Tailwind CSS
*   **Routing**: React Router v6
*   **Visualization**: Recharts (图表), SVG (拓扑图)
*   **Icons**: Lucide React
*   **AI Integration**: Google GenAI SDK (`@google/genai`)

---

## 🚀 快速开始 (Getting Started)

### 前置要求
*   Node.js >= 18.0.0
*   NPM 或 Yarn
*   (可选) Google Gemini API Key 用于 AI 功能

### 安装依赖

```bash
npm install
# 或者
yarn install
```

### 配置环境变量

在项目根目录创建 `.env` 文件（如果需要）：

```env
# 可选：用于开启 AI SQL 生成和智能诊断功能
API_KEY=your_google_gemini_api_key
```

> **注意**: 如果未配置 API Key，系统将使用 Mock 数据或返回静态的模拟分析结果，不影响界面功能的预览。

### 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:5173` 即可查看应用。

---

## 📂 项目结构 (Project Structure)

```
.
├── src/
│   ├── components/    # 通用 UI 组件 (Layout, Sidebar, Charts)
│   ├── pages/         # 核心业务页面
│   │   ├── Ingestion*.tsx   # 接入模块 (Sources, Live Tap, DLQ)
│   │   ├── Computing*.tsx   # 计算模块 (Native, Flink, Topology)
│   │   ├── Query*.tsx       # 查询模块 (Workbench, Reports, API)
│   │   ├── Metadata*.tsx    # 元数据模块 (Schema, Lifecycle)
│   │   └── Operations*.tsx  # 运维模块 (Cluster, Nodes, Logs)
│   ├── services/      # API 服务与 AI 交互逻辑
│   ├── types/         # TypeScript 类型定义
│   └── constants.ts   # Mock 数据与常量配置
├── docs/              # 设计文档与架构图
└── README.md          # 项目说明
```

---

## 🤖 AI 功能说明

本项目深度集成了 LLM 能力，主要体现在：

1.  **SQL Workbench**: 输入自然语言（如"查询过去1小时电压平均值"），自动生成 TDengine SQL。
2.  **慢查询分析**: AI 分析慢查询日志，给出索引优化或数据模型调整建议。
3.  **容量预测**: 基于历史存储数据，使用线性回归+AI 预测磁盘写满时间并给出扩容建议。
4.  **Schema 诊断**: 自动识别高基数 Tag 风险，并给出 Schema 优化方案。

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
