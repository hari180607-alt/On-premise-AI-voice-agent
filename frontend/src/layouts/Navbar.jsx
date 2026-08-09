import React, { useState, useEffect } from 'react';
import { healthService } from '../services/healthService';
import { IoMenu, IoCheckmarkCircle, IoWarning, IoTimeOutline } from 'react-icons/io5';

export default function Navbar({ onMenuToggle }) {
  const [backendHealthy, setBackendHealthy] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll backend health status
  useEffect(() => {
    let isMounted = true;
    let consecutiveFailures = 0;

    const checkHealth = async () => {
      try {
        const health = await healthService.getHealthStatus();
        if (isMounted) {
          if (health && health.status === 'healthy') {
            consecutiveFailures = 0;
            setBackendHealthy(true);
          } else {
            consecutiveFailures += 1;
            if (consecutiveFailures >= 2) {
              setBackendHealthy(false);
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          consecutiveFailures += 1;
          if (consecutiveFailures >= 2) {
            setBackendHealthy(false);
          }
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMounted) {
        checkHealth();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 lg:px-8 bg-white border-b border-slate-200/80 shadow-xs">
      {/* Left: Mobile Menu Toggle & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="p-2 text-slate-600 rounded-lg lg:hidden hover:bg-slate-100 transition-colors"
          aria-label="Toggle menu"
        >
          <IoMenu className="w-6 h-6" />
        </button>

        <div>
          <h2 className="text-base font-bold text-slate-800 hidden sm:block">
            On-Premise AI Voice Agent
          </h2>
          <p className="text-xs text-slate-500 font-medium hidden md:block">
            Autonomous Customer Service & Appointment Management
          </p>
        </div>
      </div>

      {/* Right: Status Badges & Live Clock */}
      <div className="flex items-center gap-4">
        {/* Backend Live Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium">
          {backendHealthy === null ? (
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
              Connecting API...
            </span>
          ) : backendHealthy ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Backend Online
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-rose-600 font-semibold">
              <IoWarning className="w-3.5 h-3.5" />
              Backend Offline
            </span>
          )}
        </div>

        {/* Clock */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/70 text-slate-700 text-xs font-medium border border-slate-200/50">
          <IoTimeOutline className="w-4 h-4 text-blue-600" />
          <span>{formattedDate}</span>
          <span className="font-mono text-slate-500">•</span>
          <span className="font-mono font-semibold">{formattedTime}</span>
        </div>
      </div>
    </header>
  );
}
