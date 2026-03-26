import React from 'react';
import { Shield, Lock, FileKey, RefreshCw } from 'lucide-react';

export default function Security() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Security Settings</h1>
        <p className="text-zinc-400">Manage encryption, certificates, and access control.</p>
      </div>

      <div className="grid gap-6">
        {/* TLS/SSL Configuration */}
        <div className="bg-[#1A1A1A] border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Lock className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">TLS/SSL Encryption</h2>
                <p className="text-sm text-zinc-500">Secure communication with the platform.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-emerald-500">Enabled</span>
              <div className="w-10 h-6 bg-emerald-500/20 rounded-full p-1 cursor-pointer">
                <div className="w-4 h-4 bg-emerald-500 rounded-full translate-x-4 transition-transform" />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-zinc-800 pt-6">
            <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg border border-zinc-800">
              <div className="flex items-center gap-3">
                <FileKey className="w-8 h-8 text-zinc-500" />
                <div>
                  <div className="text-sm font-medium text-white">Client Certificate</div>
                  <div className="text-xs text-zinc-500">client-cert.pem • Expires in 245 days</div>
                </div>
              </div>
              <button className="text-sm text-emerald-500 hover:text-emerald-400 font-medium">Update</button>
            </div>

            <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg border border-zinc-800">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-zinc-500" />
                <div>
                  <div className="text-sm font-medium text-white">CA Root Certificate</div>
                  <div className="text-xs text-zinc-500">root-ca.pem • Valid</div>
                </div>
              </div>
              <button className="text-sm text-emerald-500 hover:text-emerald-400 font-medium">Update</button>
            </div>
          </div>
        </div>

        {/* Data Encryption */}
        <div className="bg-[#1A1A1A] border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <RefreshCw className="w-5 h-5 text-blue-500" />
            </div>
            <h2 className="text-lg font-semibold text-white">Payload Encryption</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-white block">End-to-End Encryption</label>
                <span className="text-xs text-zinc-500">Encrypt data payload before transmission</span>
              </div>
              <div className="w-10 h-6 bg-zinc-800 rounded-full p-1 cursor-pointer">
                <div className="w-4 h-4 bg-zinc-500 rounded-full transition-transform" />
              </div>
            </div>
            
            <div className="pt-4">
              <label className="text-sm font-medium text-zinc-400 mb-2 block">Encryption Algorithm</label>
              <select className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors">
                <option>AES-256-GCM</option>
                <option>AES-128-CBC</option>
                <option>ChaCha20-Poly1305</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
