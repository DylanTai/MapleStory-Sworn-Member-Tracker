import Member from "../models/Member.js";

export function isLoggedIn(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

export async function canEditMember(req, res, next) {
  try {
    const m = await Member.findById(req.params.id);
    if (!m) return res.send("Error");
    req.member = m;
    if (!req.session.userId) return res.redirect("/login");
    // All logged-in users may edit
    next();
  } catch (e) {
    return res.send("Error");
  }
}
