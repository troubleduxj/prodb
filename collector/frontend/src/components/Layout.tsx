import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  Network,
  Shield,
  FileText,
  Activity,
  Layers,
  CheckCircle,
  Bell,
  Cpu
} from 'lucide-react';
import { cn } from '../lib/utils';

const SidebarItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      cn(
        "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-lg mx-2",
        isActive
          ? "bg-zinc-800 text-white"
          : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
      )
    }
  >
    <Icon className="w-5 h-5" />
    <span>{label}</span>
  </NavLink>
);

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#141414] text-zinc-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 flex flex-col bg-[#0A0A0A]">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-emerald-500">
            <Activity className="w-6 h-6" />
            <span className="font-bold text-lg tracking-tight text-white">DataCollector</span>
          </div>
          <div className="mt-2 text-xs text-zinc-500 font-mono">v2.4.0-beta</div>
        </div>

        <nav className="flex-1 py-6 space-y-1">
          <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" />
          <SidebarItem to="/interfaces" icon={Layers} label="Interfaces" />
          <SidebarItem to="/protocols" icon={Network} label="Protocols" />
          <SidebarItem to="/config" icon={Settings} label="Configuration" />
          <SidebarItem to="/config-status" icon={CheckCircle} label="Config Status" />
          <SidebarItem to="/alerts" icon={Bell} label="Edge Alerts" />
          <SidebarItem to="/tasks" icon={Cpu} label="Tasks" />
          <SidebarItem to="/security" icon={Shield} label="Security" />
          <SidebarItem to="/logs" icon={FileText} label="System Logs" />
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
            <div className="text-xs text-zinc-500 mb-1">Agent Status</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-emerald-500">Online</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#141414]">
        {children}
      </main>
    </div>
  );
}
