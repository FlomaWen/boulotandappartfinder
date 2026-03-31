import express from 'express';
import cors from 'cors';
import apartmentsRouter from './routes/apartments';
import jobsRouter from './routes/jobs';
import scrapeRouter from './routes/scrape';

const app = express();

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

export { app };
