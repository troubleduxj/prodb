import React from 'react';

export const PageSkeleton: React.FC = () => {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-8 bg-gray-700 rounded w-1/4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-700 rounded"></div>
        <div className="h-4 bg-gray-700 rounded w-5/6"></div>
        <div className="h-4 bg-gray-700 rounded w-4/6"></div>
      </div>
      <div className="h-32 bg-gray-700 rounded"></div>
    </div>
  );
};
