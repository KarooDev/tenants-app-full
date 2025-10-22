// server/routes/index.js
import { Router } from 'express';
import invitations from './invitations.js';
import users from './users.js';
import buildings from './buildings.js';
import blocks from './blocks.js';
import units from './units.js';
import issues from './issues.js';
import charges from './charges.js';
import payments from './payments.js';
import ratings from './ratings.js';
import cash from './cash.js';


const r = Router();


r.use('/invitations', invitations);
r.use('/users', users);
r.use('/buildings', buildings);
r.use('/blocks', blocks);
r.use('/units', units);
r.use('/issues', issues);
r.use('/charges', charges);
r.use('/payments', payments);
r.use('/ratings', ratings);
r.use('/cash', cash);


export default r;