import React from 'react';

export default function StatusBadge({ status }) {
  const normalizedStatus = (status || '').toLowerCase();

  let styles = 'bg-slate-100 text-slate-700 border-slate-200';

  if (normalizedStatus === 'booked') {
    styles = 'bg-blue-50 text-blue-700 border-blue-200/60';
  } else if (normalizedStatus === 'completed') {
    styles = 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
  } else if (normalizedStatus === 'cancelled') {
    styles = 'bg-rose-50 text-rose-700 border-rose-200/60';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${styles}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          normalizedStatus === 'booked'
            ? 'bg-blue-500'
            : normalizedStatus === 'completed'
            ? 'bg-emerald-500'
            : normalizedStatus === 'cancelled'
            ? 'bg-rose-500'
            : 'bg-slate-400'
        }`}
      />
      {status}
    </span>
  );
}
