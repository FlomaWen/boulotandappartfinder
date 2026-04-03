import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';

const router = Router();

// GET /api/apartments — list all non-deleted apartments
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const { city, minPrice, maxPrice, type, bedrooms, bathrooms, status } = _req.query;

  let query = 'SELECT * FROM apartments WHERE status != ?';
  const params: unknown[] = ['supprime'];

  if (city) {
    query += ' AND city LIKE ?';
    params.push(`%${city}%`);
  }
  if (minPrice) {
    query += ' AND price >= ?';
    params.push(Number(minPrice));
  }
  if (maxPrice) {
    query += ' AND price <= ?';
    params.push(Number(maxPrice));
  }
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  if (bedrooms) {
    query += ' AND bedrooms = ?';
    params.push(Number(bedrooms));
  }
  if (bathrooms) {
    query += ' AND bathrooms = ?';
    params.push(Number(bathrooms));
  }
  if (status) {
    query = query.replace('status != ?', 'status = ?');
    params[0] = status;
  }

  query += ' ORDER BY created_at DESC';

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

// GET /api/apartments/:id
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM apartments WHERE id = ?').get(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(row);
});

// PATCH /api/apartments/:id/status — update status
router.patch('/:id/status', (req: Request, res: Response) => {
  const db = getDb();
  const { status } = req.body;
  const validStatuses = ['nouveau', 'contacte', 'visite', 'supprime'];

  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const result = db.prepare(
    "UPDATE apartments SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(status, req.params.id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.json({ id: Number(req.params.id), status });
});

// PATCH /api/apartments/:id/favorite — toggle favorite
router.patch('/:id/favorite', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT favorite FROM apartments WHERE id = ?').get(req.params.id) as { favorite: number } | undefined;
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const newFav = row.favorite ? 0 : 1;
  db.prepare("UPDATE apartments SET favorite = ?, updated_at = datetime('now') WHERE id = ?").run(newFav, req.params.id);
  res.json({ id: Number(req.params.id), favorite: newFav });
});

// DELETE /api/apartments/:id
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM apartments WHERE id = ?').run(req.params.id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.json({ deleted: true });
});

export default router;
