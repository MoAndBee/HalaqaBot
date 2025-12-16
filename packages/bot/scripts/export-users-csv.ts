import { ConvexHttpClient } from "convex/browser";
import { api } from "@halakabot/db";
import * as fs from "fs";
import * as path from "path";

const CONVEX_URL = process.env.CONVEX_URL;

if (!CONVEX_URL) {
  throw new Error("Missing CONVEX_URL environment variable");
}

const convex = new ConvexHttpClient(CONVEX_URL);

/**
 * Escapes a CSV field value by:
 * - Wrapping in quotes if it contains comma, quote, or newline
 * - Escaping internal quotes by doubling them
 */
function escapeCsvField(value: string | number | undefined | null): string {
  if (value === undefined || value === null) {
    return "";
  }

  const stringValue = String(value);

  // If the field contains comma, quote, or newline, wrap it in quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // Escape quotes by doubling them
    const escaped = stringValue.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return stringValue;
}

async function exportUsersToCSV() {
  console.log("📊 Fetching all users from database...\n");

  const users = await convex.query(api.queries.getAllUsers, {});

  console.log(`Found ${users.length} users\n`);

  if (users.length === 0) {
    console.log("No users to export.");
    return;
  }

  // Define CSV headers
  const headers = [
    "userId",
    "username",
    "telegramName",
    "realName",
    "realNameVerified",
    "sourceMessageText",
    "updatedAt"
  ];

  // Build CSV content
  const csvLines: string[] = [];

  // Add header row
  csvLines.push(headers.join(","));

  // Add data rows
  for (const user of users) {
    const row = [
      escapeCsvField(user.userId),
      escapeCsvField(user.username),
      escapeCsvField(user.telegramName),
      escapeCsvField(user.realName),
      escapeCsvField(user.realNameVerified ?? ""),
      escapeCsvField(user.sourceMessageText),
      escapeCsvField(user.updatedAt)
    ];
    csvLines.push(row.join(","));
  }

  const csvContent = csvLines.join("\n");

  // Create output directory if it doesn't exist
  const outputDir = path.join(process.cwd(), "exports");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `users-export-${timestamp}.csv`;
  const filepath = path.join(outputDir, filename);

  // Write CSV file
  fs.writeFileSync(filepath, csvContent, "utf-8");

  console.log("✅ Export complete!");
  console.log(`   File: ${filepath}`);
  console.log(`   Total users: ${users.length}`);
  console.log(`   Users with real names: ${users.filter(u => u.realName).length}`);
  console.log(`   Users with usernames: ${users.filter(u => u.username).length}`);
}

exportUsersToCSV()
  .then(() => {
    console.log("\n✓ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Fatal error:", error);
    process.exit(1);
  });
