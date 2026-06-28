import { Hono } from 'hono';

type Env = { DB: D1Database; ASSETS: Fetcher };
const app = new Hono<{ Bindings: Env }>();

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const bad = (message: string, status = 400) => json({ error: message }, status);

app.get('/api/health', c => c.json({ ok: true }));

app.get('/api/categories', async c => {
  const rows = await c.env.DB.prepare(`
    SELECT c.*, COUNT(t.id) transaction_count
    FROM categories c LEFT JOIN transactions t ON t.category_id = c.id
    GROUP BY c.id ORDER BY c.name
  `).all();
  return c.json(rows.results);
});

app.post('/api/categories', async c => {
  const body = await c.req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const color = String(body.color || '#fff4a8').trim();
  if (!name) return bad('Category name is required');
  try {
    const result = await c.env.DB.prepare('INSERT INTO categories (name,color) VALUES (?, ?)').bind(name, color).run();
    return c.json({ id: result.meta.last_row_id, name, color, transaction_count: 0 }, 201);
  } catch {
    return bad('Category already exists');
  }
});

app.delete('/api/categories/:id', async c => {
  const id = Number(c.req.param('id'));
  const count = await c.env.DB.prepare('SELECT COUNT(*) total FROM transactions WHERE category_id=?').bind(id).first('total') as number;
  if (count > 0) return bad('Cannot delete a category that still has transactions', 409);
  await c.env.DB.prepare('DELETE FROM categories WHERE id=?').bind(id).run();
  return c.json({ ok: true });
});

app.get('/api/transactions', async c => {
  const rows = await c.env.DB.prepare(`
    SELECT t.*, c.name category_name, c.color category_color
    FROM transactions t JOIN categories c ON c.id = t.category_id
    ORDER BY t.occurred_at DESC, t.id DESC
  `).all();
  return c.json(rows.results);
});

app.post('/api/transactions', async c => {
  const b = await c.req.json().catch(() => ({}));
  const categoryId = Number(b.category_id);
  const amount = Number(b.amount);
  const type = b.type === 'income' ? 'income' : 'expense';
  const note = String(b.note || '').trim();
  const occurredAt = String(b.occurred_at || new Date().toISOString().slice(0, 10));
  if (!categoryId || !amount || amount <= 0) return bad('Category and positive amount are required');
  const result = await c.env.DB.prepare(`INSERT INTO transactions (category_id,type,amount,note,occurred_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(categoryId, type, amount, note, occurredAt).run();
  return c.json({ id: result.meta.last_row_id }, 201);
});

app.put('/api/transactions/:id', async c => {
  const id = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  const categoryId = Number(b.category_id);
  const amount = Number(b.amount);
  const type = b.type === 'income' ? 'income' : 'expense';
  const note = String(b.note || '').trim();
  const occurredAt = String(b.occurred_at || new Date().toISOString().slice(0, 10));
  if (!categoryId || !amount || amount <= 0) return bad('Category and positive amount are required');
  await c.env.DB.prepare(`UPDATE transactions SET category_id=?, type=?, amount=?, note=?, occurred_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .bind(categoryId, type, amount, note, occurredAt, id).run();
  return c.json({ ok: true });
});

app.delete('/api/transactions/:id', async c => {
  await c.env.DB.prepare('DELETE FROM transactions WHERE id=?').bind(Number(c.req.param('id'))).run();
  return c.json({ ok: true });
});

app.get('/api/summary', async c => {
  const totals = await c.env.DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) income,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) expense
    FROM transactions
  `).first();
  const byCategory = await c.env.DB.prepare(`
    SELECT c.id, c.name, c.color,
      COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END),0) expense,
      COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END),0) income,
      COUNT(t.id) count
    FROM categories c LEFT JOIN transactions t ON t.category_id = c.id
    GROUP BY c.id ORDER BY expense DESC, income DESC
  `).all();
  return c.json({ totals, byCategory: byCategory.results });
});

app.all('*', c => c.env.ASSETS.fetch(c.req.raw));
export default app;
