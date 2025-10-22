// server/routes/ratings.js
import { Router } from "express";
import { ok } from "../lib/rows.js";

const r = Router();
r.get("/list", async (req, res) => ok(res, { items: [] }));
export default r;
