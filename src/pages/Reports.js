import React, { useState } from 'react';
import { FileText, TrendingUp, TrendingDown, Users, Search } from 'lucide-react';
import api from '../utils/api';
import { formatCurrency, formatDate, formatDateInput } from '../utils/format';

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
  const [tab, setTab] = useState('pl');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

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

  const inputCls = "px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition w-full";

  const TableWrapper = ({ headers, children }) => (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
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
        <button onClick={fetchReport} disabled={loading} className="inline-flex items-center gap-2 px-5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition disabled:opacity-60">
          <Search size={14}/>{loading?'Loading...':'Load Outstanding Report'}
        </button>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard label="Total Revenue" value={formatCurrency(data.totalRevenue)} />
            <SummaryCard label="Amount Received" value={<span className="text-green-600">{formatCurrency(data.totalReceived)}</span>} />
            <SummaryCard label="Outstanding" value={<span className="text-red-500">{formatCurrency(data.totalOutstanding)}</span>} />
          </div>
          <TableWrapper headers={['Order #','Customer','Date','Total','Received','Outstanding','Status']}>
            {data.orders.length===0&&<tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">No orders in selected period</td></tr>}
            {data.orders.map(o=>(
              <tr key={o._id} className="border-b border-gray-50 hover:bg-gray-50 transition last:border-0">
                <td className="px-5 py-3.5 font-mono text-xs text-gray-600">{o.orderNumber}</td>
                <td className="px-5 py-3.5 text-sm text-gray-800 max-w-[120px] truncate">{o.customer?.name}</td>
                <td className="px-5 py-3.5 text-xs text-gray-500">{formatDate(o.orderDate)}</td>
                <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{formatCurrency(o.totalAmount)}</td>
                <td className="px-5 py-3.5 text-sm font-medium text-green-600">{formatCurrency(o.paidAmount)}</td>
                <td className="px-5 py-3.5 text-sm font-medium text-red-600">{formatCurrency(o.outstandingAmount)}</td>
                <td className="px-5 py-3.5"><Badge status={o.paymentStatus}/></td>
              </tr>
            ))}
          </TableWrapper>
        </div>
      )}

      {/* ── Purchase Report ── */}
      {tab==='purchases' && data && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard label="Total Purchases" value={formatCurrency(data.totalPurchases)} />
            <SummaryCard label="Amount Paid" value={<span className="text-green-600">{formatCurrency(data.totalPaid)}</span>} />
            <SummaryCard label="Outstanding" value={<span className="text-red-500">{formatCurrency(data.totalOutstanding)}</span>} />
          </div>
          <TableWrapper headers={['Order #','Vendor','Date','Total','Paid','Outstanding','Status']}>
            {data.orders.length===0&&<tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">No orders in selected period</td></tr>}
            {data.orders.map(o=>(
              <tr key={o._id} className="border-b border-gray-50 hover:bg-gray-50 transition last:border-0">
                <td className="px-5 py-3.5 font-mono text-xs text-gray-600">{o.orderNumber}</td>
                <td className="px-5 py-3.5 text-sm text-gray-800 max-w-[120px] truncate">{o.vendor?.name}</td>
                <td className="px-5 py-3.5 text-xs text-gray-500">{formatDate(o.orderDate)}</td>
                <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{formatCurrency(o.totalAmount)}</td>
                <td className="px-5 py-3.5 text-sm font-medium text-green-600">{formatCurrency(o.paidAmount)}</td>
                <td className="px-5 py-3.5 text-sm font-medium text-red-600">{formatCurrency(o.outstandingAmount)}</td>
                <td className="px-5 py-3.5"><Badge status={o.paymentStatus}/></td>
              </tr>
            ))}
          </TableWrapper>
        </div>
      )}

      {/* ── Outstanding Report ── */}
      {tab==='outstanding' && data && (
        <div className="space-y-5">
          <div className="max-w-xs">
            <SummaryCard icon={Users} iconBg="bg-orange-50" iconColor="text-orange-500" label="Total Receivables" value={<span className="text-red-600">{formatCurrency(data.total)}</span>} sub={`${data.customers.length} customers with outstanding`} />
          </div>
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