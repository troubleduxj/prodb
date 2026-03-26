import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Users, MessageSquare, Github, Slack, Twitter, ExternalLink, Calendar, Star, MessageCircle } from 'lucide-react';
import { Page } from '../types';
import { useTheme } from '../src/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export const HelpCommunity: React.FC = () => {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 shrink-0">
            <div className="flex items-center gap-3">
                <button 
                    onClick={() => navigate(`/${Page.HELP_CENTER}`)}
                    className={`p-2 hover:${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-lg ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'} flex items-center`}>
                    <Users className="w-6 h-6 mr-3 text-green-400" />
                    {t('community.communityHub')}
                </h1>
            </div>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/20">
                {t('community.joinDiscord')}
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-y-auto">
            {/* Main Content Area */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* Hero Banner */}
                <div className={`bg-gradient-to-r ${isDark ? 'from-blue-900/40 to-purple-900/40 border-blue-500/30' : 'from-blue-100 to-purple-100 border-blue-300'} border rounded-xl p-8 relative overflow-hidden`}>
                    <div className="relative z-10">
                        <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>{t('community.developerConference')}</h2>
                        <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} mb-6 max-w-lg`}>{t('community.conferenceDescription')}</p>
                        <div className="flex gap-4">
                            <button className={`px-5 py-2 ${isDark ? 'bg-white text-blue-900 hover:bg-gray-100' : 'bg-blue-600 text-white hover:bg-blue-700'} rounded-lg font-bold text-sm transition-colors`}>
                                {t('community.registerNow')}
                            </button>
                            <button className={`px-5 py-2 ${isDark ? 'bg-blue-600/30 border-blue-400/50 text-blue-100 hover:bg-blue-600/40' : 'bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200'} border rounded-lg font-bold text-sm transition-colors`}>
                                {t('community.viewAgenda')}
                            </button>
                        </div>
                    </div>
                    <div className="absolute right-0 top-0 h-full w-1/3 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
                    <Calendar className={`absolute -right-6 -bottom-6 w-48 h-48 ${isDark ? 'text-white' : 'text-gray-300'} opacity-5`} />
                </div>

                {/* Resource Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-6 rounded-xl border hover:border-gray-500 transition-colors cursor-pointer group`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 ${isDark ? 'bg-gray-700 group-hover:bg-black group-hover:text-white' : 'bg-gray-100 group-hover:bg-gray-800 group-hover:text-white'} rounded-full transition-colors`}>
                                <Github className="w-6 h-6" />
                            </div>
                            <ExternalLink className={`w-4 h-4 ${isDark ? 'text-gray-500 group-hover:text-white' : 'text-gray-400 group-hover:text-gray-700'}`} />
                        </div>
                        <h3 className={`font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'} mb-1`}>GitHub</h3>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('community.githubDescription')}</p>
                        <div className={`mt-4 flex items-center gap-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /> 22.5k {t('community.stars')}
                        </div>
                    </div>

                    <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-6 rounded-xl border hover:border-blue-500/50 transition-colors cursor-pointer group`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 ${isDark ? 'bg-blue-900/20 text-blue-400 group-hover:bg-blue-600 group-hover:text-white' : 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'} rounded-full transition-colors`}>
                                <MessageSquare className="w-6 h-6" />
                            </div>
                            <ExternalLink className={`w-4 h-4 ${isDark ? 'text-gray-500 group-hover:text-white' : 'text-gray-400 group-hover:text-gray-700'}`} />
                        </div>
                        <h3 className={`font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'} mb-1`}>Discord</h3>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('community.discordDescription')}</p>
                        <div className="mt-4 flex items-center gap-2 text-xs text-green-400">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span> 450 {t('community.online')}
                        </div>
                    </div>

                    <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-6 rounded-xl border hover:border-orange-500/50 transition-colors cursor-pointer group`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 ${isDark ? 'bg-orange-900/20 text-orange-400 group-hover:bg-orange-600 group-hover:text-white' : 'bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white'} rounded-full transition-colors`}>
                                <MessageCircle className="w-6 h-6" />
                            </div>
                            <ExternalLink className={`w-4 h-4 ${isDark ? 'text-gray-500 group-hover:text-white' : 'text-gray-400 group-hover:text-gray-700'}`} />
                        </div>
                        <h3 className={`font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'} mb-1`}>Stack Overflow</h3>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('community.stackOverflowDescription')}</p>
                        <div className={`mt-4 flex items-center gap-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            1.2k {t('community.questions')}
                        </div>
                    </div>
                </div>

                {/* Latest Blog/News */}
                <div>
                    <h3 className={`text-lg font-bold ${isDark ? 'text-gray-200' : 'text-gray-700'} mb-4`}>{t('community.latestFromEngineering')}</h3>
                    <div className="space-y-3">
                        {[
                            { title: 'Optimizing Storage: How we achieved 10x compression', date: 'Oct 24, 2023', author: 'Jeff Tao' },
                            { title: 'Native Grafana Plugin v3.0 Released', date: 'Oct 20, 2023', author: 'Team' },
                            { title: 'Understanding the new Stream Processing Engine', date: 'Oct 15, 2023', author: 'Developer Relations' },
                        ].map((post, i) => (
                            <div key={i} className={`flex items-center justify-between p-4 ${isDark ? 'bg-gray-800 border-gray-700 hover:bg-gray-750' : 'bg-white border-gray-200 hover:bg-gray-50'} rounded-lg border cursor-pointer`}>
                                <div>
                                    <h4 className={`font-medium ${isDark ? 'text-gray-200 hover:text-blue-400' : 'text-gray-700 hover:text-blue-600'} transition-colors`}>{post.title}</h4>
                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>{t('community.by')} {post.author} • {post.date}</p>
                                </div>
                                <ChevronLeft className={`w-4 h-4 ${isDark ? 'text-gray-600' : 'text-gray-400'} rotate-180`} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sidebar Feed */}
            <div className="space-y-6">
                <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border p-5`}>
                    <h3 className={`font-bold ${isDark ? 'text-gray-200' : 'text-gray-700'} mb-4 flex items-center`}>
                        <Slack className="w-4 h-4 mr-2 text-purple-400" /> {t('community.recentDiscussions')}
                    </h3>
                    <div className="space-y-4">
                        {[
                            { user: 'devtools_guy', msg: 'Has anyone tried the new Python connector with Pandas?', time: '2m ago' },
                            { user: 'iot_master', msg: 'Solved the wal_fsync issue, thanks @admin!', time: '15m ago' },
                            { user: 'newbie_dev', msg: 'Getting error code 0x2001 when creating stream.', time: '1h ago' },
                        ].map((chat, i) => (
                            <div key={i} className={`flex gap-3 items-start border-b ${isDark ? 'border-gray-700/50' : 'border-gray-200'} last:border-0 pb-3 last:pb-0`}>
                                <div className={`w-8 h-8 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'} flex items-center justify-center text-xs font-bold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {chat.user.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex justify-between items-baseline w-full">
                                        <span className={`text-xs font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{chat.user}</span>
                                        <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{chat.time}</span>
                                    </div>
                                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-0.5 line-clamp-2`}>{chat.msg}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button className="w-full mt-4 text-xs text-center text-blue-400 hover:text-blue-300">
                        {t('community.viewAllDiscussions')}
                    </button>
                </div>

                <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border p-5`}>
                    <h3 className={`font-bold ${isDark ? 'text-gray-200' : 'text-gray-700'} mb-4`}>{t('community.connectWithUs')}</h3>
                    <div className="space-y-3">
                        <a href="#" className={`flex items-center gap-3 p-3 rounded-lg ${isDark ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'} transition-colors`}>
                            <Twitter className="w-5 h-5 text-blue-400" />
                            <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{t('community.followTwitter')}</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
