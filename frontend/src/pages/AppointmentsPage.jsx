import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { appointmentService } from '../services/appointmentService';
import AppointmentModal from '../components/appointment/AppointmentModal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import StatusBadge from '../components/common/StatusBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import {
  IoAdd,
  IoSearch,
  IoRefresh,
  IoPencil,
  IoTrashOutline,
  IoCalendarOutline,
  IoFilterOutline,
} from 'react-icons/io5';

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  // Confirm Delete Dialog
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState(null);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const data = await appointmentService.getAppointments();
      setAppointments(data);
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  // Filter Appointments by search and status
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        appt.customer_name.toLowerCase().includes(query) ||
        appt.service.toLowerCase().includes(query) ||
        appt.appointment_date.includes(query);

      const matchesStatus =
        statusFilter === 'All' || appt.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [appointments, searchQuery, statusFilter]);

  // Open Book Modal
  const handleOpenCreate = () => {
    setSelectedAppointment(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (appointment) => {
    setSelectedAppointment(appointment);
    setIsModalOpen(true);
  };

  // Save (Create or Update) Appointment
  const handleSaveAppointment = async (formData) => {
    setActionLoading(true);
    try {
      if (selectedAppointment) {
        await appointmentService.updateAppointment(selectedAppointment.id, formData);
        toast.success('Appointment updated successfully!');
      } else {
        await appointmentService.createAppointment(formData);
        toast.success('Appointment booked successfully!');
      }
      setIsModalOpen(false);
      fetchAppointments();
    } catch (err) {
      console.error('Save appointment error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Open Delete Confirm
  const handleOpenDelete = (appointment) => {
    setAppointmentToDelete(appointment);
    setIsDeleteOpen(true);
  };

  // Confirm Delete Appointment
  const handleConfirmDelete = async () => {
    if (!appointmentToDelete) return;
    setActionLoading(true);
    try {
      await appointmentService.deleteAppointment(appointmentToDelete.id);
      toast.success('Appointment deleted successfully!');
      setIsDeleteOpen(false);
      setAppointmentToDelete(null);
      fetchAppointments();
    } catch (err) {
      console.error('Delete appointment error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Appointment Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Schedule, monitor, and update customer appointment bookings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAppointments}
            disabled={loading}
            className="p-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
            title="Refresh List"
          >
            <IoRefresh className={`w-5 h-5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20"
          >
            <IoAdd className="w-5 h-5" />
            <span>Book Appointment</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <IoSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer, service, or date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <IoFilterOutline className="w-4 h-4 text-slate-400 hidden sm:block" />
          <div className="flex items-center bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
            {['All', 'Booked', 'Completed', 'Cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === status
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Appointments Table / Content */}
      {loading ? (
        <LoadingSpinner message="Fetching appointments list..." />
      ) : filteredAppointments.length === 0 ? (
        <EmptyState
          title={searchQuery || statusFilter !== 'All' ? 'No Matching Appointments' : 'No Appointments Found'}
          description={
            searchQuery || statusFilter !== 'All'
              ? 'No appointments matched your current search or filter criteria.'
              : 'Book your first customer appointment to see it displayed here.'
          }
          actionLabel={searchQuery || statusFilter !== 'All' ? 'Reset Filters' : 'Book Appointment'}
          onAction={
            searchQuery || statusFilter !== 'All'
              ? () => {
                  setSearchQuery('');
                  setStatusFilter('All');
                }
              : handleOpenCreate
          }
          icon={IoCalendarOutline}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Customer Name</th>
                  <th className="py-3.5 px-6">Service</th>
                  <th className="py-3.5 px-6">Date</th>
                  <th className="py-3.5 px-6">Time</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAppointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-900">
                      {appt.customer_name}
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-700">{appt.service}</td>
                    <td className="py-4 px-6 text-xs text-slate-600 font-mono">
                      {appt.appointment_date}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-600 font-mono">
                      {appt.appointment_time}
                    </td>
                    <td className="py-4 px-6">
                      <StatusBadge status={appt.status} />
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(appt)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Appointment"
                      >
                        <IoPencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenDelete(appt)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Appointment"
                      >
                        <IoTrashOutline className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500 font-medium">
            Showing {filteredAppointments.length} of {appointments.length} appointment(s)
          </div>
        </div>
      )}

      {/* Appointment Form Modal */}
      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSaveAppointment}
        initialData={selectedAppointment}
        isLoading={actionLoading}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Appointment"
        message={`Are you sure you want to delete the appointment for customer "${appointmentToDelete?.customer_name}"?`}
        confirmText="Delete Appointment"
        isLoading={actionLoading}
      />
    </div>
  );
}
