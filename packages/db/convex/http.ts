import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Escapes a CSV field value by:
 * - Wrapping in quotes if it contains comma, quote, or newline
 * - Escaping internal quotes by doubling them
 */
function escapeCsvField(value: string | number | boolean | undefined | null): string {
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

/**
 * HTTP endpoint to export all users as CSV
 * Access via: https://your-deployment.convex.site/exportUsersCSV
 */
const exportUsersCSV = httpAction(async (ctx) => {
  // Fetch all users
  const users = await ctx.runQuery(api.queries.getAllUsers, {});

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

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `users-export-${timestamp}.csv`;

  // Return CSV response with proper headers
  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-cache",
    },
  });
});

const http = httpRouter();

http.route({
  path: "/exportUsersCSV",
  method: "GET",
  handler: exportUsersCSV,
});

export default http;
