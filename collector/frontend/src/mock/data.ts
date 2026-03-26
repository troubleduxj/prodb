import { LogEntry, ProtocolConfig, SystemStats } from '../types';

export const mockLogs: LogEntry[] = Array.from({ length: 20 }).map((_, i) => ({
  id: `log-${i}`,
  timestamp: new Date(Date.now() - i * 60000).toISOString(),
  level: i % 5 === 0 ? 'error' : i % 3 === 0 ? 'warn' : 'info',
  message: i % 5 === 0 ? 'Connection timeout' : 'Data packet transmitted successfully',
  source: i % 2 === 0 ? 'System' : 'Protocol: Modbus',
}));

export const mockProtocols: ProtocolConfig[] = [
  {
    id: 'p1',
    name: 'Factory Modbus',
    enabled: true,
    type: 'Modbus',
    status: 'active',
    config: { ip: '192.168.1.100', port: 502, slaveId: 1 },
  },
  {
    id: 'p2',
    name: 'Cloud MQTT',
    enabled: true,
    type: 'MQTT',
    status: 'active',
    config: { broker: 'mqtt.example.com', topic: 'sensors/#' },
  },
  {
    id: 'p3',
    name: 'Legacy OPC',
    enabled: false,
    type: 'OPC UA',
    status: 'inactive',
    config: { endpoint: 'opc.tcp://localhost:4840' },
  },
];

export const mockStats: SystemStats = {
  cpuUsage: 45,
  memoryUsage: 62,
  uptime: '12d 4h 32m',
  activeConnections: 12,
  throughput: 1450,
};
