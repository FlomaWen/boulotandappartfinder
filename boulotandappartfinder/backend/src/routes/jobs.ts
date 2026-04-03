import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';

const router = Router();

// GET /api/jobs — list all non-deleted jobs
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const { keyword, city, sector, minSalary, remote, experience, status } = _req.query;

  let query = 'SELECT * FROM jobs WHERE status != ?';
  const params: unknown[] = ['supprime'];

  if (keyword) {
    query += ' AND (title LIKE ? OR company LIKE ? OR description LIKE ? OR tags LIKE ?)';
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw, kw);
  }
  if (city) {
    query += ' AND city LIKE ?';
    params.push(`%${city}%`);
  }
  if (sector) {
    query += ' AND sector = ?';
    params.push(sector);
  }
  if (minSalary) {
    query += ' AND salary_min >= ?';
    params.push(Number(minSalary));
  }
  if (remote) {
    query += ' AND remote = ?';
    params.push(remote);
  }
  if (experience) {
    query += ' AND experience = ?';
    params.push(experience);
  }
  if (status) {
    query = query.replace('status != ?', 'status = ?');
    params[0] = status;
  }

  query += ' ORDER BY created_at DESC';

  const rows = db.prepare(query).all(...params);
  const parsed = (rows as Record<string, unknown>[]).map((row) => ({
    ...row,
    tags: JSON.parse((row.tags as string) || '[]'),
  }));
  res.json(parsed);
});

// GET /api/jobs/:id
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  row.tags = JSON.parse((row.tags as string) || '[]');
  res.json(row);
});

// PATCH /api/jobs/:id/status
router.patch('/:id/status', (req: Request, res: Response) => {
  const db = getDb();
  const { status } = req.body;
  const validStatuses = ['nouveau', 'postule', 'entretien', 'supprime'];

  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const result = db.prepare(
    "UPDATE jobs SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(status, req.params.id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.json({ id: Number(req.params.id), status });
});

// PATCH /api/jobs/:id/favorite — toggle favorite
router.patch('/:id/favorite', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT favorite FROM jobs WHERE id = ?').get(req.params.id) as { favorite: number } | undefined;
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const newFav = row.favorite ? 0 : 1;
  db.prepare("UPDATE jobs SET favorite = ?, updated_at = datetime('now') WHERE id = ?").run(newFav, req.params.id);
  res.json({ id: Number(req.params.id), favorite: newFav });
});

// DELETE /api/jobs/:id
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.json({ deleted: true });
});

export default router;
