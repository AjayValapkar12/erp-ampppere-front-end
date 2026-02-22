import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, History, Search, X, RefreshCw, CreditCard } from 'lucide-react';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

const Badge = ({ status }) => {
  const map = {
    pending: 'bg-red-100 text-red-700',
    partial: 'bg-yellow-100 text-yellow-700',
    paid:    'bg-green-100 text-green-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
};

const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent focus:bg-white transition";
const labelCls = "text-xs font-semibold text-gray-600";

const InputField = ({ label, value, onChange, type = 'text', placeholder = '', required }) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className={labelCls}>{label}{required && ' *'}</label>}
    <input
      type={type} value={value} onChange={onChange}
      placeholder={placeholder} required={required}
      className={inputCls}
    />
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Customers() {
  const [customers, setCustomers]           = useState([]);
  const [search, setSearch]                 = useState('');
  const [loading, setLoading]               = useState(true);
  const [showModal, setShowModal]           = useState(false);
  const [showLedger, setShowLedger]         = useState(false);
  const [showPayModal, setShowPayModal]     = useState(false);
  const [editCustomer, setEditCustomer]     = useState(null);
  const [ledgerCustomer, setLedgerCustomer] = useState(null);
  const [ledgerData, setLedgerData]         = useState([]);
  const [ledgerLoading, setLedgerLoading]   = useState(false);
  const [payCustomer, setPayCustomer]       = useState(null);
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState('');
  const [syncing, setSyncing]               = useState(false);

  const emptyForm = {
    name: '', email: '', phone: '', contactPerson: '', gstNumber: '',
    billingAddress:  { street: '', city: '', state: '', pincode: '' },
    deliveryAddress: { street: '', city: '', state: '', pincode: '' },
  };
  const [form, setForm]       = useState(emptyForm);
  const [payForm, setPayForm] = useState({ amount: '', paymentMethod: 'bank_transfer', transactionId: '', notes: '' });

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/customers');
      setCustomers(res.data.data);
    } catch (e) {
      console.error('Failed to load customers:', e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Open helpers ────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditCustomer(null); setForm(emptyForm); setError(''); setShowModal(true);
  };

  const openEdit = (c) => {
    setEditCustomer(c);
    setForm({
      name:            c.name           || '',
      email:           c.email          || '',
      phone:           c.phone          || '',
      contactPerson:   c.contactPerson  || '',
      gstNumber:       c.gstNumber      || '',
      billingAddress:  c.billingAddress  || emptyForm.billingAddress,
      deliveryAddress: c.deliveryAddress || emptyForm.deliveryAddress,
    });
    setError(''); setShowModal(true);
  };

  const openLedger = async (c) => {
    setLedgerCustomer(c); setLedgerData([]); setShowLedger(true); setLedgerLoading(true);
    try {
      const res = await api.get(`/customers/${c._id}/ledger`);
      setLedgerData(res.data.data);
    } catch (e) {
      console.error('Failed to load ledger:', e);
    } finally {
      setLedgerLoading(false);
    }
  };

  const openPay = (c) => {
    setPayCustomer(c);
    setPayForm({ amount: '', paymentMethod: 'bank_transfer', transactionId: '', notes: '' });
    setError('');
    setShowPayModal(true);
  };

  // ── CRUD handlers ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.name.trim()) return setError('Customer name is required');
    setSaving(true); setError('');
    try {
      if (editCustomer) {
        const res = await api.put(`/customers/${editCustomer._id}`, form);
        setCustomers(c => c.map(x => x._id === editCustomer._id ? res.data.data : x));
      } else {
        const res = await api.post('/customers', form);
        setCustomers(c => [res.data.data, ...c]);
      }
      setShowModal(false);
    } catch (e) {
      setError(e.response?.data?.message || 'Error saving customer');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete customer "${c.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/customers/${c._id}`);
      setCustomers(x => x.filter(cx => cx._id !== c._id));
    } catch (e) {
      alert(e.response?.data?.message || 'Error deleting customer');
    }
  };

  const syncBalances = async () => {
    setSyncing(true);
    try {
      await api.post('/customers/sync-balances');
      await loadCustomers();
    } catch {
      alert('Sync failed — please try again');
    } finally {
      setSyncing(false);
    }
  };

  // ── Payment handler ─────────────────────────────────────────────────────────

  const handlePayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0)
      return setError('Enter a valid amount');
    if (parseFloat(payForm.amount) > payCustomer.outstandingBalance)
      return setError('Amount exceeds customer outstanding balance');

    setSaving(true); setError('');
    try {
      const res = await api.post(`/customers/${payCustomer._id}/payment`, payForm);
      // Update the customer row in state with fresh balance
      setCustomers(c => c.map(x => x._id === payCustomer._id ? res.data.data : x));
      setShowPayModal(false);
    } catch (e) {
      setError(e.response?.data?.message || 'Error recording payment');
    } finally {
      setSaving(false);
    }
  };

  // ── Address form helper ─────────────────────────────────────────────────────

  const setAddr = (type, field, val) =>
    setForm(f => ({ ...f, [type]: { ...f[type], [field]: val } }));

  const addrSection = (title, type) => (
    <div className="mt-4">
      <div className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">{title}</div>
      <div className="flex flex-col gap-2">
        <input className={inputCls} placeholder="Street" value={form[type].street}
          onChange={e => setAddr(type, 'street', e.target.value)}/>
        <div className="grid grid-cols-3 gap-2">
          {[['city','City'],['state','State'],['pincode','Pincode']].map(([f, p]) => (
            <input key={f} className={inputCls} placeholder={p} value={form[type][f]}
              onChange={e => setAddr(type, f, e.target.value)}/>
          ))}
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Customer Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage customer information with billing and delivery details</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition flex-shrink-0"
        >
          <Plus size={16}/> Add Customer
        </button>
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-gray-500"/>
            <span className="text-sm font-semibold text-gray-900">Customer List</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{filtered.length}</span>
          </div>
          <button
            onClick={syncBalances} disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''}/>
            {syncing ? 'Syncing...' : 'Sync Balances'}
          </button>
        </div>

        <div className="px-5 py-4">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 mb-4 focus-within:ring-2 focus-within:ring-gray-900 focus-within:bg-white transition">
            <Search size={15} className="text-gray-400 flex-shrink-0"/>
            <input
              className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
              placeholder="Search customers by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><X size={14}/></button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto -mx-5">
            <table className="w-full min-w-[650px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Name','Phone','Contact Person','Outstanding','Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Loading...
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-400 text-sm">No customers found</td></tr>
                )}
                {filtered.map(c => (
                  <tr key={c._id} className="border-b border-gray-50 hover:bg-gray-50 transition last:border-0">
                    <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">{c.name}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{c.phone || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{c.contactPerson || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-red-600">{formatCurrency(c.outstandingBalance)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          title="Ledger"
                          onClick={() => openLedger(c)}
                          className="p-1.5 rounded-lg border border-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition"
                        ><History size={14}/></button>
                        <button
                          title="Edit"
                          onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg border border-gray-100 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
                        ><Edit2 size={14}/></button>
                        {/* Receive payment from this customer */}
                        <button
                          title="Receive Payment"
                          onClick={() => openPay(c)}
                          disabled={!c.outstandingBalance || c.outstandingBalance <= 0}
                          className="p-1.5 rounded-lg border border-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600 hover:border-green-100 transition disabled:opacity-30"
                        ><CreditCard size={14}/></button>
                        <button
                          title="Delete"
                          onClick={() => handleDelete(c)}
                          className="p-1.5 rounded-lg border border-red-50 text-red-400 hover:bg-red-50 hover:text-red-600 transition"
                        ><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Customer Create/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editCustomer ? 'Edit Customer' : 'Add Customer'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"><X size={18}/></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">{error}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="Customer Name" required value={form.name} placeholder="M/s. Company Name"
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
                <InputField label="Phone" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}/>
                <InputField label="Email" type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}/>
                <InputField label="Contact Person" value={form.contactPerson}
                  onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))}/>
              </div>
              <InputField label="GST Number" value={form.gstNumber} placeholder="27XXXXX1234X1Z5"
                onChange={e => setForm(f => ({ ...f, gstNumber: e.target.value }))}/>
              {addrSection('Billing Address', 'billingAddress')}
              {addrSection('Delivery Address', 'deliveryAddress')}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-700 transition disabled:opacity-60">
                {saving ? 'Saving...' : editCustomer ? 'Update' : 'Add Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ledger Modal ── */}
      {showLedger && ledgerCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Ledger: {ledgerCustomer.name}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Outstanding: <span className="font-semibold text-red-600">{formatCurrency(ledgerCustomer.outstandingBalance)}</span>
                </p>
              </div>
              <button onClick={() => setShowLedger(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"><X size={18}/></button>
            </div>
            <div className="p-5 overflow-x-auto">
              {ledgerLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400 text-sm">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Loading ledger…
                </div>
              ) : (
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Order #','Date','Total','Paid','Outstanding','Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No transactions found</td></tr>
                    )}
                    {ledgerData.map(o => (
                      <tr key={o._id} className="border-b border-gray-50 hover:bg-gray-50 transition last:border-0">
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{o.orderNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(o.orderDate)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(o.totalAmount)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-green-600">{formatCurrency(o.paidAmount)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-red-600">{formatCurrency(o.outstandingAmount)}</td>
                        <td className="px-4 py-3"><Badge status={o.paymentStatus}/></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowLedger(false)}
                className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Receive Payment Modal ── */}
      {showPayModal && payCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Receive Payment</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Customer: <span className="font-medium text-gray-600">{payCustomer.name}</span> — applied oldest-first across orders
                </p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"><X size={18}/></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">{error}</div>}

              {/* Outstanding callout */}
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <div className="text-xs text-red-500 mb-1">Customer Outstanding Balance</div>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(payCustomer.outstandingBalance)}</div>
              </div>

              <div>
                <label className={`block ${labelCls} mb-1.5`}>Amount *</label>
                <input
                  type="number" className={inputCls}
                  value={payForm.amount}
                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  max={payCustomer.outstandingBalance}
                  placeholder={`Max ${formatCurrency(payCustomer.outstandingBalance)}`}
                />
              </div>

              <div>
                <label className={`block ${labelCls} mb-1.5`}>Payment Method</label>
                <select className={inputCls} value={payForm.paymentMethod}
                  onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="upi">UPI</option>
                </select>
              </div>

              <div>
                <label className={`block ${labelCls} mb-1.5`}>Transaction ID / Reference</label>
                <input className={inputCls} value={payForm.transactionId}
                  onChange={e => setPayForm(f => ({ ...f, transactionId: e.target.value }))}
                  placeholder="Optional"/>
              </div>

              <div>
                <label className={`block ${labelCls} mb-1.5`}>Notes</label>
                <input className={inputCls} value={payForm.notes}
                  onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional"/>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowPayModal(false)}
                className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handlePayment} disabled={saving}
                className="px-5 py-2 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-700 transition disabled:opacity-60">
                {saving ? 'Saving...' : 'Record Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}