import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { mockStats } from '../mock/data';
import { Cpu, HardDrive, Wifi, Zap } from 'lucide-react';
import { motion } from 'motion/react';

const generateInitialData = () => Array.from({ length: 20 }).map((_, i) => ({
  time: new Date(Date.now() - (20 - i) * 1000).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  value: Math.floor(Math.random() * 500) + 1000,
}));

const StatCard = ({ label, value, icon: Icon, unit, color }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-[#1A1A1A] border border-zinc-800 p-6 rounded-xl"
  >
    <div className="flex items-center justify-between mb-4">
      <span className="text-zinc-400 text-sm font-medium">{label}</span>
      <Icon className={`w-5 h-5 ${color}`} />
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-3xl font-bold text-white tracking-tight">{value}</span>
      <span className="text-zinc-500 text-sm">{unit}</span>
    </div>
  </motion.div>
);

export default function Dashboard() {
  const [data, setData] = useState(generateInitialData());
  const [stats, setStats] = useState(mockStats);

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => {
        const newTime = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newValue = Math.floor(Math.random() * 500) + 1000;
        return [...prev.slice(1), { time: newTime, value: newValue }];
      });

      setStats(prev => ({
        ...prev,
        throughput: Math.floor(Math.random() * 100) + 1400,
        cpuUsage: Math.min(100, Math.max(0, prev.cpuUsage + (Math.random() * 10 - 5))),
        memoryUsage: Math.min(100, Math.max(0, prev.memoryUsage + (Math.random() * 4 - 2))),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Dashboard</h1>
        <p className="text-zinc-400">Real-time monitoring of agent performance and data throughput.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="CPU Usage" 
          value={Math.round(stats.cpuUsage)} 
          unit="%" 
          icon={Cpu} 
          color="text-blue-500" 
        />
        <StatCard 
          label="Memory" 
          value={Math.round(stats.memoryUsage)} 
          unit="%" 
          icon={HardDrive} 
          color="text-purple-500" 
        />
        <StatCard 
          label="Throughput" 
          value={stats.throughput} 
          unit="msg/s" 
          icon={Zap} 
          color="text-yellow-500" 
        />
        <StatCard 
          label="Active Connections" 
          value={stats.activeConnections} 
          unit="clients" 
          icon={Wifi} 
          color="text-emerald-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-[#1A1A1A] border border-zinc-800 rounded-xl p-6"
        >
          <h2 className="text-lg font-semibold text-white mb-6">Data Throughput History</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  stroke="#666" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#666" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => `${value}`} 
                  domain={[0, 2000]}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-[#1A1A1A] border border-zinc-800 rounded-xl p-6 flex flex-col"
        >
          <h2 className="text-lg font-semibold text-white mb-4">System Health</h2>
          <div className="space-y-6 flex-1">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-400">Disk Usage</span>
                <span className="text-white">45%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-[45%]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-400">Database Buffer</span>
                <span className="text-white">12%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 w-[12%]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-400">Network Load</span>
                <span className="text-white">{Math.round((stats.throughput / 2000) * 100)}%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 transition-all duration-500" 
                  style={{ width: `${(stats.throughput / 2000) * 100}%` }} 
                />
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-zinc-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Uptime</span>
              <span className="font-mono text-emerald-500">{stats.uptime}</span>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-[#1A1A1A] border border-zinc-800 rounded-xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Live Data Stream</h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-emerald-500 font-medium uppercase tracking-wider">Live</span>
          </div>
        </div>
        <div className="bg-black/50 rounded-lg p-4 font-mono text-xs h-48 overflow-hidden relative">
          <div className="absolute inset-0 overflow-y-auto p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-3 text-zinc-400 border-b border-zinc-800/50 pb-2 last:border-0 last:pb-0">
                <span className="text-zinc-600 shrink-0">{new Date(Date.now() - i * 1500).toISOString()}</span>
                <span className="text-blue-400 shrink-0">OUT</span>
                <span className="text-zinc-300 truncate">
                  {`{"sensor_id": "s-${100+i}", "value": ${(Math.random() * 100).toFixed(2)}, "unit": "C", "status": "ok"}`}
                </span>
              </div>
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
        </div>
      </motion.div>
    </div>
  );
}
