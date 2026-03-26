# Configuration Template Management System

This document describes the implementation of the configuration template management system for the ProDB platform.

## Overview

The configuration template management system allows users to create, manage, and apply reusable configuration templates for data collection tasks. This system supports:

- Template CRUD operations with version management
- Parameter substitution for flexible template application
- Template validation based on protocol requirements
- Import/export functionality for template sharing
- Batch application to multiple collectors

## Architecture

### Core Components

1. **ConfigTemplate Model**: Stores template metadata and configuration
2. **ConfigTemplateVersion Model**: Maintains version history for templates
3. **CollectionTask Model**: Links applied templates to collectors
4. **ConfigTemplateService**: Business logic for template operations
5. **ConfigTemplateHandler**: REST API endpoints

### Database Schema

```sql
-- Configuration templates
CREATE TABLE config_templates (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    protocol VARCHAR(50) NOT NULL,
    template_config JSONB NOT NULL,
    version VARCHAR(20) DEFAULT '1.0.0',
    created_by INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    tags JSONB,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Template version history
CREATE TABLE config_template_versions (
    id UUID PRIMARY KEY,
    template_id UUID NOT NULL,
    version VARCHAR(20) NOT NULL,
    config JSONB NOT NULL,
    change_log TEXT,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP
);

-- Collection tasks (applied templates)
CREATE TABLE collection_tasks (
    id UUID PRIMARY KEY,
    collector_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    protocol VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    enabled BOOLEAN DEFAULT true,
    template_id UUID,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

## API Endpoints

### Template Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/templates` | List templates with pagination and filtering |
| POST | `/api/v1/templates` | Create a new template |
| GET | `/api/v1/templates/{id}` | Get template by ID |
| PUT | `/api/v1/templates/{id}` | Update template |
| DELETE | `/api/v1/templates/{id}` | Delete template (soft delete) |

### Version Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/templates/{id}/versions` | Get template version history |

### Template Application

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/templates/apply` | Apply template to collectors |
| POST | `/api/v1/templates/batch-apply` | Batch apply with different parameters |

### Import/Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/templates/{id}/export` | Export template to JSON |
| POST | `/api/v1/templates/import` | Import template from JSON |

### Validation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/templates/validate` | Validate template configuration |

## Template Structure

### Basic Template Format

```json
{
  "name": "Template Name",
  "description": "Template description",
  "protocol": "modbus_tcp|opcua|mqtt",
  "template_config": {
    // Protocol-specific configuration with parameters
  },
  "version": "1.0.0",
  "tags": ["tag1", "tag2"]
}
```

### Parameter Substitution

Templates support parameter placeholders using the `{{parameter_name}}` syntax:

```json
{
  "connection": {
    "host": "{{host}}",
    "port": "{{port}}",
    "timeout": 5000
  },
  "data_points": [
    {
      "name": "{{point_name}}",
      "address": "{{address}}",
      "data_type": "{{data_type}}"
    }
  ]
}
```

When applying the template, parameters are provided:

```json
{
  "template_id": "uuid",
  "collector_ids": ["collector-uuid"],
  "parameters": {
    "host": "192.168.1.100",
    "port": 502,
    "point_name": "temperature",
    "address": "40001",
    "data_type": "float32"
  },
  "task_name": "Temperature Monitoring"
}
```

## Protocol-Specific Templates

### Modbus TCP Template

```json
{
  "name": "Standard Modbus TCP Template",
  "protocol": "modbus_tcp",
  "template_config": {
    "connection": {
      "host": "{{host}}",
      "port": 502,
      "slave_id": 1,
      "timeout": 3000
    },
    "schedule": {
      "interval": 5,
      "unit": "seconds"
    },
    "data_points": [
      {
        "name": "{{point_name}}",
        "address": "{{address}}",
        "data_type": "{{data_type}}",
        "scale": 1.0,
        "unit": "{{unit}}"
      }
    ],
    "target": {
      "database": "industrial_data",
      "super_table": "modbus_metrics",
      "tags": {
        "location": "{{location}}",
        "device_type": "plc"
      }
    }
  }
}
```

### OPC-UA Template

```json
{
  "name": "Standard OPC-UA Template",
  "protocol": "opcua",
  "template_config": {
    "server_url": "{{server_url}}",
    "security_mode": "{{security_mode}}",
    "security_policy": "{{security_policy}}",
    "authentication": {
      "type": "{{auth_type}}",
      "username": "{{username}}",
      "password": "{{password}}"
    },
    "subscription": {
      "publishing_interval": 1000,
      "max_notifications": 0
    },
    "data_points": [
      {
        "node_id": "{{node_id}}",
        "name": "{{point_name}}",
        "sampling_interval": 1000
      }
    ],
    "target": {
      "database": "industrial_data",
      "super_table": "opcua_metrics",
      "tags": {
        "server": "{{server_name}}",
        "location": "{{location}}"
      }
    }
  }
}
```

### MQTT Template

```json
{
  "name": "Standard MQTT Template",
  "protocol": "mqtt",
  "template_config": {
    "broker_url": "{{broker_url}}",
    "client_id": "{{client_id}}",
    "username": "{{username}}",
    "password": "{{password}}",
    "qos": 1,
    "clean_session": true,
    "topics": [
      {
        "topic": "{{topic}}",
        "qos": 1,
        "data_format": "json",
        "field_mapping": {
          "timestamp": "{{timestamp_field}}",
          "value": "{{value_field}}"
        }
      }
    ],
    "target": {
      "database": "industrial_data",
      "super_table": "mqtt_metrics",
      "tags": {
        "broker": "{{broker_name}}",
        "location": "{{location}}"
      }
    }
  }
}
```

## Validation Rules

### Modbus Validation

- `connection.host` is required
- `connection.port` is required
- Each data point must have `address` and `data_type`

### OPC-UA Validation

- `server_url` is required
- Each data point must have `node_id`

### MQTT Validation

- `broker_url` is required
- Each topic must have `topic` field

## Version Management

The system automatically manages template versions:

1. **Initial Creation**: Version starts at 1.0.0
2. **Configuration Changes**: Patch version increments (1.0.0 → 1.0.1)
3. **Version History**: All versions are preserved in `config_template_versions`
4. **Change Logs**: Optional change descriptions for each version

## Usage Examples

### Creating a Template

```bash
curl -X POST http://localhost:8088/api/v1/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Factory A Modbus Template",
    "description": "Standard template for Factory A PLCs",
    "protocol": "modbus_tcp",
    "template_config": {
      "connection": {
        "host": "{{host}}",
        "port": 502,
        "slave_id": 1
      },
      "data_points": [
        {
          "name": "{{point_name}}",
          "address": "{{address}}",
          "data_type": "float32"
        }
      ]
    },
    "tags": ["factory-a", "plc", "modbus"]
  }'
```

### Applying a Template

```bash
curl -X POST http://localhost:8088/api/v1/templates/apply \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "template-uuid",
    "collector_ids": ["collector-uuid-1", "collector-uuid-2"],
    "parameters": {
      "host": "192.168.1.100",
      "point_name": "temperature",
      "address": "40001"
    },
    "task_name": "Temperature Monitoring"
  }'
```

### Batch Application

```bash
curl -X POST http://localhost:8088/api/v1/templates/batch-apply \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "template-uuid",
    "applications": [
      {
        "collector_id": "collector-1",
        "task_name": "Line 1 Temperature",
        "parameters": {
          "host": "192.168.1.100",
          "point_name": "line1_temp",
          "address": "40001"
        }
      },
      {
        "collector_id": "collector-2",
        "task_name": "Line 2 Temperature",
        "parameters": {
          "host": "192.168.1.101",
          "point_name": "line2_temp",
          "address": "40001"
        }
      }
    ]
  }'
```

## Error Handling

The system provides comprehensive error handling:

- **Validation Errors**: Invalid configuration format or missing required fields
- **Not Found Errors**: Template or collector not found
- **Conflict Errors**: Cannot delete template in use
- **Parameter Errors**: Missing or invalid parameters during application

## Security Considerations

- Templates are associated with users for access control
- Sensitive information should not be stored in templates (use parameters instead)
- Template application requires appropriate permissions
- Version history maintains audit trail

## Performance Considerations

- Templates are cached for frequently used configurations
- Batch operations are optimized for multiple collector applications
- Database queries use appropriate indexes for filtering and pagination
- Large template configurations are handled efficiently with JSONB storage

## Testing

The implementation includes comprehensive tests covering:

- Template CRUD operations
- Validation for all supported protocols
- Parameter substitution
- Version management
- Import/export functionality
- Error conditions and edge cases

Run tests with:

```bash
go test ./services -v
```

## Future Enhancements

Potential future improvements:

1. **Template Categories**: Organize templates by industry or use case
2. **Template Inheritance**: Allow templates to extend other templates
3. **Advanced Validation**: Custom validation rules per template
4. **Template Marketplace**: Share templates across organizations
5. **Visual Template Builder**: GUI for creating templates
6. **Template Analytics**: Usage statistics and performance metrics