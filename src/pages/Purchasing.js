import React, { useState, useEffect } from 'react';
import { Truck, Plus, Edit2, Trash2, CreditCard, Eye, X } from 'lucide-react';
import api from '../utils/api';
import { formatCurrency, formatDate, formatDateInput } from '../utils/format';

const EMPTY_ITEM = { description:'', hsnCode:'', quantity:1, unit:'Kg', rate:0, gstRate:18 };

const Badge = ({ status }) => {
  const map = {
    pending:'bg-red-100 text-red-700', partial:'bg-yellow-100 text-yellow-700', paid:'bg-green-100 text-green-700',
    active:'bg-green-50 text-green-700', inactive:'bg-gray-100 text-gray-500',
    confirmed:'bg-blue-50 text-blue-700', received:'bg-green-50 text-green-700', cancelled:'bg-red-50 text-red-600',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status]||'bg-gray-100 text-gray-600'}`}>{status}</span>;
};

const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition";
const labelCls = "block text-xs font-semibold text-gray-600 mb-1.5";

export default function Purchasing() {
  const [tab, setTab] = useState('vendors');
  const [vendors, setVendors] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  // Edit / view targets
  const [editVendor, setEditVendor] = useState(null);
  const [editOrder, setEditOrder] = useState(null);
  const [viewOrder, setViewOrder] = useState(null);

  // Payment state — payTarget can be a PurchaseOrder or a Vendor
  const [payTarget, setPayTarget] = useState(null);   // { type: 'order'|'vendor', data: {...} }

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const emptyVendor = { name:'', email:'', phone:'', contactPerson:'', gstNumber:'', address:{ street:'', city:'', state:'', pincode:'' } };
  const [vendorForm, setVendorForm] = useState(emptyVendor);
  const [orderForm, setOrderForm] = useState({ vendor:'', orderDate:formatDateInput(new Date()), expectedDate:'', notes:'', items:[{...EMPTY_ITEM}] });
  const [payForm, setPayForm] = useState({ amount:'', paymentMethod:'bank_transfer', transactionId:'', notes:'' });

  useEffect(() => { loadVendors(); loadOrders(); }, []);

  const loadVendors = async () => {
    try { const res = await api.get('/vendors'); setVendors(res.data.data); }
    catch(e){} finally { setLoading(false); }
  };
  const loadOrders = async () => {
    try { const res = await api.get('/purchases'); setOrders(res.data.data); }
    catch(e){}
  };

  // ── Vendor modal helpers ──────────────────────────────────────
  const openVendorCreate = () => { setEditVendor(null); setVendorForm(emptyVendor); setError(''); setShowVendorModal(true); };
  const openVendorEdit = (v) => {
    setEditVendor(v);
    setVendorForm({ name:v.name||'', email:v.email||'', phone:v.phone||'', contactPerson:v.contactPerson||'', gstNumber:v.gstNumber||'', address:v.address||emptyVendor.address });
    setError(''); setShowVendorModal(true);
  };

  // ── Order modal helpers ───────────────────────────────────────
  const openOrderCreate = () => {
    setEditOrder(null);
    setOrderForm({ vendor:'', orderDate:formatDateInput(new Date()), expectedDate:'', notes:'', items:[{...EMPTY_ITEM}] });
    setError(''); setShowOrderModal(true);
  };
  const openOrderEdit = (o) => {
    setEditOrder(o);
    setOrderForm({ vendor:o.vendor?._id||o.vendor, orderDate:formatDateInput(o.orderDate), expectedDate:formatDateInput(o.expectedDate), notes:o.notes||'', items:o.items.map(i=>({...i})) });
    setError(''); setShowOrderModal(true);
  };
  const openView = async (o) => {
    const res = await api.get(`/purchases/${o._id}`);
    setViewOrder(res.data.data); setShowViewModal(true);
  };

  // ── Unified Pay modal ─────────────────────────────────────────
  /**
   * Opens the payment modal.
   * @param {'order'|'vendor'} type
   * @param {object} data  – the purchase order or vendor object
   */
  const openPay = (type, data) => {
    setPayTarget({ type, data });
    setPayForm({ amount:'', paymentMethod:'bank_transfer', transactionId:'', notes:'' });
    setError(''); setShowPayModal(true);
  };

  const outstandingForTarget = () => {
    if (!payTarget) return 0;
    return payTarget.type === 'order'
      ? payTarget.data.outstandingAmount
      : payTarget.data.outstandingBalance;
  };

  // ── Item helpers ──────────────────────────────────────────────
  const updateItem = (idx, field, val) => {
    const items = [...orderForm.items];
    items[idx] = { ...items[idx], [field]: val };
    setOrderForm(f => ({ ...f, items }));
  };

  const calcTotals = () => {
    let sub = 0, gst = 0;
    orderForm.items.forEach(i => {
      const a = (parseFloat(i.quantity)||0) * (parseFloat(i.rate)||0);
      sub += a; gst += a * (parseFloat(i.gstRate)||0) / 100;
    });
    return { subtotal: sub, totalGst: gst, total: sub + gst };
  };

  // ── Save vendor ───────────────────────────────────────────────
  const handleSaveVendor = async () => {
    if (!vendorForm.name) return setError('Vendor name required');
    setSaving(true); setError('');
    try {
      if (editVendor) {
        const res = await api.put(`/vendors/${editVendor._id}`, vendorForm);
        setVendors(v => v.map(x => x._id === editVendor._id ? res.data.data : x));
      } else {
        const res = await api.post('/vendors', vendorForm);
        setVendors(v => [res.data.data, ...v]);
      }
      setShowVendorModal(false);
    } catch(e){ setError(e.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const handleDeleteVendor = async (v) => {
    if (!window.confirm(`Delete vendor "${v.name}"?`)) return;
    try { await api.delete(`/vendors/${v._id}`); setVendors(x => x.filter(vx => vx._id !== v._id)); }
    catch(e){ alert('Error deleting'); }
  };

  // ── Save order ────────────────────────────────────────────────
  const handleSaveOrder = async () => {
    if (!orderForm.vendor) return setError('Select a vendor');
    setSaving(true); setError('');
    try {
      if (editOrder) {
        const res = await api.put(`/purchases/${editOrder._id}`, orderForm);
        setOrders(o => o.map(x => x._id === editOrder._id ? res.data.data : x));
      } else {
        const res = await api.post('/purchases', orderForm);
        setOrders(o => [res.data.data, ...o]);
        // Refresh vendor list so outstanding balance updates
        await loadVendors();
      }
      setShowOrderModal(false);
    } catch(e){ setError(e.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const handleDeleteOrder = async (o) => {
    if (!window.confirm(`Delete order ${o.orderNumber}?`)) return;
    try {
      await api.delete(`/purchases/${o._id}`);
      setOrders(x => x.filter(ox => ox._id !== o._id));
      await loadVendors(); // sync vendor balance
    } catch(e){ alert('Error deleting'); }
  };

  // ── Unified payment handler ───────────────────────────────────
  const handlePayment = async () => {
    const outstanding = outstandingForTarget();
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) return setError('Enter a valid amount');
    if (parseFloat(payForm.amount) > outstanding) return setError('Amount exceeds outstanding balance');

    setSaving(true); setError('');
    try {
      if (payTarget.type === 'order') {
        // Pay against a specific purchase order
        const res = await api.post(`/purchases/${payTarget.data._id}/payment`, payForm);
        setOrders(o => o.map(x => x._id === payTarget.data._id ? res.data.data : x));
        // Refresh vendors to reflect updated outstanding balance
        await loadVendors();
      } else {
        // Pay against a vendor — backend distributes across orders (oldest first)
        const res = await api.post(`/vendors/${payTarget.data._id}/payment`, payForm);
        // Update the vendor in state
        setVendors(v => v.map(x => x._id === payTarget.data._id ? res.data.data : x));
        // Refresh orders so their statuses update too
        await loadOrders();
      }
      setShowPayModal(false);
    } catch(e){ setError(e.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const { subtotal, totalGst, total } = calcTotals();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Purchasing Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage vendors, purchase orders, and payment tracking</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {['vendors','orders'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition capitalize ${tab===t?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── VENDORS ── */}
      {tab === 'vendors' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <span className="text-sm font-semibold text-gray-900">
              Vendors <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-1">{vendors.length}</span>
            </span>
            <button onClick={openVendorCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition">
              <Plus size={13}/>Add Vendor
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Name','Email','Phone','Outstanding','Status','Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">Loading...</td></tr>}
                {!loading && vendors.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No vendors yet. Add your first vendor.</td></tr>}
                {vendors.map(v => (
                  <tr key={v._id} className="border-b border-gray-50 hover:bg-gray-50 transition last:border-0">
                    <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">{v.name}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{v.email || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{v.phone || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-red-600">{formatCurrency(v.outstandingBalance)}</td>
                    <td className="px-5 py-3.5"><Badge status={v.status}/></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openVendorEdit(v)} className="p-1.5 rounded-lg border border-gray-100 text-gray-500 hover:bg-gray-100 transition"><Edit2 size={14}/></button>
                        {/* Pay outstanding from vendor row */}
                        <button
                          onClick={() => openPay('vendor', v)}
                          disabled={!v.outstandingBalance || v.outstandingBalance <= 0}
                          title="Record payment for this vendor"
                          className="p-1.5 rounded-lg border border-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600 transition disabled:opacity-30"
                        ><CreditCard size={14}/></button>
                        <button onClick={() => handleDeleteVendor(v)} className="p-1.5 rounded-lg border border-red-50 text-red-400 hover:bg-red-50 transition"><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ORDERS ── */}
      {tab === 'orders' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-gray-500"/>
              <span className="text-sm font-semibold text-gray-900">Purchase Orders</span>
            </div>
            <button onClick={openOrderCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition">
              <Plus size={13}/>Create Order
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Order #','Vendor','Total','Paid','Outstanding','Status','Date','Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">No purchase orders yet</td></tr>}
                {orders.map(o => (
                  <tr key={o._id} className="border-b border-gray-50 hover:bg-gray-50 transition last:border-0">
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-600">{o.orderNumber}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-800 max-w-[130px] truncate">{o.vendor?.name}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900 whitespace-nowrap">{formatCurrency(o.totalAmount)}</td>
                    <td className="px-5 py-3.5 text-sm text-green-600 font-medium whitespace-nowrap">{formatCurrency(o.paidAmount)}</td>
                    <td className="px-5 py-3.5 text-sm text-red-600 font-medium whitespace-nowrap">{formatCurrency(o.outstandingAmount)}</td>
                    <td className="px-5 py-3.5"><Badge status={o.paymentStatus}/></td>
                    <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">{formatDate(o.orderDate)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openView(o)} className="p-1.5 rounded-lg border border-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition"><Eye size={13}/></button>
                        <button onClick={() => openOrderEdit(o)} className="p-1.5 rounded-lg border border-gray-100 text-gray-500 hover:bg-gray-100 transition"><Edit2 size={13}/></button>
                        <button
                          onClick={() => openPay('order', o)}
                          disabled={o.paymentStatus === 'paid'}
                          title="Record payment for this order"
                          className="p-1.5 rounded-lg border border-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600 transition disabled:opacity-30"
                        ><CreditCard size={13}/></button>
                        <button onClick={() => handleDeleteOrder(o)} className="p-1.5 rounded-lg border border-red-50 text-red-400 hover:bg-red-50 transition"><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Vendor Modal ── */}
      {showVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editVendor ? 'Edit Vendor' : 'Add Vendor'}</h2>
              <button onClick={() => setShowVendorModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"><X size={18}/></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">{error}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[['Vendor Name *','name'],['Phone','phone'],['Email','email'],['Contact Person','contactPerson'],['GST Number','gstNumber']].map(([label, field]) => (
                  field === 'gstNumber'
                    ? <div key={field} className="sm:col-span-2"><label className={labelCls}>{label}</label><input className={inputCls} value={vendorForm[field]} onChange={e => setVendorForm(f => ({...f, [field]: e.target.value}))}/></div>
                    : <div key={field}><label className={labelCls}>{label}</label><input className={inputCls} value={vendorForm[field]} onChange={e => setVendorForm(f => ({...f, [field]: e.target.value}))}/></div>
                ))}
              </div>
              <div>
                <div className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Address</div>
                <input className={`${inputCls} mb-2`} placeholder="Street" value={vendorForm.address.street} onChange={e => setVendorForm(f => ({...f, address:{...f.address, street:e.target.value}}))}/>
                <div className="grid grid-cols-3 gap-2">
                  {[['city','City'],['state','State'],['pincode','Pincode']].map(([f, p]) => (
                    <input key={f} className={inputCls} placeholder={p} value={vendorForm.address[f]} onChange={e => setVendorForm(v => ({...v, address:{...v.address, [f]:e.target.value}}))}/>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowVendorModal(false)} className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleSaveVendor} disabled={saving} className="px-5 py-2 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-700 transition disabled:opacity-60">
                {saving ? 'Saving...' : editVendor ? 'Update' : 'Add Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Order Modal ── */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editOrder ? 'Edit Purchase Order' : 'Create Purchase Order'}</h2>
              <button onClick={() => setShowOrderModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"><X size={18}/></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">{error}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className={labelCls}>Vendor *</label>
                  <select className={inputCls} value={orderForm.vendor} onChange={e => setOrderForm(f => ({...f, vendor:e.target.value}))}>
                    <option value="">Select Vendor</option>
                    {vendors.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Order Date</label><input type="date" className={inputCls} value={orderForm.orderDate} onChange={e => setOrderForm(f => ({...f, orderDate:e.target.value}))}/></div>
                <div><label className={labelCls}>Expected Delivery</label><input type="date" className={inputCls} value={orderForm.expectedDate} onChange={e => setOrderForm(f => ({...f, expectedDate:e.target.value}))}/></div>
                <div><label className={labelCls}>Notes</label><input className={inputCls} value={orderForm.notes} onChange={e => setOrderForm(f => ({...f, notes:e.target.value}))}/></div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-gray-900">Items</span>
                  <button onClick={() => setOrderForm(f => ({...f, items:[...f.items, {...EMPTY_ITEM}]}))} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"><Plus size={13}/>Add Item</button>
                </div>
                <div className="overflow-x-auto border border-gray-100 rounded-xl">
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Description','HSN','Qty','Unit','Rate (₹)','GST %','Amount',''].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 border-b border-gray-100">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orderForm.items.map((item, idx) => {
                        const amt = (parseFloat(item.quantity)||0) * (parseFloat(item.rate)||0);
                        const gst = amt * (parseFloat(item.gstRate)||0) / 100;
                        return (
                          <tr key={idx} className="border-b border-gray-50 last:border-0">
                            <td className="px-2 py-2"><input className={inputCls} value={item.description} onChange={e => updateItem(idx,'description',e.target.value)}/></td>
                            <td className="px-2 py-2"><input className={inputCls} value={item.hsnCode} onChange={e => updateItem(idx,'hsnCode',e.target.value)}/></td>
                            <td className="px-2 py-2"><input className={inputCls} type="number" min="0" value={item.quantity} onChange={e => updateItem(idx,'quantity',e.target.value)}/></td>
                            <td className="px-2 py-2">
                              <select className={inputCls} value={item.unit} onChange={e => updateItem(idx,'unit',e.target.value)}>
                                {['Kg','Mtr','Nos','Set','Ton'].map(u => <option key={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-2"><input className={inputCls} type="number" min="0" value={item.rate} onChange={e => updateItem(idx,'rate',e.target.value)}/></td>
                            <td className="px-2 py-2">
                              <select className={inputCls} value={item.gstRate} onChange={e => updateItem(idx,'gstRate',e.target.value)}>
                                {[0,5,12,18,28].map(r => <option key={r} value={r}>{r}%</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-2"><input className={`${inputCls} bg-gray-100 cursor-not-allowed`} value={formatCurrency(amt+gst)} disabled/></td>
                            <td className="px-2 py-2">
                              {orderForm.items.length > 1 && (
                                <button onClick={() => setOrderForm(f => ({...f, items:f.items.filter((_,i) => i!==idx)}))} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><X size={14}/></button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end mt-4">
                  <div className="bg-gray-50 rounded-xl p-4 min-w-[220px] space-y-2">
                    <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                    <div className="flex justify-between text-sm text-gray-600"><span>GST</span><span>{formatCurrency(totalGst)}</span></div>
                    <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-200 pt-2"><span>Total</span><span>{formatCurrency(total)}</span></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowOrderModal(false)} className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleSaveOrder} disabled={saving} className="px-5 py-2 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-700 transition disabled:opacity-60">
                {saving ? 'Saving...' : editOrder ? 'Update' : 'Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Order Modal ── */}
      {showViewModal && viewOrder && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">PO: {viewOrder.orderNumber}</h2>
              <button onClick={() => setShowViewModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"><X size={18}/></button>
            </div>
            <div className="px-6 py-5">
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div><div className="text-xs text-gray-400 mb-0.5">Vendor</div><div className="text-sm font-semibold text-gray-900">{viewOrder.vendor?.name}</div></div>
                <div><div className="text-xs text-gray-400 mb-0.5">Order Date</div><div className="text-sm text-gray-700">{formatDate(viewOrder.orderDate)}</div></div>
                <div><div className="text-xs text-gray-400 mb-0.5">Status</div><Badge status={viewOrder.paymentStatus}/></div>
              </div>
              <div className="overflow-x-auto border border-gray-100 rounded-xl mb-5">
                <table className="w-full min-w-[500px]">
                  <thead className="bg-gray-50">
                    <tr>{['Description','Qty','Unit','Rate','GST','Amount'].map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 border-b border-gray-100">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {viewOrder.items.map((item, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-800">{item.description}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.unit}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(item.rate)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.gstRate}%</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(item.amount + item.gstAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowViewModal(false)} className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unified Pay Modal ── */}
      {showPayModal && payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Record Payment</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {payTarget.type === 'vendor'
                    ? <>Vendor: <span className="font-medium text-gray-600">{payTarget.data.name}</span> — applied oldest-first across orders</>
                    : <>Order: <span className="font-mono font-medium text-gray-600">{payTarget.data.orderNumber}</span></>
                  }
                </p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"><X size={18}/></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">{error}</div>}
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <div className="text-xs text-red-500 mb-1">Outstanding Balance</div>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(outstandingForTarget())}</div>
              </div>
              <div>
                <label className={labelCls}>Amount *</label>
                <input
                  type="number" className={inputCls}
                  value={payForm.amount}
                  onChange={e => setPayForm(f => ({...f, amount:e.target.value}))}
                  max={outstandingForTarget()}
                  placeholder={`Max ${formatCurrency(outstandingForTarget())}`}
                />
              </div>
              <div>
                <label className={labelCls}>Payment Method</label>
                <select className={inputCls} value={payForm.paymentMethod} onChange={e => setPayForm(f => ({...f, paymentMethod:e.target.value}))}>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="upi">UPI</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Transaction ID / Reference</label>
                <input className={inputCls} value={payForm.transactionId} onChange={e => setPayForm(f => ({...f, transactionId:e.target.value}))} placeholder="Optional"/>
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <input className={inputCls} value={payForm.notes} onChange={e => setPayForm(f => ({...f, notes:e.target.value}))} placeholder="Optional"/>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowPayModal(false)} className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handlePayment} disabled={saving} className="px-5 py-2 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-700 transition disabled:opacity-60">
                {saving ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}