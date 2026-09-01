/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Scissors,
  Search,
  Filter,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Calendar,
  User,
  Mail,
  Phone,
  Ruler,
  FileText,
  ExternalLink,
  Save,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  Video,
  ChevronRight
} from 'lucide-react';
import { CustomClothingRequest, CustomClothingStatus } from '../types';

export default function CustomClothingAdminView() {
  const [requests, setRequests] = useState<CustomClothingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<CustomClothingRequest | null>(null);
  const [adminNotesInput, setAdminNotesInput] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updateSuccessMsg, setUpdateSuccessMsg] = useState('');

  // Fetch Requests from Server API
  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/services/custom-clothing');
      const data = await res.json();
      if (res.ok && data.success) {
        setRequests(data.requests || []);
      } else {
        setError(data.error || 'Failed to fetch custom clothing requests.');
      }
    } catch (err: any) {
      setError('Failed to connect to backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Update Request Status & Admin Notes
  const handleUpdateStatus = async (reqId: string, newStatus: CustomClothingStatus, notes?: string) => {
    setUpdatingStatus(true);
    setUpdateSuccessMsg('');
    try {
      const res = await fetch(`/api/services/custom-clothing/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          adminNotes: notes !== undefined ? notes : adminNotesInput
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRequests((prev) =>
          prev.map((r) => (r.id === reqId ? { ...r, status: newStatus, adminNotes: notes !== undefined ? notes : adminNotesInput } : r))
        );
        if (selectedRequest && selectedRequest.id === reqId) {
          setSelectedRequest({ ...selectedRequest, status: newStatus, adminNotes: notes !== undefined ? notes : adminNotesInput });
        }
        setUpdateSuccessMsg('Request updated successfully!');
        setTimeout(() => setUpdateSuccessMsg(''), 3000);
      } else {
        alert(data.error || 'Update failed');
      }
    } catch (err) {
      alert('Network error during update');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Delete Request
  const handleDeleteRequest = async (reqId: string, refNo: string) => {
    if (!window.confirm(`Are you sure you want to delete custom clothing request #${refNo}?`)) return;

    try {
      const res = await fetch(`/api/services/custom-clothing/${reqId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== reqId));
        if (selectedRequest?.id === reqId) setSelectedRequest(null);
      }
    } catch (err) {
      alert('Delete failed');
    }
  };

  // Filtered Requests
  const filteredRequests = requests.filter((r) => {
    const matchesStatus = statusFilter === 'All' || r.status.toLowerCase() === statusFilter.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !query ||
      r.referenceNo.toLowerCase().includes(query) ||
      r.fullName.toLowerCase().includes(query) ||
      r.email.toLowerCase().includes(query) ||
      r.garmentType.toLowerCase().includes(query);

    return matchesStatus && matchesQuery;
  });

  const getStatusBadgeClass = (status: CustomClothingStatus) => {
    switch (status) {
      case 'New':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'In Review':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Quoted':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'In Progress':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Cancelled':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200/80 pb-5 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Scissors className="h-4 w-4" />
            </div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Custom Clothing Service Requests
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 font-light dark:text-slate-400">
            Track, review measurements, inspect design inspirations, and issue quotes for bespoke tailor-made apparel requests.
          </p>
        </div>

        <button
          onClick={fetchRequests}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Sync Requests
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Total Inquiries</span>
          <strong className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">{requests.length}</strong>
        </div>
        <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-4 shadow-2xs">
          <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">New Submissions</span>
          <strong className="mt-1 font-display text-2xl font-bold text-blue-700 dark:text-blue-300">
            {requests.filter((r) => r.status === 'New').length}
          </strong>
        </div>
        <div className="rounded-2xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 shadow-2xs">
          <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">In Review / Quoted</span>
          <strong className="mt-1 font-display text-2xl font-bold text-amber-700 dark:text-amber-300">
            {requests.filter((r) => r.status === 'In Review' || r.status === 'Quoted').length}
          </strong>
        </div>
        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 shadow-2xs">
          <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">In Crafting / Done</span>
          <strong className="mt-1 font-display text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {requests.filter((r) => r.status === 'In Progress' || r.status === 'Completed').length}
          </strong>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/80 dark:border-slate-700 text-xs">
          {['All', 'New', 'In Review', 'Quoted', 'In Progress', 'Completed', 'Cancelled'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ref, name, email..."
            className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 text-xs text-slate-900 dark:text-white focus:border-indigo-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
            Loading bespoke custom clothing requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 dark:text-slate-400">
            <Scissors className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            No custom clothing requests found matching your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-bold">Reference #</th>
                  <th className="py-3 px-4 font-bold">Date</th>
                  <th className="py-3 px-4 font-bold">Client Name</th>
                  <th className="py-3 px-4 font-bold">Garment Category</th>
                  <th className="py-3 px-4 font-bold">Deadline</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {req.referenceNo}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white">
                      <div>{req.fullName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{req.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {req.garmentType === 'Other' ? `Other (${req.otherGarmentType})` : req.garmentType}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-rose-600 dark:text-rose-400">
                      {req.preferredDeadline}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getStatusBadgeClass(req.status)}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedRequest(req);
                            setAdminNotesInput(req.adminNotes || '');
                          }}
                          className="inline-flex h-7 items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 px-2.5 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" /> View Specs
                        </button>
                        <button
                          onClick={() => handleDeleteRequest(req.id, req.referenceNo)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="Delete Request"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 p-6 md:p-8 shadow-2xl my-8 border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setSelectedRequest(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
              <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                REFERENCE NO: {selectedRequest.referenceNo}
              </span>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getStatusBadgeClass(selectedRequest.status)}`}>
                {selectedRequest.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700 dark:text-slate-300">
              {/* Client Info */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Client Details</h4>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Name:</span>
                  <strong className="text-slate-900 dark:text-white">{selectedRequest.fullName}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Email:</span>
                  <a href={`mailto:${selectedRequest.email}`} className="text-indigo-600 dark:text-indigo-400 font-medium">
                    {selectedRequest.email}
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{selectedRequest.phone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Fitting / Delivery:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{selectedRequest.deliveryLocation}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Budget Range:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{selectedRequest.budgetRange}</span>
                </div>
              </div>

              {/* Garment Info */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Garment Specifications</h4>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Category:</span>
                  <strong className="text-slate-900 dark:text-white">
                    {selectedRequest.garmentType === 'Other' ? `Other (${selectedRequest.otherGarmentType})` : selectedRequest.garmentType}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Target Deadline:</span>
                  <strong className="text-rose-600 dark:text-rose-400">{selectedRequest.preferredDeadline}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Submitted On:</span>
                  <span>{new Date(selectedRequest.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Body Measurements Table */}
            <div className="mt-6">
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Ruler className="h-4 w-4 text-indigo-500" /> Body Measurements ({selectedRequest.measurements.unit})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5">
                  <span className="text-[10px] text-slate-400 block">Bust / Chest</span>
                  <strong className="text-slate-900 dark:text-white">{selectedRequest.measurements.bust} {selectedRequest.measurements.unit}</strong>
                </div>
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5">
                  <span className="text-[10px] text-slate-400 block">Waist</span>
                  <strong className="text-slate-900 dark:text-white">{selectedRequest.measurements.waist} {selectedRequest.measurements.unit}</strong>
                </div>
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5">
                  <span className="text-[10px] text-slate-400 block">Hips</span>
                  <strong className="text-slate-900 dark:text-white">{selectedRequest.measurements.hips} {selectedRequest.measurements.unit}</strong>
                </div>
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5">
                  <span className="text-[10px] text-slate-400 block">Shoulder Width</span>
                  <strong className="text-slate-900 dark:text-white">{selectedRequest.measurements.shoulderWidth} {selectedRequest.measurements.unit}</strong>
                </div>
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5">
                  <span className="text-[10px] text-slate-400 block">Sleeve Length</span>
                  <strong className="text-slate-900 dark:text-white">{selectedRequest.measurements.sleeveLength} {selectedRequest.measurements.unit}</strong>
                </div>
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5">
                  <span className="text-[10px] text-slate-400 block">Inseam / Leg</span>
                  <strong className="text-slate-900 dark:text-white">{selectedRequest.measurements.inseam} {selectedRequest.measurements.unit}</strong>
                </div>
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 col-span-2">
                  <span className="text-[10px] text-slate-400 block">Height</span>
                  <strong className="text-slate-900 dark:text-white">{selectedRequest.measurements.height} {selectedRequest.measurements.unit}</strong>
                </div>
              </div>

              {selectedRequest.measurements.customNotes && (
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <strong>Measurement Notes:</strong> {selectedRequest.measurements.customNotes}
                </p>
              )}
            </div>

            {/* Design Inspirations & Links */}
            {((selectedRequest.designLinks && selectedRequest.designLinks.length > 0) ||
              (selectedRequest.materialSamples && selectedRequest.materialSamples.length > 0) ||
              (selectedRequest.designImages && selectedRequest.designImages.length > 0) ||
              (selectedRequest.designVideos && selectedRequest.designVideos.length > 0)) && (
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-400">Design Inspirations & Files</h4>
                
                {/* Images */}
                <div className="flex flex-wrap gap-2">
                  {[...(selectedRequest.materialSamples || []), ...(selectedRequest.designImages || [])].map((img, idx) => (
                    <a key={idx} href={img.url} target="_blank" rel="noopener noreferrer" className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
                      <img src={img.url} alt={img.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                    </a>
                  ))}
                </div>

                {/* Links */}
                {selectedRequest.designLinks && selectedRequest.designLinks.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-slate-400 block">INSPIRATION LINKS</span>
                    {selectedRequest.designLinks.map((lnk, idx) => (
                      <a key={idx} href={lnk} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline block truncate">
                        <ExternalLink className="h-3 w-3 shrink-0" /> {lnk}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Additional Notes */}
            {selectedRequest.additionalNotes && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs text-amber-900 dark:text-amber-200">
                <strong className="block mb-1 font-semibold">Client Notes / Embellishments:</strong>
                {selectedRequest.additionalNotes}
              </div>
            )}

            {/* Admin Status & Notes Editor */}
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Update Order Status
                  </label>
                  <select
                    value={selectedRequest.status}
                    onChange={(e) => handleUpdateStatus(selectedRequest.id, e.target.value as CustomClothingStatus)}
                    className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="New">New</option>
                    <option value="In Review">In Review</option>
                    <option value="Quoted">Quoted</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                {updateSuccessMsg && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-lg border border-emerald-200">
                    {updateSuccessMsg}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Admin Internal Notes / Quote Details
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={adminNotesInput}
                    onChange={(e) => setAdminNotesInput(e.target.value)}
                    placeholder="e.g. Quoted KSh 35,000. Fabric sourced from Nairobi Swatch Hub."
                    className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                  <button
                    onClick={() => handleUpdateStatus(selectedRequest.id, selectedRequest.status, adminNotesInput)}
                    disabled={updatingStatus}
                    className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shrink-0 cursor-pointer"
                  >
                    Save Notes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
