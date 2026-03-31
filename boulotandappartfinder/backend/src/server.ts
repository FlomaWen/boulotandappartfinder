import { app } from './app';

const PORT = process.env.PORT || 3000;

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
