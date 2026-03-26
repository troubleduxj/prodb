import React, { useState } from 'react';
import { Play, Sparkles, Save, Clock, Trash2 } from 'lucide-react';
import { generateSqlFromNaturalLanguage } from '../services/geminiService';
import { SAMPLE_QUERIES } from '../constants';

export const QueryService: React.FC = () => {
  const [query, setQuery] = useState('SELECT * FROM meters LIMIT 10;');
  const [prompt, setPrompt] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [logs, setLogs] = useState<string[]>(['System ready.']);

  const handleRun = () => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] Executing: ${query}`, ...prev]);
    // Simulate execution time
    setTimeout(() => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] Query executed successfully (12 rows, 0.045s)`, ...prev]);
    }, 500);
  };

  const handleAiGenerate = async () => {
    if (!prompt.trim()) return;
    setLoadingAi(true);
    const schemaContext = `
      SuperTable meters (ts TIMESTAMP, current FLOAT, voltage INT, phase FLOAT) TAGS (location BINARY(64), groupId INT)
      SuperTable sensors (ts TIMESTAMP, temperature FLOAT, humidity FLOAT) TAGS (areaId INT)
    `;
    const generatedSql = await generateSqlFromNaturalLanguage(prompt, schemaContext);
    setQuery(generatedSql);
    setLoadingAi(false);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-100">Unified Query Service</h1>
        <div className="flex space-x-2">
           <button className="flex items-center px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition">
              <Clock className="w-4 h-4 mr-2" /> History
           </button>
           <button className="flex items-center px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition">
              <Save className="w-4 h-4 mr-2" /> Saved
           </button>
        </div>
      </div>

      {/* AI Assistant Bar */}
      <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-lg p-4 flex gap-4 items-center">
        <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400">
            <Sparkles className="w-5 h-5" />
        </div>
        <input 
            type="text" 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask AI to write SQL (e.g., 'Find average voltage for group 5 in the last hour')" 
            className="flex-1 bg-transparent border-none text-gray-200 focus:ring-0 placeholder-gray-500"
        />
        <button 
            onClick={handleAiGenerate}
            disabled={loadingAi}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-md text-sm font-medium transition-colors flex items-center"
        >
            {loadingAi ? 'Generating...' : 'Generate SQL'}
        </button>
      </div>

      {/* Main Split View */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Editor Pane */}
        <div className="flex-1 flex flex-col bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800">
                <span className="text-xs font-mono text-gray-400">Editor</span>
                <div className="flex gap-2">
                    <button className="p-1 hover:text-red-400 text-gray-500" onClick={() => setQuery('')}><Trash2 className="w-4 h-4" /></button>
                </div>
            </div>
            <textarea 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-[#1e1e1e] text-gray-300 font-mono p-4 text-sm resize-none focus:outline-none"
                spellCheck={false}
            />
            <div className="p-4 border-t border-gray-700 bg-gray-800 flex justify-between items-center">
                <div className="flex gap-2">
                    {SAMPLE_QUERIES.map((q, i) => (
                        <button key={i} onClick={() => setQuery(q)} className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded truncate max-w-[100px]">
                            Query {i+1}
                        </button>
                    ))}
                </div>
                <button onClick={handleRun} className="flex items-center px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-medium transition shadow-lg shadow-green-900/20">
                    <Play className="w-4 h-4 mr-2 fill-current" />
                    Run
                </button>
            </div>
        </div>

        {/* Results/Logs Pane */}
        <div className="w-1/3 flex flex-col gap-4">
             <div className="flex-1 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col">
                <div className="px-4 py-2 border-b border-gray-700 bg-gray-800">
                    <span className="text-xs font-mono text-gray-400">Execution Log</span>
                </div>
                <div className="flex-1 p-4 font-mono text-xs overflow-auto space-y-2">
                    {logs.map((log, i) => (
                        <div key={i} className={log.includes('Error') ? 'text-red-400' : 'text-green-400'}>
                            {log}
                        </div>
                    ))}
                </div>
             </div>
             <div className="h-1/3 bg-gray-800 rounded-xl border border-gray-700 p-4">
                 <h3 className="text-sm font-medium text-gray-300 mb-2">Schema Helper</h3>
                 <div className="text-xs text-gray-500 space-y-1">
                     <p><span className="text-blue-400">meters</span> (ts, current, voltage)</p>
                     <p><span className="text-blue-400">sensors</span> (ts, temp, humidity)</p>
                     <p><span className="text-blue-400">logs</span> (ts, level, message)</p>
                 </div>
             </div>
        </div>
      </div>
    </div>
  );
};