import React, { useState } from 'react';
import { useTheme } from '../src/contexts/ThemeContext';
import { Layers, Database, ArrowRight, GitMerge, Plus, X, Trash2, Eye, Play, Save } from 'lucide-react';

interface VirtualView {
  id: string;
  name: string;
  desc: string;
  sourceA: string;
  sourceB: string;
  sql: string;
  bucket: string;
  status: 'ACTIVE' | 'DRAFT';
}

const INITIAL_VIEWS: VirtualView[] = [
  {
    id: 'v1',
    name: 'view_power_efficiency',
    desc: 'Join: power_db ⇄ factory_db',
    sourceA: 'power_db.meters',
    sourceB: 'factory_db.sensors',
    sql: 'SELECT t1.avg_vol, t2.avg_temp \nFROM power_db.meters t1 \nJOIN factory_db.sensors t2 \nON bucket(t1.ts, 1m) = bucket(t2.ts, 1m)',
    bucket: '1m',
    status: 'ACTIVE'
  }
];

export const QueryVirtualViews: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [views, setViews] = useState<VirtualView[]>(INITIAL_VIEWS);
  const [showModal, setShowModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
      name: '',
      sourceA: 'power_db.meters',
      sourceB: 'factory_db.sensors',
      bucket: '1m'
  });

  const handleCreate = () => {
      const newView: VirtualView = {
          id: `v_${Date.now()}`,
          name: formData.name || `view_${Math.floor(Math.random() * 1000)}`,
          desc: `Join: ${formData.sourceA.split('.')[0]} ⇄ ${formData.sourceB.split('.')[0]}`,
          sourceA: formData.sourceA,
          sourceB: formData.sourceB,
          bucket: formData.bucket,
          sql: `SELECT t1.*, t2.* \nFROM ${formData.sourceA} t1 \nJOIN ${formData.sourceB} t2 \nON bucket(t1.ts, ${formData.bucket}) = bucket(t2.ts, ${formData.bucket})`,
          status: 'ACTIVE'
      };
      setViews([...views, newView]);
      setShowModal(false);
      setFormData({ name: '', sourceA: 'power_db.meters', sourceB: 'factory_db.sensors', bucket: '1m' });
  };

  const handleDelete = (id: string) => {
      setViews(views.filter(v => v.id !== id));
  };

  return (
    <div className="space-y-6 relative h-full">
       <div className="flex items-center justify-between">
        <div>
           <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Virtual Views (Federated)</h1>
           <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Configure logic views to join data across different databases (e.g. Power DB + Environment DB).</p>
        </div>
        <button 
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center shadow-lg shadow-blue-900/20"
        >
           <Layers className="w-4 h-4 mr-2" /> Create View
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {views.map(view => (
            <div key={view.id} className={`rounded-xl border p-6 relative overflow-hidden group transition-colors ${isDark ? 'bg-gray-800 border-gray-700 hover:border-gray-500' : 'bg-white border-gray-200 hover:border-gray-400'}`}>
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-500/20 rounded-lg text-purple-400">
                            <GitMerge className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className={`font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{view.name}</h3>
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{view.desc}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="bg-green-500/10 text-green-400 px-2 py-1 rounded text-xs font-bold border border-green-500/20">ACTIVE</span>
                        <button 
                            onClick={() => handleDelete(view.id)}
                            className={`p-1.5 rounded transition-opacity opacity-0 group-hover:opacity-100 ${isDark ? 'text-gray-500 hover:text-red-400 hover:bg-gray-700' : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'}`}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Visualization of the join */}
                <div className="flex items-center justify-between mb-6 text-sm">
                    <div className={`flex-1 p-3 rounded border flex flex-col items-center ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                        <Database className="w-4 h-4 text-blue-400 mb-2" />
                        <span className={`font-mono text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{view.sourceA}</span>
                    </div>
                    <div className={`px-2 flex flex-col items-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <span className="text-[10px] mb-1">Bucket: {view.bucket}</span>
                        <ArrowRight className="w-4 h-4" />
                    </div>
                    <div className={`p-2 rounded-full z-10 border-2 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-200 border-gray-300'}`}>
                        <span className="text-[10px] font-bold text-white">JOIN</span>
                    </div>
                    <div className={`px-2 flex flex-col items-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <span className="text-[10px] mb-1">Bucket: {view.bucket}</span>
                        <ArrowRight className="w-4 h-4" />
                    </div>
                    <div className={`flex-1 p-3 rounded border flex flex-col items-center ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                        <Database className="w-4 h-4 text-green-400 mb-2" />
                        <span className={`font-mono text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{view.sourceB}</span>
                    </div>
                </div>
                
                <div className={`p-3 rounded border mb-4 h-24 overflow-auto custom-scrollbar ${isDark ? 'bg-gray-900/50 border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                    <code className={`text-xs font-mono block whitespace-pre-wrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {view.sql}
                    </code>
                </div>

                <div className="flex gap-2">
                    <button className={`flex-1 py-2 rounded text-sm transition-colors flex items-center justify-center ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                        <Save className="w-4 h-4 mr-2" /> Edit Logic
                    </button>
                    <button 
                        onClick={() => setShowPreview(true)}
                        className={`flex-1 py-2 rounded text-sm transition-colors flex items-center justify-center ${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                        <Eye className="w-4 h-4 mr-2" /> Preview Data
                    </button>
                </div>
            </div>
          ))}

          {/* Add New Placeholder */}
          <button 
            onClick={() => setShowModal(true)}
            className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all p-6 min-h-[300px] ${isDark ? 'border-gray-700 text-gray-500 hover:border-blue-500 hover:text-blue-400' : 'border-gray-300 text-gray-400 hover:border-blue-500 hover:text-blue-500'}`}
          >
              <Plus className="w-12 h-12 mb-2 opacity-50" />
              <span className="font-medium">Create New Virtual View</span>
          </button>
      </div>

      {/* Create Modal */}
      {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className={`rounded-xl border w-full max-w-lg shadow-2xl ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className={`flex justify-between items-center p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <h2 className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>Create Virtual View</h2>
                      <button onClick={() => setShowModal(false)} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-900'}><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>View Name</label>
                          <input 
                              type="text" 
                              value={formData.name}
                              onChange={e => setFormData({...formData, name: e.target.value})}
                              placeholder="e.g. view_cross_db_analysis"
                              className={`w-full border rounded px-3 py-2 outline-none focus:border-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Left Source</label>
                              <select 
                                  value={formData.sourceA}
                                  onChange={e => setFormData({...formData, sourceA: e.target.value})}
                                  className={`w-full border rounded px-3 py-2 outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
                              >
                                  <option value="power_db.meters">power_db.meters</option>
                                  <option value="fleet_db.vehicles">fleet_db.vehicles</option>
                              </select>
                          </div>
                          <div>
                              <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Right Source</label>
                              <select 
                                  value={formData.sourceB}
                                  onChange={e => setFormData({...formData, sourceB: e.target.value})}
                                  className={`w-full border rounded px-3 py-2 outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
                              >
                                  <option value="factory_db.sensors">factory_db.sensors</option>
                                  <option value="sys_db.logs">sys_db.logs</option>
                              </select>
                          </div>
                      </div>
                      <div>
                           <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Join Bucket (Time Window)</label>
                           <select 
                               value={formData.bucket}
                               onChange={e => setFormData({...formData, bucket: e.target.value})}
                               className={`w-full border rounded px-3 py-2 outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
                           >
                               <option value="1s">1 Second</option>
                               <option value="1m">1 Minute</option>
                               <option value="1h">1 Hour</option>
                               <option value="1d">1 Day</option>
                           </select>
                           <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Data will be aligned by timestamp buckets before joining.</p>
                      </div>
                      
                      <div className={`p-3 border rounded text-xs ${isDark ? 'bg-blue-900/20 border-blue-500/20 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                          <strong className="block mb-1">Generated SQL Preview:</strong>
                          <code className="font-mono opacity-80 block">
                              SELECT t1.*, t2.* <br/>
                              FROM {formData.sourceA} t1 JOIN {formData.sourceB} t2 <br/>
                              ON bucket(t1.ts, {formData.bucket}) = bucket(t2.ts, {formData.bucket})
                          </code>
                      </div>
                  </div>
                  <div className={`p-6 border-t flex justify-end gap-3 ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
                      <button onClick={() => setShowModal(false)} className={`px-4 py-2 text-sm ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>Cancel</button>
                      <button onClick={handleCreate} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium shadow-lg shadow-blue-900/20">
                          Create View
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className={`rounded-xl border w-full max-w-4xl shadow-2xl flex flex-col max-h-[80vh] ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className={`flex justify-between items-center p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <h2 className={`text-lg font-bold flex items-center ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                          <Play className="w-4 h-4 mr-2 text-green-400" /> Data Preview (Limit 10)
                      </h2>
                      <button onClick={() => setShowPreview(false)} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-900'}><X className="w-5 h-5"/></button>
                  </div>
                  <div className="flex-1 overflow-auto p-0">
                      <table className="w-full text-left border-collapse text-sm">
                          <thead>
                              <tr className={`${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                                  <th className={`p-3 border-b sticky top-0 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'}`}>bucket_ts</th>
                                  <th className={`p-3 border-b sticky top-0 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'}`}>t1.avg_vol</th>
                                  <th className={`p-3 border-b sticky top-0 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'}`}>t1.max_curr</th>
                                  <th className={`p-3 border-b sticky top-0 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'}`}>t2.avg_temp</th>
                                  <th className={`p-3 border-b sticky top-0 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'}`}>t2.humidity</th>
                              </tr>
                          </thead>
                          <tbody className={isDark ? 'divide-y divide-gray-700 text-gray-300 font-mono' : 'divide-y divide-gray-200 text-gray-700 font-mono'}>
                              {[...Array(8)].map((_, i) => (
                                  <tr key={i} className={isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}>
                                      <td className="p-3">2023-10-27 10:0{i}:00</td>
                                      <td className="p-3">{(220 + Math.random() * 5).toFixed(2)}</td>
                                      <td className="p-3">{(10 + Math.random() * 2).toFixed(2)}</td>
                                      <td className="p-3">{(45 + Math.random() * 10).toFixed(1)}</td>
                                      <td className="p-3">{(60 + Math.random() * 5).toFixed(1)}%</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
