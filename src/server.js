import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

dotenv.config();
const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(bodyParser.json());

app.use((req, _res, next) => {
  const auth = req.header("authorization");
  if (auth?.startsWith("Bearer ")) {
    try { req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET || "dev"); }
    catch {}
  }
  if (!req.user) req.user = { id: "u_demo" };
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/wallet", async (req, res) => {
  const userId = req.user.id;
  const w = await prisma.wallet.upsert({ where: { userId }, create: { userId }, update: {} });
  res.json({ pending: w.pendingP, available: w.availableP, paid: w.paidOutP });
});

app.post("/api/reel/session/start", async (req, res) => {
  const userId = req.user.id;
  const s = await prisma.adReelSession.create({ data: { userId, mode: "combo", status: "created" } });
  res.json({ session_id: s.id, ad_offer_id: `adgem_${Date.now()}`, survey_prefetch_url: `https://example.com/survey?uid=${userId}&sid=${s.id}` });
});

app.post("/api/reel/ad/locally_completed", async (_req, res) => { res.json({ ok: true }); });
app.post("/api/reel/survey/locally_done", async (req, res) => {
  const userId = req.user.id;
  const { session_id } = req.body || {};
  const totalP = 6; const userP = Math.round(totalP * 0.55); const houseP = totalP - userP;
  const txn = await prisma.walletTransaction.create({ data: { userId, type: "combo_unit", status: "pending", amountUserP: userP, amountHouseP: houseP, sessionId: session_id } });
  await prisma.adReelSession.update({ where: { id: session_id }, data: { walletTxnId: txn.id } }).catch(() => {});
  res.json({ ok: true, pending_txn_id: txn.id });
});

app.post("/postback/adgem", (_req, res) => res.json({ ok: true }));
app.post("/postback/survey/bitlabs", (_req, res) => res.json({ ok: true }));
app.post("/postback/survey/cpx", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ADSVERSE API listening on ${PORT}`));
