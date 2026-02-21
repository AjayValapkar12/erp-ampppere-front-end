import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShoppingCart, Plus, Eye, Edit2, Trash2, CreditCard,
  Search, X, FileText, CheckCircle, Circle,
} from 'lucide-react';
import api from '../utils/api';
import { formatCurrency, formatDate, formatDateInput } from '../utils/format';
import InvoiceModal from './InvoiceModal';

// ─── Inline ItemAutocomplete ──────────────────────────────────────────────────
// Self-contained — no separate file import needed.
// Fetches suggestions from /api/sales-orders/item-suggestions (debounced).
// Keyboard navigable: ↑ ↓ Enter Escape.

function ItemAutocomplete({ value, onChange, onSelect, placeholder = 'Item description' }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]               = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [loading, setLoading]         = useState(false);
  const debounceRef                   = useRef(null);
  const containerRef                  = useRef(null);

  const fetchSuggestions = useCallback(async (q) => {
    setLoading(true);
    try {
      const res = await api.get('/sales-orders/item-suggestions', { params: { q } });
      setSuggestions(res.data.data || []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!value.trim()) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 250);
    return () => clearTimeout(debounceRef.current);
  }, [value, fetchSuggestions]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (s) => {
    onChange(s.description);
    onSelect && onSelect(s);
    setOpen(false);
    setSuggestions([]);
    setHighlighted(-1);
  };

  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && highlighted >= 0) { e.preventDefault(); handleSelect(suggestions[highlighted]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition";

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          autoComplete="off"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); setHighlighted(-1); }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={inputCls}
        />
        {loading && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-3.5 w-3.5 text-gray-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </span>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {suggestions.map((s, idx) => (
            <li
              key={s.description}
              onMouseDown={() => handleSelect(s)}
              onMouseEnter={() => setHighlighted(idx)}
              className={`px-3 py-2 cursor-pointer text-sm transition ${
                highlighted === idx ? 'bg-gray-900 text-white' : 'hover:bg-gray-50 text-gray-800'
              }`}
            >
              <div className="font-medium truncate">{s.description}</div>
              <div className={`text-xs mt-0.5 ${highlighted === idx ? 'text-gray-300' : 'text-gray-400'}`}>
                HSN {s.hsnCode} · {s.unit} · GST {s.gstRate}% · Last ₹{Number(s.lastRate).toLocaleString('en-IN')}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_ITEM = { description: '', hsnCode: '8544', quantity: 1, unit: 'Mtr', rate: 0, gstRate: 18 };

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

const Badge = ({ status }) => {
  const map = {
    pending: 'bg-red-100 text-red-700',
    partial: 'bg-yellow-100 text-yellow-700',
    paid:    'bg-green-100 text-green-700',
  };
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : status;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  );
};

const TotalsBox = ({ subtotal, totalGst, total }) => (
  <div className="flex justify-end mt-4">
    <div className="bg-gray-50 rounded-xl p-4 min-w-[220px] space-y-2">
      <div className="flex justify-between text-sm text-gray-600">
        <span>Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span>
      </div>
      <div className="flex justify-between text-sm text-gray-600">
        <span>GST</span><span className="font-medium">{formatCurrency(totalGst)}</span>
      </div>
      <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-200 pt-2 mt-1">
        <span>Total</span><span>{formatCurrency(total)}</span>
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Sales() {
  const [orders, setOrders]                   = useState([]);
  const [customers, setCustomers]             = useState([]);
  const [search, setSearch]                   = useState('');
  const [loading, setLoading]                 = useState(true);
  const [showModal, setShowModal]             = useState(false);
  const [showViewModal, setShowViewModal]     = useState(false);
  const [showPayModal, setShowPayModal]       = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editOrder, setEditOrder]             = useState(null);
  const [viewOrder, setViewOrder]             = useState(null);
  const [payOrder, setPayOrder]               = useState(null);
  const [invoiceOrder, setInvoiceOrder]       = useState(null);
  const [saving, setSaving]                   = useState(false);
  const [error, setError]                     = useState('');
  const [togglingDelivery, setTogglingDelivery] = useState(null);

  const emptyForm = {
    customer: '', orderDate: formatDateInput(new Date()),
    deliveryDate: '', notes: '', items: [{ ...EMPTY_ITEM }],
  };
  const [form, setForm]         = useState(emptyForm);
  const [payForm, setPayForm]   = useState({ amount: '', paymentMethod: 'bank_transfer', transactionId: '', notes: '' });

  useEffect(() => { loadOrders(); loadCustomers(); }, []);

  const loadOrders = async () => {
    try {
      const res = await api.get('/sales');
      setOrders(res.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadCustomers = async () => {
    try { const res = await api.get('/customers'); setCustomers(res.data.data); } catch {}
  };

  const filtered = orders.filter(o =>
    o.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
    o.customer?.name?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Open helpers ────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditOrder(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  };

  const openEdit = (order) => {
    setEditOrder(order);
    setForm({
      customer:     order.customer?._id || order.customer,
      orderDate:    formatDateInput(order.orderDate),
      deliveryDate: formatDateInput(order.deliveryDate),
      notes:        order.notes || '',
      items:        order.items.map(i => ({ ...i })),
    });
    setError('');
    setShowModal(true);
  };

  const openView = async (order) => {
    try {
      const res = await api.get(`/sales/${order._id}`);
      setViewOrder(res.data.data);
      setShowViewModal(true);
    } catch { alert('Failed to load order details'); }
  };

  const openPay = (order) => {
    setPayOrder(order);
    setPayForm({ amount: '', paymentMethod: 'bank_transfer', transactionId: '', notes: '' });
    setError('');
    setShowPayModal(true);
  };

  const openInvoice = (order) => {
    const hasDelivered = order.items?.some(i => i.isDelivered);
    if (!hasDelivered) {
      alert('Mark at least one item as delivered before generating an invoice.');
      return;
    }
    setInvoiceOrder(order);
    setShowInvoiceModal(true);
  };

  // ── Item form helpers ───────────────────────────────────────────────────────

  const updateItem = (idx, field, val) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: val };
      return { ...f, items };
    });
  };

  // Called when autocomplete suggestion is picked — auto-fills sibling fields
  const applyItemSuggestion = (idx, suggestion) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = {
        ...items[idx],
        description: suggestion.description,
        hsnCode:     suggestion.hsnCode,
        unit:        suggestion.unit,
        gstRate:     suggestion.gstRate,
        // Pre-fill rate with last used rate; user can override freely
        rate:        suggestion.lastRate > 0 ? suggestion.lastRate : items[idx].rate,
      };
      return { ...f, items };
    });
  };

  const addItem    = () => setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const calcTotals = () => {
    let sub = 0, gst = 0;
    form.items.forEach(i => {
      const a = (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0);
      sub += a;
      gst += (a * (parseFloat(i.gstRate) || 0)) / 100;
    });
    return { subtotal: sub, totalGst: gst, total: sub + gst };
  };

  // ── CRUD handlers ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.customer) return setError('Please select a customer');
    if (form.items.some(i => !i.description.trim())) return setError('All items must have a description');
    setSaving(true); setError('');
    try {
      if (editOrder) {
        const res = await api.put(`/sales/${editOrder._id}`, form);
        setOrders(o => o.map(x => x._id === editOrder._id ? res.data.data : x));
      } else {
        const res = await api.post('/sales', form);
        setOrders(o => [res.data.data, ...o]);
      }
      setShowModal(false);
    } catch (e) {
      setError(e.response?.data?.message || 'Error saving order');
    } finally { setSaving(false); }
  };

  const handleDelete = async (order) => {
    if (!window.confirm(`Delete order ${order.orderNumber}?`)) return;
    try {
      await api.delete(`/sales/${order._id}`);
      setOrders(o => o.filter(x => x._id !== order._id));
    } catch (e) { alert(e.response?.data?.message || 'Error deleting'); }
  };

  const handlePayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) return setError('Enter a valid amount');
    setSaving(true); setError('');
    try {
      const res = await api.post(`/sales/${payOrder._id}/payment`, payForm);
      setOrders(o => o.map(x => x._id === payOrder._id ? res.data.data : x));
      setShowPayModal(false);
    } catch (e) {
      setError(e.response?.data?.message || 'Error recording payment');
    } finally { setSaving(false); }
  };

  const toggleItemDelivery = async (orderId, itemId) => {
    const key = `${orderId}-${itemId}`;
    setTogglingDelivery(key);
    try {
      const res = await api.patch(`/sales/${orderId}/items/${itemId}/delivery`);
      const updated = res.data.data;
      setOrders(prev => prev.map(o => o._id === orderId
        ? { ...o, items: updated.items, deliveryStatus: updated.deliveryStatus }
        : o
      ));
      if (viewOrder?._id === orderId) {
        setViewOrder(prev => ({ ...prev, items: updated.items, deliveryStatus: updated.deliveryStatus }));
      }
    } catch { alert('Failed to update delivery status'); }
    finally { setTogglingDelivery(null); }
  };

  const { subtotal, totalGst, total } = calcTotals();
  const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition";
  const labelCls = "block text-xs font-semibold text-gray-600 mb-1.5";

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Sales Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage sales orders, deliveries, and invoicing</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition flex-shrink-0"
        >
          <Plus size={16} /> Create Order
        </button>
      </div>

      {/* ── Orders Table Card ── */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-900">Sales Orders</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{filtered.length}</span>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 mb-4 focus-within:ring-2 focus-within:ring-gray-900 focus-within:bg-white transition">
            <Search size={15} className="text-gray-400 flex-shrink-0" />
            <input
              className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
              placeholder="Search by customer or order number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><X size={14}/></button>}
          </div>

          <div className="overflow-x-auto -mx-5">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Order #','Customer','Total','Paid','Outstanding','Payment','Delivery','Date','Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400 text-sm">Loading...</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400 text-sm">No orders found</td></tr>
                )}
                {filtered.map(order => {
                  const deliveredCount = order.items?.filter(i => i.isDelivered).length || 0;
                  const totalItems     = order.items?.length || 0;
                  return (
                    <tr key={order._id} className="border-b border-gray-50 hover:bg-gray-50 transition last:border-0">
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-600 whitespace-nowrap">{order.orderNumber}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-800 max-w-[130px] truncate">{order.customer?.name}</td>
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-900 whitespace-nowrap">{formatCurrency(order.totalAmount)}</td>
                      <td className="px-5 py-3.5 text-sm text-green-600 font-medium whitespace-nowrap">{formatCurrency(order.paidAmount)}</td>
                      <td className="px-5 py-3.5 text-sm text-red-600 font-medium whitespace-nowrap">{formatCurrency(order.outstandingAmount)}</td>
                      <td className="px-5 py-3.5"><Badge status={order.paymentStatus}/></td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`text-xs font-medium ${
                          deliveredCount === totalItems && totalItems > 0
                            ? 'text-green-600'
                            : deliveredCount > 0 ? 'text-yellow-600' : 'text-red-500'
                        }`}>
                          {deliveredCount}/{totalItems} delivered
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">{formatDate(order.orderDate)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <button title="View" onClick={() => openView(order)}
                            className="p-1.5 rounded-lg border border-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition">
                            <Eye size={13}/>
                          </button>
                          <button title="Edit" onClick={() => openEdit(order)}
                            className="p-1.5 rounded-lg border border-gray-100 text-gray-500 hover:bg-gray-100 transition">
                            <Edit2 size={13}/>
                          </button>
                          <button title="Payment" onClick={() => openPay(order)}
                            disabled={order.paymentStatus === 'paid'}
                            className="p-1.5 rounded-lg border border-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600 transition disabled:opacity-30">
                            <CreditCard size={13}/>
                          </button>
                          <button title="Invoice" onClick={() => openInvoice(order)}
                            className={`p-1.5 rounded-lg border border-gray-100 transition ${
                              order.items?.some(i => i.isDelivered)
                                ? 'text-blue-600 hover:bg-blue-50 hover:border-blue-100'
                                : 'text-gray-300 cursor-not-allowed'
                            }`}>
                            <FileText size={13}/>
                          </button>
                          <button title="Delete" onClick={() => handleDelete(order)}
                            className="p-1.5 rounded-lg border border-red-50 text-red-400 hover:bg-red-50 hover:text-red-600 transition">
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Create / Edit Order Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editOrder ? 'Edit Sales Order' : 'Create Sales Order'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition">
                <X size={18}/>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">{error}</div>
              )}

              {/* Order meta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Customer *</label>
                  <select className={inputCls} value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))}>
                    <option value="">Select Customer</option>
                    {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Order Date</label>
                  <input type="date" className={inputCls} value={form.orderDate} onChange={e => setForm(f => ({ ...f, orderDate: e.target.value }))}/>
                </div>
                <div>
                  <label className={labelCls}>Delivery Date</label>
                  <input type="date" className={inputCls} value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))}/>
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <input type="text" className={inputCls} placeholder="Optional" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}/>
                </div>
              </div>

              {/* Items table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-gray-900">Order Items</span>
                  <button onClick={addItem}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition">
                    <Plus size={13}/> Add Item
                  </button>
                </div>

                <div className="overflow-x-auto border border-gray-100 rounded-xl">
                  <table className="w-full min-w-[720px]">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Description','HSN','Qty','Unit','Rate (₹)','GST %','Amount',''].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 border-b border-gray-100">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((item, idx) => {
                        const amt = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
                        const gst = (amt * (parseFloat(item.gstRate) || 0)) / 100;
                        return (
                          <tr key={idx} className="border-b border-gray-50 last:border-0">
                            {/* Description with autocomplete */}
                            <td className="px-2 py-2 min-w-[200px]">
                              <ItemAutocomplete
                                value={item.description}
                                onChange={v => updateItem(idx, 'description', v)}
                                onSelect={s => applyItemSuggestion(idx, s)}
                                placeholder="Item description"
                              />
                            </td>
                            <td className="px-2 py-2 w-20">
                              <input className={inputCls} value={item.hsnCode}
                                onChange={e => updateItem(idx, 'hsnCode', e.target.value)} placeholder="8544"/>
                            </td>
                            <td className="px-2 py-2 w-20">
                              <input className={inputCls} type="number" min="0"
                                value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)}/>
                            </td>
                            <td className="px-2 py-2 w-24">
                              <select className={inputCls} value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}>
                                {['Mtr','Km','Kg','Nos','Set','Pcs'].map(u => <option key={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-2 w-28">
                              <input className={inputCls} type="number" min="0" step="0.01"
                                value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)}/>
                            </td>
                            <td className="px-2 py-2 w-24">
                              <select className={inputCls} value={item.gstRate} onChange={e => updateItem(idx, 'gstRate', e.target.value)}>
                                {[0,5,12,18,28].map(r => <option key={r} value={r}>{r}%</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-2 w-32">
                              <input className={`${inputCls} bg-gray-100 cursor-not-allowed`}
                                value={formatCurrency(amt + gst)} disabled/>
                            </td>
                            <td className="px-2 py-2 w-8">
                              {form.items.length > 1 && (
                                <button onClick={() => removeItem(idx)}
                                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                                  <X size={14}/>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <TotalsBox subtotal={subtotal} totalGst={totalGst} total={total} />
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-700 transition disabled:opacity-60">
                {saving ? 'Saving...' : editOrder ? 'Update Order' : 'Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View / Delivery Modal ── */}
      {showViewModal && viewOrder && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Order: {viewOrder.orderNumber}</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowViewModal(false); openInvoice(viewOrder); }}
                  disabled={!viewOrder.items?.some(i => i.isDelivered)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-40"
                >
                  <FileText size={13}/> Generate Invoice
                </button>
                <button onClick={() => setShowViewModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition">
                  <X size={18}/>
                </button>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[['Customer', viewOrder.customer?.name], ['Order Date', formatDate(viewOrder.orderDate)]].map(([l, v]) => (
                  <div key={l}>
                    <div className="text-xs text-gray-400 mb-0.5">{l}</div>
                    <div className="text-sm font-semibold text-gray-800">{v}</div>
                  </div>
                ))}
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Status</div>
                  <Badge status={viewOrder.paymentStatus}/>
                </div>
              </div>

              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Items &amp; Delivery Status</h3>
              <div className="space-y-3 mb-5">
                {viewOrder.items.map(item => {
                  const key       = `${viewOrder._id}-${item._id}`;
                  const isToggling = togglingDelivery === key;
                  const amt        = item.amount || (item.quantity * item.rate);
                  const gst        = item.gstAmount || ((amt * item.gstRate) / 100);
                  return (
                    <div key={item._id}
                      className={`border rounded-xl p-4 transition-all ${item.isDelivered ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-white'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-gray-900 mb-1.5">{item.description}</div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                            <span>Qty: <strong className="text-gray-700">{item.quantity} {item.unit}</strong></span>
                            <span>Rate: <strong className="text-gray-700">₹{item.rate}</strong></span>
                            <span>Total: <strong className="text-gray-700">{formatCurrency(amt + gst)}</strong></span>
                            {item.hsnCode && <span>HSN: <strong className="text-gray-700">{item.hsnCode}</strong></span>}
                          </div>
                          {item.isDelivered && item.deliveredDate && (
                            <div className="text-xs text-green-600 mt-1.5 font-medium">
                              ✓ Delivered: {formatDate(item.deliveredDate)}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => toggleItemDelivery(viewOrder._id, item._id)}
                          disabled={isToggling}
                          className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 ${
                            item.isDelivered
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {item.isDelivered ? <CheckCircle size={13}/> : <Circle size={13}/>}
                          {isToggling ? 'Updating...' : item.isDelivered ? 'Mark Undelivered' : 'Mark Delivered'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <div className="bg-gray-50 rounded-xl p-4 min-w-[220px] space-y-2">
                  <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{formatCurrency(viewOrder.subtotal)}</span></div>
                  <div className="flex justify-between text-sm text-gray-600"><span>GST</span><span>{formatCurrency(viewOrder.totalGst)}</span></div>
                  <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-200 pt-2"><span>Total</span><span>{formatCurrency(viewOrder.totalAmount)}</span></div>
                  <div className="flex justify-between text-sm text-green-600 font-medium"><span>Paid</span><span>{formatCurrency(viewOrder.paidAmount)}</span></div>
                  <div className="flex justify-between text-sm text-red-600 font-medium"><span>Outstanding</span><span>{formatCurrency(viewOrder.outstandingAmount)}</span></div>
                </div>
              </div>

              {!viewOrder.items?.some(i => i.isDelivered) && (
                <p className="text-center text-xs text-gray-400 mt-4">
                  💡 Mark items as delivered to enable invoice generation
                </p>
              )}
            </div>

            <div className="flex justify-end px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowViewModal(false)}
                className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Modal ── */}
      {showPayModal && payOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Record Payment</h2>
              <button onClick={() => setShowPayModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"><X size={18}/></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">{error}</div>}
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <div className="text-xs text-red-500 mb-1">Outstanding Amount</div>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(payOrder.outstandingAmount)}</div>
              </div>
              <div>
                <label className={labelCls}>Payment Amount (₹) *</label>
                <input type="number" max={payOrder.outstandingAmount} className={inputCls}
                  value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"/>
              </div>
              <div>
                <label className={labelCls}>Payment Method</label>
                <select className={inputCls} value={payForm.paymentMethod} onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="upi">UPI</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Transaction ID / Reference</label>
                <input type="text" className={inputCls} placeholder="Optional"
                  value={payForm.transactionId} onChange={e => setPayForm(f => ({ ...f, transactionId: e.target.value }))}/>
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <input type="text" className={inputCls} placeholder="Optional"
                  value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}/>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowPayModal(false)}
                className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={handlePayment} disabled={saving}
                className="px-5 py-2 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-700 transition disabled:opacity-60">
                {saving ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice Modal ── */}
      {showInvoiceModal && invoiceOrder && (
        <InvoiceModal
          order={invoiceOrder}
          onClose={() => { setShowInvoiceModal(false); setInvoiceOrder(null); }}
          onSaved={loadOrders}
        />
      )}
    </div>
  );
}