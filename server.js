import express from "express";
import expressLayouts from "express-ejs-layouts";
import mongoose from "mongoose";
import dotenv from "dotenv";
import methodOverride from "method-override";
import session from "express-session";
import MongoStore from "connect-mongo";
import path from "node:path";
import { fileURLToPath } from "node:url";

import User from "./models/User.js";
import Member from "./models/Member.js";
import authRoutes from "./routes/auth.js";
import memberRoutes from "./routes/members.js";
import { refreshAvatarsFor } from "./utils/avatar.js";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Views + layouts
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

// Static + parsers + method override
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

// Sessions
app.use(
  session({
    secret: "dev-secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  })
);

// Globals for EJS
app.use((req, res, next) => {
  res.locals.title = "Sworn Member Tracker";
  res.locals.commas = (v) => {
    const n =
      typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
    if (Number.isNaN(n)) return v;
    return n.toLocaleString("en-US");
  };
  next();
});

// DB
if (!process.env.MONGODB_URI) {
  console.log("Missing MONGODB_URI");
  process.exit(1);
}
await mongoose.connect(process.env.MONGODB_URI);

// Attach current user
app.use(async (req, res, next) => {
  res.locals.currentUser = null;
  if (req.session.userId) {
    try {
      const user = await User.findById(req.session.userId).lean();
      if (user) {
        req.user = user;
        res.locals.currentUser = user;
      }
    } catch {}
  }
  next();
});

// Routes
app.get("/", (req, res) => res.redirect("/roster"));
app.use("/", authRoutes);
app.use("/members", memberRoutes);

// Roster (Active/Inactive) with pagination (6 per page)
app.get("/roster", async (req, res) => {
  try {
    const status = (req.query.status || "active").toLowerCase();
    const isInactive = status === "inactive";
    const perPage = 15;
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const skip = (page - 1) * perPage;
    const filter = isInactive
      ? { isActive: false }
      : {
          $or: [{ isActive: { $exists: false } }, { isActive: { $ne: false } }],
        };
    const total = await Member.countDocuments(filter);
    const totalPages = Math.max(Math.ceil(total / perPage), 1);
    const slice = await Member.find(filter, {
      ign: 1,
      avatarUrl: 1,
      isActive: 1,
      avatarCheckedAt: 1,
    })
      .sort({ ign: 1 })
      .skip(skip)
      .limit(perPage)
      .lean();

    try {
      await refreshAvatarsFor(slice, { force: req.query.refresh === "1" });
    } catch {}

    res.render("roster", {
      members: slice,
      status: isInactive ? "inactive" : "active",
      page,
      totalPages,
    });
  } catch {
    res.send("Error");
  }
});

// Fallback + listen
app.use((req, res) => res.send("Error"));
app.listen(3000);

// Expose current path to views (for conditional titles)
app.use((req, res, next) => {
  res.locals.path = req.path;
  next();
});
