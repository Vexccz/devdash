/**
 * One-off script: promote an existing user to admin, or create one.
 *   node src/scripts/make-admin.js admin@example.com
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node src/scripts/make-admin.js <email> [password]');
    process.exit(1);
  }
  const password = process.argv[3];

  await mongoose.connect(process.env.MONGODB_URI);
  let user = await User.findOne({ email });
  if (!user) {
    if (!password) {
      console.error('User not found. Provide a password as 2nd arg to create one.');
      process.exit(1);
    }
    const passwordHash = await bcrypt.hash(password, 10);
    user = await User.create({ email, passwordHash, name: 'Admin', role: 'admin', plan: 'pro' });
    console.log(`Created admin: ${email}`);
  } else {
    await User.findByIdAndUpdate(user._id, { role: 'admin' });
    console.log(`Promoted to admin: ${email}`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
