// Unified catch-all serverless function for API routes on Vercel.
// We mount the router at BOTH '/' and '/api' to cover path differences
// depending on how Vercel passes req.url for a wildcard function file.
// Adds a one-time per request log of req.url (visible in Vercel logs)
// to help diagnose any path mismatches.

function buildApp(){
  const a = express();
  a.use(express.json({ limit: '1mb' }));
  // Mount at /api so requests like /api/template resolve correctly
  a.use('/api', createApiRouter());
  return a;
}
  a.use((req,res,next)=>{ if(!req._logged){ console.log('[api fn] req.url:', req.url); req._logged=true; } next(); });
  const router = createApiRouter();
  a.use(router);        // e.g. if req.url comes through as '/template'
  a.use('/api', router); // e.g. if req.url comes through as '/api/template'
