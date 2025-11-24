import { app } from './app.js';
import excelRoutes from './routes/excel.js';
import roleRoutes from './routes/roles.js';


// Health check route
app.get('/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Mount feature routes
app.use('/excel', excelRoutes);
app.use('/roles', roleRoutes);

// Start server
const port = process.env.PORT || 8000;
app.listen(port, () => console.log(`Server running on ${port}`));
