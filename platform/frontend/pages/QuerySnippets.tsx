import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { Scissors, Copy, Edit, Tag, Plus, X, Trash2, Check, Code, Search } from 'lucide-react';

interface Snippet {
    id: number;
    title: string;
    desc: string;
    sql: string;
    tags: string[];
}

const INITIAL_SNIPPETS: Snippet[] = [
    { id: 1, title: 'Exclude Maintenance Hours', desc: 'Where clause to filter out weekends and nights', sql: 'WHERE hour(ts) BETWEEN 8 AND 18 AND dayofweek(ts) BETWEEN 1 AND 5', tags: ['filter', 'util'] },
    { id: 2, title: 'Weighted Moving Average', desc: 'Complex calculation for smoothing', sql: 'SELECT (val * 0.5 + lag(val) * 0.3 + lag(val, 2) * 0.2) as wma ...', tags: ['math', 'analytics'] },
    { id: 3, title: 'Session Window Grouping', desc: 'Group events by session gap of 30s', sql: 'SESSION(ts, 30s)', tags: ['window'] },
];

export const QuerySnippets: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [snippets, setSnippets] = useState<Snippet[]>(INITIAL_SNIPPETS);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ title: '', desc: '', sql: '', tags: '' });
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleOpenModal = (snippet?: Snippet) => {
      if (snippet) {
          setEditingId(snippet.id);
          setFormData({
              title: snippet.title,
              desc: snippet.desc,
              sql: snippet.sql,
              tags: snippet.tags.join(', ')
          });
      } else {
          setEditingId(null);
          setFormData({ title: '', desc: '', sql: '', tags: '' });
      }
      setModalOpen(true);
  };

  const handleSave = () => {
      const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(t => t);
      
      if (editingId) {
          setSnippets(snippets.map(s => s.id === editingId ? { ...s, ...formData, tags: tagsArray } : s));
      } else {
          const newSnippet: Snippet = {
              id: Date.now(),
              title: formData.title || 'Untitled Snippet',
              desc: formData.desc,
              sql: formData.sql,
              tags: tagsArray
          };
          setSnippets([newSnippet, ...snippets]);
      }
      setModalOpen(false);
  };

  const handleDelete = (id: number) => {
      if (confirm(t('snippets.confirmDelete', 'Are you sure you want to delete this snippet?'))) {
          setSnippets(snippets.filter(s => s.id !== id));
      }
  };

  const handleCopy = (id: number, sql: string) => {
      navigator.clipboard.writeText(sql);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredSnippets = snippets.filter(s => 
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <div>
           <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('snippets.title', 'SQL Snippets')}</h1>
           <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('snippets.description', 'Shared library of reusable query fragments.')}</p>
        </div>
        <div className="flex gap-3">
             <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t('snippets.searchPlaceholder', 'Search snippets...')} 
                    className={`pl-9 pr-4 py-2 border rounded-lg text-sm outline-none w-64 ${isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`} 
                />
             </div>
             <button 
                onClick={() => handleOpenModal()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center shadow-lg shadow-blue-900/20"
             >
                <Plus className="w-4 h-4 mr-2" /> {t('snippets.newSnippet', 'New Snippet')}
             </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSnippets.map(snip => (
              <div key={snip.id} className={`rounded-xl border p-6 flex flex-col transition-colors group ${isDark ? 'bg-gray-800 border-gray-700 hover:border-gray-500' : 'bg-white border-gray-200 hover:border-gray-400'}`}>
                  <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded ${isDark ? 'bg-gray-700 text-blue-400' : 'bg-blue-50 text-blue-500'}`}>
                             <Code className="w-4 h-4" />
                          </div>
                          <h3 className={`font-bold truncate max-w-[180px] ${isDark ? 'text-gray-100' : 'text-gray-900'}`} title={snip.title}>{snip.title}</h3>
                      </div>
                      <button 
                        onClick={() => handleCopy(snip.id, snip.sql)}
                        className={`transition-colors ${copiedId === snip.id ? 'text-green-400' : isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-800'}`}
                        title={t('common.copyToClipboard', 'Copy to clipboard')}
                      >
                          {copiedId === snip.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                  </div>
                  <p className={`text-sm mb-4 h-10 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{snip.desc}</p>
                  
                  <div className={`flex-1 rounded p-3 mb-4 border overflow-hidden relative group/code ${isDark ? 'bg-gray-900 border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                      <code className={`text-xs font-mono block leading-relaxed break-all ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                          {snip.sql}
                      </code>
                      <div className={`absolute inset-0 bg-gradient-to-t via-transparent to-transparent opacity-50 group-hover/code:opacity-20 transition-opacity ${isDark ? 'from-gray-900' : 'from-gray-50'}`}></div>
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                      <div className="flex gap-2 flex-wrap">
                          {snip.tags.map((tag, i) => (
                              <span key={i} className={`flex items-center text-[10px] px-2 py-0.5 rounded border ${isDark ? 'text-gray-500 bg-gray-700/50 border-gray-600/30' : 'text-gray-600 bg-gray-100 border-gray-200'}`}>
                                  <Tag className="w-3 h-3 mr-1 opacity-50" /> {tag}
                              </span>
                          ))}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleOpenModal(snip)} className={`p-1.5 rounded ${isDark ? 'text-gray-500 hover:text-blue-400 hover:bg-gray-700' : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100'}`}><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(snip.id)} className={`p-1.5 rounded ${isDark ? 'text-gray-500 hover:text-red-400 hover:bg-gray-700' : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'}`}><Trash2 className="w-4 h-4" /></button>
                      </div>
                  </div>
              </div>
          ))}
          
          {/* Empty State */}
          {filteredSnippets.length === 0 && (
              <div className={`col-span-full py-12 text-center rounded-xl border border-dashed ${isDark ? 'text-gray-500 bg-gray-800/50 border-gray-700/50' : 'text-gray-400 bg-gray-50 border-gray-200'}`}>
                  <Scissors className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>{t('snippets.noSnippets', 'No snippets found.')}</p>
              </div>
          )}
      </div>

      {/* Modal */}
      {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className={`rounded-xl border w-full max-w-lg shadow-2xl ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className={`flex justify-between items-center p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <h2 className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{editingId ? t('snippets.editSnippet', 'Edit Snippet') : t('snippets.newSnippet', 'New SQL Snippet')}</h2>
                      <button onClick={() => setModalOpen(false)} className={`${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('snippets.titleLabel', 'Title')}</label>
                          <input 
                              type="text" 
                              value={formData.title}
                              onChange={e => setFormData({...formData, title: e.target.value})}
                              className={`w-full border rounded px-3 py-2 outline-none focus:border-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-800'}`}
                              placeholder={t('snippets.titlePlaceholder', 'e.g. Time Zone Conversion')}
                          />
                      </div>
                      <div>
                          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('snippets.descriptionLabel', 'Description')}</label>
                          <input 
                              type="text" 
                              value={formData.desc}
                              onChange={e => setFormData({...formData, desc: e.target.value})}
                              className={`w-full border rounded px-3 py-2 outline-none focus:border-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-800'}`}
                              placeholder={t('snippets.descriptionPlaceholder', 'Short description of what this does')}
                          />
                      </div>
                      <div>
                          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('snippets.sqlCodeLabel', 'SQL Code')}</label>
                          <textarea 
                              value={formData.sql}
                              onChange={e => setFormData({...formData, sql: e.target.value})}
                              className={`w-full h-32 border rounded px-3 py-2 font-mono text-sm outline-none focus:border-blue-500 resize-none ${isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-gray-50 border-gray-300 text-gray-800'}`}
                              placeholder="SELECT ..."
                          />
                      </div>
                      <div>
                          <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('snippets.tagsLabel', 'Tags (comma separated)')}</label>
                          <input 
                              type="text" 
                              value={formData.tags}
                              onChange={e => setFormData({...formData, tags: e.target.value})}
                              className={`w-full border rounded px-3 py-2 outline-none focus:border-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-800'}`}
                              placeholder={t('snippets.tagsPlaceholder', 'e.g. math, window, util')}
                          />
                      </div>
                  </div>
                  <div className={`p-6 border-t flex justify-end gap-3 rounded-b-xl ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
                      <button onClick={() => setModalOpen(false)} className={`px-4 py-2 text-sm ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-800'}`}>{t('common.cancel', 'Cancel')}</button>
                      <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium shadow-lg shadow-blue-900/20">
                          {editingId ? t('snippets.updateSnippet', 'Update Snippet') : t('snippets.saveSnippet', 'Save Snippet')}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
