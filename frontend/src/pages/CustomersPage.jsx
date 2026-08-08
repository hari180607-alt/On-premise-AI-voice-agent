import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { customerService } from '../services/customerService';
import CustomerModal from '../components/customer/CustomerModal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import {
  IoAdd,
  IoSearch,
  IoRefresh,
  IoPencil,
  IoTrashOutline,
  IoPeopleOutline,
  IoSwapVertical,
} from 'react-icons/io5';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Confirm Delete Dialog
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await customerService.getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Filter and Sort Customers
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((c) => {
        const query = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(query) ||
          c.phone.toLowerCase().includes(query) ||
          (c.email && c.email.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        if (sortAsc) {
          return a.name.localeCompare(b.name);
        }
        return b.name.localeCompare(a.name);
      });
  }, [customers, searchQuery, sortAsc]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setSelectedCustomer(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (customer) => {
    setSelectedCustomer(customer);
    setIsModalOpen(true);
  };

  // Save (Create or Update) Customer
  const handleSaveCustomer = async (formData) => {
    setActionLoading(true);
    try {
      if (selectedCustomer) {
        await customerService.updateCustomer(selectedCustomer.id, formData);
        toast.success('Customer updated successfully!');
      } else {
        await customerService.createCustomer(formData);
        toast.success('Customer added successfully!');
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err) {
      console.error('Save customer error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Open Delete Confirm
  const handleOpenDelete = (customer) => {
    setCustomerToDelete(customer);
    setIsDeleteOpen(true);
  };

  // Confirm Delete Customer
  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    setActionLoading(true);
    try {
      await customerService.deleteCustomer(customerToDelete.id);
      toast.success('Customer deleted successfully!');
      setIsDeleteOpen(false);
      setCustomerToDelete(null);
      fetchCustomers();
    } catch (err) {
      console.error('Delete customer error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customer Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage customer records, contact info, and directory details.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCustomers}
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
            <span>Add Customer</span>
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
            placeholder="Search by name, phone, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
          />
        </div>

        {/* Sort Toggle */}
        <button
          onClick={() => setSortAsc((prev) => !prev)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <IoSwapVertical className="w-4 h-4 text-slate-500" />
          <span>Sort Name: {sortAsc ? 'A - Z' : 'Z - A'}</span>
        </button>
      </div>

      {/* Main Table / Data Content */}
      {loading ? (
        <LoadingSpinner message="Fetching customer records..." />
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No Matching Customers' : 'No Customers Yet'}
          description={
            searchQuery
              ? `No customer records matched your query "${searchQuery}".`
              : 'Add your first customer to start managing appointments.'
          }
          actionLabel={searchQuery ? 'Clear Search' : 'Add Customer'}
          onAction={searchQuery ? () => setSearchQuery('') : handleOpenCreate}
          icon={IoPeopleOutline}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Customer Name</th>
                  <th className="py-3.5 px-6">Phone Number</th>
                  <th className="py-3.5 px-6">Email Address</th>
                  <th className="py-3.5 px-6">Created Date</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCustomers.map((customer) => {
                  const createdDate = new Date(customer.created_at).toLocaleDateString(
                    'en-US',
                    {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    }
                  );

                  return (
                    <tr key={customer.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6 font-semibold text-slate-900">
                        {customer.name}
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-600">
                        {customer.phone}
                      </td>
                      <td className="py-4 px-6 text-slate-600">
                        {customer.email || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-500">{createdDate}</td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEdit(customer)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Customer"
                        >
                          <IoPencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(customer)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Customer"
                        >
                          <IoTrashOutline className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500 font-medium">
            Showing {filteredCustomers.length} of {customers.length} customer(s)
          </div>
        </div>
      )}

      {/* Customer Form Modal */}
      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSaveCustomer}
        initialData={selectedCustomer}
        isLoading={actionLoading}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete customer "${customerToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete Customer"
        isLoading={actionLoading}
      />
    </div>
  );
}
