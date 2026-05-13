// Promote a user to admin. Optionally creates them.
// Usage: npm run make-admin user@example.com [password]
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email) {
    console.error('Usage: npm run make-admin <email> [password]');
    process.exit(1);
  }
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    if (!password) {
      console.error(`User ${email} not found. Pass a password to create one.`);
      process.exit(1);
    }
    const hash = await bcrypt.hash(password, 10);
    user = await prisma.user.create({ data: { email, password: hash, role: 'ADMIN', plan: 'FREE' } });
    console.log(`Created admin user: ${email}`);
  } else {
    user = await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    console.log(`Promoted to admin: ${email}`);
  }
}
main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
