import React from 'react';

export default function LoadingSpinner({ message = 'Loading live data...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-slate-500">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
        <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
      </div>
      {message && <p className="mt-4 text-sm font-medium text-slate-600">{message}</p>}
    </div>
  );
}
