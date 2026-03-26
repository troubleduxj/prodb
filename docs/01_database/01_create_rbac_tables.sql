-- ProDB Manager RBAC and User Management Tables
-- Designed for PostgreSQL

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for permission groups to categorize permissions in the UI
CREATE TABLE permission_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    sort_order INT DEFAULT 0
);

-- Table for individual permissions
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    group_id INT REFERENCES permission_groups(id),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    type SMALLINT NOT NULL DEFAULT 1 -- 1: Menu, 2: Button/API
);

-- Table for roles
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    status SMALLINT NOT NULL DEFAULT 1 -- 1: Enabled, 2: Disabled
);

-- Many-to-many relationship between roles and permissions
CREATE TABLE role_permissions (
    role_id INT REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Table for users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    avatar_url VARCHAR(255),
    status SMALLINT NOT NULL DEFAULT 1, -- 1: Active, 2: Disabled
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Many-to-many relationship between users and roles
CREATE TABLE user_roles (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    role_id INT REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- Table for collectors
CREATE TABLE collectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    secret_key VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'offline',
    last_heartbeat TIMESTAMPTZ,
    config_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add some comments for clarity
COMMENT ON TABLE permission_groups IS '权限分组，用于UI展示';
COMMENT ON TABLE permissions IS '具体权限点';
COMMENT ON TABLE roles IS '用户角色';
COMMENT ON TABLE users IS '系统用户';
COMMENT ON TABLE collectors IS '数据采集器信息';

-- You can add default data if needed, for example, a default admin role and user.
INSERT INTO roles (id, name, description) VALUES (1, 'Superadmin', 'System Super Administrator');
INSERT INTO roles (id, name, description) VALUES (2, 'Admin', 'System Administrator');
INSERT INTO roles (id, name, description) VALUES (3, 'Manager', 'Manager');
INSERT INTO roles (id, name, description) VALUES (4, 'Cashier', 'Cashier');
