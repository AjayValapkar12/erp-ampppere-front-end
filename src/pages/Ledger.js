import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Download } from 'lucide-react';
import api from '../utils/api';
import { formatCurrency, formatDate, formatDateInput } from '../utils/format';

export default function Ledger() {
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [partyLedger, setPartyLedger] = useState([]);
  const [trialBalance, setTrialBalance] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedPartyModel, setSelectedPartyModel] = useState('Customer');
  const [selectedParty, setSelectedParty] = useState('');
  const [partyDirection, setPartyDirection] = useState('both');
  const [partySummary, setPartySummary] = useState({ debit: 0, credit: 0, balance: 0 });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [partyLoading, setPartyLoading] = useState(false);

  useEffect(() => {
    const today = new Date();
    setStartDate(formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)));
    setEndDate(formatDateInput(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
    loadAccounts();
    loadCustomers();
    loadVendors();
  }, []);

  useEffect(() => {
    if (selectedAccount) loadLedgerEntries();
  }, [selectedAccount, selectedParty, selectedPartyModel, startDate, endDate]);

  useEffect(() => {
    if (!selectedParty && selectedPartyModel === 'Customer' && customers.length) {
      setSelectedParty(customers[0]._id);
    }
  }, [customers, selectedPartyModel, selectedParty]);

  useEffect(() => {
    if (!selectedParty && selectedPartyModel === 'Vendor' && vendors.length) {
      setSelectedParty(vendors[0]._id);
    }
  }, [vendors, selectedPartyModel, selectedParty]);

  useEffect(() => {
    if (selectedParty) {
      loadPartySummary();
      loadPartyLedger();
    }
  }, [selectedParty, selectedPartyModel, startDate, endDate, partyDirection]);

  const loadAccounts = async () => {
    try {
      const res = await api.get('/ledger/accounts');
      setAccounts(res.data.data || []);
      if (res.data.data?.length) setSelectedAccount(res.data.data[0]._id);
    } catch (e) {
      console.error('Ledger accounts load failed', e);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await api.get('/customers');
      setCustomers(res.data.data || []);
    } catch {}
  };

  const loadVendors = async () => {
    try {
      const res = await api.get('/vendors');
      setVendors(res.data.data || []);
    } catch {}
  };

  const loadTrialBalance = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/ledger/trial-balance?startDate=${startDate}&endDate=${endDate}`);
      setTrialBalance(res.data.data || []);
    } catch (e) {
      console.error('Trial balance load failed', e);
    } finally {
      setLoading(false);
    }
  };

  const loadLedgerEntries = async () => {
    setLedgerLoading(true);
    try {
      let url = `/ledger/account/${selectedAccount}?startDate=${startDate}&endDate=${endDate}`;
      if (selectedParty) {
        url += `&party=${selectedParty}&partyModel=${selectedPartyModel}`;
      }
      const res = await api.get(url);
      setEntries(res.data.data || []);
    } catch (e) {
      console.error('Ledger entries load failed', e);
    } finally {
      setLedgerLoading(false);
    }
  };

  const loadPartyLedger = async () => {
    if (!selectedParty) return;
    setPartyLoading(true);
    try {
      let url = `/ledger/party?partyModel=${selectedPartyModel}&partyId=${selectedParty}&startDate=${startDate}&endDate=${endDate}`;
      if (partyDirection && partyDirection !== 'both') {
        url += `&direction=${partyDirection}`;
      }
      const res = await api.get(url);
      setPartyLedger(res.data.data || []);
    } catch (e) {
      console.error('Party ledger load failed', e);
      setPartyLedger([]);
    } finally {
      setPartyLoading(false);
    }
  };

  const loadPartySummary = async () => {
    if (!selectedParty) return;
    try {
      const res = await api.get(`/ledger/party/summary?partyModel=${selectedPartyModel}&partyId=${selectedParty}&startDate=${startDate}&endDate=${endDate}`);
      setPartySummary(res.data.data || { debit: 0, credit: 0, balance: 0 });
    } catch (e) {
      console.error('Party summary load failed', e);
      setPartySummary({ debit: 0, credit: 0, balance: 0 });
    }
  };

  const handleSearch = async () => {
    await Promise.all([loadTrialBalance(), loadLedgerEntries(), loadPartySummary(), loadPartyLedger()]);
  };

  const selectedAccountObj = accounts.find(acc => acc._id === selectedAccount);
  const selectedPartyObj = (selectedPartyModel === 'Customer' ? customers : vendors).find(p => p._id === selectedParty);
  const isPartyLedger = Boolean(selectedParty);

  const rowSource = selectedParty ? partyLedger : entries;
  const runningRows = rowSource.reduce((acc, row) => {
    const prev = acc.length ? acc[acc.length - 1].runningBalance : 0;
    const delta = (row.debit || 0) - (row.credit || 0);
    acc.push({ ...row, runningBalance: prev + delta });
    return acc;
  }, []);

  const downloadCsv = () => {
    if (!rowSource.length) return;
    const isPartyLedger = Boolean(selectedParty);
    const headers = isPartyLedger
      ? ['Date','Reference','Description','Party Type','Party Name','Payment Method','Transaction ID','Debit','Credit','Running Balance']
      : ['Date','Reference','Description','Payment Method','Transaction ID','Debit','Credit','Running Balance'];

    const escapeCsv = value => {
      const str = value == null ? '' : String(value);
      return `"${str.replace(/"/g, '""')}"`;
    };

    let csv = headers.map(escapeCsv).join(',') + '\n';
    runningRows.forEach(row => {
      const values = [
        formatDate(row.date),
        row.referenceNumber || '',
        row.description || '',
        ...(isPartyLedger ? [row.partyModel || selectedPartyModel, row.partyName || selectedPartyObj?.name || ''] : []),
        row.paymentMethod || '',
        row.transactionId || '',
        row.debit || 0,
        row.credit || 0,
        row.runningBalance || 0,
      ];
      csv += values.map(escapeCsv).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fileName = isPartyLedger
      ? `ledger_${selectedPartyObj?.name || selectedParty}_${selectedPartyModel}.csv`
      : `ledger_${selectedAccountObj.code || selectedAccountObj.name}.csv`;
    link.download = fileName;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <BookOpen size={24} className="text-gray-900" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Ledger</h1>
            <p className="text-sm text-gray-500 mt-1">General ledger, account ledger and trial balance for sales/purchase transactions.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Account</label>
            <select className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}>
              {accounts.map(account => (
                <option key={account._id} value={account._id}>{account.code} · {account.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Party Type</label>
            <select className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" value={selectedPartyModel} onChange={e => { setSelectedPartyModel(e.target.value); setSelectedParty(''); }}>
              <option value="Customer">Customer</option>
              <option value="Vendor">Vendor</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Party</label>
            <select className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" value={selectedParty} onChange={e => setSelectedParty(e.target.value)}>
              <option value="">All</option>
              {(selectedPartyModel === 'Customer' ? customers : vendors).map(item => (
                <option key={item._id} value={item._id}>{item.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Party Ledger Filter</label>
            <select className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50" value={partyDirection} onChange={e => setPartyDirection(e.target.value)}>
              <option value="both">All transactions</option>
              <option value="debit">Debits only</option>
              <option value="credit">Credits only</option>
            </select>
          </div>
          <div className="col-span-2 rounded-xl border border-gray-100 bg-white p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Party Summary</div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-gray-50 p-3 text-sm">
                <div className="text-gray-500">Debit</div>
                <div className="text-lg font-bold text-green-700">{formatCurrency(partySummary.debit)}</div>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 text-sm">
                <div className="text-gray-500">Credit</div>
                <div className="text-lg font-bold text-red-700">{formatCurrency(partySummary.credit)}</div>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 text-sm">
                <div className="text-gray-500">Balance</div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(partySummary.balance)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
          <button onClick={handleSearch} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition">
            <Search size={14} /> Refresh Ledger
          </button>
          <button onClick={downloadCsv} disabled={!selectedAccountObj || runningRows.length === 0} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50">
            <Download size={14} /> Download CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Account</div>
          <div className="mt-2 text-lg font-bold text-gray-900">{selectedAccountObj?.name || '-'}</div>
          <div className="text-sm text-gray-500 mt-1">{selectedAccountObj?.type || ''}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Debit</div>
          <div className="mt-2 text-lg font-bold text-green-600">{formatCurrency(runningRows.reduce((sum, row) => sum + (row.debit || 0), 0))}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Credit</div>
          <div className="mt-2 text-lg font-bold text-red-600">{formatCurrency(runningRows.reduce((sum, row) => sum + (row.credit || 0), 0))}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-gray-900">{isPartyLedger ? 'Party Ledger' : 'Account Ledger'}</div>
              <div className="text-xs text-gray-500">Showing transactions for selected {isPartyLedger ? 'party' : 'account'}</div>
            </div>
            <span className="text-xs text-gray-400">{ledgerLoading ? 'Loading…' : `${runningRows.length} entries`}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full responsive-table">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {[
                    'Date',
                    'Ref',
                    'Description',
                    ...(isPartyLedger ? ['Account'] : []),
                    'Payment Method',
                    'Transaction ID',
                    'Debit',
                    'Credit',
                    'Running Bal',
                  ].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledgerLoading ? (
                  <tr><td colSpan={isPartyLedger ? 9 : 8} className="py-10 text-center text-sm text-gray-400">Loading ledger entries…</td></tr>
                ) : runningRows.length === 0 ? (
                  <tr><td colSpan={isPartyLedger ? 9 : 8} className="py-10 text-center text-sm text-gray-400">No ledger entries found for this account</td></tr>
                ) : runningRows.map(row => (
                  <tr key={`${row._id}-${row.date}`} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{formatDate(row.date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{row.referenceNumber || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.description}</td>
                    {isPartyLedger && (
                      <td className="px-4 py-3 text-sm text-gray-700">{row.account?.code ? `${row.account.code} · ${row.account.name}` : '-'}</td>
                    )}
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{row.paymentMethod || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{row.transactionId || '-'}</td>
                    <td className="px-4 py-3 text-sm text-green-700">{row.debit ? formatCurrency(row.debit) : '-'}</td>
                    <td className="px-4 py-3 text-sm text-red-700">{row.credit ? formatCurrency(row.credit) : '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(row.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="text-sm font-bold text-gray-900 mb-3">Trial Balance</div>
          <div className="overflow-x-auto">
            <table className="w-full responsive-table">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Account','Debit','Credit'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className="py-10 text-center text-sm text-gray-400">Loading trial balance…</td></tr>
                ) : trialBalance.length === 0 ? (
                  <tr><td colSpan={3} className="py-10 text-center text-sm text-gray-400">No trial balance data available</td></tr>
                ) : trialBalance.map(row => (
                  <tr key={row.account._id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-sm text-gray-700">{row.account.code} · {row.account.name}</td>
                    <td className="px-4 py-3 text-sm text-green-700">{formatCurrency(row.debit)}</td>
                    <td className="px-4 py-3 text-sm text-red-700">{formatCurrency(row.credit)}</td>
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
