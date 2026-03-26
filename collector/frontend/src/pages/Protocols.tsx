import React, { useState } from 'react';
import { mockProtocols } from '../mock/data';
import { Plus, MoreVertical, Power, Trash2, Settings2, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ProtocolConfig } from '../types';

export default function Protocols() {
  const [protocols, setProtocols] = useState(mockProtocols);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProtocol, setNewProtocol] = useState<Partial<ProtocolConfig>>({
    name: '',
    type: 'MQTT',
    config: {}
  });

  const toggleProtocol = (id: string) => {
    setProtocols(protocols.map(p => 
      p.id === id ? { ...p, enabled: !p.enabled, status: !p.enabled ? 'active' : 'inactive' } : p
    ));
  };

  const handleAddProtocol = () => {
    if (!newProtocol.name) return;
    
    const protocol: ProtocolConfig = {
      id: `p-${Date.now()}`,
      name: newProtocol.name,
      type: newProtocol.type as any,
      enabled: true,
      status: 'active',
      config: newProtocol.type === 'MQTT' 
        ? { broker: 'mqtt.local', topic: 'test' } 
        : { ip: '127.0.0.1', port: 502 }
    };

    setProtocols([...protocols, protocol]);
    setIsModalOpen(false);
    setNewProtocol({ name: '', type: 'MQTT', config: {} });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto relative">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Collection Protocols</h1>
          <p className="text-zinc-400">Manage data collection sources and protocols.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Protocol
        </button>
      </div>

      <div className="grid gap-4">
        {protocols.map((protocol) => (
          <motion.div 
            key={protocol.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#1A1A1A] border border-zinc-800 rounded-xl p-6 flex items-center justify-between group hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center gap-6">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                protocol.enabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'
              }`}>
                <Settings2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{protocol.name}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                    {protocol.type}
                  </span>
                  <span className="text-sm text-zinc-500">
                    {Object.entries(protocol.config).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                protocol.status === 'active' 
                  ? 'bg-emerald-500/10 text-emerald-500' 
                  : 'bg-zinc-800 text-zinc-500'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  protocol.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-500'
                }`} />
                {protocol.status.toUpperCase()}
              </div>

              <div className="h-8 w-px bg-zinc-800 mx-2" />

              <button 
                onClick={() => toggleProtocol(protocol.id)}
                className={`p-2 rounded-lg transition-colors ${
                  protocol.enabled 
                    ? 'text-emerald-500 hover:bg-emerald-500/10' 
                    : 'text-zinc-500 hover:bg-zinc-800'
                }`}
                title={protocol.enabled ? "Disable" : "Enable"}
              >
                <Power className="w-5 h-5" />
              </button>
              
              <button className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
              
              <button className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1A1A1A] border border-zinc-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Add New Protocol</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Protocol Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Production Line 1"
                    value={newProtocol.name}
                    onChange={(e) => setNewProtocol({...newProtocol, name: e.target.value})}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Protocol Type</label>
                  <select 
                    value={newProtocol.type}
                    onChange={(e) => setNewProtocol({...newProtocol, type: e.target.value as any})}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="MQTT">MQTT</option>
                    <option value="Modbus">Modbus TCP</option>
                    <option value="OPC UA">OPC UA</option>
                    <option value="HTTP">HTTP/REST</option>
                    <option value="WebSocket">WebSocket</option>
                  </select>
                </div>

                <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 text-sm text-zinc-500">
                  <p>Default configuration template will be applied for {newProtocol.type}. You can edit specific parameters after creation.</p>
                </div>
              </div>

              <div className="p-6 border-t border-zinc-800 flex justify-end gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-zinc-400 hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddProtocol}
                  disabled={!newProtocol.name}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Create Protocol
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
