import type { SimUser, TelegramSimulator } from "./telegram/simulator";

/** The cast and chats every simulated run starts with. */
export interface World {
  owner: SimUser;
  admin: SimUser;
  students: SimUser[];
  channelId: number;
  groupId: number;
  /** The chat the bot forwards messages to when it looks up their author. */
  scratchChatId: number;
}

/** The standard cast: an owner, a second admin, students, one channel with its group. */
export function createWorld(sim: TelegramSimulator): World {
  const owner = sim.addUser({ first_name: "أم أحمد", username: "umm_ahmad" });
  const admin = sim.addUser({ first_name: "مشرفة", last_name: "سارة", username: "supervisor_sara" });
  const students = [
    sim.addUser({ first_name: "Fatima", username: "fatima_q" }),
    sim.addUser({ first_name: "Mona" }),
    sim.addUser({ first_name: "Hidden", hideForwards: true }),
  ];
  const { channelId, groupId } = sim.createChannel({
    title: "حلقة القرآن",
    ownerId: owner.id,
    adminIds: [admin.id],
  });
  const scratchChatId = sim.createGroup({ title: "Bot scratch", ownerId: owner.id });
  return { owner, admin, students, channelId, groupId: groupId!, scratchChatId };
}
