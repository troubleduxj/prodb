import React from 'react';
import { mockLogs } from '../mock/data';
import { AlertCircle, Info, AlertTriangle, Search, Download } from 'lucide-react';

const LogIcon = ({ level }: { level: string }) => {
  switch (level) {
    case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'warn': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    default: return <Info className="w-4 h-4 text-blue-500" />;
  }
};

export default function Logs() {
  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">System Logs</h1>
          <p className="text-zinc-400">Audit trails and operational logs.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search logs..." 
              className="bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-zinc-700 w-64"
            />
          </div>
          <button className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="bg-[#1A1A1A] border border-zinc-800 rounded-xl overflow-hidden flex-1 flex flex-col">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-zinc-800 bg-zinc-900/50 text-xs font-medium text-zinc-500 uppercase tracking-wider">
          <div className="col-span-2">Timestamp</div>
          <div className="col-span-1">Level</div>
          <div className="col-span-2">Source</div>
          <div className="col-span-7">Message</div>
        </div>
        
        <div className="overflow-y-auto flex-1">
          {mockLogs.map((log) => (
            <div 
              key={log.id} 
              className="grid grid-cols-12 gap-4 p-4 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors text-sm font-mono"
            >
              <div className="col-span-2 text-zinc-500">
                {new Date(log.timestamp).toLocaleTimeString()}
              </div>
              <div className="col-span-1 flex items-center gap-2">
                <LogIcon level={log.level} />
                <span className={`uppercase text-xs font-semibold ${
                  log.level === 'error' ? 'text-red-500' : 
                  log.level === 'warn' ? 'text-yellow-500' : 'text-blue-500'
                }`}>
                  {log.level}
                </span>
              </div>
              <div className="col-span-2 text-zinc-400 truncate">
                {log.source}
              </div>
              <div className="col-span-7 text-zinc-300">
                {log.message}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
