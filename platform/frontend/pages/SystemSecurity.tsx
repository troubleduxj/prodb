import React from 'react';
import { Shield, Lock, FileText, Globe, AlertTriangle, Check } from 'lucide-react';
import { useTheme } from '../src/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export const SystemSecurity: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{t('security.settings')}</h1>
          <p className="text-sm text-gray-400 mt-1">{t('security.platformAccessControl')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Authentication Policy */}
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} p-6`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'} mb-6 flex items-center`}>
                  <Lock className="w-5 h-5 mr-2 text-blue-400" />
                  {t('security.authentication')}
              </h3>
              <div className="space-y-6">
                  <div className="flex items-center justify-between">
                      <div>
                          <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('security.enforceMFA')}</p>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('security.require2FA')}</p>
                      </div>
                      <div className={`w-11 h-6 ${isDark ? 'bg-gray-600' : 'bg-gray-300'} rounded-full relative cursor-pointer`}>
                          <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm"></div>
                      </div>
                  </div>
                  <div className="flex items-center justify-between">
                      <div>
                          <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('security.ldapSSO')}</p>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('security.syncWithAD')}</p>
                      </div>
                      <div className="w-11 h-6 bg-green-600 rounded-full relative cursor-pointer">
                          <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm"></div>
                      </div>
                  </div>
                  <hr className={`${isDark ? 'border-gray-700' : 'border-gray-200'}`} />
                  <div className="space-y-3">
                      <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{t('security.passwordPolicy')}</p>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} block mb-1`}>{t('security.minLength')}</label>
                              <input type="number" defaultValue={12} className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded px-2 py-1.5 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`} />
                          </div>
                          <div>
                              <label className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} block mb-1`}>{t('security.expiration')}</label>
                              <input type="number" defaultValue={90} className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded px-2 py-1.5 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`} />
                          </div>
                      </div>
                      <div className={`flex items-center gap-4 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          <span className="flex items-center"><Check className="w-3 h-3 mr-1 text-green-500"/> {t('security.requireSpecialChar')}</span>
                          <span className="flex items-center"><Check className="w-3 h-3 mr-1 text-green-500"/> {t('security.requireNumber')}</span>
                      </div>
                  </div>
              </div>
          </div>

          {/* Network Access */}
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} p-6`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'} mb-6 flex items-center`}>
                  <Globe className="w-5 h-5 mr-2 text-purple-400" />
                  {t('security.networkAccess')}
              </h3>
              <div className="space-y-4">
                  <div className={`p-3 ${isDark ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'} border rounded flex items-start gap-3`}>
                      <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                      <div className={`text-xs ${isDark ? 'text-yellow-200/80' : 'text-yellow-700'}`}>
                          <p className="font-bold mb-1">{t('security.publicAccessWarning')}</p>
                          <p>{t('security.publicAccessMessage')}</p>
                      </div>
                  </div>
                  <div>
                      <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>{t('security.adminIPWhitelist')}</label>
                      <textarea 
                          className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded-lg p-3 text-sm font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'} h-32 focus:border-blue-500 outline-none`}
                          defaultValue={`192.168.1.0/24\n10.0.0.0/8\n203.0.113.5`}
                      ></textarea>
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-2`}>{t('security.ipWhitelistHint')}</p>
                  </div>
              </div>
          </div>

          {/* Audit Logs */}
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} p-6 lg:col-span-2`}>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'} mb-6 flex items-center`}>
                  <FileText className="w-5 h-5 mr-2 text-green-400" />
                  {t('security.auditCompliance')}
              </h3>
              <div className="flex items-center gap-8">
                  <div className="flex-1 space-y-4">
                      <div className={`flex items-center justify-between p-3 ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'} rounded border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                          <div>
                              <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{t('security.ddlAuditing')}</p>
                              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('security.ddlAuditingDesc')}</p>
                          </div>
                          <div className="w-11 h-6 bg-green-600 rounded-full relative cursor-pointer">
                              <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm"></div>
                          </div>
                      </div>
                      <div className={`flex items-center justify-between p-3 ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'} rounded border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                          <div>
                              <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{t('security.dmlAuditing')}</p>
                              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('security.dmlAuditingDesc')}</p>
                          </div>
                          <div className={`w-11 h-6 ${isDark ? 'bg-gray-600' : 'bg-gray-300'} rounded-full relative cursor-pointer`}>
                              <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm"></div>
                          </div>
                      </div>
                  </div>
                  <div className="flex-1 space-y-4">
                      <div className={`flex items-center justify-between p-3 ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'} rounded border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                          <div>
                              <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{t('security.queryAuditing')}</p>
                              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('security.queryAuditingDesc')}</p>
                          </div>
                          <div className="w-11 h-6 bg-green-600 rounded-full relative cursor-pointer">
                              <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm"></div>
                          </div>
                      </div>
                      <div className={`flex items-center justify-between p-3 ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'} rounded border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                          <div>
                              <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{t('security.userLoginHistory')}</p>
                              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('security.userLoginHistoryDesc')}</p>
                          </div>
                          <div className="w-11 h-6 bg-green-600 rounded-full relative cursor-pointer">
                              <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm"></div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};
