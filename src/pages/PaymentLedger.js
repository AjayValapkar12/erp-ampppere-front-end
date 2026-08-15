import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Filter } from 'lucide-react';
import api from '../utils/api';
import { formatCurrency, formatDate, formatDateInput } from '../utils/format';

export default function PaymentLedger() {
  const [ledger, setLedger] = useState([]);
  const [summary, setSummary] = useState(null);
  const [methodStats, setMethodStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterReference, setFilterReference] = useState('');
  const [activeTab, setActiveTab] = useState('ledger'); // ledger, summary, methods
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const today = new Date();
    setStartDate(formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)));
    setEndDate(formatDateInput(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      loadData();
    }
  }, [startDate, endDate, filterMethod, filterType]);

  const loadData = async () => {
    setLoading(true);
    try {
      let url = `/payment-ledger/unified?startDate=${startDate}&endDate=${endDate}`;
      if (filterMethod) url += `&paymentMethod=${filterMethod}`;
      if (filterType) url += `&transactionType=${filterType}`;

      const [ledgerRes, summaryRes, statsRes] = await Promise.all([
        api.get(url),
        api.get(`/payment-ledger/unified/summary?startDate=${startDate}&endDate=${endDate}`),
        api.get(`/payment-ledger/stats/methods?startDate=${startDate}&endDate=${endDate}`)
      ]);

      let filteredLedger = ledgerRes.data.data || [];
      
      // Client-side filtering for customer name and reference
      if (filterCustomer) {
        filteredLedger = filteredLedger.filter(entry =>
          entry.partyName.toLowerCase().includes(filterCustomer.toLowerCase())
        );
      }
      if (filterReference) {
        filteredLedger = filteredLedger.filter(entry =>
          entry.referenceNumber.toLowerCase().includes(filterReference.toLowerCase())
        );
      }

      setLedger(filteredLedger);
      setSummary(summaryRes.data.data);
      setMethodStats(statsRes.data.data || {});
    } catch (err) {
      console.error('Failed to load ledger', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncPayments = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/payment-ledger/sync-existing');
      if (res.data.success) {
        alert(`✓ Synced ${res.data.data.synced} existing payments!`);
        loadData();
      }
    } catch (err) {
      alert('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const getPaymentMethodLabel = (method) => {
    const labels = {
      cash: '💵 Cash',
      bank_transfer: '🏦 Bank Transfer',
      cheque: '✓ Cheque',
      upi: '📱 UPI'
    };
    return labels[method] || method;
  };

  const getTransactionTypeColor = (type) => {
    return type === 'Sales' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50';
  };

  const getTransactionTypeLabel = (type) => {
    return type === 'Sales' ? '↓ CREDIT (Received)' : '↑ DEBIT (Paid)';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">💰 Payment Ledger</h1>
          <p className="text-gray-600">Simple & Transparent Payment Transaction History</p>
          <button
            onClick={handleSyncPayments}
            disabled={syncing}
            className="mt-2 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-gray-400 text-sm font-medium"
          >
            {syncing ? '⏳ Syncing existing payments...' : '🔄 Sync Old Payments'}
          </button>
        </div>

        {/* Date Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer/Vendor</label>
              <input
                type="text"
                placeholder="Search customer name..."
                value={filterCustomer}
                onChange={(e) => setFilterCustomer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice/PO #</label>
              <input
                type="text"
                placeholder="Search reference..."
                value={filterReference}
                onChange={(e) => setFilterReference(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
              <select
                value={filterMethod}
                onChange={(e) => setFilterMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Methods</option>
                <option value="cash">💵 Cash</option>
                <option value="bank_transfer">🏦 Bank Transfer</option>
                <option value="cheque">✓ Cheque</option>
                <option value="upi">📱 UPI</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="Sales">Sales (Credit)</option>
                <option value="Purchase">Purchase (Debit)</option>
              </select>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 md:col-start-6"
            >
              {loading ? 'Loading...' : '🔍 Search'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`flex-1 px-4 py-3 font-medium text-center transition-colors ${
                activeTab === 'ledger'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📋 Ledger Entries
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex-1 px-4 py-3 font-medium text-center transition-colors ${
                activeTab === 'summary'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📊 Summary
            </button>
            <button
              onClick={() => setActiveTab('methods')}
              className={`flex-1 px-4 py-3 font-medium text-center transition-colors ${
                activeTab === 'methods'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              💳 Payment Methods
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Ledger Tab */}
            {activeTab === 'ledger' && (
              <div>
                {ledger.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No transactions found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 border-b-2 border-gray-300">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold text-gray-700">Date</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-700">Invoice / PO #</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-700">Customer / Vendor</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-700">Type</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-700">Method</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-700">Debit (Paid)</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-700">Credit (Received)</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-700">Balance</th>
                          <th className="text-center px-4 py-3 font-semibold text-gray-700">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.map((entry, idx) => (
                          <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-700">{formatDate(entry.date)}</td>
                            <td className="px-4 py-3 text-gray-700">
                              <div className="text-sm">
                                <div className="font-semibold">{entry.referenceNumber}</div>
                                <div className="text-gray-500 text-xs">{entry.referenceModel}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{entry.partyName}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-sm font-medium ${getTransactionTypeColor(entry.transactionType)}`}>
                                {getTransactionTypeLabel(entry.transactionType)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{getPaymentMethodLabel(entry.paymentMethod)}</td>
                            <td className="text-right px-4 py-3 font-semibold">
                              {entry.debit > 0 ? (
                                <span className="text-red-600">↑ {formatCurrency(entry.debit)}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="text-right px-4 py-3 font-semibold">
                              {entry.credit > 0 ? (
                                <span className="text-green-600">↓ {formatCurrency(entry.credit)}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="text-right px-4 py-3 font-semibold">
                              <span className={entry.runningBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatCurrency(entry.runningBalance)}
                              </span>
                            </td>
                            <td className="text-center px-4 py-3">
                              <span className={`text-xs px-2 py-1 rounded ${
                                entry.fromOldSystem 
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {entry.fromOldSystem ? '⚙️ Old' : '✨ New'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Summary Tab */}
            {activeTab === 'summary' && summary && (
              <div className="space-y-6">
                {/* Main Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Total Credit */}
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-700 mb-2">Total Received (Sales)</p>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalCredit)}</p>
                        <p className="text-xs text-green-600 mt-1">↓ Credits ({summary.byTransactionType.Sales.count} transactions)</p>
                      </div>
                      <TrendingDown className="text-green-400" size={32} />
                    </div>
                  </div>

                  {/* Total Debit */}
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-red-700 mb-2">Total Paid (Purchase)</p>
                        <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalDebit)}</p>
                        <p className="text-xs text-red-600 mt-1">↑ Debits ({summary.byTransactionType.Purchase.count} transactions)</p>
                      </div>
                      <TrendingUp className="text-red-400" size={32} />
                    </div>
                  </div>

                  {/* Net Balance */}
                  <div className={`rounded-lg p-6 border-2 ${
                    summary.netBalance >= 0
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-orange-50 border-orange-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-medium ${summary.netBalance >= 0 ? 'text-blue-700' : 'text-orange-700'} mb-2`}>
                          Net Balance
                        </p>
                        <p className={`text-2xl font-bold ${summary.netBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                          {formatCurrency(summary.netBalance)}
                        </p>
                        <p className={`text-xs ${summary.netBalance >= 0 ? 'text-blue-600' : 'text-orange-600'} mt-1`}>
                          {summary.netBalance >= 0 ? '✓ Positive' : '✗ Negative'}
                        </p>
                      </div>
                      <DollarSign className={summary.netBalance >= 0 ? 'text-blue-400' : 'text-orange-400'} size={32} />
                    </div>
                  </div>
                </div>

                {/* Transaction Type Breakdown */}
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Transaction Breakdown</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded p-4 border-l-4 border-green-500">
                      <p className="text-sm text-gray-600">Sales Transactions</p>
                      <p className="text-xl font-bold text-green-600">{summary.byTransactionType.Sales.count}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Total: {formatCurrency(summary.byTransactionType.Sales.amount)}
                      </p>
                    </div>
                    <div className="bg-white rounded p-4 border-l-4 border-red-500">
                      <p className="text-sm text-gray-600">Purchase Transactions</p>
                      <p className="text-xl font-bold text-red-600">{summary.byTransactionType.Purchase.count}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Total: {formatCurrency(summary.byTransactionType.Purchase.amount)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Methods Tab */}
            {activeTab === 'methods' && (
              <div className="space-y-4">
                {Object.entries(methodStats).map(([method, stats]) => (
                  <div key={method} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-semibold text-gray-900">{getPaymentMethodLabel(method)}</h4>
                      <span className="text-sm font-medium text-gray-600">{stats.count} transactions</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-600 uppercase tracking-wide">Received</p>
                        <p className="text-xl font-bold text-green-600">{formatCurrency(stats.credit)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 uppercase tracking-wide">Paid</p>
                        <p className="text-xl font-bold text-red-600">{formatCurrency(stats.debit)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 uppercase tracking-wide">Net</p>
                        <p className={`text-xl font-bold ${stats.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                          {formatCurrency(stats.net)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
