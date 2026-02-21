import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, Users, Truck, ShoppingCart, AlertCircle } from 'lucide-react';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';

const StatCard = ({ icon: Icon, iconBg, iconColor, label, value, sub }) => (
  <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-sm transition-shadow">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${iconBg}`}>
      <Icon size={20} className={iconColor} />
    </div>
    <div className="text-xs text-gray-500 font-medium mb-1">{label}</div>
    <div className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 truncate">{value}</div>
    <div className="text-xs text-gray-400">{sub}</div>
  </div>
);

const Badge = ({ status }) => {
  const map = {
    pending: 'bg-red-100 text-red-700',
    partial: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(res => setStats(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span className="text-sm">Loading dashboard...</span>
      </div>
    </div>
  );

  if (!stats) return (
    <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
      Failed to load dashboard data.
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your cable manufacturing business</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          icon={TrendingUp} iconBg="bg-blue-50" iconColor="text-blue-600"
          label="Total Sales Revenue"
          value={formatCurrency(stats.totalSalesRevenue)}
          sub={`This month: ${formatCurrency(stats.monthSalesRevenue)}`}
        />
        <StatCard
          icon={AlertCircle} iconBg="bg-orange-50" iconColor="text-orange-500"
          label="Receivables Outstanding"
          value={formatCurrency(stats.totalOutstandingReceivables)}
          sub={`${stats.pendingSalesOrders} pending orders`}
        />
        <StatCard
          icon={TrendingDown} iconBg="bg-red-50" iconColor="text-red-500"
          label="Payables Outstanding"
          value={formatCurrency(stats.totalOutstandingPayables)}
          sub={`${stats.pendingPurchaseOrders} pending orders`}
        />
        <StatCard
          icon={Users} iconBg="bg-green-50" iconColor="text-green-600"
          label="Total Customers"
          value={stats.totalCustomers}
          sub="Registered customers"
        />
        <StatCard
          icon={Truck} iconBg="bg-purple-50" iconColor="text-purple-600"
          label="Total Vendors"
          value={stats.totalVendors}
          sub="Active suppliers"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Monthly Sales vs Purchases</h3>
            <p className="text-xs text-gray-400 mt-0.5">Last 6 months comparison</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="sales" fill="#1a1a2e" name="Sales" radius={[4,4,0,0]} />
              <Bar dataKey="purchases" fill="#ef4444" name="Purchases" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Revenue Trend</h3>
            <p className="text-xs text-gray-400 mt-0.5">Monthly revenue (last 6 months)</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Line type="monotone" dataKey="sales" stroke="#1a1a2e" strokeWidth={2} dot={{ fill: '#1a1a2e', r: 4 }} name="Revenue" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Sales */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-gray-50">
            <ShoppingCart size={16} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Recent Sales Orders</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  {['Order #','Customer','Amount','Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recentSales.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-gray-400 text-sm py-8">No orders yet</td></tr>
                )}
                {stats.recentSales.map(order => (
                  <tr key={order._id} className="hover:bg-gray-50 transition border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{order.orderNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 max-w-[120px] truncate">{order.customer?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(order.totalAmount)}</td>
                    <td className="px-4 py-3"><Badge status={order.paymentStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Purchases */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-gray-50">
            <Truck size={16} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Recent Purchase Orders</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  {['Order #','Vendor','Amount','Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recentPurchases.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-gray-400 text-sm py-8">No orders yet</td></tr>
                )}
                {stats.recentPurchases.map(order => (
                  <tr key={order._id} className="hover:bg-gray-50 transition border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{order.orderNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 max-w-[120px] truncate">{order.vendor?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(order.totalAmount)}</td>
                    <td className="px-4 py-3"><Badge status={order.paymentStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}