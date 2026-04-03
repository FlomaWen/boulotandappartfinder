import express from 'express';
import cors from 'cors';
import apartmentsRouter from './routes/apartments';
import jobsRouter from './routes/jobs';
import scrapeRouter from './routes/scrape';
import schedulerRouter from './routes/scheduler';
import autoSearchesRouter from './routes/auto-searches';

const app = express();

// Middleware
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:4200').split(',');
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Routes
app.use('/api/apartments', apartmentsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/scrape', scrapeRouter);
app.use('/api/scheduler', schedulerRouter);
app.use('/api/auto-searches', autoSearchesRouter);

// Health check
app.get('/api/health', (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export { app };
