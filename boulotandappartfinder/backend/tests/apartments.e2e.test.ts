import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('GET /api/apartments', () => {
  it('should return 200 and an array', async () => {
    const res = await request(app).get('/api/apartments');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should not return apartments with status "supprime"', async () => {
    const res = await request(app).get('/api/apartments');

    expect(res.status).toBe(200);
    const deleted = res.body.filter((a: { status: string }) => a.status === 'supprime');
    expect(deleted.length).toBe(0);
  });
});

describe('GET /api/apartments/:id', () => {
  it('should return 404 for non-existing apartment', async () => {
    const res = await request(app).get('/api/apartments/999999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});

describe('PATCH /api/apartments/:id/status', () => {
  it('should return 400 for invalid status', async () => {
    const res = await request(app)
      .patch('/api/apartments/1/status')
      .send({ status: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid status');
  });

  it('should return 404 for non-existing apartment', async () => {
    const res = await request(app)
      .patch('/api/apartments/999999/status')
      .send({ status: 'contacte' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});

describe('DELETE /api/apartments/:id', () => {
  it('should return 404 for non-existing apartment', async () => {
    const res = await request(app).delete('/api/apartments/999999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});
