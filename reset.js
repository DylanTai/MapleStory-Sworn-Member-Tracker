import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import User from "./models/User.js";
import Member from "./models/Member.js";

dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI;

async function promptYES(prompt) {
  const rl = createInterface({ input, output });
  try {
    const ans = (
      await rl.question(`${prompt} (type "yes" to confirm): `)
    ).trim();
    return ans === "yes";
  } finally {
    rl.close();
  }
}

async function promptCredentials() {
  const rl = createInterface({ input, output });
  try {
    let username = (await rl.question("Create first admin username: ")).trim();
    while (!username)
      username = (
        await rl.question("Username cannot be empty. Try again: ")
      ).trim();
    let pwd1 = await rl.question("Create password: ");
    while (!pwd1)
      pwd1 = await rl.question("Password cannot be empty. Try again: ");
    let pwd2 = await rl.question("Confirm password: ");
    while (pwd2 !== pwd1) {
      output.write("Passwords do not match.\n");
      pwd2 = await rl.question("Confirm password: ");
    }
    return { username, password: pwd1 };
  } finally {
    rl.close();
  }
}

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to", MONGODB_URI);

    // Always delete all users
    const delUsers = await User.deleteMany({});
    console.log(`Deleted ${delUsers.deletedCount} user(s).`);

    // Optionally delete all members
    const wipeMembers = await promptYES("Also delete ALL members");
    if (wipeMembers) {
      const delMembers = await Member.deleteMany({});
      console.log(`Deleted ${delMembers.deletedCount} member(s).`);
    } else {
      console.log("Keeping existing members.");
    }

    // Create first admin
    const { username, password } = await promptCredentials();
    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ username, passwordHash });
    console.log(`Created first admin "${username}".`);

    await mongoose.disconnect();
    console.log("Done.");
    process.exit(0);
  } catch (e) {
    console.error("Reset error:", e?.message || e);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

run();
