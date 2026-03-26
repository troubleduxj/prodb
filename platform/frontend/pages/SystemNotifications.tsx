import React, { useState } from 'react';
import { Bell, Mail, Webhook, MessageSquare, Save, Plus, Edit2, Trash2 } from 'lucide-react';
import { useTheme } from '../src/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export const SystemNotifications: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'channels' | 'templates'>('channels');
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('notification.settings')}</h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1`}>{t('notification.configureAlerting')}</p>
        </div>
        <div className={`flex gap-2 ${isDark ? 'bg-gray-800' : 'bg-white'} p-1 rounded-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <button 
                onClick={() => setActiveTab('channels')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'channels' ? (isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900') : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}
            >
                {t('notification.channels')}
            </button>
            <button 
                onClick={() => setActiveTab('templates')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'templates' ? (isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-900') : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}`}
            >
                {t('notification.templates')}
            </button>
        </div>
      </div>

      {activeTab === 'channels' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* SMTP Configuration */}
              <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} p-6`}>
                  <div className="flex items-center justify-between mb-6">
                      <h3 className={`text-lg font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'} flex items-center`}>
                          <Mail className="w-5 h-5 mr-2 text-blue-400" />
                          {t('notification.smtpServer')}
                      </h3>
                      <div className="w-11 h-6 bg-green-600 rounded-full relative cursor-pointer">
                          <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm"></div>
                      </div>
                  </div>
                  <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                          <div className="col-span-2">
                              <label className={`block text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-1`}>{t('notification.host')}</label>
                              <input type="text" defaultValue="smtp.gmail.com" className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none`} />
                          </div>
                          <div className="col-span-1">
                              <label className={`block text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-1`}>{t('notification.port')}</label>
                              <input type="number" defaultValue={587} className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none`} />
                          </div>
                      </div>
                      <div>
                          <label className={`block text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-1`}>{t('notification.username')}</label>
                          <input type="text" defaultValue="alerts@tdengine.local" className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none`} />
                      </div>
                      <div>
                          <label className={`block text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-1`}>{t('notification.password')}</label>
                          <input type="password" defaultValue="********" className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none`} />
                      </div>
                      <div>
                          <label className={`block text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-1`}>{t('notification.senderName')}</label>
                          <input type="text" defaultValue="TDengine Alerts" className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none`} />
                      </div>
                      <div className="pt-4 flex justify-end">
                          <button className={`px-4 py-2 ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} text-white rounded text-sm transition-colors`}>
                              {t('notification.sendTestEmail')}
                          </button>
                      </div>
                  </div>
              </div>

              {/* Other Channels */}
              <div className="space-y-6">
                  {/* Slack */}
                  <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} p-6`}>
                      <div className="flex items-center justify-between mb-4">
                          <h3 className={`text-lg font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'} flex items-center`}>
                              <MessageSquare className="w-5 h-5 mr-2 text-purple-400" />
                              {t('notification.slackIntegration')}
                          </h3>
                          <div className={`w-11 h-6 ${isDark ? 'bg-gray-600' : 'bg-gray-300'} rounded-full relative cursor-pointer`}>
                              <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm"></div>
                          </div>
                      </div>
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-4`}>{t('notification.slackDescription')}</p>
                      <div>
                          <label className={`block text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-1`}>{t('notification.webhookURL')}</label>
                          <input type="password" placeholder="https://hooks.slack.com/services/..." className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none`} disabled />
                      </div>
                  </div>

                  {/* Generic Webhook */}
                  <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} p-6`}>
                      <div className="flex items-center justify-between mb-4">
                          <h3 className={`text-lg font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'} flex items-center`}>
                              <Webhook className="w-5 h-5 mr-2 text-yellow-400" />
                              {t('notification.globalWebhook')}
                          </h3>
                          <div className="w-11 h-6 bg-green-600 rounded-full relative cursor-pointer">
                              <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm"></div>
                          </div>
                      </div>
                      <div className="space-y-3">
                          <div>
                              <label className={`block text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-1`}>{t('notification.endpointURL')}</label>
                              <input type="text" defaultValue="https://api.opsgenie.com/v1/alerts" className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none`} />
                          </div>
                          <div>
                              <label className={`block text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-1`}>{t('notification.authHeader')}</label>
                              <input type="text" defaultValue="Authorization: GenieKey 123-abc" className={`w-full ${isDark ? 'bg-gray-900' : 'bg-gray-50'} border ${isDark ? 'border-gray-600' : 'border-gray-300'} rounded px-3 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'} outline-none`} />
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      ) : (
          /* Templates Tab */
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} overflow-hidden`}>
              <div className={`grid grid-cols-12 gap-4 p-4 border-b ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'} text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'} uppercase`}>
                  <div className="col-span-3">{t('notification.templateName')}</div>
                  <div className="col-span-2">{t('notification.type')}</div>
                  <div className="col-span-5">{t('notification.subjectPreview')}</div>
                  <div className="col-span-2 text-right">{t('common.actions')}</div>
              </div>
              {[
                  { name: 'Default Alert', type: 'Email', preview: '[Alert] {{rule_name}} is triggering on {{host}}' },
                  { name: 'Recovery Notice', type: 'Email', preview: '[Resolved] {{rule_name}} back to normal' },
                  { name: 'Slack Compact', type: 'Slack Payload', preview: '{"text": ":warning: *{{rule_name}}*: {{value}}"}' },
              ].map((tpl, i) => (
                  <div key={i} className={`grid grid-cols-12 gap-4 p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} last:border-0 ${isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'} items-center`}>
                      <div className={`col-span-3 font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{tpl.name}</div>
                      <div className="col-span-2">
                          <span className={`text-xs ${isDark ? 'bg-gray-700' : 'bg-gray-200'} px-2 py-1 rounded ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{tpl.type}</span>
                      </div>
                      <div className={`col-span-5 text-xs font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'} truncate`}>{tpl.preview}</div>
                      <div className="col-span-2 flex justify-end gap-2">
                          <button className={`p-2 ${isDark ? 'text-gray-400 hover:text-blue-400 hover:bg-gray-700' : 'text-gray-500 hover:text-blue-500 hover:bg-gray-100'} rounded`}><Edit2 className="w-4 h-4"/></button>
                          <button className={`p-2 ${isDark ? 'text-gray-400 hover:text-red-400 hover:bg-gray-700' : 'text-gray-500 hover:text-red-500 hover:bg-gray-100'} rounded`}><Trash2 className="w-4 h-4"/></button>
                      </div>
                  </div>
              ))}
              <div className={`p-4 ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                  <button className="flex items-center text-sm text-blue-400 hover:text-blue-300">
                      <Plus className="w-4 h-4 mr-2" /> {t('notification.addCustomTemplate')}
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};
