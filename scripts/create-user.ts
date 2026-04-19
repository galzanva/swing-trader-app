/**
 * Script to create the first user in the database
 * Usage: npx ts-node scripts/create-user.ts
 * 
 * Or add to package.json:
 * "create-user": "ts-node scripts/create-user.ts"
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import * as readline from "readline";

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function createUser() {
  try {
    console.log("╔════════════════════════════════════════════╗");
    console.log("║   Trader Journey - Create First User      ║");
    console.log("╚════════════════════════════════════════════╝\n");

    // Get user input
    const email = await question("Enter email address: ");
    if (!email || !email.includes("@")) {
      console.error("❌ Invalid email address");
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.error(`❌ User with email ${email} already exists`);
      process.exit(1);
    }

    const name = await question("Enter full name (optional): ");
    const password = await question("Enter password (min 8 characters): ");

    if (password.length < 8) {
      console.error("❌ Password must be at least 8 characters long");
      process.exit(1);
    }

    const confirmPassword = await question("Confirm password: ");

    if (password !== confirmPassword) {
      console.error("❌ Passwords do not match");
      process.exit(1);
    }

    // Hash password
    console.log("\n⏳ Creating user...");
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        passwordHash,
        plan: "free",
      },
    });

    console.log("\n✅ User created successfully!");
    console.log("╔════════════════════════════════════════════╗");
    console.log(`║ ID:    ${user.id.padEnd(36)}║`);
    console.log(`║ Email: ${user.email.padEnd(36)}║`);
    console.log(`║ Name:  ${(user.name || "N/A").padEnd(36)}║`);
    console.log(`║ Plan:  ${user.plan.padEnd(36)}║`);
    console.log("╚════════════════════════════════════════════╝\n");

    console.log("🎉 You can now log in at: http://localhost:3000/login\n");
  } catch (error) {
    console.error("\n❌ Error creating user:", error);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

createUser();

