import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
  name:   { type: String, required: true, trim: true },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  policies: {
    fileSharing:    { type: Boolean, default: true },
    screenSharing:  { type: Boolean, default: true },
    guestAccess:    { type: Boolean, default: true },
    retentionDays:  { type: Number, default: 30 },
    sessionExpiry:  { type: Number, default: 60 },
    messageRateLimit: { type: Number, default: 100 },
  },
}, { timestamps: true });

export default mongoose.model('Organization', organizationSchema);
