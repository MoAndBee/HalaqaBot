import { internalMutation } from "../_generated/server";

export const removeSkipCount = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all turnQueue entries
    const allEntries = await ctx.db.query("turnQueue").collect();

    console.log(`Found ${allEntries.length} turnQueue entries to check`);

    let updated = 0;
    for (const entry of allEntries) {
      // Check if skipCount field exists (it would be in the object even if we removed it from schema)
      if ('skipCount' in entry) {
        // Remove the skipCount field by setting it to undefined
        await ctx.db.patch(entry._id, {
          skipCount: undefined as any,
        });
        updated++;
      }
    }

    console.log(`✅ Removed skipCount from ${updated} entries`);
    return { total: allEntries.length, updated };
  },
});
