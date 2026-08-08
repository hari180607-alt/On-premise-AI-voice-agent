import React, { useState, useEffect } from 'react';
import { customerService } from '../services/customerService';
import { appointmentService } from '../services/appointmentService';
import { healthService } from '../services/healthService';
import StatusBadge from '../components/common/StatusBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import {
  IoPeopleOutline,
  IoCalendarOutline,
  IoServerOutline,
  IoLayersOutline,
  IoRefreshOutline,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoArrowForward,
} from 'react-icons/io5';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalAppointments: 0,
    backendOnline: false,
    databaseConnected: false,
    latestAppointment: null,
  });
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    setRefreshing(true);
    try {
      // 1. Get backend & database status
      let isBackendOnline = false;
      let isDbConnected = false;
      try {
        const rootRes = await healthService.getRootStatus();
        if (rootRes && rootRes.message) {
          isBackendOnline = true;
        }
        
        const healthRes = await healthService.getHealthStatus();
        if (healthRes && healthRes.database) {
          isDbConnected = healthRes.database.connected;
        }
      } catch (err) {
        console.error('Error fetching health status:', err);
      }

      // 2. Get customer stats
      let customers = [];
      try {
        customers = await customerService.getCustomers();
      } catch (err) {
        console.error('Error fetching customers:', err);
      }

      // 3. Get appointment stats
      let appointments = [];
      try {
        appointments = await appointmentService.getAppointments();
      } catch (err) {
        console.error('Error fetching appointments:', err);
      }

      // Sort appointments by created_at desc to find latest
      const sortedAppointments = [...appointments].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      const latest = sortedAppointments.length > 0 ? sortedAppointments[0] : null;

      setStats({
        totalCustomers: customers.length,
        totalAppointments: appointments.length,
        backendOnline: isBackendOnline,
        databaseConnected: isDbConnected,
        latestAppointment: latest,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner message="Assembling live dashboard intelligence..." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time operations monitor for the Autonomous Voice Agent.
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
        >
          <IoRefreshOutline className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh Live Data</span>
        </button>
      </div>

      {/* Grid of 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Customers */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Customers</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">{stats.totalCustomers}</h3>
          </div>
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl">
            <IoPeopleOutline className="w-6 h-6" />
          </div>
        </div>

        {/* Total Appointments */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Appointments</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">{stats.totalAppointments}</h3>
          </div>
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl">
            <IoCalendarOutline className="w-6 h-6" />
          </div>
        </div>

        {/* Backend status */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Backend Service</p>
            <div className="flex items-center gap-2 mt-2">
              {stats.backendOnline ? (
                <>
                  <IoCheckmarkCircle className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-bold text-slate-800">Online</span>
                </>
              ) : (
                <>
                  <IoCloseCircle className="w-5 h-5 text-rose-500" />
                  <span className="text-sm font-bold text-slate-800">Offline</span>
                </>
              )}
            </div>
          </div>
          <div className={`p-3.5 rounded-2xl ${stats.backendOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            <IoServerOutline className="w-6 h-6" />
          </div>
        </div>

        {/* Database status */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Database Status</p>
            <div className="flex items-center gap-2 mt-2">
              {stats.databaseConnected ? (
                <>
                  <IoCheckmarkCircle className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-bold text-slate-800">Connected</span>
                </>
              ) : (
                <>
                  <IoCloseCircle className="w-5 h-5 text-rose-500" />
                  <span className="text-sm font-bold text-slate-800">Disconnected</span>
                </>
              )}
            </div>
          </div>
          <div className={`p-3.5 rounded-2xl ${stats.databaseConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            <IoLayersOutline className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Content Sections: Latest Appointment & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest Appointment Details */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Latest Appointment</h3>
            <Link
              to="/appointments"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 hover:underline"
            >
              <span>View All</span>
              <IoArrowForward className="w-3.5 h-3.5" />
            </Link>
          </div>
          
          <div className="p-6">
            {stats.latestAppointment ? (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/50">
                  <div>
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Customer Name</h4>
                    <p className="text-lg font-bold text-slate-900 mt-1">{stats.latestAppointment.customer_name}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Status</h4>
                    <div className="mt-1.5">
                      <StatusBadge status={stats.latestAppointment.status} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Service Requested</span>
                    <p className="text-sm font-bold text-slate-800 mt-1.5">{stats.latestAppointment.service}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Appointment Date</span>
                    <p className="text-sm font-bold text-slate-800 mt-1.5 font-mono">{stats.latestAppointment.appointment_date}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Appointment Time</span>
                    <p className="text-sm font-bold text-slate-800 mt-1.5 font-mono">{stats.latestAppointment.appointment_time}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="inline-flex p-3 bg-slate-100 text-slate-400 rounded-full mb-3">
                  <IoCalendarOutline className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">No Appointments Recorded</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Book a new customer appointment in the scheduling section.
                </p>
                <Link
                  to="/appointments"
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-xs"
                >
                  Book Now
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick Directory Actions */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Voice Agent Overview</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              This panel controls database entities and appointments. In Phase 2, this workspace will integrate with OpenAI Whisper, Piper TTS, and custom call flow handlers to execute autonomous calling.
            </p>
            
            <div className="mt-6 space-y-3">
              <Link
                to="/customers"
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <IoPeopleOutline className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700">Customers Directory</span>
                </div>
                <IoArrowForward className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Link
                to="/appointments"
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100 transition-colors">
                    <IoCalendarOutline className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700">Bookings Manager</span>
                </div>
                <IoArrowForward className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 mt-6 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>Server: 127.0.0.1:8000</span>
            <span>API Version: v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
