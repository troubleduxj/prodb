import React from 'react';
import { Share2 } from 'lucide-react';

export const Ecosystem: React.FC = () => {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-100">Ecosystem & Connectors</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { name: 'Grafana', desc: 'Visualize TDengine data in Grafana dashboards.', color: 'text-orange-500' },
                    { name: 'Kafka', desc: 'Stream data in/out via Kafka topics.', color: 'text-purple-500' },
                    { name: 'Spark', desc: 'Batch processing integration with Apache Spark.', color: 'text-red-500' },
                    { name: 'Telegraf', desc: 'Agent-based metrics collection.', color: 'text-blue-500' },
                    { name: 'MATLAB', desc: 'Connector for industrial analysis.', color: 'text-blue-700' },
                    { name: 'Python SDK', desc: 'Native Python client for data science.', color: 'text-yellow-400' }
                ].map(item => (
                    <div key={item.name} className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:bg-gray-800/80 transition cursor-pointer group">
                        <div className="flex items-center mb-4">
                            <Share2 className={`w-8 h-8 mr-3 ${item.color}`} />
                            <h3 className="text-lg font-semibold text-gray-200">{item.name}</h3>
                        </div>
                        <p className="text-gray-400 text-sm">{item.desc}</p>
                        <div className="mt-4 flex justify-end">
                            <span className="text-blue-500 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">Configure &rarr;</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}