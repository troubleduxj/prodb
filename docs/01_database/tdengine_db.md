# TDengine 数据库设计

本文档描述了用于存储 ProDB 项目采集数据的 TDengine 数据库设计方案。TDengine 的核心是其“一个采集点一张表”的设计理念，我们将通过超级表（STable）来实现这一模式。

## 1. 设计原则

*   **超级表 (STable)**: 为每一种类型的采集设备或数据源创建一个超级表。超级表定义了该类型设备所有采集点的公共指标（Schema）。
*   **标签 (Tags)**: 使用标签来区分和描述每个具体的采集点（子表）。标签是静态的元数据，如设备 ID、地理位置、设备型号等。
*   **子表 (Sub-table)**: 每个具体的采集设备（例如，一个特定的温度传感器）都对应一张由超级表创建的子表。子表的名称通常由设备唯一标识符（如 `device_id`）来命名。

这种设计模式充分利用了 TDengine 的优势，能够极大地提升查询性能和数据压缩率。

## 2. 超级表示例

假设我们需要采集两种设备的数据：环境监测传感器和电力监测仪。

### 2.1 环境监测超级表

*   **超级表名称**: `env_sensors`
*   **用途**: 存储所有环境监测传感器（如温湿度、光照传感器）的数据。

**表结构 (SQL)**:
```sql
CREATE STABLE env_sensors (
    ts TIMESTAMP,
    temperature FLOAT,
    humidity FLOAT,
    illuminance FLOAT
)
TAGS (
    device_id VARCHAR(100),
    location VARCHAR(100),
    group_id INT
);
```

*   **字段 (Metrics)**:
    *   `ts`: 时间戳，必需字段。
    *   `temperature`: 温度。
    *   `humidity`: 湿度。
    *   `illuminance`: 光照强度。
*   **标签 (Tags)**:
    *   `device_id`: 设备的唯一 ID。
    *   `location`: 设备的物理位置。
    *   `group_id`: 设备所属的分组 ID。

### 2.2 电力监测超级表

*   **超级表名称**: `power_meters`
*   **用途**: 存储所有电力监测仪的数据。

**表结构 (SQL)**:
```sql
CREATE STABLE power_meters (
    ts TIMESTAMP,
    voltage FLOAT,
    current FLOAT,
    power FLOAT,
    frequency FLOAT
)
TAGS (
    meter_id VARCHAR(100),
    phase VARCHAR(10),
    building_id INT
);
```

*   **字段 (Metrics)**:
    *   `ts`: 时间戳。
    *   `voltage`: 电压。
    *   `current`: 电流。
    *   `power`: 功率。
    *   `frequency`: 频率。
*   **标签 (Tags)**:
    *   `meter_id`: 电表的唯一 ID。
    *   `phase`: 相线（如 A, B, C）。
    *   `building_id`: 所属建筑物的 ID。

## 3. 数据写入流程

当一个采集器需要为一个新的设备（例如 `device_id` 为 `sensor_001`）上报数据时，它会执行类似以下的 SQL 语句来自动创建子表并写入数据：

```sql
INSERT INTO sensor_001
USING env_sensors TAGS ('sensor_001', '-70.9,42.3', 1)
VALUES (NOW, 25.5, 60.2, 1200.0);
```

TDengine 会自动使用 `sensor_001` 作为子表名，并利用 `USING...TAGS...` 子句为该子表设置标签。
