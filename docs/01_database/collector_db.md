# 采集器本地缓存数据库设计 (SQLite)

本文档定义了数据采集器在本地使用的 SQLite 数据库结构。该数据库的核心功能是在网络中断时缓存待上报的数据，以实现存储转发功能。

## 1. 设计原则

*   **轻量级**: 选用 SQLite 是因为它是一个轻量级的文件型数据库，无需额外配置，非常适合资源受限的边缘设备。
*   **高性能写入**: 表结构设计应尽可能简单，以优化写入性能，确保不会因为本地缓存而影响数据采集效率。
*   **易于维护**: 数据库应能自动清理已成功上报的数据。

## 2. 表结构

**表名: data_cache**
| 字段名 | 数据类型 | 约束 | 描述 |
| --- | --- | --- | --- |
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 缓存数据的唯一 ID |
| topic | TEXT | NOT NULL | 数据主题或来源标识 (e.g., a specific MQTT topic or device ID) |
| payload | BLOB | NOT NULL | 待上报的原始数据包 |
| timestamp | INTEGER | NOT NULL | 数据采集时的 Unix 时间戳 (秒或毫秒) |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 数据入库时间 |

### 字段说明

*   `topic`: 用于标识这批数据属于哪个采集点或设备，方便管理和调试。
*   `payload`: 使用 `BLOB` (二进制大对象) 类型来存储原始数据，这样可以无需关心具体的数据格式（JSON, a binary protocol, etc.），直接存储和转发，具有最高的灵活性和效率。
*   `timestamp`: 记录原始数据的时间戳至关重要，确保数据在网络恢复并重新上报后，在 TDengine 中仍能保持正确的时间顺序。
