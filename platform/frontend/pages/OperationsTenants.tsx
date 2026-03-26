
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { Users, Database, HardDrive, Network, Plus, MoreHorizontal, Shield, Clock, Key, Ban, CheckCircle, Activity, Search, X, Save } from 'lucide-react';

// --- Types ---
interface Tenant {
    id: string;
    name: string;
    company: string;
    dbName: string;
    plan: 'Starter' | 'Professional' | 'Enterprise';
    status: 'Active' | 'Suspended' | 'Provisioning';
    createdAt: string;
    resources: {
        storageUsed: number; // GB
        storageLimit: number; // GB
        tablesUsed: number;
        tablesLimit: number;
        connections: number;
        maxConnections: number;
    };
    config: {
        retentionDays: number;
        replicas: number;
    };
}

// --- Mock Data ---
const INITIAL_TENANTS: Tenant[] = [
    { 
        id: 'tenant_001', 
        name: 'Power Corp', 
        company: 'Global Power Inc.',
        dbName: 't_power_corp', 
        plan: 'Enterprise',
        status: 'Active',
        createdAt: '2023-01-15',
        resources: { storageUsed: 450, storageLimit: 1000, tablesUsed: 1200, tablesLimit: 5000, connections: 120, maxConnections: 500 },
        config: { retentionDays: 3650, replicas: 3 }
    },
    { 
        id: 'tenant_002', 
        name: 'Smart Factory', 
        company: 'AutoParts Mfg',
        dbName: 't_smart_fact', 
        plan: 'Professional',
        status: 'Active',
        createdAt: '2023-03-22',
        resources: { storageUsed: 850, storageLimit: 1000, tablesUsed: 4500, tablesLimit: 5000, connections: 480, maxConnections: 500 },
        config: { retentionDays: 365, replicas: 1 }
    },
    { 
        id: 'tenant_003', 
        name: 'Fleet Logistics', 
        company: 'FastMove Logistics',
        dbName: 't_fleet_logs', 
        plan: 'Starter',
        status: 'Suspended',
        createdAt: '2023-06-10',
        resources: { storageUsed: 120, storageLimit: 200, tablesUsed: 50, tablesLimit: 100, connections: 0, maxConnections: 50 },
        config: { retentionDays: 90, replicas: 1 }
    },
];

export const OperationsTenants: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [tenants, setTenants] = useState<Tenant[]>(INITIAL_TENANTS);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // New Tenant Form State
  const [newTenant, setNewTenant] = useState({
      name: '',
      company: '',
      plan: 'Starter'
  });

  const handleCreateTenant = () => {
      const dbName = `t_${newTenant.name.toLowerCase().replace(/\s+/g, '_')}_${Math.floor(Math.random()*1000)}`;
      const limits = newTenant.plan === 'Enterprise' 
        ? { storage: 5000, tables: 50000, conns: 2000, rep: 3, ret: 3650 }
        : newTenant.plan === 'Professional'
        ? { storage: 1000, tables: 5000, conns: 500, rep: 2, ret: 365 }
        : { storage: 200, tables: 100, conns: 50, rep: 1, ret: 90 };

      const tenant: Tenant = {
          id: `tenant_${Date.now()}`,
          name: newTenant.name,
          company: newTenant.company,
          dbName: dbName,
          plan: newTenant.plan as any,
          status: 'Provisioning',
          createdAt: new Date().toISOString().split('T')[0],
          resources: {
              storageUsed: 0,
              storageLimit: limits.storage,
              tablesUsed: 0,
              tablesLimit: limits.tables,
              connections: 0,
              maxConnections: limits.conns
          },
          config: { retentionDays: limits.ret, replicas: limits.rep }
      };

      setTenants([tenant, ...tenants]);
      setShowModal(false);
      setNewTenant({ name: '', company: '', plan: 'Starter' });

      // Simulate Provisioning
      setTimeout(() => {
          setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, status: 'Active' } : t));
      }, 2000);
  };

  const toggleStatus = (id: string) => {
      setTenants(prev => prev.map(t => {
          if (t.id === id) {
              return { ...t, status: t.status === 'Active' ? 'Suspended' : 'Active' };
          }
          return t;
      }));
  };

  const getUsageColor = (used: number, limit: number) => {
      const ratio = used / limit;
      if (ratio > 0.9) return 'bg-red-500';
      if (ratio > 0.75) return 'bg-yellow-500';
      return 'bg-blue-500';
  };

  const filteredTenants = tenants.filter(t => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.dbName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
          <div>
             <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('tenants.title', 'Multi-Tenancy Management')}</h1>
             <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('tenants.description', 'Manage tenant databases, resource quotas, and access credentials.')}</p>
          </div>
          <div className="flex gap-3">
             <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t('tenants.searchPlaceholder', 'Search tenants...')} 
                    className={`pl-9 pr-4 py-2 border rounded-lg text-sm outline-none w-64 ${isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-300 text-gray-800'}`} 
                />
             </div>
             <button 
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center shadow-lg shadow-blue-900/20"
             >
                <Plus className="w-4 h-4 mr-2" /> {t('tenants.provisionTenant', 'Provision Tenant')}
             </button>
          </div>
       </div>

       {/* Tenant Cards */}
       <div className="grid grid-cols-1 gap-6">
           {filteredTenants.map(tenant => (
               <div key={tenant.id} className={`rounded-xl border p-6 flex flex-col md:flex-row md:items-start gap-6 transition-all ${tenant.status === 'Suspended' ? 'opacity-75 grayscale-[0.5]' : ''} ${isDark ? (tenant.status === 'Suspended' ? 'bg-gray-800 border-red-900/30' : 'bg-gray-800 border-gray-700 hover:border-blue-500/30') : (tenant.status === 'Suspended' ? 'bg-white border-red-200' : 'bg-white border-gray-200 hover:border-blue-300')}`}>
                   
                   {/* Info Column */}
                   <div className={`w-full md:w-64 shrink-0 pr-6 ${isDark ? 'border-r border-gray-700/50' : 'border-r border-gray-200'}`}>
                       <div className="flex items-center gap-3 mb-2">
                           <div className={`p-3 rounded-lg ${tenant.status === 'Active' ? 'bg-blue-500/20 text-blue-400' : tenant.status === 'Provisioning' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                               <Users className="w-6 h-6" />
                           </div>
                           <div>
                               <h3 className={`font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{tenant.name}</h3>
                               <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{tenant.company}</p>
                           </div>
                       </div>
                       
                       <div className="space-y-2 mt-4">
                           <div className="flex items-center justify-between text-xs">
                               <span className={`flex items-center ${isDark ? 'text-gray-500' : 'text-gray-500'}`}><Database className="w-3 h-3 mr-1.5"/> {t('tenants.database', 'Database')}</span>
                               <span className="text-blue-300 font-mono bg-blue-900/20 px-1.5 rounded">{tenant.dbName}</span>
                           </div>
                           <div className="flex items-center justify-between text-xs">
                               <span className={`flex items-center ${isDark ? 'text-gray-500' : 'text-gray-500'}`}><Shield className="w-3 h-3 mr-1.5"/> {t('tenants.plan', 'Plan')}</span>
                               <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{tenant.plan}</span>
                           </div>
                           <div className="flex items-center justify-between text-xs">
                               <span className={`flex items-center ${isDark ? 'text-gray-500' : 'text-gray-500'}`}><Clock className="w-3 h-3 mr-1.5"/> {t('tenants.created', 'Created')}</span>
                               <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{tenant.createdAt}</span>
                           </div>
                       </div>

                       <div className={`mt-4 pt-4 flex justify-between items-center ${isDark ? 'border-t border-gray-700/50' : 'border-t border-gray-200'}`}>
                           <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                               tenant.status === 'Active' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 
                               tenant.status === 'Provisioning' ? 'bg-yellow-500/10 text-yellow-500 animate-pulse' :
                               'bg-red-500/10 text-red-500 border border-red-500/20'
                           }`}>
                               {tenant.status}
                           </span>
                           <div className="flex gap-1">
                                <button className={`p-1.5 rounded ${isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'}`} title={t('tenants.accessKeys', 'Access Keys')}>
                                    <Key className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => toggleStatus(tenant.id)}
                                    className={`p-1.5 rounded ${isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-red-400' : 'hover:bg-gray-100 text-gray-500 hover:text-red-500'}`} 
                                    title={tenant.status === 'Active' ? t('tenants.suspend', 'Suspend') : t('tenants.activate', 'Activate')}
                                >
                                    {tenant.status === 'Active' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                </button>
                           </div>
                       </div>
                   </div>

                   {/* Resources Column */}
                   <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                       <h4 className={`col-span-2 text-xs font-bold uppercase tracking-wider mb-[-10px] ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('tenants.resourceQuotas', 'Resource Quotas & Usage')}</h4>
                       
                       {/* Storage Quota */}
                       <div className="space-y-2">
                           <div className="flex justify-between text-sm">
                               <span className={`flex items-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}><HardDrive className={`w-4 h-4 mr-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}/> {t('tenants.storage', 'Storage')}</span>
                               <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{tenant.resources.storageUsed} GB <span className={isDark ? 'text-gray-500' : 'text-gray-500'}>/ {tenant.resources.storageLimit} GB</span></span>
                           </div>
                           <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-700/50' : 'bg-gray-200'}`}>
                               <div 
                                 className={`h-full rounded-full ${getUsageColor(tenant.resources.storageUsed, tenant.resources.storageLimit)}`} 
                                 style={{width: `${(tenant.resources.storageUsed / tenant.resources.storageLimit) * 100}%`}}
                               ></div>
                           </div>
                           <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('tenants.retention', 'Retention')}: {tenant.config.retentionDays} {t('common.days', 'Days')}</p>
                       </div>

                       {/* Connections Quota */}
                       <div className="space-y-2">
                           <div className="flex justify-between text-sm">
                               <span className={`flex items-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}><Network className={`w-4 h-4 mr-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}/> {t('tenants.connections', 'Connections')}</span>
                               <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{tenant.resources.connections} <span className={isDark ? 'text-gray-500' : 'text-gray-500'}>/ {tenant.resources.maxConnections}</span></span>
                           </div>
                           <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-700/50' : 'bg-gray-200'}`}>
                               <div 
                                 className={`h-full rounded-full ${getUsageColor(tenant.resources.connections, tenant.resources.maxConnections)}`} 
                                 style={{width: `${(tenant.resources.connections / tenant.resources.maxConnections) * 100}%`}}
                               ></div>
                           </div>
                           <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('tenants.ingressLimit', 'Ingress Limit')}</p>
                       </div>

                       {/* Table Count */}
                       <div className="space-y-2">
                           <div className="flex justify-between text-sm">
                               <span className={`flex items-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}><Activity className={`w-4 h-4 mr-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}/> {t('tenants.tables', 'Tables')}</span>
                               <span className={isDark ? 'text-gray-200' : 'text-gray-800'}>{tenant.resources.tablesUsed.toLocaleString()} <span className={isDark ? 'text-gray-500' : 'text-gray-500'}>/ {tenant.resources.tablesLimit.toLocaleString()}</span></span>
                           </div>
                           <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-700/50' : 'bg-gray-200'}`}>
                               <div 
                                 className={`h-full rounded-full ${getUsageColor(tenant.resources.tablesUsed, tenant.resources.tablesLimit)}`} 
                                 style={{width: `${(tenant.resources.tablesUsed / tenant.resources.tablesLimit) * 100}%`}}
                               ></div>
                           </div>
                           <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('tenants.devicesSubtables', 'Devices / Sub-tables')}</p>
                       </div>

                       {/* Configs */}
                       <div className={`flex items-center gap-4 text-xs rounded-lg border p-3 ${isDark ? 'bg-gray-900/50 border-gray-700/50 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                           <div className="flex flex-col">
                               <span className={`uppercase text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('tenants.replica', 'Replica')}</span>
                               <span className={isDark ? 'text-gray-200 font-mono' : 'text-gray-800 font-mono'}>{tenant.config.replicas} {t('common.copies', 'Copies')}</span>
                           </div>
                           <div className={`w-px h-6 ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
                           <div className="flex flex-col">
                               <span className={`uppercase text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('tenants.vgroups', 'VGroups')}</span>
                               <span className={isDark ? 'text-gray-200 font-mono' : 'text-gray-800 font-mono'}>{t('tenants.auto', 'Auto')} (2-12)</span>
                           </div>
                           <div className={`w-px h-6 ${isDark ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
                           <div className="flex flex-col">
                               <span className={`uppercase text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('tenants.isolation', 'Isolation')}</span>
                               <span className="text-green-400 font-bold">{t('tenants.physicalDB', 'Physical DB')}</span>
                           </div>
                       </div>
                   </div>
               </div>
           ))}
       </div>

       {/* Provisioning Modal */}
       {showModal && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
               <div className={`rounded-xl border w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                   <div className={`p-6 border-b flex justify-between items-center ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                       <div>
                           <h2 className={`text-xl font-bold flex items-center ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                               <Plus className="w-5 h-5 mr-2 text-blue-400" /> {t('tenants.provisionTenant', 'Provision Tenant')}
                           </h2>
                           <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('tenants.provisionDescription', 'This will create a dedicated Database and User in TDengine.')}</p>
                       </div>
                       <button onClick={() => setShowModal(false)} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}><X className="w-6 h-6"/></button>
                   </div>
                   
                   <div className="p-6 space-y-4">
                       <div>
                           <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('tenants.tenantName', 'Tenant Name')} <span className="text-red-400">*</span></label>
                           <input 
                               type="text" 
                               value={newTenant.name}
                               onChange={e => setNewTenant({...newTenant, name: e.target.value})}
                               className={`w-full border rounded-lg px-3 py-2 outline-none focus:border-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-800'}`}
                               placeholder={t('tenants.tenantNamePlaceholder', 'e.g. Acme Corp')}
                           />
                       </div>
                       <div>
                           <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('tenants.company', 'Company / Organization')}</label>
                           <input 
                               type="text" 
                               value={newTenant.company}
                               onChange={e => setNewTenant({...newTenant, company: e.target.value})}
                               className={`w-full border rounded-lg px-3 py-2 outline-none focus:border-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-800'}`}
                               placeholder={t('tenants.companyPlaceholder', 'e.g. Acme International Ltd.')}
                           />
                       </div>
                       <div>
                           <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('tenants.servicePlan', 'Service Plan')}</label>
                           <div className="grid grid-cols-3 gap-3">
                               {['Starter', 'Professional', 'Enterprise'].map(plan => (
                                   <div 
                                       key={plan}
                                       onClick={() => setNewTenant({...newTenant, plan})}
                                       className={`cursor-pointer border rounded-lg p-3 text-center transition-all ${
                                           newTenant.plan === plan 
                                           ? 'bg-blue-600/20 border-blue-500 text-blue-100 ring-1 ring-blue-500' 
                                           : isDark ? 'bg-gray-700/50 border-gray-600 text-gray-400 hover:bg-gray-700' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                                       }`}
                                   >
                                       <div className="font-bold text-sm mb-1">{plan}</div>
                                       <div className="text-[10px] opacity-70">
                                           {plan === 'Starter' ? '200GB / 1 Rep' : plan === 'Professional' ? '1TB / 2 Rep' : '5TB / 3 Rep'}
                                       </div>
                                   </div>
                               ))}
                           </div>
                       </div>

                       <div className={`p-3 rounded border text-xs font-mono ${isDark ? 'bg-gray-900/50 border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                           <p className="mb-1">{t('tenants.proposedConfig', 'Proposed Config')}:</p>
                           <p>CREATE DATABASE <span className="text-blue-400">{`t_${newTenant.name.toLowerCase().replace(/\s+/g, '_')}_xxx`}</span></p>
                           <p>KEEP {newTenant.plan === 'Starter' ? '90' : newTenant.plan === 'Professional' ? '365' : '3650'}</p>
                           <p>REPLICA {newTenant.plan === 'Starter' ? '1' : newTenant.plan === 'Professional' ? '2' : '3'}</p>
                       </div>
                   </div>

                   <div className={`p-6 border-t flex justify-end gap-3 rounded-b-xl ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
                       <button onClick={() => setShowModal(false)} className={`px-4 py-2 text-sm ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-800'}`}>{t('common.cancel', 'Cancel')}</button>
                       <button 
                           onClick={handleCreateTenant}
                           disabled={!newTenant.name}
                           className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                           <Save className="w-4 h-4 mr-2" /> {t('tenants.createTenant', 'Create Tenant')}
                       </button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};
