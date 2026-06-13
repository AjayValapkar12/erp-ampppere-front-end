import React, { useState } from 'react';
import { FileText, TrendingUp, TrendingDown, Users, Search, Download, Bell } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts';
import api from '../utils/api';
import { formatCurrency, formatDate, formatDateInput } from '../utils/format';
import { useAuth } from '../context/AuthContext';

const SALES_CHART_COLORS = ['#1f2937', '#0f766e', '#dc2626', '#d97706', '#2563eb', '#7c3aed'];

const Badge = ({ status }) => {
  const map = { pending:'bg-red-100 text-red-700', partial:'bg-yellow-100 text-yellow-700', paid:'bg-green-100 text-green-700' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status]||'bg-gray-100 text-gray-600'}`}>{status}</span>;
};

const SummaryCard = ({ icon: Icon, iconBg, iconColor, label, value, sub }) => (
  <div className="bg-white rounded-xl border border-gray-100 p-5">
    {Icon && <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${iconBg}`}><Icon size={20} className={iconColor}/></div>}
    <div className="text-xs text-gray-500 font-medium mb-1">{label}</div>
    <div className="text-xl sm:text-2xl font-bold text-gray-900">{value}</div>
    {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
  </div>
);

export default function Reports() {
  const { user } = useAuth();
  const [tab, setTab] = useState('pl');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderStatus, setReminderStatus] = useState('');

  const salesOrderRows = data?.customers
    ? data.customers.flatMap(c =>
        (c.orders || []).map(o => ({
          ...o,
          customerId: c.customer?._id,
          customerName: c.customer?.name || '-',
          customerPhone: c.customer?.phone || '-'
        }))
      )
    : [];

  const topCustomerOutstanding = (data?.customers || [])
    .slice()
    .sort((a, b) => (b.outstandingAmount || 0) - (a.outstandingAmount || 0))
    .slice(0, 6)
    .map(c => ({
      name: c.customer?.name || 'Unknown',
      outstanding: c.outstandingAmount || 0,
      paid: c.paidAmount || 0
    }));

  const paymentStatusBreakdown = salesOrderRows.reduce((acc, order) => {
    const status = order.paymentStatus || 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const salesStatusChartData = Object.entries(paymentStatusBreakdown).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  }));

  const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const tabs = [
    { key:'pl', label:'P&L Report' },
    { key:'sales', label:'Sales Report' },
    { key:'purchases', label:'Purchase Report' },
    { key:'outstanding', label:'Outstanding' },
  ];

  const currentMonth = () => {
    const now = new Date();
    setStartDate(formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
    setEndDate(formatDateInput(new Date(now.getFullYear(), now.getMonth()+1, 0)));
  };

  const fetchReport = async () => {
    setLoading(true); setData(null);
    setReminderStatus('');
    try {
      let url = '';
      if (tab==='pl') url=`/reports/pl?startDate=${startDate}&endDate=${endDate}`;
      else if (tab==='sales') url=`/reports/sales?startDate=${startDate}&endDate=${endDate}`;
      else if (tab==='purchases') url=`/reports/purchases?startDate=${startDate}&endDate=${endDate}`;
      else if (tab==='outstanding') url=`/reports/outstanding`;
      const res = await api.get(url);
      setData(res.data.data);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  };

  const sendReminder = async () => {
    setSendingReminder(true);
    setReminderStatus('');
    try {
      const res = await api.post('/reminders/outstanding/send');
      const result = res.data?.data;

      if (result?.success) {
        setReminderStatus(`Reminder sent to ${result.recipient} for ${result.customerCount} customers.`);
      } else if (result?.skipped) {
        setReminderStatus(result.reason || 'Reminder skipped.');
      } else {
        setReminderStatus('Reminder request completed.');
      }
    } catch (e) {
      setReminderStatus(e.response?.data?.message || 'Failed to send reminder.');
    } finally {
      setSendingReminder(false);
    }
  };

  const downloadExcel = () => {
    if (!data) return;
    
    let csvContent = '';
    let filename = '';
    
    if (tab === 'sales' && data.customers) {
      csvContent = 'Customer Name,Phone,Order Number,Order Date,Invoice Number,PO Number,Order Amount,Paid Amount,Outstanding,Payment Status\n';
      salesOrderRows.forEach(order => {
        csvContent += [
          escapeCsv(order.customerName),
          escapeCsv(order.customerPhone),
          escapeCsv(order.orderNumber || ''),
          escapeCsv(order.orderDate ? formatDate(order.orderDate) : ''),
          escapeCsv(order.invoiceNumber || '-'),
          escapeCsv(order.poNumber || '-'),
          order.totalAmount || 0,
          order.paidAmount || 0,
          order.outstandingAmount || 0,
          escapeCsv(order.paymentStatus || '')
        ].join(',') + '\n';
      });

      csvContent += '\n';
      csvContent += 'Customer Summary\n';
      csvContent += 'Customer Name,Phone,Orders,Total Amount,Paid Amount,Outstanding\n';
      data.customers.forEach(cust => {
        csvContent += [
          escapeCsv(cust.customer?.name || ''),
          escapeCsv(cust.customer?.phone || ''),
          cust.orderCount || 0,
          cust.totalAmount || 0,
          cust.paidAmount || 0,
          cust.outstandingAmount || 0
        ].join(',') + '\n';
      });
      filename = 'sales_report.csv';
    } else if (tab === 'purchases' && data.vendors) {
      csvContent = 'Vendor Name,Phone,Total Amount,Paid Amount,Outstanding,Order Number,Order Date,Invoice Number,PO Number,Payment Status\n';
      data.vendors.forEach(vend => {
        (vend.orders || []).forEach(order => {
          csvContent += `"${vend.vendor?.name || ''}","${vend.vendor?.phone || ''}",${vend.totalAmount},${vend.paidAmount},${vend.outstandingAmount},"${order.orderNumber}","${order.orderDate ? formatDate(order.orderDate) : ''}","${order.invoiceNumber}","${order.poNumber}","${order.paymentStatus}"\n`;
        });
      });
      filename = 'purchase_report.csv';
    }
    
    if (!csvContent) return;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const inputCls = "px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition w-full";

  const TableWrapper = ({ headers, children }) => (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full responsive-table">
          <thead>
            <tr className="border-b border-gray-100">
              {headers.map(h=><th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Financial and operational reports for your business</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-full sm:w-fit overflow-x-auto">
        {tabs.map(t=>(
          <button key={t.key} onClick={()=>{ setTab(t.key); setData(null); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap
              ${tab===t.key?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}
          >{t.label}</button>
        ))}
      </div>

      {/* Date Filters */}
      {tab!=='outstanding' && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="w-full sm:w-44">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">From Date</label>
              <input type="date" className={inputCls} value={startDate} onChange={e=>setStartDate(e.target.value)} />
            </div>
            <div className="w-full sm:w-44">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">To Date</label>
              <input type="date" className={inputCls} value={endDate} onChange={e=>setEndDate(e.target.value)} />
            </div>
            <button onClick={currentMonth} className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition whitespace-nowrap">
              This Month
            </button>
            <button onClick={fetchReport} disabled={loading} className="inline-flex items-center gap-2 px-5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition disabled:opacity-60 whitespace-nowrap">
              <Search size={14}/>{loading?'Loading...':'Generate Report'}
            </button>
          </div>
        </div>
      )}

      {tab==='outstanding' && !data && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <button onClick={fetchReport} disabled={loading} className="inline-flex items-center gap-2 px-5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition disabled:opacity-60">
            <Search size={14}/>{loading?'Loading...':'Load Outstanding Report'}
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={sendReminder}
              disabled={sendingReminder}
              className="inline-flex items-center gap-2 px-5 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition disabled:opacity-60"
            >
              <Bell size={14}/>{sendingReminder ? 'Sending...' : 'Send Reminder'}
            </button>
          )}
        </div>
      )}

      {/* ── P&L Report ── */}
      {tab==='pl' && data && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard icon={TrendingUp} iconBg="bg-green-50" iconColor="text-green-600" label="Total Revenue" value={<span className="text-green-600">{formatCurrency(data.revenue)}</span>} sub={`${data.orders} sales orders`} />
            <SummaryCard icon={TrendingDown} iconBg="bg-red-50" iconColor="text-red-500" label="Total Purchases" value={<span className="text-red-500">{formatCurrency(data.purchases)}</span>} sub={`${data.pos} purchase orders`} />
            <SummaryCard icon={FileText} iconBg="bg-blue-50" iconColor="text-blue-600" label="Gross Profit" value={<span className={data.grossProfit>=0?'text-green-600':'text-red-500'}>{formatCurrency(data.grossProfit)}</span>} sub={`Margin: ${data.revenue>0?((data.grossProfit/data.revenue)*100).toFixed(1):0}%`} />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h3 className="text-sm font-bold text-gray-900">Profit & Loss Summary</h3>
            </div>
            <div className="p-5 space-y-3 max-w-md">
              <div className="flex justify-between items-center py-2 border-b border-gray-50 text-sm text-gray-700">
                <span>Sales Revenue</span>
                <span className="font-semibold text-green-600">{formatCurrency(data.revenue)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50 text-sm text-gray-700">
                <span>Purchase Cost</span>
                <span className="font-semibold text-red-500">({formatCurrency(data.purchases)})</span>
              </div>
              <div className="flex justify-between items-center py-3 text-base font-bold text-gray-900">
                <span>Gross Profit</span>
                <span className={data.grossProfit>=0?'text-green-600':'text-red-500'}>{formatCurrency(data.grossProfit)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sales Report ── */}
      {tab==='sales' && data && (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <SummaryCard label="Total Revenue" value={formatCurrency(data.totalRevenue || 0)} />
            <SummaryCard label="Amount Received" value={<span className="text-green-600">{formatCurrency(data.totalReceived || 0)}</span>} />
            <SummaryCard label="Outstanding" value={<span className="text-red-500">{formatCurrency(data.totalOutstanding || 0)}</span>} />
            <SummaryCard label="Total Customers" value={data.customers?.length || 0} />
          </div>
          
          {/* Download Button */}
          <div className="flex justify-end">
            <button onClick={downloadExcel} disabled={!data || !(data.customers && data.customers.length)} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50">
              <Download size={14}/> Download CSV
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-900">Top Customers by Outstanding</h3>
                <p className="text-xs text-gray-400 mt-1">Customer-wise outstanding and received amount</p>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topCustomerOutstanding}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="outstanding" fill="#dc2626" radius={[4, 4, 0, 0]} name="Outstanding" />
                  <Bar dataKey="paid" fill="#15803d" radius={[4, 4, 0, 0]} name="Received" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-900">Order Payment Status Mix</h3>
                <p className="text-xs text-gray-400 mt-1">Distribution of customer order payment states</p>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={salesStatusChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={92}
                    paddingAngle={3}
                  >
                    {salesStatusChartData.map((entry, index) => (
                      <Cell key={entry.name} fill={SALES_CHART_COLORS[index % SALES_CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} orders`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-3">
                {salesStatusChartData.map((entry, index) => (
                  <div key={entry.name} className="inline-flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SALES_CHART_COLORS[index % SALES_CHART_COLORS.length] }} />
                    <span>{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-900">Customer-wise Outstanding Summary</h3>
              <span className="text-xs text-gray-400">{data.customers?.length || 0} customers</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full responsive-table">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Customer</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Orders</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Total Value</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Paid</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Outstanding</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">% Unpaid</th>
                  </tr>
                </thead>
                <tbody>
                  {!data.customers || data.customers.length===0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No data available</td></tr>
                  ) : data.customers.map(c=>(
                    <tr key={c.customer?._id} className="border-b border-gray-50 hover:bg-gray-50 transition last:border-0">
                      <td className="px-5 py-3.5">
                        <div className="text-sm font-semibold text-gray-900">{c.customer?.name}</div>
                        <div className="text-xs text-gray-400">{c.customer?.phone || '-'}</div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{c.orderCount || 0}</span>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-900 text-right">{formatCurrency(c.totalAmount)}</td>
                      <td className="px-5 py-3.5 text-sm font-medium text-green-600 text-right">{formatCurrency(c.paidAmount)}</td>
                      <td className="px-5 py-3.5 text-sm font-bold text-red-600 text-right">{formatCurrency(c.outstandingAmount)}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`text-xs font-medium ${c.totalAmount > 0 && (c.outstandingAmount/c.totalAmount) > 0.5 ? 'text-red-600' : 'text-yellow-600'}`}>
                          {c.totalAmount > 0 ? ((c.outstandingAmount/c.totalAmount)*100).toFixed(0) : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Sales Order Details with Invoice/PO */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h3 className="text-sm font-bold text-gray-900">Sales Order Details (Individual Orders)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full responsive-table">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Order #</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Customer</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Invoice #</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">PO Number</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Total</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Received</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Outstanding</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(!data.customers || (data.customers.length === 0)) && (
                    <tr><td colSpan={9} className="text-center py-12 text-gray-400 text-sm">No orders in selected period</td></tr>
                  )}
                  {salesOrderRows.map(o => (
                    <tr key={o._id || o.orderNumber} className="border-b border-gray-50 hover:bg-gray-50 transition last:border-0">
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-600">{o.orderNumber}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-800 max-w-[120px] truncate">{o.customerName}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-500">{o.orderDate ? formatDate(o.orderDate) : '-'}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-600">{o.invoiceNumber || '-'}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-600 font-medium">{o.poNumber || '-'}</td>
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-900 text-right">{formatCurrency(o.totalAmount)}</td>
                      <td className="px-5 py-3.5 text-sm font-medium text-green-600 text-right">{formatCurrency(o.paidAmount)}</td>
                      <td className="px-5 py-3.5 text-sm font-medium text-red-600 text-right">{formatCurrency(o.outstandingAmount)}</td>
                      <td className="px-5 py-3.5"><Badge status={o.paymentStatus}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Purchase Report ── */}
      {tab==='purchases' && data && (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <SummaryCard label="Total Purchases" value={formatCurrency(data.totalPurchases || 0)} />
            <SummaryCard label="Amount Paid" value={<span className="text-green-600">{formatCurrency(data.totalPaid || 0)}</span>} />
            <SummaryCard label="Outstanding" value={<span className="text-red-500">{formatCurrency(data.totalOutstanding || 0)}</span>} />
            <SummaryCard label="Total Vendors" value={data.vendors?.length || 0} />
          </div>
          
          {/* Download Button */}
          <div className="flex justify-end">
            <button onClick={downloadExcel} disabled={!data || !(data.vendors && data.vendors.length)} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50">
              <Download size={14}/> Download Excel
            </button>
          </div>
          
          {/* Vendor-wise Summary with Analytics */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-900">Vendor-wise Outstanding Summary</h3>
              <span className="text-xs text-gray-400">{data.vendors?.length || 0} vendors</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full responsive-table">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Vendor</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Orders</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Total Value</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Paid</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Outstanding</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">% Unpaid</th>
                  </tr>
                </thead>
                <tbody>
                  {!data.vendors || data.vendors.length===0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No data available</td></tr>
                  ) : data.vendors.map(v=>(
                    <tr key={v.vendor?._id} className="border-b border-gray-50 hover:bg-gray-50 transition last:border-0">
                      <td className="px-5 py-3.5">
                        <div className="text-sm font-semibold text-gray-900">{v.vendor?.name}</div>
                        <div className="text-xs text-gray-400">{v.vendor?.phone || '-'}</div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">{v.orderCount || 0}</span>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-900 text-right">{formatCurrency(v.totalAmount)}</td>
                      <td className="px-5 py-3.5 text-sm font-medium text-green-600 text-right">{formatCurrency(v.paidAmount)}</td>
                      <td className="px-5 py-3.5 text-sm font-bold text-red-600 text-right">{formatCurrency(v.outstandingAmount)}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`text-xs font-medium ${v.totalAmount > 0 && (v.outstandingAmount/v.totalAmount) > 0.5 ? 'text-red-600' : 'text-yellow-600'}`}>
                          {v.totalAmount > 0 ? ((v.outstandingAmount/v.totalAmount)*100).toFixed(0) : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Purchase Order Details with Invoice/PO */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h3 className="text-sm font-bold text-gray-900">Purchase Order Details (Individual Orders)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full responsive-table">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Order #</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Vendor</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Invoice #</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">PO Number</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Total</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Paid</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Outstanding</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(!data.vendors || (data.vendors.length === 0)) && (
                    <tr><td colSpan={9} className="text-center py-12 text-gray-400 text-sm">No orders in selected period</td></tr>
                  )}
                  {data.vendors && data.vendors.flatMap(v => (v.orders || []).map(o => ({ ...o, vendorName: v.vendor?.name }))).map(o => (
                    <tr key={o._id || o.orderNumber} className="border-b border-gray-50 hover:bg-gray-50 transition last:border-0">
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-600">{o.orderNumber}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-800 max-w-[120px] truncate">{o.vendorName}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-500">{o.orderDate ? formatDate(o.orderDate) : '-'}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-600">{o.invoiceNumber || '-'}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-600 font-medium">{o.poNumber || '-'}</td>
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-900 text-right">{formatCurrency(o.totalAmount)}</td>
                      <td className="px-5 py-3.5 text-sm font-medium text-green-600 text-right">{formatCurrency(o.paidAmount)}</td>
                      <td className="px-5 py-3.5 text-sm font-medium text-red-600 text-right">{formatCurrency(o.outstandingAmount)}</td>
                      <td className="px-5 py-3.5"><Badge status={o.paymentStatus}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Outstanding Report ── */}
      {tab==='outstanding' && data && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xs">
              <SummaryCard icon={Users} iconBg="bg-orange-50" iconColor="text-orange-500" label="Total Receivables" value={<span className="text-red-600">{formatCurrency(data.total)}</span>} sub={`${data.customers.length} customers with outstanding`} />
            </div>
            {user?.role === 'admin' && (
              <div className="flex flex-col items-start gap-2">
                <button
                  onClick={sendReminder}
                  disabled={sendingReminder}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition disabled:opacity-60"
                >
                  <Bell size={14}/>{sendingReminder ? 'Sending...' : 'Send Outstanding Reminder'}
                </button>
                <p className="text-xs text-gray-400">Sends email to the configured reminder inbox with customers having pending balance.</p>
              </div>
            )}
          </div>
          {reminderStatus && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${reminderStatus.toLowerCase().includes('failed') || reminderStatus.toLowerCase().includes('only admin') ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
              {reminderStatus}
            </div>
          )}
          <TableWrapper headers={['Customer Name','Phone','Outstanding Amount']}>
            {data.customers.length===0&&<tr><td colSpan={3} className="text-center py-12 text-gray-400 text-sm">No outstanding receivables</td></tr>}
            {data.customers.map(c=>(
              <tr key={c._id} className="border-b border-gray-50 hover:bg-gray-50 transition last:border-0">
                <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">{c.name}</td>
                <td className="px-5 py-3.5 text-sm text-gray-600">{c.phone||<span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-3.5 text-sm font-bold text-red-600">{formatCurrency(c.outstandingBalance)}</td>
              </tr>
            ))}
          </TableWrapper>
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <FileText size={28} className="text-gray-300" />
          </div>
          <h3 className="text-base font-semibold text-gray-600 mb-1">
            {tab==='outstanding' ? 'Click to load outstanding report' : 'Select date range and generate report'}
          </h3>
          <p className="text-sm text-gray-400">Use the filters above to view your business reports</p>
        </div>
      )}
    </div>
  );
}
