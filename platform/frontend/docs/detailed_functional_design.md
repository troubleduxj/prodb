### 3.5 运维管控平台 (Operations & Tenancy)

本模块作为平台的“控制塔”，不仅关注底层基础设施的健康，还负责多租户资源隔离与数据资产的行政管理。

#### 3.5.1 集群核心管理 (Cluster Core)
*   **节点全景监控**:
    *   **节点状态**: 实时展示 MNode (管理节点)、DNode (数据节点)、QNode (计算节点) 的在线状态 (`Ready`, `Offline`, `Syncing`)。
    *   **资源负载**: 可视化各节点的 CPU (核心绑定情况)、内存 (VNode Buffer 占用)、磁盘 I/O (WAL fsync 延迟)。
*   **高可用与副本管理**:
    *   **VGroup (虚拟组) 视图**: 监控虚拟组的健康状态，展示 Master/Slave 副本分布。若发生 Leader 切换或副本丢失，立即预警。
    *   **负载均衡 (Rebalancing)**: 监测节点间的数据倾斜（VNode 数量差异），支持自动或手动触发 VNode 迁移，实现集群扩缩容后的数据重平衡。
*   **配置中心**:
    *   **参数热加载**: 可视化管理 `taos.cfg`，支持对 `walLevel`, `minRows`, `blocks` 等参数的批量下发与热更新（无需重启节点）。

#### 3.5.2 数据资产运维 (Data Ops)
*   **数据浏览器 (Data Explorer)**:
    *   **无代码浏览**: 提供类似 Navicat 的界面，树状展示 `Database -> SuperTable -> SubTable` 结构。
    *   **快速预览**: 支持对超级表进行 Sampling (采样) 预览，快速检查最新 100 条数据或数据质量。
*   **管理端 SQL 控制台**:
    *   **增强编辑器**: 集成 Monaco Editor，支持 TAOS SQL 关键字高亮、智能补全（表名/字段名联想）。
    *   **DDL 专属模式**: 针对 `CREATE`, `ALTER`, `DROP` 等危险操作增加“二次确认”与“模拟执行”检查。

#### 3.5.3 多租户管理 (Multi-Tenancy)
基于“逻辑隔离”策略，实现多租户共用一套物理集群。
*   **租户模型**: 
    *   **租户 (Tenant)**: 映射为 TDengine 中的独立 `Database`。
    *   **资源配额 (Quotas)**: 
        *   **存储配额**: 限制该租户数据库的最大磁盘占用（如 500GB）。
        *   **连接数限制**: 限制该租户的最大并发连接数。
        *   **表数量限制**: 限制允许创建的子表上限。
*   **权限隔离**:
    *   通过 TDengine 的 `GRANT` 机制，为租户管理员分配仅限于其 Database 的读写权限，严格禁止跨库访问。

#### 3.5.4 智能监控与告警 (Observability & Alerting)
*   **关键指标监控**:
    *   **写入侧**: 监控 `wal_fsync_delay` (WAL 落盘延迟，核心性能瓶颈)、`points_written_per_sec` (写入点数)。
    *   **查询侧**: 监控慢查询 (Slow Queries)，捕获执行时间超过阈值（如 1s）的 SQL。
    *   **存储侧**: 监控磁盘使用率（分级存储：Level 1 SSD / Level 2 HDD），预测磁盘写满时间。
*   **告警规则引擎**:
    *   支持定义复合告警规则，例如：`磁盘使用率 > 85%` 且 `写入速率 > 10k/s` 持续 5 分钟。
    *   **通知渠道**: Webhook, Email, Slack, DingTalk, SMS。

#### 3.5.5 容灾与备份
*   **快照备份**: 集成 `taosdump` 工具，支持按 Database 或 SuperTable 级别进行定时全量/增量备份。
*   **导入导出**: 提供 CSV/SQL 文件的批量导入导出向导，支持断点续传。

---

### 3.6 生态连接器 (Ecosystem)

*   **Grafana 集成**: 一键生成并导出 Grafana Dashboard JSON 模板。
*   **应用开发支持**: 提供 Python/Java/Go/Node.js 连接示例代码生成器。
*   **第三方数据源**: 配置 Telegraf、EMQX 等常用组件的连接参数。

---

### 3.7 安全与审计 (Security & Audit)

*   **审计日志 (Audit Log)**: 
    *   记录所有 DDL 操作（Schema 变更）、DCL 操作（权限变更）的操作人、IP、时间及具体 SQL。
*   **访问控制**: 
    *   实现基于角色的访问控制 (RBAC)，预置 `SuperAdmin`, `TenantAdmin`, `DataAnalyst`, `DeviceReadonly` 等角色。