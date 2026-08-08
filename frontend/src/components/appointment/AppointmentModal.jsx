import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { customerService } from '../../services/customerService';

export default function AppointmentModal({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  isLoading = false,
}) {
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [formData, setFormData] = useState({
    customer_id: '',
    service: '',
    appointment_date: '',
    appointment_time: '',
    status: 'Booked',
  });

  const [errors, setErrors] = useState({});

  // Fetch customers list for dropdown on modal open
  useEffect(() => {
    if (isOpen) {
      const loadCustomers = async () => {
        setLoadingCustomers(true);
        try {
          const list = await customerService.getCustomers();
          setCustomers(list);
        } catch (err) {
          console.error('Failed to load customers for dropdown:', err);
        } finally {
          setLoadingCustomers(false);
        }
      };
      loadCustomers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        customer_id: initialData.customer_id || '',
        service: initialData.service || '',
        appointment_date: initialData.appointment_date || '',
        appointment_time: initialData.appointment_time || '',
        status: initialData.status || 'Booked',
      });
    } else {
      // Default to today's date if creating new
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        customer_id: '',
        service: 'General Consultation',
        appointment_date: today,
        appointment_time: '10:00',
        status: 'Booked',
      });
    }
    setErrors({});
  }, [initialData, isOpen]);

  const validate = () => {
    const newErrors = {};
    if (!formData.customer_id) {
      newErrors.customer_id = 'Please select a customer';
    }
    if (!formData.service.trim()) {
      newErrors.service = 'Service title is required';
    }
    if (!formData.appointment_date) {
      newErrors.appointment_date = 'Date is required';
    }
    if (!formData.appointment_time) {
      newErrors.appointment_time = 'Time is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(formData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Appointment' : 'Book New Appointment'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer Select Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Customer <span className="text-rose-500">*</span>
          </label>
          <select
            value={formData.customer_id}
            onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
            disabled={loadingCustomers || (initialData && true)} // Customer fixed on edit
            className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 transition-colors ${
              errors.customer_id
                ? 'border-rose-400 focus:ring-rose-200'
                : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'
            } disabled:bg-slate-100 disabled:text-slate-500`}
          >
            <option value="">-- Select Customer --</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phone})
              </option>
            ))}
          </select>
          {errors.customer_id && (
            <p className="mt-1 text-xs text-rose-500">{errors.customer_id}</p>
          )}
        </div>

        {/* Service Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Service Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Dental Checkup / Consultation"
            value={formData.service}
            onChange={(e) => setFormData({ ...formData, service: e.target.value })}
            className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 transition-colors ${
              errors.service
                ? 'border-rose-400 focus:ring-rose-200'
                : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'
            }`}
          />
          {errors.service && <p className="mt-1 text-xs text-rose-500">{errors.service}</p>}
        </div>

        {/* Date and Time Fields Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={formData.appointment_date}
              onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
              className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 transition-colors ${
                errors.appointment_date
                  ? 'border-rose-400 focus:ring-rose-200'
                  : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'
              }`}
            />
            {errors.appointment_date && (
              <p className="mt-1 text-xs text-rose-500">{errors.appointment_date}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Time <span className="text-rose-500">*</span>
            </label>
            <input
              type="time"
              value={formData.appointment_time}
              onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
              className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl focus:outline-none focus:ring-2 transition-colors ${
                errors.appointment_time
                  ? 'border-rose-400 focus:ring-rose-200'
                  : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'
              }`}
            />
            {errors.appointment_time && (
              <p className="mt-1 text-xs text-rose-500">{errors.appointment_time}</p>
            )}
          </div>
        </div>

        {/* Status Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-colors"
          >
            <option value="Booked">Booked</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors disabled:opacity-50 shadow-xs"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </span>
            ) : initialData ? (
              'Update Appointment'
            ) : (
              'Book Appointment'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
