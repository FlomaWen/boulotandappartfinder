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
