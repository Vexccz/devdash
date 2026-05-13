/**
 * node src/scripts/make-admin.js <email> [password]
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email) {
    console.error('Usage: node src/scripts/make-admin.js <email> [password]');
    process.exit(1);
  }
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    if (!password) {
      console.error('User not found. Provide a password as 2nd arg to create one.');
      process.exit(1);
    }
    const passwordHash = await bcrypt.hash(password, 10);
    user = await prisma.user.create({ data: { email, passwordHash, name: 'Admin', role: 'ADMIN', plan: 'PRO' } });
    console.log(`Created admin: ${email}`);
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    console.log(`Promoted to admin: ${email}`);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
