import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { API_BASE_URL } from './config';

const money = n => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0
}).format(Number(n || 0));
const today = () => new Date().toISOString().slice(0, 10);
const toThousandsInput = amount => {
  const value = Number(amount || 0) / 1000;
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.0+$/, '');
};
const parseThousandVnd = value => {
  const normalized = String(value || '').replace(',', '.').trim();
  const num = Number(normalized);
  return Number.isFinite(num) ? Math.round(num * 1000) : 0;
};
const palette = ['#c99b61', '#87a47a', '#d59a8b', '#8da8bd', '#b9a275', '#b18bb0', '#8fb7a6', '#d7b46a'];
const PASSWORD_KEY = 'expense_notes_app_password';
const shortMonth = value => new Date(`${value}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short' });
const dayMonth = date => new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
const monthLabel = value => new Date(`${value}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short' });

function Section({ id, title, note, open, onToggle, children, actions }) {
  return <section className="panel section-card">
    <div className="section-title">
      <button className="section-toggle" type="button" onClick={() => onToggle(id)} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}>
        <span><h2>{title}</h2>{note && <small>{note}</small>}</span>
        <b aria-hidden="true">{open ? '−' : '+'}</b>
      </button>
      {actions && <div className="section-actions">{actions}</div>}
    </div>
    {open && <div className="section-body">{children}</div>}
  </section>;
}

function App() {
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ totals: { income: 0, expense: 0 }, byCategory: [] });
  const [showForm, setShowForm] = useState(false);
  const [grouped, setGrouped] = useState(false);
  const [editing, setEditing] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');
  const [appPassword, setAppPassword] = useState(() => localStorage.getItem(PASSWORD_KEY) || '');
  const [loginPassword, setLoginPassword] = useState(() => localStorage.getItem(PASSWORD_KEY) || '');
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activityRange, setActivityRange] = useState('week');
  const [openSections, setOpenSections] = useState({ dashboard: true, pie: true, spending: true, activity: true, recent: true, categories: true });
  const [form, setForm] = useState({ type: 'expense', amount: '', category_id: '', note: '', occurred_at: today() });

  const toggleSection = id => setOpenSections(s => ({ ...s, [id]: !s[id] }));


  async function api(path, options = {}, passwordOverride) {
    const password = passwordOverride ?? appPassword;
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...(password ? { 'X-App-Password': password } : {}),
        ...(options.headers || {})
      }
    });

    if (!res.ok) {
      let message = 'Something went wrong';
      try { message = (await res.json()).error || message; } catch {}
      if (res.status === 401) {
        localStorage.removeItem(PASSWORD_KEY);
        setAuthenticated(false);
        setAppPassword('');
      }
      throw new Error(message);
    }

    return res.json();
  }

  async function load() {
    const [c, t, s] = await Promise.all([api('/api/categories'), api('/api/transactions'), api('/api/summary')]);
    setCategories(c); setTransactions(t); setSummary(s);
    if (!form.category_id && c[0]) setForm(f => ({ ...f, category_id: String(c[0].id) }));
  }

  useEffect(() => {
    if (!appPassword) {
      setCheckingAuth(false);
      return;
    }
    api('/api/auth/check')
      .then(() => setAuthenticated(true))
      .catch(err => setError(err.message))
      .finally(() => setCheckingAuth(false));
  }, []);

  useEffect(() => {
    if (authenticated) load().catch(err => setError(err.message));
  }, [authenticated]);

  async function login(e) {
    e.preventDefault();
    setError('');
    const password = loginPassword.trim();
    if (!password) return setError('Enter the app password.');
    await api('/api/auth/check', { method: 'POST' }, password);
    localStorage.setItem(PASSWORD_KEY, password);
    setAppPassword(password);
    setAuthenticated(true);
  }

  function logout() {
    localStorage.removeItem(PASSWORD_KEY);
    setAppPassword('');
    setLoginPassword('');
    setAuthenticated(false);
    setCategories([]);
    setTransactions([]);
    setSummary({ totals: { income: 0, expense: 0 }, byCategory: [] });
  }

  const balance = Number(summary.totals.income) - Number(summary.totals.expense);
  const maxCategorySpend = Math.max(...summary.byCategory.map(c => Number(c.expense || 0)), 1);
  const groupedEntries = useMemo(() => {
    const map = transactions.reduce((acc, t) => {
      const key = t.category_name || 'Uncategorized';
      if (!acc[key]) acc[key] = { name: key, items: [], income: 0, expense: 0 };
      acc[key].items.push(t);
      acc[key][t.type] += Number(t.amount || 0);
      return acc;
    }, {});
    return Object.values(map).sort((a, b) => (b.expense + b.income) - (a.expense + a.income));
  }, [transactions]);

  const pieData = useMemo(() => summary.byCategory.filter(c => Number(c.expense) > 0).map((c, index) => ({
    ...c,
    amount: Number(c.expense),
    color: palette[index % palette.length]
  })), [summary.byCategory]);
  const pieTotal = pieData.reduce((sum, c) => sum + c.amount, 0);
  const pieGradient = pieData.length ? pieData.reduce((acc, item) => {
    const start = acc.cursor;
    const end = start + (item.amount / pieTotal) * 100;
    acc.parts.push(`${item.color} ${start}% ${end}%`);
    acc.cursor = end;
    return acc;
  }, { cursor: 0, parts: [] }).parts.join(', ') : '#ddd 0% 100%';

  const activityData = useMemo(() => {
    if (activityRange === 'month6') {
      const now = new Date();
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return { key, label: monthLabel(key), income: 0, expense: 0 };
      });
      const map = Object.fromEntries(months.map(m => [m.key, m]));
      transactions.forEach(t => {
        const key = t.occurred_at.slice(0, 7);
        if (map[key]) map[key][t.type] += Number(t.amount);
      });
      return months;
    }
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      return { key, label: dayMonth(key), income: 0, expense: 0 };
    });
    const map = Object.fromEntries(days.map(d => [d.key, d]));
    transactions.forEach(t => {
      if (map[t.occurred_at]) map[t.occurred_at][t.type] += Number(t.amount);
    });
    return days;
  }, [transactions, activityRange]);
  const maxActivity = Math.max(...activityData.map(d => Math.max(d.income, d.expense)), 1);
  const activityYear = new Date().getFullYear();
  const amountPreview = parseThousandVnd(form.amount);

  function openAdd() {
    setEditing(null);
    setError('');
    setForm({ type: 'expense', amount: '', category_id: String(categories[0]?.id || ''), note: '', occurred_at: today() });
    setShowForm(true);
  }

  function openEdit(t) {
    setEditing(t);
    setError('');
    setForm({ type: t.type, amount: toThousandsInput(t.amount), category_id: String(t.category_id), note: t.note || '', occurred_at: t.occurred_at });
    setShowForm(true);
  }

  async function saveTransaction(e) {
    e.preventDefault();
    const amount = parseThousandVnd(form.amount);
    if (!amount || amount <= 0) return setError('Enter an amount such as 24 for 24,000 VND or 24.5 for 24,500 VND.');
    const payload = JSON.stringify({ ...form, amount, category_id: Number(form.category_id) });
    await api(editing ? `/api/transactions/${editing.id}` : '/api/transactions', { method: editing ? 'PUT' : 'POST', body: payload });
    setShowForm(false); await load();
  }

  async function removeTransaction(id) {
    if (confirm('Delete this transaction?')) {
      await api(`/api/transactions/${id}`, { method: 'DELETE' });
      await load();
    }
  }

  async function addCategory(e) {
    e.preventDefault();
    if (!newCategory.trim()) return;
    await api('/api/categories', { method: 'POST', body: JSON.stringify({ name: newCategory, color: '#111111' }) });
    setNewCategory(''); await load();
  }

  async function removeCategory(id, count) {
    if (count > 0) return alert('Move or delete transactions in this category first.');
    if (confirm('Delete this category?')) {
      await api(`/api/categories/${id}`, { method: 'DELETE' });
      await load();
    }
  }

  const Transaction = ({ t }) => <div className={`tx ${t.type}-tx`}>
    <div className="tx-main"><b>{t.note || 'Untitled'}</b><small>{dayMonth(t.occurred_at)} · {t.category_name}</small></div>
    <strong className={`money ${t.type}`}>{t.type === 'expense' ? '-' : '+'}{money(t.amount)}</strong>
    <div className="tx-actions"><button onClick={() => openEdit(t)}>Edit</button><button onClick={() => removeTransaction(t.id)}>Delete</button></div>
  </div>;

  if (checkingAuth) {
    return <main className="auth-page"><section className="panel auth-card"><h1>Expense Notes</h1><p>Checking app password...</p></section></main>;
  }

  if (!authenticated) {
    return <main className="auth-page">
      <form className="panel auth-card" onSubmit={login}>
        <p>Private app</p>
        <h1>Expense Notes</h1>
        <label>App password<input type="password" autoFocus value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="Enter shared password" /></label>
        {error && <div className="alert">{error}</div>}
        <button className="primary save-button" type="submit"><span className="add-icon" aria-hidden="true">→</span><span>Unlock app</span></button>
      </form>
    </main>;
  }

  return <main>
    <header className="hero">
      <div><p>Personal Expense Lite</p><h1>Expense Notes</h1><span>Sticky notes for quick expense tracking.</span></div>
      <div className="hero-actions"><button className="primary hero-add" onClick={openAdd}><span className="add-icon" aria-hidden="true">+</span><span>Add transaction</span></button><button className="logout-button" onClick={logout}>Lock</button></div>
    </header>

    {error && <div className="alert">{error}</div>}

    <Section id="dashboard" title="Dashboard" note="Balance, income, expenses" open={openSections.dashboard} onToggle={toggleSection}>
      <div className="dashboard">
        <div className="card balance-card"><small>Balance</small><strong className="money">{money(balance)}</strong></div>
        <div className="card income-card"><small>Income</small><strong className="money">{money(summary.totals.income)}</strong></div>
        <div className="card expense-card"><small>Expenses</small><strong className="money">{money(summary.totals.expense)}</strong></div>
      </div>
    </Section>

    <Section id="pie" title="Expense pie" note="Category share" open={openSections.pie} onToggle={toggleSection}>
      <div className="pie-wrap">
        <div className="pie" style={{ background: `conic-gradient(${pieGradient})` }}><span>{pieTotal ? 'Expense' : 'No data'}</span></div>
        <div className="pie-list">
          {pieData.map(c => <div className="pie-item" key={c.id}><i style={{ background: c.color }} /> <b>{c.name}</b><small>{money(c.amount)}</small></div>)}
          {!pieData.length && <small>No expense transactions yet.</small>}
        </div>
      </div>
    </Section>

    <Section id="spending" title="Spending by category" note="Expense only" open={openSections.spending} onToggle={toggleSection}>
      <div className="bars">
        {summary.byCategory.filter(c => Number(c.expense) > 0).map((c, index) => <div className="barrow" key={c.id}>
          <div className="barlabel"><b>{c.name}</b><small>{money(c.expense)}</small></div>
          <div className="bartrack"><i style={{ width: `${Math.max((Number(c.expense) / maxCategorySpend) * 100, 4)}%`, background: palette[index % palette.length] }} /></div>
        </div>)}
      </div>
    </Section>

    <Section id="activity" title="Activity track" note={activityRange === 'week' ? 'Last 7 days' : 'Last 6 months'} open={openSections.activity} onToggle={toggleSection} actions={<div className="range-control"><span>Day</span><button className={`range-switch ${activityRange === 'month6' ? 'is-month' : ''}`} type="button" aria-label={activityRange === 'week' ? 'Switch to monthly view' : 'Switch to daily view'} title={activityRange === 'week' ? 'Switch to monthly view' : 'Switch to daily view'} onClick={()=>setActivityRange(activityRange === 'week' ? 'month6' : 'week')}><i /></button><span>Month</span></div>}>
      <div className="activity-chart-wrap">
        {activityRange === 'month6' && <div className="activity-year-watermark" aria-hidden="true">{activityYear}</div>}
        <div className="daychart">
          {activityData.map(d => <div className="day" key={d.key}>
            <div className="cols">
              <i className="income" style={{ height: `${Math.max((d.income / maxActivity) * 100, d.income ? 6 : 0)}%` }} title={`Income ${money(d.income)}`} />
              <i className="expense" style={{ height: `${Math.max((d.expense / maxActivity) * 100, d.expense ? 6 : 0)}%` }} title={`Expense ${money(d.expense)}`} />
            </div>
            <small>{d.label}</small>
          </div>)}
        </div>
      </div>
      <div className="legend"><span className="line income-line"></span> Income <span className="line expense-line"></span> Expense</div>
    </Section>

    <Section id="recent" title="Recent transactions" note={grouped ? 'Grouped by category' : 'Latest entries'} open={openSections.recent} onToggle={toggleSection} actions={<div className="group-control"><span>Group</span><button className={`group-switch ${grouped ? 'is-on' : ''}`} type="button" aria-pressed={grouped} aria-label={grouped ? 'Show flat transactions' : 'Group transactions by category'} title={grouped ? 'Show flat transactions' : 'Group transactions by category'} onClick={()=>setGrouped(!grouped)}><i /></button></div>}>
      {grouped ? <div className="grouped-list">{groupedEntries.map(group => <details className="tx-group" open key={group.name}>
        <summary>
          <span><b>{group.name}</b><small>{group.items.length} transaction{group.items.length === 1 ? '' : 's'}</small></span>
          <em>
            {group.income > 0 && <strong className="money income">+{money(group.income)}</strong>}
            {group.expense > 0 && <strong className="money expense">-{money(group.expense)}</strong>}
          </em>
        </summary>
        <div className="group-items">{group.items.map(t=><Transaction key={t.id} t={t}/>)}</div>
      </details>)}</div> : transactions.map(t=><Transaction key={t.id} t={t}/>) }
    </Section>

    <Section id="categories" title="Categories" note="Create or delete" open={openSections.categories} onToggle={toggleSection}>
      <form className="inline" onSubmit={addCategory}><input placeholder="New category" value={newCategory} onChange={e=>setNewCategory(e.target.value)} /><button>Add</button></form>
      {categories.map(c => <div className="category" key={c.id}><span>{c.name}</span><small>{c.transaction_count} item(s)</small><button onClick={()=>removeCategory(c.id,c.transaction_count)}>Delete</button></div>)}
    </Section>

    {showForm && <div className="modal"><form className="form" onSubmit={saveTransaction}><button type="button" className="x" onClick={()=>setShowForm(false)}>×</button><h2>{editing ? 'Edit transaction' : 'New transaction'}</h2><label>Type<select className={form.type === 'income' ? 'income-select' : 'expense-select'} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="expense">Expense</option><option value="income">Income</option></select></label><label>Amount in thousands<input inputMode="decimal" type="text" placeholder="24 = 24,000 VND" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/><small>{amountPreview > 0 ? `Will save as ${money(amountPreview)}` : 'Examples: 24 = 24,000 VND · 24.5 = 24,500 VND'}</small></label><label>Category<select value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Date<input type="date" value={form.occurred_at} onChange={e=>setForm({...form,occurred_at:e.target.value})}/></label><label>Note<input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Coffee, salary, rent..."/></label><button className="primary save-button"><span className="add-icon" aria-hidden="true">✓</span><span>Save transaction</span></button></form></div>}
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
