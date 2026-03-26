import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Code, Copy, Check, Lock, Globe } from 'lucide-react';
import { Page } from '../types';
import { useTheme } from '../src/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const API_GROUPS = [
    {
        name: 'Ingestion API',
        endpoints: [
            { method: 'POST', path: '/v2/insert', summary: 'Insert Rows (JSON)', id: 'insert' },
            { method: 'POST', path: '/v2/schemaless', summary: 'Schemaless Write (Line Protocol)', id: 'sml' },
        ]
    },
    {
        name: 'Query API',
        endpoints: [
            { method: 'POST', path: '/v3/sql', summary: 'Execute SQL Query', id: 'sql' },
            { method: 'GET', path: '/v3/health', summary: 'Cluster Health Check', id: 'health' },
        ]
    },
    {
        name: 'Management',
        endpoints: [
            { method: 'GET', path: '/v2/users', summary: 'List Users', id: 'users' },
            { method: 'POST', path: '/v2/users', summary: 'Create User', id: 'create_user' },
        ]
    }
];

export const HelpApiRef: React.FC = () => {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState('sql');
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';

  const getMethodColor = (method: string) => {
      switch(method) {
          case 'GET': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
          case 'POST': return 'text-green-400 bg-green-500/10 border-green-500/20';
          case 'DELETE': return 'text-red-400 bg-red-500/10 border-red-500/20';
          case 'PUT': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
          default: return isDark ? 'text-gray-400 bg-gray-700 border-gray-600' : 'text-gray-500 bg-gray-200 border-gray-300';
      }
  };

  const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-3">
                <button 
                    onClick={() => navigate(`/${Page.HELP_CENTER}`)}
                    className={`p-2 hover:${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-lg ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'} flex items-center`}>
                    <Code className="w-6 h-6 mr-3 text-purple-400" />
                    {t('apiRef.apiReference')}
                </h1>
            </div>
            <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-400 bg-gray-800 border-gray-700' : 'text-gray-500 bg-white border-gray-200'} px-3 py-1.5 rounded-lg border`}>
                <Globe className="w-4 h-4" />
                <span>{t('apiRef.baseURL')}: </span>
                <code className={`${isDark ? 'text-gray-200' : 'text-gray-700'} font-mono`}>https://api.tdengine.cloud</code>
            </div>
        </div>

        <div className={`flex-1 flex gap-6 overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            {/* Sidebar */}
            <div className={`w-72 border-r ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'} flex flex-col`}>
                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    {API_GROUPS.map((group, idx) => (
                        <div key={idx}>
                            <h3 className={`text-xs font-bold ${isDark ? 'text-gray-500' : 'text-gray-400'} uppercase mb-3 tracking-wider`}>{group.name}</h3>
                            <div className="space-y-1">
                                {group.endpoints.map(ep => (
                                    <button
                                        key={ep.id}
                                        onClick={() => setActiveId(ep.id)}
                                        className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-all group flex items-center gap-2 ${
                                            activeId === ep.id 
                                            ? (isDark ? 'bg-gray-700 text-gray-100 shadow-sm' : 'bg-gray-200 text-gray-900 shadow-sm') 
                                            : (isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100')
                                        }`}
                                    >
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getMethodColor(ep.method)}`}>
                                            {ep.method}
                                        </span>
                                        <span className="truncate">{ep.summary}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto">
                    {/* Endpoint Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded font-bold font-mono">POST</span>
                            <h2 className={`text-3xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>/v3/sql</h2>
                        </div>
                        <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-lg`}>{t('apiRef.executesSQLQuery')}</p>
                    </div>

                    {/* Auth */}
                    <div className={`mb-8 p-4 ${isDark ? 'bg-gray-900/30' : 'bg-gray-50'} rounded-xl border ${isDark ? 'border-gray-700/50' : 'border-gray-200'} flex items-start gap-4`}>
                        <Lock className="w-5 h-5 text-yellow-500 mt-0.5" />
                        <div>
                            <h3 className={`text-sm font-bold ${isDark ? 'text-gray-200' : 'text-gray-700'} mb-1`}>{t('apiRef.authenticationRequired')}</h3>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {t('apiRef.includeAPIToken')} <code className={`${isDark ? 'bg-gray-800' : 'bg-white'} px-1.5 py-0.5 rounded ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Authorization</code> {t('apiRef.header')}
                                <br/>{t('apiRef.example')}: <code className="text-yellow-500">Authorization: Basic {'<token>'}</code>
                            </p>
                        </div>
                    </div>

                    {/* Parameters */}
                    <div className="mb-10">
                        <h3 className={`text-lg font-bold ${isDark ? 'text-gray-200' : 'text-gray-700'} mb-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} pb-2`}>{t('apiRef.bodyParameters')}</h3>
                        <div className="space-y-4">
                            <div className={`grid grid-cols-12 gap-4 text-sm p-3 rounded-lg hover:${isDark ? 'bg-gray-700/20' : 'bg-gray-100'}`}>
                                <div className="col-span-3 font-mono text-blue-400 font-bold">sql <span className="text-red-400">*</span></div>
                                <div className={`col-span-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>string</div>
                                <div className={`col-span-7 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{t('apiRef.sqlDescription')}</div>
                            </div>
                            <div className={`grid grid-cols-12 gap-4 text-sm p-3 rounded-lg hover:${isDark ? 'bg-gray-700/20' : 'bg-gray-100'}`}>
                                <div className="col-span-3 font-mono text-blue-400 font-bold">db</div>
                                <div className={`col-span-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>string</div>
                                <div className={`col-span-7 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{t('apiRef.dbDescription')}</div>
                            </div>
                            <div className={`grid grid-cols-12 gap-4 text-sm p-3 rounded-lg hover:${isDark ? 'bg-gray-700/20' : 'bg-gray-100'}`}>
                                <div className="col-span-3 font-mono text-blue-400 font-bold">req_id</div>
                                <div className={`col-span-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>string</div>
                                <div className={`col-span-7 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{t('apiRef.reqIdDescription')}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
