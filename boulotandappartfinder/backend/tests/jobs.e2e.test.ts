import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('GET /api/jobs', () => {
  it('should return 200 and an array of jobs', async () => {
    const res = await request(app).get('/api/jobs');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('each job should have required fields', async () => {
    const res = await request(app).get('/api/jobs');

    expect(res.status).toBe(200);

    if (res.body.length > 0) {
      const job = res.body[0];
      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('title');
      expect(job).toHaveProperty('company');
      expect(job).toHaveProperty('city');
      expect(job).toHaveProperty('url');
      expect(job).toHaveProperty('source');
      expect(job).toHaveProperty('status');
      expect(job).toHaveProperty('tags');
      expect(Array.isArray(job.tags)).toBe(true);
    }
  });

  it('should not return jobs with status "supprime"', async () => {
    const res = await request(app).get('/api/jobs');

    expect(res.status).toBe(200);
    const deletedJobs = res.body.filter((j: { status: string }) => j.status === 'supprime');
    expect(deletedJobs.length).toBe(0);
  });
});

describe('GET /api/jobs/:id', () => {
  it('should return 404 for non-existing job', async () => {
    const res = await request(app).get('/api/jobs/999999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});

describe('PATCH /api/jobs/:id/status', () => {
  it('should return 400 for invalid status', async () => {
    const res = await request(app)
      .patch('/api/jobs/1/status')
      .send({ status: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid status');
  });

  it('should return 404 for non-existing job', async () => {
    const res = await request(app)
      .patch('/api/jobs/999999/status')
      .send({ status: 'postule' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});

describe('DELETE /api/jobs/:id', () => {
  it('should return 404 for non-existing job', async () => {
    const res = await request(app).delete('/api/jobs/999999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});

describe('POST /api/scrape/jobs', () => {
  it('should return 400 if keyword is missing', async () => {
    const res = await request(app)
      .post('/api/scrape/jobs')
      .send({ city: 'Paris' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('keyword and city are required');
  });

  it('should return 400 if city is missing', async () => {
    const res = await request(app)
      .post('/api/scrape/jobs')
      .send({ keyword: 'dev' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('keyword and city are required');
  });
});

describe('POST /api/scrape/apartments', () => {
  it('should return 400 if city is missing', async () => {
    const res = await request(app)
      .post('/api/scrape/apartments')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('city is required');
  });
});
