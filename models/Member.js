import mongoose from "mongoose";
const { Schema } = mongoose;

const memberSchema = new Schema(
  {
    ign: { type: String, required: true },
    discord: String,
    isActive: { type: Boolean, default: true },
    culvertBest: { type: Number, default: 0 },
    notes: String,
    avatarUrl: String,
    avatarCheckedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("Member", memberSchema);
