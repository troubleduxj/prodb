# 数据库管理平台数据库设计 (PostgreSQL)

本文档详细定义了 ProDB 数据库管理平台所使用的 PostgreSQL 数据库结构。该数据库主要负责存储平台的业务元数据。

## 1. ER 图

[此处应包含以下所有表格的实体关系图。]

## 2. 表结构

### 2.1 用户与权限模块 (RBAC)

本模块在标准 RBAC 模型基础上进行了细化，增加了权限分组、用户状态等特性，以满足更复杂的管理需求。

**表名: users**
| 字段名 | 数据类型 | 约束 | 描述 |
| --- | --- | --- | --- |
| id | SERIAL | PRIMARY KEY | 用户 ID |
| username | VARCHAR(50) | NOT NULL, UNIQUE | 登录用户名 |
| password_hash | VARCHAR(255) | NOT NULL | 加密后的密码 |
| full_name | VARCHAR(100) | | 用户全名/昵称 |
| email | VARCHAR(100) | UNIQUE | 电子邮箱 |
| avatar_url | VARCHAR(255) | | 用户头像地址 |
| status | SMALLINT | NOT NULL, DEFAULT 1 | 用户状态 (1: 正常, 2: 禁用) |
| last_login_at | TIMESTAMP | | 最后登录时间 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**表名: roles**
| 字段名 | 数据类型 | 约束 | 描述 |
| --- | --- | --- | --- |
| id | SERIAL | PRIMARY KEY | 角色 ID |
| name | VARCHAR(50) | NOT NULL, UNIQUE | 角色名称 (e.g., admin) |
| description | VARCHAR(255) | | 角色描述 |
| status | SMALLINT | NOT NULL, DEFAULT 1 | 角色状态 (1: 启用, 2: 禁用) |

**表名: permission_groups**
| 字段名 | 数据类型 | 约束 | 描述 |
| --- | --- | --- | --- |
| id | SERIAL | PRIMARY KEY | 权限分组 ID |
| name | VARCHAR(50) | NOT NULL, UNIQUE | 分组名称 (e.g., 采集器管理) |
| sort_order | INT | DEFAULT 0 | 排序字段 |

**表名: permissions**
| 字段名 | 数据类型 | 约束 | 描述 |
| --- | --- | --- | --- |
| id | SERIAL | PRIMARY KEY | 权限 ID |
| group_id | INT | FOREIGN KEY (permission_groups.id) | 所属权限分组 ID |
| name | VARCHAR(100) | NOT NULL, UNIQUE | 权限标识 (e.g., collector:create) |
| description | VARCHAR(255) | | 权限描述 |
| type | SMALLINT | NOT NULL, DEFAULT 1 | 权限类型 (1: 菜单, 2: 按钮/API) |

**表名: user_roles (多对多关联)**
| 字段名 | 数据类型 | 约束 | 描述 |
| --- | --- | --- | --- |
| user_id | INT | FOREIGN KEY (users.id) ON DELETE CASCADE | 用户 ID |
| role_id | INT | FOREIGN KEY (roles.id) ON DELETE CASCADE | 角色 ID |
| PRIMARY KEY (user_id, role_id) | | | 联合主键 |

**表名: role_permissions (多对多关联)**
| 字段名 | 数据类型 | 约束 | 描述 |
| --- | --- | --- | --- |
| role_id | INT | FOREIGN KEY (roles.id) ON DELETE CASCADE | 角色 ID |
| permission_id | INT | FOREIGN KEY (permissions.id) ON DELETE CASCADE | 权限 ID |
| PRIMARY KEY (role_id, permission_id) | | | 联合主键 |

### 2.2 采集器管理模块

**表名: collectors**
| 字段名 | 数据类型 | 约束 | 描述 |
| --- | --- | --- | --- |
| id | UUID | PRIMARY KEY | 采集器唯一标识 (Collector-ID) |
| name | VARCHAR(100) | NOT NULL | 采集器名称 |
| secret_key | VARCHAR(255) | NOT NULL | 用于认证的密钥 |
| status | VARCHAR(20) | DEFAULT 'offline' | 状态 (online, offline, error) |
| last_heartbeat | TIMESTAMP | | 最后心跳时间 |
| config_json | JSONB | | 下发给采集器的配置 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 注册时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新时间 |
