import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';

const router = Router();

interface AutoSearch {
  id: number;
  type: 'apartments' | 'jobs';
  name: string;
  filters: string;
  active: number;
  created_at: string;
}

// GET all auto searches
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM auto_searches ORDER BY created_at DESC').all() as AutoSearch[];
  const results = rows.map((r) => ({ ...r, filters: JSON.parse(r.filters) }));
  res.json(results);
});

// POST create a new auto search
router.post('/', (req: Request, res: Response) => {
  const { type, name, filters } = req.body;

  if (!type || !name || !filters) {
    res.status(400).json({ error: 'type, name, and filters are required' });
    return;
  }

  if (type !== 'apartments' && type !== 'jobs') {
    res.status(400).json({ error: 'type must be "apartments" or "jobs"' });
    return;
  }

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO auto_searches (type, name, filters) VALUES (?, ?, ?)'
  ).run(type, name, JSON.stringify(filters));

  res.json({ id: result.lastInsertRowid, type, name, filters, active: 1 });
});

// PATCH toggle active status
router.patch('/:id/toggle', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const row = db.prepare('SELECT active FROM auto_searches WHERE id = ?').get(id) as { active: number } | undefined;

  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const newActive = row.active ? 0 : 1;
  db.prepare('UPDATE auto_searches SET active = ? WHERE id = ?').run(newActive, id);
  res.json({ id: Number(id), active: newActive });
});

// DELETE an auto search
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const result = db.prepare('DELETE FROM auto_searches WHERE id = ?').run(id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.json({ deleted: true });
});

export default router;
