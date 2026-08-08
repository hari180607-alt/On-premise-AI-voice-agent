import React from 'react';
import { NavLink } from 'react-router-dom';
import { IoGridOutline, IoPeopleOutline, IoCalendarOutline, IoMicOutline, IoGrid, IoPeople, IoCalendar, IoChatbubbleEllipses, IoChatbubbleEllipsesOutline } from 'react-icons/io5';

export default function Sidebar({ isOpen, onClose }) {
  const navItems = [
    {
      name: 'Dashboard',
      path: '/',
      activeIcon: IoGrid,
      inactiveIcon: IoGridOutline,
    },
    {
      name: 'Customers',
      path: '/customers',
      activeIcon: IoPeople,
      inactiveIcon: IoPeopleOutline,
    },
    {
      name: 'Appointments',
      path: '/appointments',
      activeIcon: IoCalendar,
      inactiveIcon: IoCalendarOutline,
    },
    {
      name: 'AI Receptionist',
      path: '/ai-receptionist',
      activeIcon: IoChatbubbleEllipses,
      inactiveIcon: IoChatbubbleEllipsesOutline,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-800">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
            <IoMicOutline className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide leading-tight">AI Voice Agent</h1>
            <p className="text-[11px] font-medium text-slate-400">Autonomous Service</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Menu
          </div>
          {navItems.map((item) => {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                {({ isActive }) => {
                  const Icon = isActive ? item.activeIcon : item.inactiveIcon;
                  return (
                    <>
                      <Icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </>
                  );
                }}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Info */}
        <div className="p-4 m-3 rounded-xl bg-slate-800/40 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Phase 1 Scaffolding</span>
            <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 font-mono text-[10px]">
              v1.0.0
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
