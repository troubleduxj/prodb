export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  source: string;
}

export interface ProtocolConfig {
  id: string;
  name: string;
  enabled: boolean;
  type: 'MQTT' | 'Modbus' | 'OPC UA' | 'HTTP' | 'WebSocket';
  status: 'active' | 'inactive' | 'error';
  config: Record<string, string | number | boolean>;
}

export interface SystemStats {
  cpuUsage: number;
  memoryUsage: number;
  uptime: string;
  activeConnections: number;
  throughput: number; // msg/sec
}
