import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import the route registrator from the compiled API.
// apps/api/dist/ produceras av `npm run build` (tsc -p apps/api/tsconfig.json).
let registerRoutes;
try {
  const routesMod = await import('./apps/api/dist/routes/index.js');
  registerRoutes = routesMod.registerRoutes;
  console.log('✅  Route module loaded successfully.');
} catch (importErr) {
  console.error('❌  CRITICAL: Could not import API routes:', importErr.message);
  console.error('    Möjliga orsaker:');
  console.error('      • apps/api/dist/ saknas — kör `npm run build` först.');
  console.error('      • DATABASE_URL saknas — db.ts kastar fel direkt vid import.');
  console.error('        För lokal smoketest räcker en placeholder: DATABASE_URL=postgres://noop');
  registerRoutes = async () => { console.warn('⚠️   Routes unavailable — only /health active.'); };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || '10000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const WEB_DIST = path.join(__dirname, 'apps/web/dist');
const LANDING_HTML = path.join(__dirname, 'landing.html');
const POLSIA_SLUG = process.env.POLSIA_ANALYTICS_SLUG || 'huntlog';

// ── Build diagnostics (visible in runtime logs for debugging) ──────────────
console.log('=== BUILD DIAGNOSTICS ===');
console.log('WEB_DIST/index.html:', fs.existsSync(path.join(WEB_DIST, 'index.html')));
console.log('packages/shared/dist/index.js:', fs.existsSync(path.join(__dirname, 'packages/shared/dist/index.js')));
console.log('apps/api/dist/routes/index.js:', fs.existsSync(path.join(__dirname, 'apps/api/dist/routes/index.js')));
console.log('=========================');

// ── Database pool ─────────────────────────────────────────────────────────────
let db = null;
if (process.env.DATABASE_URL) {
  try {
    const { default: pg } = await import('pg');
    const { Pool } = pg;
    db = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    // Prevent unhandled 'error' events from crashing the process when Neon
    // drops idle connections (the root cause of "Load failed" on first save).
    db.on('error', (err) => {
      console.error('pg pool background error (non-fatal):', err.message);
    });

    // ── Run DB migrations at startup ─────────────────────────────────────────
    const migClient = await db.connect();
    try {
      // Core users table (Polsia standard)
      await migClient.query(`
        CREATE TABLE IF NOT EXISTS users (
          id                      SERIAL PRIMARY KEY,
          email                   VARCHAR(255) NOT NULL,
          name                    VARCHAR(255),
          password_hash           VARCHAR(255),
          created_at              TIMESTAMPTZ  DEFAULT NOW(),
          updated_at              TIMESTAMPTZ  DEFAULT NOW(),
          stripe_subscription_id  VARCHAR(255),
          subscription_status     VARCHAR(50),
          subscription_plan       VARCHAR(255),
          subscription_expires_at TIMESTAMPTZ,
          subscription_updated_at TIMESTAMPTZ
        )
      `);
      await migClient.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
          ON users (LOWER(email))
      `);
      await migClient.query(`
        CREATE INDEX IF NOT EXISTS users_stripe_subscription_id_idx
          ON users (stripe_subscription_id)
      `);

      // Add role column (F2)
      await migClient.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'hunter'
      `);

      // HuntLog entity tables — JSONB storage for schema flexibility
      await migClient.query(`
        CREATE TABLE IF NOT EXISTS huntlog_weapons (
          id         TEXT        PRIMARY KEY,
          user_id    TEXT        NOT NULL,
          data       JSONB       NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await migClient.query(`
        CREATE INDEX IF NOT EXISTS huntlog_weapons_user_idx ON huntlog_weapons (user_id)
      `);

      await migClient.query(`
        CREATE TABLE IF NOT EXISTS huntlog_ammo (
          id         TEXT        PRIMARY KEY,
          user_id    TEXT        NOT NULL,
          data       JSONB       NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await migClient.query(`
        CREATE INDEX IF NOT EXISTS huntlog_ammo_user_idx ON huntlog_ammo (user_id)
      `);

      await migClient.query(`
        CREATE TABLE IF NOT EXISTS huntlog_locations (
          id         TEXT        PRIMARY KEY,
          user_id    TEXT        NOT NULL,
          data       JSONB       NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await migClient.query(`
        CREATE INDEX IF NOT EXISTS huntlog_locations_user_idx ON huntlog_locations (user_id)
      `);

      // Backfill: set location_type='other' and country='SE' for existing rows missing these fields
      await migClient.query(`
        UPDATE huntlog_locations
        SET data = data || jsonb_strip_nulls(jsonb_build_object(
          'location_type', CASE WHEN data->>'location_type' IS NULL THEN 'other' ELSE NULL END,
          'country', CASE WHEN data->>'country' IS NULL THEN 'SE' ELSE NULL END
        ))
        WHERE data->>'location_type' IS NULL OR data->>'country' IS NULL
      `);

      await migClient.query(`
        CREATE TABLE IF NOT EXISTS huntlog_sessions (
          id         TEXT        PRIMARY KEY,
          user_id    TEXT        NOT NULL,
          data       JSONB       NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await migClient.query(`
        CREATE INDEX IF NOT EXISTS huntlog_sessions_user_idx ON huntlog_sessions (user_id)
      `);

      await migClient.query(`
        CREATE TABLE IF NOT EXISTS huntlog_dogs (
          id         TEXT        PRIMARY KEY,
          user_id    TEXT        NOT NULL,
          data       JSONB       NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await migClient.query(`
        CREATE INDEX IF NOT EXISTS huntlog_dogs_user_idx ON huntlog_dogs (user_id)
      `);

      // Signups table (landing page email capture)
      await migClient.query(`
        CREATE TABLE IF NOT EXISTS signups (
          id         SERIAL      PRIMARY KEY,
          name       VARCHAR(255),
          email      VARCHAR(255) NOT NULL,
          created_at TIMESTAMPTZ  DEFAULT NOW()
        )
      `);
      await migClient.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS signups_email_idx ON signups (LOWER(email))
      `);

      // Add is_admin + is_active columns (idempotent — safe to run on existing DB)
      await migClient.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false
      `);
      await migClient.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true
      `);

      // Password reset tokens table (single-use, time-limited)
      await migClient.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id         SERIAL      PRIMARY KEY,
          user_id    INTEGER     NOT NULL,
          token_hash VARCHAR(255) NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at    TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await migClient.query(`
        CREATE INDEX IF NOT EXISTS prt_user_idx ON password_reset_tokens (user_id)
      `);

      // Seed initial admin account (ON CONFLICT DO NOTHING — runs once)
      const { default: bcrypt } = await import('bcryptjs');
      const adminHash = await bcrypt.hash('AdminHunt2026!', 12);
      await migClient.query(
        `INSERT INTO users (email, name, password_hash, role, is_admin, is_active)
         VALUES ($1, $2, $3, 'hunter', true, true)
         ON CONFLICT DO NOTHING`,
        ['admin@huntledger.se', 'admin', adminHash],
      );

      // Harvested animals — first-class relational table linked to hunt sessions
      await migClient.query(`
        CREATE TABLE IF NOT EXISTS huntlog_harvested_animals (
          id               TEXT         PRIMARY KEY,
          session_id       TEXT         NOT NULL,
          user_id          TEXT         NOT NULL,
          species          TEXT         NOT NULL,
          species_custom   TEXT,
          sex              TEXT,
          estimated_age    TEXT,
          carcass_weight   NUMERIC(10,3),
          antler_points    INTEGER,
          shot_placement   TEXT,
          trichina_id      TEXT,
          facility_id      TEXT,
          notes            TEXT,
          created_at       TIMESTAMPTZ  DEFAULT NOW(),
          updated_at       TIMESTAMPTZ  DEFAULT NOW()
        )
      `);
      await migClient.query(`
        CREATE INDEX IF NOT EXISTS huntlog_harvested_animals_session_idx
          ON huntlog_harvested_animals (session_id)
      `);
      await migClient.query(`
        CREATE INDEX IF NOT EXISTS huntlog_harvested_animals_user_idx
          ON huntlog_harvested_animals (user_id)
      `);

      // Feedback table (user-submitted feedback + admin view)
      await migClient.query(`
        CREATE TABLE IF NOT EXISTS feedback (
          id         SERIAL      PRIMARY KEY,
          user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title      TEXT        NOT NULL,
          body       TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await migClient.query(`
        CREATE INDEX IF NOT EXISTS feedback_user_idx ON feedback (user_id)
      `);
      await migClient.query(`
        CREATE INDEX IF NOT EXISTS feedback_created_idx ON feedback (created_at DESC)
      `);

      console.log('✅  DB migrations complete (users, huntlog tables, signups, password_reset_tokens, harvested_animals, feedback, admin seed)');
    } catch (e) {
      console.warn('⚠️  DB migration error:', e.message);
    } finally {
      migClient.release();
    }
  } catch (e) {
    console.warn('⚠️   DB setup failed:', e.message);
    db = null;
  }
} else {
  console.warn('⚠️   DATABASE_URL not set — DB features disabled');
}

async function main() {
  let transport;
  if (process.env.NODE_ENV !== 'production') {
    try {
      await import('pino-pretty');
      transport = { target: 'pino-pretty', options: { colorize: true } };
    } catch { /* pino-pretty not available in prod — fine */ }
  }

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      ...(transport ? { transport } : {}),
    },
    trustProxy: true,
  });

  // CORS — allow huntledger.se + polsia.app + localhost
  const allowedOrigins = [
    'https://huntledger.se',
    'https://www.huntledger.se',
    'https://huntlog-e293.polsia.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4173',
  ];
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
        cb(null, true);
      } else {
        cb(null, true); // permissive for now; tighten after custom domain confirmed
      }
    },
    credentials: true,
  });

  // ── Landing page at / ────────────────────────────────────────────────────
  // Bugfix: inject auth-check so logged-in users get redirected to the SPA
  // instead of seeing the marketing landing page on reload.
  const AUTH_REDIRECT_SCRIPT = '<script>try{if(localStorage.getItem("huntledger.auth.token"))location.replace("/overview")}catch(e){}</script>';

  // /health registreras av apps/api/src/routes/index.ts via registerRoutes() ovan,
  // ingen extra route behövs här (orsakade dubbelregistrering tidigare).

  app.get('/', async (request, reply) => {
    if (fs.existsSync(LANDING_HTML)) {
      let html = fs.readFileSync(LANDING_HTML, 'utf8');
      html = html.replace('__POLSIA_SLUG__', POLSIA_SLUG);
      // Inject auth-check script at the top of <head> so it runs before page renders
      html = html.replace('<head>', '<head>' + AUTH_REDIRECT_SCRIPT);
      return reply.type('text/html').send(html);
    }
    return reply.type('text/html').send('<h1>HuntLedger</h1>');
  });

  // ── Badge catalogue ──────────────────────────────────────────────────────
  app.get('/badges', async (request, reply) => {
    const badgesPath = path.join(WEB_DIST, 'badges.html');
    if (fs.existsSync(badgesPath)) {
      let html = fs.readFileSync(badgesPath, 'utf8');
      html = html.replace(/__POLSIA_SLUG__/g, POLSIA_SLUG);
      return reply.type('text/html').send(html);
    }
    const siblingBadges = path.join(__dirname, 'apps/web/public/badges.html');
    if (fs.existsSync(siblingBadges)) {
      let html = fs.readFileSync(siblingBadges, 'utf8');
      html = html.replace(/__POLSIA_SLUG__/g, POLSIA_SLUG);
      return reply.type('text/html').send(html);
    }
    return reply.code(404).send('Badge catalogue not available');
  });

  // ── Guide pages at /guider/:slug ──────────────────────────────────────────
  app.get('/guider/:slug', async (request, reply) => {
    const slug = request.params.slug;
    // Sanitise: only allow lowercase letters, digits, and hyphens
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return reply.code(404).send('Guide not found');
    }
    const fileName = slug + '.html';
    // Try dist/guider/ first, then SRC_DIR/guider/ fallback
    const distPath = path.join(WEB_DIST, 'guider', fileName);
    const fallbackPath = path.join(__dirname, 'apps/web/public/guider', fileName);
    const guidePath = fs.existsSync(distPath) ? distPath : (fs.existsSync(fallbackPath) ? fallbackPath : null);
    if (guidePath) {
      let html = fs.readFileSync(guidePath, 'utf8');
      html = html.replace(/__POLSIA_SLUG__/g, POLSIA_SLUG);
      return reply.type('text/html').send(html);
    }
    return reply.code(404).send('Guide not found');
  });

  // ── Email capture endpoint ───────────────────────────────────────────────
  app.post('/api/signups', async (request, reply) => {
    if (!db) {
      return reply.code(503).send({ error: 'Signups temporarily unavailable' });
    }
    const { name, email } = request.body || {};
    if (!email || typeof email !== 'string') {
      return reply.code(400).send({ error: 'E-postadress krävs' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const cleanName  = name ? String(name).trim().slice(0, 255) : null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return reply.code(400).send({ error: 'Ogiltig e-postadress' });
    }
    try {
      await db.query(
        'INSERT INTO signups (name, email) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [cleanName, cleanEmail]
      );
      return reply.send({ success: true });
    } catch (e) {
      console.error('signups insert error:', e.message);
      return reply.code(500).send({ error: 'Internt serverfel' });
    }
  });

  // Register API routes (health + /api/v1/* including F2 auth + data)
  try {
    await registerRoutes(app);
    console.log('✅  API routes registered successfully.');
  } catch (routeErr) {
    console.error('❌  CRITICAL: Failed to register API routes:', routeErr.message);
    console.error(routeErr.stack);
    // Still start the server so health check works and logs are visible
  }

  // Serve Vite frontend build
  if (fs.existsSync(WEB_DIST)) {
    // wildcard: false → fastifyStatic registers explicit GET/HEAD routes for each file
    // in WEB_DIST (no catch-all /* route), so our setNotFoundHandler below handles all
    // SPA routes (e.g. /login, /register) that don't correspond to actual files.
    // index: false → prevents fastifyStatic from registering GET / for index.html;
    // we already have app.get('/') for the landing page above, and registering HEAD /
    // twice (auto-HEAD from app.get('/') + fastifyStatic's HEAD /) would crash on startup.
    await app.register(fastifyStatic, {
      root: WEB_DIST,
      wildcard: false,
      index: false,
    });

    console.log('Static file serving enabled from: ' + WEB_DIST);
    console.log('SPA index.html exists: ' + fs.existsSync(path.join(WEB_DIST, 'index.html')));
  } else {
    console.warn('WARNING: Web dist directory not found at ' + WEB_DIST);
    console.warn('Frontend will not be served. Only API routes are available.');
  }

  // SPA catchall — registered unconditionally so /login and all client-side routes
  // never return Fastify's default 404.  Returns React app index.html if the build
  // succeeded, otherwise falls through to a JSON 404 (only for non-GET or truly
  // missing resources).
  const spaIndexPath = path.join(WEB_DIST, 'index.html');
  app.setNotFoundHandler(async (request, reply) => {
    if (request.method === 'GET' && fs.existsSync(spaIndexPath)) {
      return reply
        .type('text/html; charset=utf-8')
        .send(fs.readFileSync(spaIndexPath, 'utf8'));
    }
    return reply.code(404).send({ error: 'Not Found' });
  });

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log('Server listening on http://' + HOST + ':' + PORT);

    // Keep Neon connections warm — ping every 4 minutes to prevent Neon from
    // suspending the compute and dropping idle connections.
    const { pool: apiPool } = await import('./apps/api/dist/db.js');
    setInterval(async () => {
      try {
        await apiPool.query('SELECT 1');
      } catch (e) {
        console.warn('keepalive ping failed (non-fatal):', e.message);
      }
    }, 4 * 60 * 1000); // 4 minutes
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
