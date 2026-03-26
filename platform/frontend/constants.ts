import { NodeStatus, DataSource, SuperTable, Plugin } from './types';

export const MOCK_NODES: NodeStatus[] = [
  { id: 1, ip: '192.168.1.101', role: 'MNODE', status: 'Ready', cpu: 12, memory: 45 },
  { id: 2, ip: '192.168.1.102', role: 'DNODE', status: 'Ready', cpu: 65, memory: 78 },
  { id: 3, ip: '192.168.1.103', role: 'DNODE', status: 'Syncing', cpu: 88, memory: 60 },
  { id: 4, ip: '192.168.1.104', role: 'DNODE', status: 'Ready', cpu: 24, memory: 32 },
];

export const MOCK_PLUGINS: Plugin[] = [
  {
    id: 'mqtt-v1',
    name: 'MQTT Broker',
    version: '1.2.0',
    description: 'Connect to standard MQTT 3.1/5.0 brokers. Supports full TLS/SSL and QoS.',
    icon: 'Network',
    status: 'Installed',
    schema: [
      { name: 'brokerUrl', label: 'Broker URL', type: 'text', required: true, defaultValue: 'tcp://localhost:1883', description: 'Protocol can be tcp://, ssl://, or ws://' },
      { name: 'clientId', label: 'Client ID', type: 'text', required: false, defaultValue: 'tdengine-client', description: 'Unique identifier for the client' },
      { name: 'topic', label: 'Topic Subscription', type: 'text', required: true, defaultValue: 'sensors/#', description: 'Supports standard MQTT wildcards (+, #)' },
      { name: 'qos', label: 'QoS Level', type: 'select', options: ['0', '1', '2'], defaultValue: '1' },
      { name: 'username', label: 'Username', type: 'text', required: false },
      { name: 'password', label: 'Password', type: 'password', required: false },
      { name: 'dataFormat', label: 'Payload Format', type: 'select', options: ['JSON', 'InfluxDB Line Protocol', 'Telnet'], defaultValue: 'JSON', description: 'Format of the message payload' },
      { name: 'tlsCaCert', label: 'TLS CA Certificate (PEM)', type: 'textarea', required: false, description: 'Paste CA certificate content for SSL/TLS connections' },
    ]
  },
  {
    id: 'kafka-v1',
    name: 'Apache Kafka',
    version: '2.1.0',
    description: 'High-throughput consumer for Kafka/Redpanda clusters.',
    icon: 'Share2',
    status: 'Installed',
    schema: [
      { name: 'bootstrapServers', label: 'Bootstrap Servers', type: 'text', required: true, defaultValue: 'localhost:9092' },
      { name: 'topic', label: 'Topic Name', type: 'text', required: true, defaultValue: 'iot-metrics' },
      { name: 'groupId', label: 'Consumer Group ID', type: 'text', required: true, defaultValue: 'tdengine-group' },
      { name: 'autoOffsetReset', label: 'Auto Offset Reset', type: 'select', options: ['earliest', 'latest'], defaultValue: 'latest' },
      { name: 'securityProtocol', label: 'Security Protocol', type: 'select', options: ['PLAINTEXT', 'SSL', 'SASL_PLAINTEXT', 'SASL_SSL'], defaultValue: 'PLAINTEXT' },
      { name: 'saslMechanism', label: 'SASL Mechanism', type: 'select', options: ['PLAIN', 'SCRAM-SHA-256', 'SCRAM-SHA-512'], defaultValue: 'PLAIN' },
      { name: 'saslUsername', label: 'SASL Username', type: 'text', required: false },
      { name: 'saslPassword', label: 'SASL Password', type: 'password', required: false },
    ]
  },
  {
    id: 'http-v1',
    name: 'HTTP Webhook',
    version: '1.0.0',
    description: 'Passive receiver for HTTP/HTTPS POST requests.',
    icon: 'Globe',
    status: 'Installed',
    schema: [
      { name: 'port', label: 'Listen Port', type: 'number', required: true, defaultValue: 8080 },
      { name: 'endpoint', label: 'Endpoint Path', type: 'text', required: true, defaultValue: '/api/data' },
      { name: 'enableSsl', label: 'Enable SSL/TLS', type: 'boolean', defaultValue: false },
      { name: 'authType', label: 'Auth Type', type: 'select', options: ['None', 'Basic', 'Bearer'], defaultValue: 'None' },
      { name: 'authToken', label: 'Auth Token/Secret', type: 'password', required: false },
      { name: 'bufferSize', label: 'Buffer Size', type: 'number', defaultValue: 10000, description: 'Internal queue size before blocking' },
    ]
  },
   {
    id: 'opcua-v1',
    name: 'OPC UA Client',
    version: '0.9.5',
    description: 'Industrial automation protocol for PLCs (Siemens, Allen-Bradley, etc.).',
    icon: 'Factory',
    status: 'Available',
    schema: [
       { name: 'endpointUrl', label: 'Endpoint URL', type: 'text', required: true, defaultValue: 'opc.tcp://localhost:4840' },
       { name: 'securityPolicy', label: 'Security Policy', type: 'select', options: ['None', 'Basic256', 'Basic256Sha256', 'Aes128_Sha256_RsaOaep'], defaultValue: 'None' },
       { name: 'securityMode', label: 'Security Mode', type: 'select', options: ['None', 'Sign', 'SignAndEncrypt'], defaultValue: 'None' },
       { name: 'authType', label: 'Authentication', type: 'select', options: ['Anonymous', 'UserName'], defaultValue: 'Anonymous' },
       { name: 'username', label: 'Username', type: 'text', required: false },
       { name: 'password', label: 'Password', type: 'password', required: false },
       { name: 'nodeList', label: 'Node IDs (JSON)', type: 'textarea', required: true, defaultValue: '[\n  "ns=2;s=Machine1.Speed",\n  "ns=2;s=Machine1.Temperature"\n]', description: 'List of NodeIDs to subscribe to' },
    ]
  },
   {
    id: 'modbus-tcp-v1',
    name: 'Modbus TCP',
    version: '1.0.1',
    description: 'Poll data from Modbus TCP slaves/servers.',
    icon: 'Cpu',
    status: 'Available',
    schema: [
       { name: 'host', label: 'Device IP', type: 'text', required: true },
       { name: 'port', label: 'Port', type: 'number', required: true, defaultValue: 502 },
       { name: 'slaveId', label: 'Slave ID', type: 'number', required: true, defaultValue: 1 },
       { name: 'timeout', label: 'Timeout (ms)', type: 'number', required: true, defaultValue: 1000 },
       { name: 'pollInterval', label: 'Poll Interval (ms)', type: 'number', required: true, defaultValue: 1000 },
       { name: 'registerMap', label: 'Register Map (JSON)', type: 'textarea', required: true, defaultValue: '{\n  "measurements": [\n    {"name": "voltage", "address": 0, "type": "FLOAT32", "count": 2},\n    {"name": "current", "address": 2, "type": "FLOAT32", "count": 2}\n  ]\n}', description: 'Mapping of registers to TDengine columns' },
    ]
  },
  {
    id: 'coap-v1',
    name: 'CoAP Server',
    version: '0.8.0',
    description: 'Constrained Application Protocol (UDP) for low-power IoT devices.',
    icon: 'Radio',
    status: 'Available',
    schema: [
       { name: 'port', label: 'UDP Port', type: 'number', required: true, defaultValue: 5683 },
       { name: 'dtlsEnabled', label: 'Enable DTLS', type: 'boolean', defaultValue: false },
       { name: 'resourcePath', label: 'Resource Path', type: 'text', required: true, defaultValue: 'data' },
       { name: 'dataFormat', label: 'Payload Format', type: 'select', options: ['JSON', 'CBOR', 'Text'], defaultValue: 'JSON' },
    ]
  },
  {
    id: 'statsd-v1',
    name: 'StatsD / Collectd',
    version: '1.1.0',
    description: 'Collect metrics from IT infrastructure and applications.',
    icon: 'Activity',
    status: 'Available',
    schema: [
       { name: 'protocol', label: 'Protocol', type: 'select', options: ['UDP', 'TCP'], defaultValue: 'UDP' },
       { name: 'port', label: 'Listen Port', type: 'number', required: true, defaultValue: 8125 },
       { name: 'allowedPendingMessages', label: 'Max Pending Messages', type: 'number', defaultValue: 10000 },
       { name: 'deleteGauges', label: 'Delete Gauges', type: 'boolean', defaultValue: true, description: 'Delete gauges after flushing' },
    ]
  }
];

export const MOCK_DATA_SOURCES: DataSource[] = [
  { 
    id: 'ds_001', 
    name: 'Factory A IoT Gateway', 
    pluginId: 'mqtt-v1', 
    type: 'MQTT Broker', 
    status: 'Active', 
    ingestionRate: 4500, 
    config: {},
    sampleData: {
      "device_id": "sensor_001",
      "timestamp": 1678888888000,
      "payload": {
        "temperature": 24.5,
        "humidity": 60.2,
        "vibration": { "x": 0.01, "y": 0.02 },
        "status": "ok"
      },
      "metadata": { "region": "us-east-1", "firmware": "1.2.0" }
    },
    mappingRules: [
      { id: 'm1', sourcePath: 'timestamp', targetColumn: 'ts', transform: 'None' },
      { id: 'm2', sourcePath: 'payload.temperature', targetColumn: 'current', transform: 'None' }
    ]
  },
  { 
    id: 'ds_002', 
    name: 'Vehicle Fleet Stream', 
    pluginId: 'kafka-v1', 
    type: 'Apache Kafka', 
    status: 'Active', 
    ingestionRate: 12000, 
    config: {},
    sampleData: {
      "vin": "TESLA_MODEL_Y_999",
      "event_ts": 1678889999000,
      "telemetry": {
        "speed_kmh": 105,
        "battery_level": 88,
        "gps": { "lat": 34.0522, "lng": -118.2437 }
      }
    },
    mappingRules: [
      { id: 'k1', sourcePath: 'event_ts', targetColumn: 'ts', transform: 'None' },
      { id: 'k2', sourcePath: 'vin', targetColumn: 'device_sn', transform: 'None' },
      { id: 'k3', sourcePath: 'telemetry.speed_kmh', targetColumn: 'phase', transform: 'None' }
    ]
  },
  { id: 'ds_003', name: 'Weather API Poller', pluginId: 'http-v1', type: 'HTTP Webhook', status: 'Inactive', ingestionRate: 0, config: {} },
  { id: 'ds_004', name: 'Siemens PLC Connector', pluginId: 'opcua-v1', type: 'OPC UA Client', status: 'Active', ingestionRate: 850, config: {} },
];

export const MOCK_SUPER_TABLES: SuperTable[] = [
  { name: 'meters', database: 'power_db', columns: 4, tags: 2, tables: 15000 },
  { name: 'sensors', database: 'factory_db', columns: 8, tags: 3, tables: 450 },
  { name: 'logs', database: 'sys_db', columns: 5, tags: 4, tables: 20 },
  { name: 'vehicles', database: 'fleet_db', columns: 12, tags: 5, tables: 50000 },
];

export const SAMPLE_QUERIES = [
  "SELECT count(*) FROM meters WHERE ts > NOW - 1h;",
  "SELECT avg(current), max(voltage) FROM meters INTERVAL(1m);",
  "SELECT * FROM vehicles WHERE speed > 80 AND location IS NOT NULL;"
];