import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { Hexagon, CheckCircle, RefreshCcw, Save, Settings, Layers, Box, TrendingUp, Calendar, Sparkles, AlertCircle, HardDrive, Calculator, Database, Scale, ArrowRightLeft, LayoutTemplate, ArrowRight, AlertTriangle } from 'lucide-react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell } from 'recharts';
import { analyzeStorageTrend } from '../services/geminiService';

const CONFIG_PARAMS = [
    { name: 'walLevel', value: '2', type: 'select', options: ['0', '1', '2'], desc: 'Write Ahead Log Level' },
    { name: 'fsync', value: '1000', type: 'number', desc: 'Fsync frequency (ms)' },
    { name: 'minRows', value: '100', type: 'number', desc: 'Min rows to flush block' },
    { name: 'maxRows', value: '4096', type: 'number', desc: 'Max rows per block' },
    { name: 'blocks', value: '6', type: 'number', desc: 'Memory blocks per VNode' },
    { name: 'keep', value: '3650', type: 'number', desc: 'Default retention days' },
];

export const OperationsCluster: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  
  const [configs, setConfigs] = useState(CONFIG_PARAMS);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showRebalanceSim, setShowRebalanceSim] = useState(false);

  const handleConfigChange = (name: string, val: string) => {
      setConfigs(prev => prev.map(c => c.name === name ? {...c, value: val} : c));
  };

  // --- Capacity Forecasting Logic (Linear Regression) ---
  const capacityMetrics = useMemo(() => {
    const TOTAL_CAPACITY_GB = 12000; // 12 TB Total
    const TOTAL_CAPACITY_TB = 12;
    const HISTORY_DAYS = 30;
    
    // 1. Generate Mock History (Last 30 Days)
    const historyData = [];
    const now = new Date();
    // Start from ~8.5TB and grow linearly with some random noise
    const startUsage = 8500; 
    const dailyGrowthMean = 65; // GB/day
    
    for (let i = HISTORY_DAYS; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        // Add randomness/seasonality
        const noise = (Math.sin(i) * 20) + (Math.random() * 10);
        const usage = startUsage + ((HISTORY_DAYS - i) * dailyGrowthMean) + noise;
        
        historyData.push({
            day: i === 0 ? 'Today' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            usage: parseFloat((usage / 1024).toFixed(2)), // Convert to TB
            rawUsage: usage,
            timestamp: i // relative day index for regression
        });
    }

    const currentUsageGB = historyData[historyData.length - 1].rawUsage;
    const currentUsageTB = parseFloat((currentUsageGB / 1024).toFixed(2));

    // 2. Perform Linear Regression (Least Squares)
    const n = historyData.length;
    const sumX = historyData.reduce((acc, item) => acc + item.timestamp, 0);
    const sumY = historyData.reduce((acc, item) => acc + item.rawUsage, 0);
    const sumXY = historyData.reduce((acc, item) => acc + (item.timestamp * item.rawUsage), 0);
    const sumXX = historyData.reduce((acc, item) => acc + (item.timestamp * item.timestamp), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // 3. Predict Disk Full Date
    // Solve for x when y = TOTAL_CAPACITY_GB
    // TOTAL = intercept + slope * x  =>  x = (TOTAL - intercept) / slope
    const daysUntilFull = (TOTAL_CAPACITY_GB - (intercept + slope * HISTORY_DAYS)) / slope;
    
    const fullDate = new Date(now);
    fullDate.setDate(fullDate.getDate() + daysUntilFull);

    // 4. Generate Forecast Points for Chart (Project out to full date + buffer)
    const forecastData = [];
    // Only plot forecast if slope is positive
    if (slope > 0) {
        // Start from today
        forecastData.push({
            day: 'Today',
            usage: currentUsageTB, // Connect lines
            forecast: currentUsageTB,
        });

        // Add a few points until full
        const steps = 5;
        const stepSize = Math.max(1, Math.floor(daysUntilFull / steps));
        
        for (let i = 1; i <= steps + 1; i++) {
            const futureDays = i * stepSize;
            if (futureDays > daysUntilFull + 5) break; // Don't go too far past full

            const futureDate = new Date(now);
            futureDate.setDate(futureDate.getDate() + futureDays);
            
            // y = mx + b (x is relative to start of history)
            const predictedGB = intercept + slope * (HISTORY_DAYS + futureDays);
            
            forecastData.push({
                day: futureDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                forecast: parseFloat((predictedGB / 1024).toFixed(2)),
                isProjected: true
            });
        }
    }

    return {
        history: historyData,
        forecast: forecastData,
        daysRemaining: Math.floor(daysUntilFull),
        fullDate: fullDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        growthRate: slope.toFixed(1), // GB/day
        currentUsageTB,
        totalCapacityTB: TOTAL_CAPACITY_TB,
        percentUsed: ((currentUsageGB / TOTAL_CAPACITY_GB) * 100).toFixed(1)
    };
  }, []);

  // --- Storage Distribution Logic ---
  const storageBreakdown = useMemo(() => {
    const used = capacityMetrics.currentUsageTB;
    const total = capacityMetrics.totalCapacityTB;
    const free = Math.max(0, total - used);
    
    // Mock distribution of used space
    return [
        { name: 'power_db', value: used * 0.45, color: 'bg-blue-500', textColor: 'text-blue-400' },
        { name: 'factory_db', value: used * 0.30, color: 'bg-green-500', textColor: 'text-green-400' },
        { name: 'fleet_db', value: used * 0.15, color: 'bg-purple-500', textColor: 'text-purple-400' },
        { name: 'System/WAL', value: used * 0.10, color: 'bg-yellow-500', textColor: 'text-yellow-400' },
        { name: 'Free Space', value: free, color: isDark ? 'bg-gray-700' : 'bg-gray-300', textColor: isDark ? 'text-gray-500' : 'text-gray-500' },
    ];
  }, [capacityMetrics, isDark]);

  // --- VGroup Heatmap Logic ---
  const vGroupNodes = useMemo(() => [
      { id: 1, ip: '192.168.1.101', count: 92, role: 'MNODE', zone: 'us-east-1a' }, 
      { id: 2, ip: '192.168.1.102', count: 45, role: 'DNODE', zone: 'us-east-1a' },
      { id: 3, ip: '192.168.1.103', count: 41, role: 'DNODE', zone: 'us-east-1b' },
      { id: 4, ip: '192.168.1.104', count: 8,  role: 'DNODE', zone: 'us-east-1b' },
  ], []);

  const totalVGroups = vGroupNodes.reduce((acc, n) => acc + n.count, 0);
  const avgVGroups = Math.round(totalVGroups / vGroupNodes.length);
  // Calculate Standard Deviation for Heatmap
  const variance = vGroupNodes.reduce((acc, n) => acc + Math.pow(n.count - avgVGroups, 2), 0) / vGroupNodes.length;
  const stdDev = Math.sqrt(variance);
  const isClusterUnbalanced = stdDev > 15; // Threshold for alert

  const getHeatmapStyle = (count: number) => {
      const diff = count - avgVGroups;
      if (diff > 20) return { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400', bar: 'bg-red-500' };
      if (diff < -20) return { bg: isDark ? 'bg-gray-700/50' : 'bg-gray-200/50', border: isDark ? 'border-gray-600' : 'border-gray-300', text: isDark ? 'text-gray-400' : 'text-gray-500', bar: isDark ? 'bg-gray-500' : 'bg-gray-400' };
      return { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', bar: 'bg-green-500' };
  };

  const handleAnalyze = async () => {
      setIsAnalyzing(true);
      try {
          const result = await analyzeStorageTrend(
              capacityMetrics.history, 
              capacityMetrics.growthRate, 
              capacityMetrics.daysRemaining
          );
          setAiAnalysis(result);
      } catch (error) {
          console.error(error);
      } finally {
          setIsAnalyzing(false);
      }
  };

  // Combine data for the chart
  const chartData = [...capacityMetrics.history, ...capacityMetrics.forecast.slice(1)];

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
          <div>
             <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('operations.cluster.clusterCore', 'Cluster Core')}</h1>
             <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('operations.cluster.globalClusterStatus', 'Global cluster status, topology, and configuration.')}</p>
          </div>
          <button className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center border ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'}`}>
             <RefreshCcw className="w-4 h-4 mr-2" /> {t('common.refreshState', 'Refresh State')}
          </button>
       </div>

       {/* Top Status Cards - Compact */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <div className={`p-4 rounded-xl flex items-center gap-3 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
               <div className="p-2 bg-green-500/20 rounded-full">
                   <CheckCircle className="w-5 h-5 text-green-500" />
               </div>
               <div>
                   <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('common.healthy', 'Healthy')}</h3>
                   <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('operations.cluster.clusterStatus', 'Cluster Status')}</p>
               </div>
           </div>
           
           <div className={`p-4 rounded-xl flex items-center gap-3 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
               <div className="p-2 bg-blue-500/20 rounded-full">
                   <Layers className="w-5 h-5 text-blue-500" />
               </div>
               <div>
                   <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>4 {t('operations.cluster.nodes', 'Nodes')}</h3>
                   <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>1 {t('operations.cluster.mnode', 'MNode')}, 3 {t('operations.cluster.dnodes', 'DNodes')}</p>
               </div>
           </div>

           <div className={`p-4 rounded-xl flex items-center gap-3 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
               <div className="p-2 bg-purple-500/20 rounded-full">
                   <Box className="w-5 h-5 text-purple-500" />
               </div>
               <div>
                   <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{totalVGroups} {t('operations.cluster.vgroups', 'VGroups')}</h3>
                   <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('operations.cluster.replicaFactor', 'Replica Factor')}: 3</p>
               </div>
           </div>

           <div className={`p-4 rounded-xl flex items-center gap-3 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
               <div className="p-2 bg-yellow-500/20 rounded-full">
                   <HardDrive className="w-5 h-5 text-yellow-500" />
               </div>
               <div>
                   <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{capacityMetrics.percentUsed}%</h3>
                   <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('operations.cluster.storageUsed', 'Storage Used')}</p>
               </div>
           </div>
       </div>

       {/* Grid: Added items-start to prevent left card stretching */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
           
           {/* Capacity Forecasting Section */}
           <div className={`lg:col-span-2 rounded-xl p-5 flex flex-col ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
               <div className={`flex items-center justify-between mb-4 border-b pb-3 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                   <div className="flex items-center gap-2">
                       <h3 className={`font-bold flex items-center ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                           <TrendingUp className="w-5 h-5 mr-2 text-blue-400" /> {t('operations.cluster.capacityForecasting', 'Capacity Forecasting')}
                       </h3>
                       {/* Method Indicator */}
                       <span className={`text-[10px] px-2 py-0.5 rounded border flex items-center ${isDark ? 'bg-gray-700 text-gray-400 border-gray-600' : 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                           <Calculator className="w-3 h-3 mr-1" />
                           {t('operations.cluster.modelLinearRegression', 'Model: Linear Regression')}
                       </span>
                   </div>
                   
                   {/* Ask AI Button */}
                   <button 
                       onClick={handleAnalyze}
                       disabled={isAnalyzing}
                       className={`flex items-center text-xs px-3 py-1.5 rounded-lg border transition-all ${
                           aiAnalysis 
                           ? 'bg-purple-600/20 border-purple-500/50 text-purple-300' 
                           : (isDark ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200')
                       }`}
                   >
                       {isAnalyzing ? <RefreshCcw className="w-3 h-3 animate-spin mr-2" /> : <Sparkles className="w-3 h-3 mr-2" />}
                       {aiAnalysis ? t('operations.cluster.regenerateInsight', 'Regenerate Insight') : t('operations.cluster.askAIForInsight', 'Ask AI for Insight')}
                   </button>
               </div>

               <div className="flex flex-col md:flex-row gap-6 mb-2">
                   {/* Left: Key Metrics (Compact) */}
                   <div className="w-full md:w-1/3 space-y-4 shrink-0">
                       <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-900/50 border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                           <p className={`text-xs uppercase font-bold mb-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('operations.cluster.timeToFull', 'Time to Full')}</p>
                           <div className="flex items-baseline gap-2">
                               <span className={`text-3xl font-bold ${
                                   capacityMetrics.daysRemaining < 30 ? 'text-red-400' : 
                                   capacityMetrics.daysRemaining < 90 ? 'text-yellow-400' : 'text-green-400'
                               }`}>
                                   {capacityMetrics.daysRemaining}
                               </span>
                               <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('common.days', 'Days')}</span>
                           </div>
                           <p className={`text-xs mt-2 flex items-center ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                               <Calendar className="w-3 h-3 mr-1" /> {t('operations.cluster.est', 'Est')}: {capacityMetrics.fullDate}
                           </p>
                       </div>

                       <div className="space-y-2">
                           <div className={`flex justify-between text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                               <span>{t('operations.cluster.currentUsage', 'Current Usage')}</span>
                               <span className={isDark ? 'text-gray-200' : 'text-gray-900'}>{capacityMetrics.currentUsageTB} TB</span>
                           </div>
                           <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                               <div className="h-full bg-blue-500" style={{width: `${capacityMetrics.percentUsed}%`}}></div>
                           </div>
                       </div>
                       
                       <div className="space-y-2">
                           <div className={`flex justify-between text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                               <span>{t('operations.cluster.avgGrowthRate', 'Avg Growth Rate')}</span>
                               <span className={isDark ? 'text-gray-200' : 'text-gray-900'}>+{capacityMetrics.growthRate} GB/{t('common.day', 'day')}</span>
                           </div>
                           <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                               <div className="h-full bg-purple-500" style={{width: '65%'}}></div>
                           </div>
                       </div>
                   </div>

                   {/* Right: Chart */}
                   <div className="flex-1 min-w-0">
                       <div className="h-[200px] w-full">
                           <ResponsiveContainer width="100%" height="100%">
                               <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                   <defs>
                                       <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                                           <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                           <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                       </linearGradient>
                                   </defs>
                                   <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} vertical={false} />
                                   <XAxis 
                                        dataKey="day" 
                                        stroke={isDark ? "#6b7280" : "#9ca3af"} 
                                        fontSize={10} 
                                        tickLine={false} 
                                        axisLine={false} 
                                        minTickGap={30}
                                   />
                                   <YAxis 
                                        stroke={isDark ? "#6b7280" : "#9ca3af"} 
                                        fontSize={10} 
                                        tickLine={false} 
                                        axisLine={false} 
                                        unit="TB"
                                        domain={[0, 14]}
                                        width={30}
                                   />
                                   <Tooltip 
                                        contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb', color: isDark ? '#f3f4f6' : '#1f2937', fontSize: '12px' }}
                                        itemStyle={{ color: '#93c5fd' }}
                                        formatter={(value: number, name: string) => [`${value} TB`, name === 'usage' ? 'Actual' : 'Forecast']}
                                   />
                                   <ReferenceLine y={capacityMetrics.totalCapacityTB} stroke="#ef4444" strokeDasharray="3 3">
                                        <text x={10} y={10} fill="#ef4444" fontSize={10}>Max: 12 TB</text>
                                   </ReferenceLine>
                                   
                                   <Area 
                                        type="monotone" 
                                        dataKey="usage" 
                                        stroke="#3b82f6" 
                                        strokeWidth={2} 
                                        fillOpacity={1} 
                                        fill="url(#colorUsage)" 
                                        name="usage"
                                   />
                                   <Line 
                                        type="monotone" 
                                        dataKey="forecast" 
                                        stroke="#a855f7" 
                                        strokeWidth={2} 
                                        strokeDasharray="4 4" 
                                        dot={false}
                                        name="forecast"
                                        connectNulls
                                   />
                               </ComposedChart>
                           </ResponsiveContainer>
                       </div>
                       <div className={`flex justify-center gap-4 mt-2 text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                           <span className="flex items-center"><span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span> {t('operations.cluster.actualUsage', 'Actual Usage')}</span>
                           <span className="flex items-center"><span className="w-2 h-2 bg-purple-500 rounded-full mr-1"></span> {t('operations.cluster.regressionForecast', 'Regression Forecast')}</span>
                           <span className="flex items-center"><span className="w-2 h-2 border border-red-500 rounded-full mr-1"></span> {t('operations.cluster.capacityLimit', 'Capacity Limit')}</span>
                       </div>
                   </div>
               </div>
               
               {/* AI Insight Section (Conditional) */}
               {aiAnalysis && (
                   <div className={`mt-4 p-3 border rounded-lg flex gap-3 animate-in fade-in slide-in-from-top-2 ${isDark ? 'bg-purple-900/20 border-purple-500/30' : 'bg-purple-50 border-purple-200'}`}>
                       <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                       <div>
                           <h4 className={`text-xs font-bold mb-1 ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{t('operations.cluster.aiStrategicRecommendation', 'AI Strategic Recommendation')}</h4>
                           <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{aiAnalysis}</p>
                       </div>
                   </div>
               )}

               {/* New: Storage Distribution Bar to fill bottom space */}
               <div className={`mt-5 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-end mb-2">
                        <h4 className={`text-xs font-bold uppercase flex items-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            <Database className="w-3 h-3 mr-1" /> {t('operations.cluster.storageDistribution', 'Storage Distribution')}
                        </h4>
                        <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('operations.cluster.total', 'Total')}: {capacityMetrics.totalCapacityTB} TB</span>
                    </div>
                    {/* Stacked Bar */}
                    <div className={`w-full h-2.5 rounded-full overflow-hidden flex ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                        {storageBreakdown.map((item, i) => (
                            <div 
                                key={i} 
                                className={`h-full ${item.color} first:rounded-l-full last:rounded-r-full relative group`} 
                                style={{width: `${(item.value / capacityMetrics.totalCapacityTB) * 100}%`}}
                            >
                            </div>
                        ))}
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
                        {storageBreakdown.map((item, i) => (
                            <div className={`flex items-center text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-600'}`} key={i}>
                                <span className={`w-2 h-2 rounded-full ${item.color} mr-1.5`}></span>
                                <span className={item.textColor}>{item.name}</span>
                                <span className={`ml-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>({item.value.toFixed(1)} TB)</span>
                            </div>
                        ))}
                    </div>
               </div>
           </div>

           {/* Configuration Center (Right Column - 1/3 width) */}
           <div className={`rounded-xl p-5 flex flex-col ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
               <div className="flex justify-between items-center mb-4">
                   <h3 className={`font-bold flex items-center ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                       <Settings className="w-4 h-4 mr-2 text-gray-400" /> {t('operations.cluster.globalConfig', 'Global Config')}
                   </h3>
               </div>
               
               <div className="flex-1 overflow-y-auto max-h-[400px] pr-2 space-y-3 custom-scrollbar">
                   {configs.map(conf => (
                       <div key={conf.name} className={`flex flex-col gap-2 p-3 rounded border transition-colors ${isDark ? 'bg-gray-700/30 border-gray-700/50 hover:border-gray-600' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                           <div className="flex justify-between items-center">
                               <p className={`font-mono text-sm text-blue-300`}>{conf.name}</p>
                               {conf.type === 'select' ? (
                                   <select 
                                     value={conf.value}
                                     onChange={(e) => handleConfigChange(conf.name, e.target.value)}
                                     className={`border rounded px-2 py-0.5 text-xs outline-none w-24 text-right ${isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                                   >
                                       {conf.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                   </select>
                               ) : (
                                   <input 
                                     type="number"
                                     value={conf.value}
                                     onChange={(e) => handleConfigChange(conf.name, e.target.value)}
                                     className={`border rounded px-2 py-0.5 text-xs outline-none w-24 text-right ${isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                                   />
                               )}
                           </div>
                           <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{conf.desc}</p>
                       </div>
                   ))}
               </div>
               
               {/* Config Action */}
               <div className={`mt-4 pt-4 border-t flex justify-end ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                   <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium flex items-center justify-center">
                       <Save className="w-4 h-4 mr-2" /> {t('operations.cluster.applyHotUpdate', 'Apply Hot Update')}
                   </button>
               </div>
           </div>
       </div>

       {/* NEW: VGroup Visualization Section */}
       <div className={`rounded-xl p-6 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
           <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-3">
                   <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                        <Scale className="w-6 h-6" />
                   </div>
                   <div>
                       <h3 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('operations.cluster.vgroupTopologyLoadBalancer', 'VGroup Topology & Load Balancer')}</h3>
                       <p className={`text-sm flex items-center gap-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                           {t('operations.cluster.standardDeviation', 'Standard Deviation')}: <span className={`font-mono ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>{stdDev.toFixed(2)}</span>
                           {isClusterUnbalanced && (
                               <span className="flex items-center text-red-400 bg-red-500/10 px-2 py-0.5 rounded text-xs border border-red-500/20">
                                   <AlertTriangle className="w-3 h-3 mr-1" /> {t('operations.cluster.imbalanced', 'Imbalanced')}
                               </span>
                           )}
                       </p>
                   </div>
               </div>

               <button 
                   onClick={() => setShowRebalanceSim(!showRebalanceSim)}
                   className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center border ${
                       showRebalanceSim 
                       ? (isDark ? 'bg-gray-700 text-gray-200 border-gray-600' : 'bg-gray-200 text-gray-800 border-gray-300') 
                       : 'bg-purple-600 hover:bg-purple-500 text-white border-purple-500 shadow-lg shadow-purple-900/20'
                   }`}
               >
                   {showRebalanceSim ? <LayoutTemplate className="w-4 h-4 mr-2" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
                   {showRebalanceSim ? t('operations.cluster.hideSimulation', 'Hide Simulation') : t('operations.cluster.simulateRebalance', 'Simulate Rebalance')}
               </button>
           </div>

           {/* Heatmap Grid */}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               {vGroupNodes.map(node => {
                   const style = getHeatmapStyle(node.count);
                   return (
                       <div key={node.id} className={`rounded-xl border p-4 transition-all ${style.bg} ${style.border}`}>
                           <div className="flex justify-between items-start mb-4">
                               <div className="flex items-center gap-2">
                                    <Hexagon className={`w-5 h-5 ${style.text}`} />
                                    <span className={`font-bold ${style.text}`}>{t('operations.cluster.node', 'Node')} {node.id}</span>
                               </div>
                               <span className={`text-[10px] font-mono ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{node.ip}</span>
                           </div>
                           
                           <div className="mb-4 text-center">
                               <span className={`text-3xl font-bold ${style.text}`}>{node.count}</span>
                               <p className={`text-xs uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('operations.cluster.vgroups', 'VGroups')}</p>
                           </div>

                           <div className={`w-full h-2 rounded-full overflow-hidden mb-2 ${isDark ? 'bg-gray-900/30' : 'bg-gray-200'}`}>
                               <div className={`h-full ${style.bar}`} style={{width: `${(node.count / 100) * 100}%`}}></div>
                           </div>
                           <p className={`text-[10px] text-center ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{node.zone}</p>
                       </div>
                   );
               })}
           </div>

           {/* Simulation View */}
           {showRebalanceSim && (
               <div className={`mt-8 pt-8 border-t animate-in fade-in slide-in-from-top-4 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                   <div className="flex items-center justify-between mb-4">
                        <h4 className={`font-bold flex items-center ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                            <ArrowRightLeft className="w-5 h-5 mr-2 text-blue-400" /> 
                            {t('operations.cluster.rebalanceExecutionPlan', 'Rebalance Execution Plan')}
                        </h4>
                        <button className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium flex items-center shadow-lg shadow-green-900/20">
                            {t('operations.cluster.executePlan', 'Execute Plan')} ({t('operations.cluster.est', 'Est')}. 12m)
                        </button>
                   </div>
                   
                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                       <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-900/50 border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                           <h5 className={`text-xs font-bold uppercase mb-3 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('operations.cluster.planDetails', 'Plan Details')}</h5>
                           <ul className="space-y-3 text-sm">
                               <li className={`flex items-center justify-between ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                   <span>{t('operations.cluster.moveFromNode', 'Move from Node')} 1</span>
                                   <span className="text-red-400 font-mono">-37 {t('operations.cluster.vgroups', 'VGroups')}</span>
                               </li>
                               <li className={`flex items-center justify-between ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                   <span>{t('operations.cluster.moveToNode', 'Move to Node')} 4</span>
                                   <span className="text-green-400 font-mono">+33 {t('operations.cluster.vgroups', 'VGroups')}</span>
                               </li>
                               <li className={`flex items-center justify-between ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                   <span>{t('operations.cluster.moveToNode', 'Move to Node')} 2</span>
                                   <span className="text-green-400 font-mono">+4 {t('operations.cluster.vgroups', 'VGroups')}</span>
                               </li>
                           </ul>
                       </div>

                       <div className={`lg:col-span-2 rounded-lg p-4 border ${isDark ? 'bg-gray-900/50 border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                            <h5 className={`text-xs font-bold uppercase mb-3 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('operations.cluster.beforeVsAfter', 'Before vs. After')}</h5>
                            <div className="h-40 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={vGroupNodes.map(n => ({
                                        name: `${t('operations.cluster.node', 'Node')} ${n.id}`,
                                        current: n.count,
                                        target: avgVGroups
                                    }))} barGap={0}>
                                        <XAxis dataKey="name" tick={{fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af'}} axisLine={false} tickLine={false} />
                                        <Tooltip 
                                            cursor={{fill: isDark ? '#374151' : '#e5e7eb', opacity: 0.2}}
                                            contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#ffffff', borderColor: isDark ? '#374151' : '#e5e7eb', color: isDark ? '#f3f4f6' : '#1f2937', fontSize: '12px' }}
                                        />
                                        <Bar dataKey="current" name={t('operations.cluster.currentLoad', 'Current Load')} fill="#ef4444" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="target" name={t('operations.cluster.targetLoad', 'Target Load')} fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.5} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                       </div>
                   </div>
               </div>
           )}
       </div>
    </div>
  );
};
