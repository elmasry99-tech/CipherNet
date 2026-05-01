import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ['admin', 'oso', 'internal', 'guest', 'general'], required: true },
  orgId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
  status:       { type: String, enum: ['pending', 'active', 'disabled'], default: 'pending' },
  publicKey:    { type: String, default: null },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
