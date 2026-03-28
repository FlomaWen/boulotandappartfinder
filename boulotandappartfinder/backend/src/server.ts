import express from 'express';
import cors from 'cors';
import apartmentsRouter from './routes/apartments';
import jobsRouter from './routes/jobs';
import scrapeRouter from './routes/scrape';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

// Routes
app.use('/api/apartments', apartmentsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/scrape', scrapeRouter);

// Health check
app.get('/api/health', (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  GET    /api/apartments');
  console.log('  GET    /api/apartments/:id');
  console.log('  PATCH  /api/apartments/:id/status');
  console.log('  DELETE /api/apartments/:id');
  console.log('  GET    /api/jobs');
  console.log('  GET    /api/jobs/:id');
  console.log('  PATCH  /api/jobs/:id/status');
  console.log('  DELETE /api/jobs/:id');
  console.log('  POST   /api/scrape/apartments  { city, maxPrice? }');
  console.log('  POST   /api/scrape/jobs         { keyword, city }');
});
