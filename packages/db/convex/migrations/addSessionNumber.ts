import { internalMutation } from "../_generated/server";

export const addSessionNumber = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all userLists entries
    const allEntries = await ctx.db.query("userLists").collect();

    console.log(`Found ${allEntries.length} userList entries to update`);

    let updated = 0;
    for (const entry of allEntries) {
      // Only update if sessionNumber is not set
      if (entry.sessionNumber === undefined) {
        await ctx.db.patch(entry._id, {
          sessionNumber: 1,
        });
        updated++;
      }
    }

    console.log(`✅ Updated ${updated} entries with sessionNumber = 1`);
    return { total: allEntries.length, updated };
  },
});
