import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("re-notify bot of stalled tasks", { minutes: 1 }, internal.botTaskQueue.notifyIfStalled, {});

export default crons;
