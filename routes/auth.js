import { Router } from "express";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import { isLoggedIn } from "../middleware/auth.js";

const router = Router();

async function canAccessSignup(req) {
  const count = await User.countDocuments();
  if (count === 0) return true;
  return !!req.user;
}

router.get("/login", (req, res) => {
  if (req.user) return res.redirect("/roster");
  res.render("login", { error: null });
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.render("login", { error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.render("login", { error: "Invalid credentials" });
    req.session.userId = user._id.toString();
    res.redirect("/roster");
  } catch {
    res.send("Error");
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/roster"));
});

router.get("/signup", async (req, res) => {
  if (!(await canAccessSignup(req))) return res.send("Error");
  res.render("signup", { error: null });
});

router.post("/signup", async (req, res) => {
  try {
    const count = await User.countDocuments();
    if (count > 0 && !req.user) return res.send("Error");
    const { username, password } = req.body;
    const exists = await User.findOne({ username });
    if (exists)
      return res.render("signup", { error: "Username already taken." });
    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ username, passwordHash });
    res.redirect("/login");
  } catch {
    res.send("Error");
  }
});

// Delete ONLY current user (captcha required) and logout
router.post("/account/delete-self", isLoggedIn, async (req, res) => {
  try {
    const EXACT = "I AM MOST CERTAIN I WANT THIS ACTION TO BE DONE!!";
    const { captcha } = req.body;
    if (captcha !== EXACT) return res.send("Error");
    await User.deleteOne({ _id: req.user._id });
    req.session.destroy(() => res.redirect("/signup"));
  } catch {
    res.send("Error");
  }
});

export default router;
