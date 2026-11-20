// Generate Convex's local bindings before Bun resolves imports from @halakabot/db.
// This only generates files; it neither starts nor deploys a Convex backend.
import { ensureConvexCodegen } from "../src/convex-emulator";

await ensureConvexCodegen();
