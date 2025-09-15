import { Router } from "express";
import Member from "../models/Member.js";
import { isLoggedIn, canEditMember } from "../middleware/auth.js";
import { tryFetchAvatar, refreshAvatarsFor } from "../utils/avatar.js";

const router = Router();

// --- Index: list members with search/sort/pagination
router.get("/", isLoggedIn, async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const filter = q
      ? { $or: [{ ign: new RegExp(q, "i") }, { discord: new RegExp(q, "i") }] }
      : {};

    const sortKey = (req.query.sort || "ign").toLowerCase();
    const order = (
      req.query.order ||
      (sortKey === "culvert" || sortKey === "active" ? "desc" : "asc")
    ).toLowerCase();
    const sortField =
      sortKey === "culvert"
        ? "culvertBest"
        : sortKey === "discord"
        ? "discord"
        : sortKey === "active"
        ? "isActive"
        : "ign";
    const sortObj = { [sortField]: order === "desc" ? -1 : 1 };

    const perPage = 6;
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const skip = (page - 1) * perPage;

    const total = await Member.countDocuments(filter);
    const totalPages = Math.max(Math.ceil(total / perPage), 1);

    const raw = await Member.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(perPage)
      .select("ign avatarUrl avatarCheckedAt")
      .lean();
    await refreshAvatarsFor(raw, { force: req.query.refresh === "1" });

    let members = await Member.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(perPage)
      .populate("createdBy", "username")
      .lean();

    members = members.map((m) => ({ ...m, canEdit: !!req.session.userId }));

    return res.render("members/index", {
      members,
      q,
      page,
      totalPages,
      sortKey,
      order,
      myEdits: false,
    });
  } catch (e) {
    console.error("GET /members error:", e);
    return res.send("Error");
  }
});

// --- My Edits: must be before parameterized routes
router.get("/my-edits", isLoggedIn, async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const filter = { createdBy: req.session.userId };
    if (q) {
      filter.$or = [
        { ign: new RegExp(q, "i") },
        { discord: new RegExp(q, "i") },
      ];
    }

    const sortKey = (req.query.sort || "ign").toLowerCase();
    const order = (
      req.query.order ||
      (sortKey === "culvert" || sortKey === "active" ? "desc" : "asc")
    ).toLowerCase();
    const sortField =
      sortKey === "culvert"
        ? "culvertBest"
        : sortKey === "discord"
        ? "discord"
        : sortKey === "active"
        ? "isActive"
        : "ign";
    const sortObj = { [sortField]: order === "desc" ? -1 : 1 };

    const perPage = 6;
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const skip = (page - 1) * perPage;

    const total = await Member.countDocuments(filter);
    const totalPages = Math.max(Math.ceil(total / perPage), 1);

    const raw = await Member.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(perPage)
      .select("ign avatarUrl avatarCheckedAt")
      .lean();
    await refreshAvatarsFor(raw, { force: req.query.refresh === "1" });

    let members = await Member.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(perPage)
      .populate("createdBy", "username")
      .lean();

    members = members.map((m) => ({ ...m, canEdit: !!req.session.userId }));

    return res.render("members/index", {
      members,
      q,
      page,
      totalPages,
      sortKey,
      order,
      myEdits: true,
    });
  } catch (e) {
    console.error("GET /members/my-edits error:", e);
    return res.send("Error");
  }
});

// --- New
router.get("/new", isLoggedIn, (req, res) => {
  return res.render("members/new", { title: "Add Member" });
});

// --- Create
router.post("/", isLoggedIn, async (req, res) => {
  try {
    const data = {
      ign: (req.body.ign || "").trim(),
      discord: (req.body.discord || "").trim(),
      isActive: !!req.body.isActive,
      culvertBest: Number(req.body.culvertBest) || 0,
      notes: req.body.notes || "",
      createdBy: req.session.userId,
    };
    // ChatGPT wrote this — avatar auto-fetch from MapleRanks
    const fetched = await tryFetchAvatar(data.ign);
    if (fetched) {
      data.avatarUrl = fetched;
      data.avatarCheckedAt = new Date();
    }
    const doc = await Member.create(data);
    return res.redirect(`/members/${doc._id}`);
  } catch (e) {
    console.error("POST /members error:", e);
    return res.send("Error");
  }
});

// --- Show (public)
router.get("/:id", async (req, res) => {
  try {
    const doc = await Member.findById(req.params.id)
      .populate("createdBy", "username")
      .lean();
    if (!doc) return res.send("Error");
    return res.render("members/show", {
      member: doc,
      canEdit: !!req.session.userId,
    });
  } catch (e) {
    console.error("GET /members/:id error:", e);
    return res.send("Error");
  }
});

// --- Edit
router.get("/:id/edit", isLoggedIn, canEditMember, async (req, res) => {
  try {
    const m = await Member.findById(req.params.id).lean();
    if (!m) return res.send("Error");
    return res.render("members/edit", { member: m });
  } catch (e) {
    console.error("GET /members/:id/edit error:", e);
    return res.send("Error");
  }
});

// --- Update
router.put("/:id", isLoggedIn, canEditMember, async (req, res) => {
  try {
    const updates = {
      ign: (req.body.ign || "").trim(),
      discord: (req.body.discord || "").trim(),
      isActive: !!req.body.isActive,
      culvertBest: Number(req.body.culvertBest) || 0,
      notes: req.body.notes || "",
    };
    await Member.findByIdAndUpdate(req.params.id, updates, { new: true });
    return res.redirect(`/members/${req.params.id}`);
  } catch (e) {
    console.error("PUT /members/:id error:", e);
    return res.send("Error");
  }
});

// --- Refresh one avatar
router.post(
  "/:id/refresh-avatar",
  isLoggedIn,
  canEditMember,
  async (req, res) => {
    try {
      const m = await Member.findById(req.params.id);
      if (!m) return res.send("Error");
      const found = await tryFetchAvatar(m.ign);
      if (found) m.avatarUrl = found;
      m.avatarCheckedAt = new Date();
      await m.save();
      return res.redirect(`/members/${m._id}/edit`);
    } catch (e) {
      console.error("POST /members/:id/refresh-avatar error:", e);
      return res.send("Error");
    }
  }
);

// --- Delete
router.delete("/:id", isLoggedIn, canEditMember, async (req, res) => {
  try {
    await Member.findByIdAndDelete(req.params.id);
    return res.redirect("/members");
  } catch (e) {
    console.error("DELETE /members/:id error:", e);
    return res.send("Error");
  }
});

// --- Danger zone: wipe all members (requires captcha exact match)
router.post("/wipe-members", isLoggedIn, async (req, res) => {
  try {
    const captcha = (req.body.captcha || "").trim();
    if (captcha !== "I AM MOST CERTAIN I WANT THIS ACTION TO BE DONE!!") {
      return res.send("Error");
    }
    await Member.deleteMany({});
    return res.redirect("/members");
  } catch (e) {
    console.error("POST /members/wipe-members error:", e);
    return res.send("Error");
  }
});

export default router;
