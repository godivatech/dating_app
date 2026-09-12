import React, { useEffect, useState, useMemo } from 'react';
import {
  CreditCard,
  ShoppingBag,
  Search,
  Download,
  TrendingUp,
  Users,
  Sparkles,
  Target,
  RefreshCw,
  Layers,
  AlertCircle,
  Coins,
} from 'lucide-react';
import {
  api,
  PurchaseTransactionItem,
  RevenueOverview,
} from '../services/api';

export const RevenueView: React.FC = () => {
  const [overview, setOverview] = useState<RevenueOverview | null>(null);
  const [transactions, setTransactions] = useState<PurchaseTransactionItem[]>([]);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);

  const fetchFinancialData = () => {
    setIsLoadingOverview(true);
    setIsLoadingTransactions(true);

    api.getRevenueOverview()
      .then((data) => {
        setOverview(data);
      })
      .catch((err) => {
        console.error('Failed to fetch revenue overview:', err);
      })
      .finally(() => {
        setIsLoadingOverview(false);
      });

    api.getTransactions()
      .then((data) => {
        setTransactions(data || []);
      })
      .catch((err) => {
        console.error('Failed to fetch transactions:', err);
      })
      .finally(() => {
        setIsLoadingTransactions(false);
      });
  };

  useEffect(() => {
    fetchFinancialData();
  }, []);

  // Compute distinct products from both API products catalog and actual transaction history
  const productFilterOptions = useMemo(() => {
    const optionsMap = new Map<string, string>();

    // Add products known to store catalog
    if (overview?.availableProducts) {
      overview.availableProducts.forEach((p) => {
        optionsMap.set(p.storeProductId, `${p.displayName} (₹${p.priceInr})`);
      });
    }

    // Add any unique product ID that appears in transaction ledger
    transactions.forEach((tx) => {
      if (tx.productId && !optionsMap.has(tx.productId)) {
        optionsMap.set(tx.productId, tx.productId);
      }
    });

    return Array.from(optionsMap.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [overview, transactions]);

  // Filtering transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (productFilter && tx.productId !== productFilter) return false;
      if (platformFilter && tx.platform !== platformFilter) return false;
      if (statusFilter && tx.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchName = tx.userName?.toLowerCase().includes(q);
        const matchPhone = tx.userPhone?.toLowerCase().includes(q);
        const matchId = tx.id.toLowerCase().includes(q);
        const matchProduct = tx.productId?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchId && !matchProduct) return false;
      }
      return true;
    });
  }, [transactions, productFilter, platformFilter, statusFilter, search]);

  // Safe Export to CSV with full RFC 4180 escaping
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;
    const headers = [
      'Transaction ID',
      'Customer Name',
      'Phone Number',
      'Product ID',
      'Amount (INR)',
      'Currency',
      'Platform',
      'Provider',
      'Status',
      'Created At',
    ];

    const rows = filteredTransactions.map((tx) => [
      `"${tx.id.replace(/"/g, '""')}"`,
      `"${(tx.userName || 'Anonymous').replace(/"/g, '""')}"`,
      `"${(tx.userPhone || 'N/A').replace(/"/g, '""')}"`,
      `"${(tx.productId || 'N/A').replace(/"/g, '""')}"`,
      (tx.amount / 100).toFixed(2),
      `"${tx.currency || 'INR'}"`,
      `"${(tx.platform || 'UNKNOWN').replace(/"/g, '""')}"`,
      `"${(tx.provider || 'UNKNOWN').replace(/"/g, '""')}"`,
      `"${tx.status || 'UNKNOWN'}"`,
      `"${tx.createdAt ? new Date(tx.createdAt).toISOString() : ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `truelove_revenue_ledger_${new Date().toISOString().split('T')[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format INR currency safely
  const formatInr = (amount?: number) => {
    if (amount === undefined || isNaN(amount)) return '₹0.00';
    return `₹${amount.toLocaleString('en-IN', {
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="animate-fade-in flex flex-col gap-5 sm:gap-6">
      {/* Monetization Executive Summary & KPI Metrics (2 boxes per row on mobile, 4 on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 lg:gap-4">
        {/* Card 1: Gross Realized Revenue */}
        <div className="glass-card p-3 sm:p-4 lg:p-5 relative overflow-hidden flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-2.5 min-w-0">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
                Realized Revenue
              </span>
              <div className="p-1 sm:p-1.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100 flex-shrink-0">
                <CreditCard size={15} />
              </div>
            </div>
            <div className="text-xl sm:text-2xl lg:text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight mb-1 sm:mb-2 truncate">
              {isLoadingOverview ? '...' : formatInr(overview?.realizedRevenueInr)}
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10.5px] sm:text-xs text-slate-500 truncate">
            <span className="font-semibold text-emerald-600 truncate">
              {overview?.completedTransactionsCount || 0} checkouts
            </span>
          </div>
        </div>

        {/* Card 2: Monthly Recurring Run-Rate (MRR) */}
        <div className="glass-card p-3 sm:p-4 lg:p-5 relative overflow-hidden flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-2.5 min-w-0">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
                Monthly Run-Rate
              </span>
              <div className="p-1 sm:p-1.5 rounded-md bg-rose-50 text-rose-600 border border-rose-100 flex-shrink-0">
                <TrendingUp size={15} />
              </div>
            </div>
            <div className="text-xl sm:text-2xl lg:text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight mb-1 sm:mb-2 truncate">
              {isLoadingOverview ? '...' : formatInr(overview?.monthlyRunRateInr)}
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10.5px] sm:text-xs text-slate-500 truncate">
            <span className="font-semibold text-rose-600 truncate">
              {overview?.activeSubscribersCount || 0} active subs
            </span>
          </div>
        </div>

        {/* Card 3: Active Paid Subscribers */}
        <div className="glass-card p-3 sm:p-4 lg:p-5 relative overflow-hidden flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-2.5 min-w-0">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
                Paid Members
              </span>
              <div className="p-1 sm:p-1.5 rounded-md bg-pink-50 text-pink-600 border border-pink-100 flex-shrink-0">
                <Users size={15} />
              </div>
            </div>
            <div className="text-xl sm:text-2xl lg:text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight mb-1 sm:mb-2 truncate">
              {isLoadingOverview ? '...' : `${overview?.activeSubscribersCount || 0}`}
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10.5px] sm:text-xs text-slate-500 truncate">
            <span>Verified in DB</span>
          </div>
        </div>

        {/* Card 4: Average Order Value (AOV) */}
        <div className="glass-card p-3 sm:p-4 lg:p-5 relative overflow-hidden flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-2.5 min-w-0">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
                Avg Order (AOV)
              </span>
              <div className="p-1 sm:p-1.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100 flex-shrink-0">
                <Sparkles size={15} />
              </div>
            </div>
            <div className="text-xl sm:text-2xl lg:text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight mb-1 sm:mb-2 truncate">
              {isLoadingOverview ? '...' : formatInr(overview?.averageOrderValueInr)}
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10.5px] sm:text-xs text-slate-500 truncate">
            <span>Per checkout</span>
          </div>
        </div>
      </div>

      {/* Truelove Coin Economy Pulse Widget */}
      {overview?.coinMetrics && (
        <div className="glass-card p-3.5 sm:p-4 bg-gradient-to-r from-amber-500/5 via-rose-500/5 to-purple-500/5 border border-amber-200/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-amber-100 text-amber-700">
                <Coins size={16} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                  Prepaid Coin Economy &amp; Micro-Monetization Pulse
                </h4>
                <p className="text-[11px] text-slate-500">
                  Real-time float, burn velocity, and realized revenue from 1-tap UPI recharges
                </p>
              </div>
            </div>
            <span className="badge badge-active text-[10px] sm:text-xs px-2 py-0.5 self-start sm:self-auto">
              Live Wallet Float
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <div className="p-2.5 rounded-lg bg-white/80 border border-slate-200">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Coin Recharges
              </div>
              <div className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                {overview.coinMetrics.totalCoinRechargesCount} packs
              </div>
              <div className="text-[10px] text-emerald-600 font-medium">100% UPI Realized</div>
            </div>

            <div className="p-2.5 rounded-lg bg-white/80 border border-slate-200">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Recharge Revenue
              </div>
              <div className="text-base sm:text-lg font-extrabold text-emerald-600 mt-0.5">
                {formatInr(overview.coinMetrics.totalCoinRevenueInr)}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">Gross Cash Collected</div>
            </div>

            <div className="p-2.5 rounded-lg bg-white/80 border border-slate-200">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Wallet Coin Float
              </div>
              <div className="text-base sm:text-lg font-extrabold text-amber-600 mt-0.5">
                🪙 {overview.coinMetrics.totalCoinsInCirculation.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">Held Across User Wallets</div>
            </div>

            <div className="p-2.5 rounded-lg bg-white/80 border border-slate-200">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Coins Spent (Burnt)
              </div>
              <div className="text-base sm:text-lg font-extrabold text-purple-600 mt-0.5">
                🔥 {overview.coinMetrics.totalCoinsSpent.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">Notes, Calls &amp; Boosts</div>
            </div>
          </div>
        </div>
      )}

      {/* Benchmark Unit Economics Callout */}
      <div className="glass-card p-3.5 sm:p-5 border-l-4 border-l-rose-600 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-rose-600 flex-shrink-0">
            <Target size={20} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm sm:text-base font-bold text-slate-900">
                Target Financial Model &amp; Unit Economics Benchmark
              </h4>
              <span className="badge badge-neutral text-[11px] px-2 py-0.5">
                At Scale Target
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
              Target Run-Rate: <strong>₹2,73,130/mo</strong> • Target Active Members: <strong>425</strong> • Projected Net Margin: <strong>~78.7%</strong> (~₹2.15L/mo net of R2, Neon PG, Daily.co, and SMS OTP).
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowBenchmarkModal(!showBenchmarkModal)}
          className="btn btn-glass btn-sm text-xs sm:text-sm whitespace-nowrap self-start md:self-auto"
        >
          <Layers size={14} />
          <span>{showBenchmarkModal ? 'Hide Target Details' : 'View Target Details'}</span>
        </button>
      </div>

      {/* Target Model Expansion Panel */}
      {showBenchmarkModal && overview?.benchmarkProjection && (
        <div className="glass-card animate-fade-in p-3.5 sm:p-5 bg-slate-50/60">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 lg:gap-4">
            <div className="p-2.5 sm:p-4 rounded-lg bg-white border border-slate-200 min-w-0">
              <div className="text-[10px] sm:text-xs text-slate-500 font-semibold truncate">Projected MRR</div>
              <div className="text-sm sm:text-base lg:text-lg font-bold text-slate-900 mt-0.5 sm:mt-1 truncate">
                ₹{overview.benchmarkProjection.projectedMonthlyRunRateInr.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-2.5 sm:p-4 rounded-lg bg-white border border-slate-200 min-w-0">
              <div className="text-[10px] sm:text-xs text-slate-500 font-semibold truncate">Subscribers</div>
              <div className="text-sm sm:text-base lg:text-lg font-bold text-slate-900 mt-0.5 sm:mt-1 truncate">
                {overview.benchmarkProjection.projectedSubscribers} Members
              </div>
            </div>
            <div className="p-2.5 sm:p-4 rounded-lg bg-white border border-slate-200 min-w-0">
              <div className="text-[10px] sm:text-xs text-slate-500 font-semibold truncate">Notes Volume</div>
              <div className="text-sm sm:text-base lg:text-lg font-bold text-slate-900 mt-0.5 sm:mt-1 truncate">
                ~{overview.benchmarkProjection.projectedNotesVolume.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-2.5 sm:p-4 rounded-lg bg-white border border-slate-200 min-w-0">
              <div className="text-[10px] sm:text-xs text-slate-500 font-semibold truncate">Net Profit</div>
              <div className="text-sm sm:text-base lg:text-lg font-bold text-emerald-600 mt-0.5 sm:mt-1 truncate">
                ~₹{overview.benchmarkProjection.projectedNetProfitInr.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Tier Cards (Dynamically populated from backend database) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">

        {isLoadingOverview ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card p-4 sm:p-5 min-h-[160px] opacity-60">
              <div className="h-4.5 w-1/2 bg-slate-200 rounded mb-3 animate-pulse" />
              <div className="h-3.5 w-4/5 bg-slate-200 rounded animate-pulse" />
            </div>
          ))
        ) : (
          overview?.tierBreakdown.map((stream) => (
            <div
              key={stream.id}
              className={`glass-card p-4 sm:p-5 flex flex-col justify-between ${
                stream.tier === 'COIN'
                  ? 'border-amber-300/80 bg-gradient-to-b from-amber-50/30 to-white'
                  : ''
              }`}
            >
              <div>
                <div className="flex flex-col gap-1.5 mb-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm sm:text-[15.5px] font-bold text-slate-900 leading-snug">
                      {stream.name}
                    </h4>
                    {stream.tier === 'COIN' && (
                      <span className="badge text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 flex-shrink-0">
                        🪙 Wallet
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="badge badge-neutral text-[11px] font-semibold px-2 py-0.5">
                      {stream.priceDisplay}
                    </span>
                  </div>
                </div>
                <p className="text-xs sm:text-[13px] text-slate-500 mb-4 leading-relaxed">
                  {stream.description}
                </p>
              </div>

              <div className="p-3 sm:p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col xs:flex-row xs:items-center justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-400 font-medium truncate">Live Units Active</div>
                  <div className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    {stream.activeUnits} {stream.tier === 'COIN' ? 'recharges' : stream.tier === 'PACK' ? 'sold' : 'subscribers'}
                  </div>
                </div>
                <div className="text-left xs:text-right min-w-0">
                  <div className="text-[11px] text-slate-400 font-medium truncate">Monthly Realized</div>
                  <div className={`text-base sm:text-[17px] font-bold truncate ${stream.monthlyRevenueInr > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {formatInr(stream.monthlyRevenueInr)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Live Transaction Ledger Card */}
      <div className="glass-card overflow-hidden">
        {/* Ledger Header & Search Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 sm:gap-4">
          <div className="flex items-center gap-2.5">
            <ShoppingBag size={18} className="text-slate-500" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Customer Purchase Ledger ({filteredTransactions.length})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-56 lg:w-64">
              <Search
                size={14}
                className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              />
              <input
                type="text"
                className="input-search text-xs sm:text-sm pl-8 py-2 w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ledger..."
              />
            </div>

            {/* Dynamic Product Filter from Live Store Catalog */}
            <select
              className="select-filter text-xs sm:text-sm flex-1 sm:flex-initial max-w-full sm:max-w-[170px]"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              title="Filter by store product"
            >
              <option value="">All Products</option>
              {productFilterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Platform Filter */}
            <select
              className="select-filter text-xs sm:text-sm flex-1 sm:flex-initial"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
            >
              <option value="">All Platforms</option>
              <option value="ANDROID">Android</option>
              <option value="IOS">iOS</option>
              <option value="WEB">Web</option>
            </select>

            {/* Status Filter */}
            <select
              className="select-filter text-xs sm:text-sm flex-1 sm:flex-initial"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>

            {/* Refresh Ledger */}
            <button
              onClick={fetchFinancialData}
              className="btn btn-glass p-2 text-xs sm:text-sm"
              title="Refresh ledger data"
              disabled={isLoadingTransactions}
            >
              <RefreshCw size={13} className={isLoadingTransactions ? 'animate-spin' : ''} />
            </button>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              disabled={filteredTransactions.length === 0}
              className="btn btn-glass btn-sm text-xs sm:text-sm flex-1 sm:flex-initial whitespace-nowrap"
              title={filteredTransactions.length === 0 ? 'No transactions to export' : 'Export ledger as CSV file'}
              style={{ opacity: filteredTransactions.length === 0 ? 0.5 : 1 }}
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse text-left min-w-[720px]">
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface)',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-tertiary)',
                }}
              >
                <th className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap">Transaction ID</th>
                <th className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap">Customer</th>
                <th className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap">Product</th>
                <th className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap">Amount</th>
                <th className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap">Platform &amp; Provider</th>
                <th className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap text-right">Status</th>
              </tr>
            </thead>

            <tbody>
              {isLoadingTransactions ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', fontSize: '14px', color: 'var(--text-tertiary)' }}>
                    Loading financial ledger...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)' }}>
                      <AlertCircle size={28} />
                      <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>No transactions found</div>
                      <div style={{ fontSize: '13px' }}>No payments matched the specified filter criteria.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    <td className="px-4 py-3 sm:px-5 sm:py-3.5 font-mono text-xs sm:text-[13px] text-slate-500 max-w-[120px] sm:max-w-[160px] truncate" title={tx.id}>
                      {tx.id}
                    </td>
                    <td className="px-4 py-3 sm:px-5 sm:py-3.5">
                      <div className="text-xs sm:text-sm font-semibold text-slate-900">{tx.userName || 'Anonymous Member'}</div>
                      <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">{tx.userPhone || 'No Phone'}</div>
                    </td>
                    <td className="px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-[13px] text-slate-600">
                      <div className="font-semibold text-slate-900 text-xs sm:text-[13px]">
                        {overview?.availableProducts?.find((p) => p.storeProductId === tx.productId || p.productKey === tx.productId)?.displayName ||
                          (tx.productId.includes('coins.100') ? '🪙 100 Coins Starter Pack' :
                          tx.productId.includes('coins.250') ? '🪙 250 Coins Popular Pack' :
                          tx.productId.includes('coins.700') ? '🪙 700 Coins Best Value' :
                          tx.productId.includes('gold') ? 'Truelove Gold (1 Month)' :
                          tx.productId.includes('plus') ? 'Truelove Plus (1 Month)' :
                          tx.productId.includes('notes.5') ? '5 Direct Notes Pack' :
                          tx.productId.includes('notes.15') ? '15 Direct Notes Pack' :
                          tx.productId.includes('notes.30') ? '30 Direct Notes Pack' :
                          tx.productId)}
                      </div>
                      <div className="font-mono text-[10.5px] text-slate-400 mt-0.5">
                        {tx.productId}
                      </div>
                    </td>
                    <td className="px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-sm font-bold text-slate-900">
                      ₹{(tx.amount / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-[13px] text-slate-600 whitespace-nowrap">
                      {tx.platform} ({tx.provider})
                    </td>
                    <td className="px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-[13px] text-slate-500 whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 sm:px-5 sm:py-3.5 text-right whitespace-nowrap">
                      <span
                        className={`badge text-xs ${
                          tx.status === 'COMPLETED'
                            ? 'badge-active'
                            : tx.status === 'FAILED'
                            ? 'badge-danger'
                            : 'badge-warning'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
