/**
 * Simple script to create a user with predefined credentials
 * Usage: npx ts-node scripts/create-user-simple.ts
 * 
 * DEFAULT CREDENTIALS:
 * Email: admin@swingadvisor.com
 * Password: SwingTrader2025!
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const DEFAULT_USER = {
  email: "galzaless@gmail.com",
  name: "Gal Zanman",
  password: "password",
  plan: "free",
};

async function createDefaultUser() {
  try {
    console.log("╔════════════════════════════════════════════╗");
    console.log("║   Creating Default Admin User              ║");
    console.log("╚════════════════════════════════════════════╝\n");

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: DEFAULT_USER.email },
    });

    if (existingUser) {
      console.log("⚠️  User already exists:");
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Name:  ${existingUser.name || "N/A"}`);
      console.log("\n💡 Use the interactive script if you want to create a different user.");
      await prisma.$disconnect();
      return;
    }

    // Hash password
    console.log("⏳ Hashing password...");
    const passwordHash = await bcrypt.hash(DEFAULT_USER.password, 12);

    // Create user
    console.log("⏳ Creating user in database...");
    const user = await prisma.user.create({
      data: {
        email: DEFAULT_USER.email,
        name: DEFAULT_USER.name,
        passwordHash,
        plan: DEFAULT_USER.plan,
      },
    });

    console.log("\n✅ Default user created successfully!\n");
    console.log("╔════════════════════════════════════════════╗");
    console.log("║           LOGIN CREDENTIALS                ║");
    console.log("╠════════════════════════════════════════════╣");
    console.log(`║ Email:    ${DEFAULT_USER.email.padEnd(30)}║`);
    console.log(`║ Password: ${DEFAULT_USER.password.padEnd(30)}║`);
    console.log("╚════════════════════════════════════════════╝\n");

    console.log("🚀 Next steps:");
    console.log("   1. Run: npm run dev");
    console.log("   2. Visit: http://localhost:3000");
    console.log("   3. You'll be redirected to login");
    console.log("   4. Use the credentials above\n");

    console.log("⚠️  IMPORTANT: Change the default password after first login!\n");
  } catch (error) {
    console.error("\n❌ Error creating user:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createDefaultUser();

