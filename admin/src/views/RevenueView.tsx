import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  ShoppingBag,
  Search,
  Download,
} from 'lucide-react';
import { api, PurchaseTransactionItem } from '../services/api';

export const RevenueView: React.FC = () => {
  const [transactions, setTransactions] = useState<PurchaseTransactionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    let isMounted = true;
    api.getTransactions()
      .then((data) => {
        if (isMounted) setTransactions(data);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const revenueStreams = [
    {
      name: 'Truelove Gold Tier',
      price: '₹499 / mo',
      description: 'See Who Liked You, 5 Direct Notes/wk, 1 Boost/wk, Incognito',
      subscribers: 240,
      monthlyTotal: '₹1,19,760',
    },
    {
      name: 'Truelove Plus Tier',
      price: '₹299 / mo',
      description: 'Unlimited Swipes, Rewind Pass, Passport location travel',
      subscribers: 185,
      monthlyTotal: '₹55,315',
    },
    {
      name: 'Direct Note Micro-Packs',
      price: '₹99 (5) • ₹199 (15) • ₹349 (30)',
      description: 'A-la-carte direct message invites sent with profile likes',
      subscribers: 680,
      monthlyTotal: '₹98,055',
    },
  ];

  // Filtering transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (productFilter && tx.productId !== productFilter) return false;
    if (platformFilter && tx.platform !== platformFilter) return false;
    if (statusFilter && tx.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchName = tx.userName?.toLowerCase().includes(q);
      const matchPhone = tx.userPhone?.toLowerCase().includes(q);
      const matchId = tx.id.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchId) return false;
    }
    return true;
  });

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;
    const headers = ['Transaction ID', 'Customer Name', 'Phone Number', 'Product ID', 'Amount (INR)', 'Platform', 'Provider', 'Status', 'Created At'];
    const rows = filteredTransactions.map((tx) => [
      `"${tx.id}"`,
      `"${tx.userName.replace(/"/g, '""')}"`,
      `"${tx.userPhone}"`,
      `"${tx.productId}"`,
      (tx.amount / 100).toFixed(2),
      `"${tx.platform}"`,
      `"${tx.provider}"`,
      `"${tx.status}"`,
      `"${new Date(tx.createdAt).toISOString()}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `truelove_transactions_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Monetization Executive Summary */}
      <div
        className="glass-card"
        style={{
          padding: '24px 28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '18px' }}>
          <div>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
              Run-rate &amp; Unit Economics
            </div>
            <h2 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              ₹2,73,130 <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-tertiary)' }}>/ month projected run-rate</span>
            </h2>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Net Profit Margin: ~78.7% (Net ~₹2,15,000/mo after Cloudflare R2, Neon PG, Daily.co, and SMS OTP costs)
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ padding: '12px 18px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)' }}>Monthly Volume</div>
              <div style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>~3,922 Notes</div>
            </div>
            <div style={{ padding: '12px 18px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)' }}>Active Subscribers</div>
              <div style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>425 Members</div>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Tier Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '18px' }}>
        {revenueStreams.map((stream, idx) => (
          <div
            key={idx}
            className="glass-card"
            style={{
              padding: '22px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '16.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {stream.name}
                </span>
                <span className="badge badge-neutral" style={{ fontSize: '12px', padding: '4px 9px' }}>
                  {stream.price}
                </span>
              </div>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: 1.45 }}>
                {stream.description}
              </p>
            </div>

            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Units Active</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{stream.subscribers}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Monthly Total</div>
                <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-success)' }}>{stream.monthlyTotal}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live Transaction Ledger Card */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {/* Ledger Header & Search Controls */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShoppingBag size={18} color="var(--text-secondary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Customer Purchase Ledger ({filteredTransactions.length})
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search
                size={14}
                color="var(--text-tertiary)"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                className="input-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ledger..."
                style={{ paddingLeft: '32px', fontSize: '12.5px' }}
              />
            </div>

            {/* Product Filter */}
            <select
              className="select-filter"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              style={{ fontSize: '12.5px' }}
            >
              <option value="">All Products</option>
              <option value="truelove_gold">Truelove Gold</option>
              <option value="truelove_plus">Truelove Plus</option>
              <option value="direct_notes_5">5 Direct Notes</option>
              <option value="direct_notes_15">15 Direct Notes</option>
              <option value="direct_notes_30">30 Direct Notes</option>
            </select>

            {/* Platform Filter */}
            <select
              className="select-filter"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              style={{ fontSize: '12.5px' }}
            >
              <option value="">All Platforms</option>
              <option value="ANDROID">Android</option>
              <option value="IOS">iOS</option>
              <option value="WEB">Web</option>
            </select>

            {/* Status Filter */}
            <select
              className="select-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ fontSize: '12.5px' }}
            >
              <option value="">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className="btn btn-glass btn-sm"
              title="Export ledger as CSV file"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface)',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-tertiary)',
                }}
              >
                <th style={{ padding: '14px 20px' }}>Transaction ID</th>
                <th style={{ padding: '14px 20px' }}>Customer</th>
                <th style={{ padding: '14px 20px' }}>Product</th>
                <th style={{ padding: '14px 20px' }}>Amount</th>
                <th style={{ padding: '14px 20px' }}>Platform</th>
                <th style={{ padding: '14px 20px' }}>Date</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', fontSize: '14px', color: 'var(--text-tertiary)' }}>
                    Loading financial ledger...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', fontSize: '14px', color: 'var(--text-tertiary)' }}>
                    No transactions matching filter criteria.
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
                    <td style={{ padding: '14px 20px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {tx.id}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)' }}>{tx.userName}</div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{tx.userPhone}</div>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <span className="badge badge-neutral" style={{ fontSize: '11.5px', padding: '3px 8px' }}>
                        {tx.productId}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      ₹{(tx.amount / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                      {tx.platform} ({tx.provider})
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '13.5px', color: 'var(--text-tertiary)' }}>
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <span
                        className={`badge ${
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
