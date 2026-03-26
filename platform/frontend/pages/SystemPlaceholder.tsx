import React from 'react';
import { useLocation } from 'react-router-dom';
import { Settings, Construction } from 'lucide-react';

export const SystemPlaceholder: React.FC = () => {
  const location = useLocation();
  const pageName = location.pathname.split('/').pop()?.replace('-', ' ').toUpperCase();

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-gray-500">
      <div className="bg-gray-800 p-6 rounded-full mb-4 border border-gray-700 shadow-lg">
        <Settings className="w-16 h-16 text-blue-500 opacity-80" />
      </div>
      <h2 className="text-2xl font-bold text-gray-300 mb-2">System Management</h2>
      <p className="text-gray-400 max-w-md text-center">
        The <span className="text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 mx-1">{pageName}</span> module is currently under development.
      </p>
      <div className="mt-8 flex items-center gap-2 text-sm bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700/50">
          <Construction className="w-4 h-4 text-yellow-500" />
          <span>Coming soon in Phase 3</span>
      </div>
    </div>
  );
};
