import React from 'react';
import { IoFolderOpenOutline } from 'react-icons/io5';

export default function EmptyState({
  title = 'No Records Found',
  description = 'There are currently no items to display.',
  actionLabel,
  onAction,
  icon: Icon = IoFolderOpenOutline,
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-xs">
      <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl mb-4">
        <Icon className="w-8 h-8" />
      </div>
      <h4 className="text-base font-semibold text-slate-800">{title}</h4>
      <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-xs"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
