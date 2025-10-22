// server/app.js
import 'dotenv/config';
import compression from 'compression';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import auth from './routes/auth.js';
import invitations from './routes/invitations.js';
import units from './routes/units.js'
import cash from './routes/cash.js';
import ratings from './routes/ratings.js';
import buildings from './routes/buildings.js';
import issues from './routes/issues.js';
import charges from './routes/charges.js';
import users from './routes/users.js';

const app = express();

/* 1) CORS FIRST (and preflight) */
app.use(cors({
  origin: ['http://localhost:5173', 'https://bineytna.com'], // add any other origins you use
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.options('*', cors()); // handle OPTIONS preflight
app.use(compression());
app.use((req,res,next)=>{ res.set('Connection','keep-alive'); next(); });
/* 2) Body parser & logging BEFORE routes */
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

/* 3) Routes */
app.get('/auth/health', (req, res) => res.json({ service: 'tenants-app', ts: Date.now() }));
app.use('/auth', auth);          // now gets CORS + body parsing
app.use('/invitations', invitations);
app.use('/units', units);
app.use('/cash', cash);
app.use('/buildings', buildings);
app.use('/issues', issues);
app.use('/ratings', ratings);
app.use('/charges', charges);
app.use('/users', users);
/* 4) Start */
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`API running on :${PORT}`));
