// ChatGPT wrote this
import axios from "axios";
import * as cheerio from "cheerio";

function absolutize(u, base) {
  try {
    return new URL(u, base).toString();
  } catch {
    return null;
  }
}
function normalize(u) {
  if (!u) return null;
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("http://")) return u.replace("http://", "https://");
  return u;
}

// ChatGPT wrote this
export async function tryFetchFirstImage(pageUrl) {
  try {
    const { data: html } = await axios.get(pageUrl, {
      timeout: 12000,
      headers: { "User-Agent": "Mozilla/5.0" },
      maxRedirects: 5,
    });
    const $ = cheerio.load(html);
    let src = $('meta[property="og:image"]').attr("content");
    if (!src) {
      const img = $("img").first();
      src = img.attr("src") || img.attr("data-src");
    }
    if (!src) return null;
    const abs = absolutize(src, pageUrl);
    return normalize(abs || src);
  } catch {
    return null;
  }
}

// ChatGPT wrote this
export async function tryFetchAvatar(ign) {
  const page = `https://mapleranks.com/u/${encodeURIComponent(ign)}`;
  return tryFetchFirstImage(page);
}

// ChatGPT wrote this
export async function refreshAvatarsFor(
  members,
  { force = false, throttleMs = 86400000 } = {}
) {
  if (!Array.isArray(members) || members.length === 0) return;
  for (const m of members) {
    try {
      const last = m.avatarCheckedAt
        ? new Date(m.avatarCheckedAt).getTime()
        : 0;
      const should = force || Date.now() - last > throttleMs;
      if (!should) continue;
      const found = await tryFetchAvatar(m.ign);
      const updates = { avatarCheckedAt: new Date() };
      if (found && found !== m.avatarUrl) updates.avatarUrl = found;
      // We import Member inline to avoid a circular import at module load
      const { default: Member } = await import("../models/Member.js");
      await Member.findByIdAndUpdate(m._id, updates);
    } catch {}
  }
}
