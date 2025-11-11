export declare const addMessageAuthor: import("convex/server").RegisteredMutation<"public", {
    messageText?: string | undefined;
    chatId: number;
    postId: number;
    messageId: number;
    user: {
        username?: string | undefined;
        id: number;
        first_name: string;
    };
}, Promise<void>>;
export declare const addUserToList: import("convex/server").RegisteredMutation<"public", {
    displayName?: string | undefined;
    chatId: number;
    postId: number;
    user: {
        username?: string | undefined;
        id: number;
        first_name: string;
    };
}, Promise<boolean>>;
export declare const clearUserList: import("convex/server").RegisteredMutation<"public", {
    chatId: number;
    postId: number;
}, Promise<void>>;
export declare const setLastListMessage: import("convex/server").RegisteredMutation<"public", {
    chatId: number;
    postId: number;
    messageId: number;
}, Promise<void>>;
export declare const clearLastListMessage: import("convex/server").RegisteredMutation<"public", {
    chatId: number;
    postId: number;
}, Promise<void>>;
export declare const storeClassification: import("convex/server").RegisteredMutation<"public", {
    chatId: number;
    postId: number;
    messageId: number;
    containsName: boolean;
    detectedNames: string[];
}, Promise<void>>;
export declare const updateUserPosition: import("convex/server").RegisteredMutation<"public", {
    chatId: number;
    postId: number;
    userId: number;
    newPosition: number;
}, Promise<void>>;
export declare const removeUserFromList: import("convex/server").RegisteredMutation<"public", {
    chatId: number;
    postId: number;
    userId: number;
}, Promise<void>>;
export declare const completeUserTurn: import("convex/server").RegisteredMutation<"public", {
    chatId: number;
    postId: number;
    userId: number;
    sessionType: string;
}, Promise<void>>;
export declare const skipUserTurn: import("convex/server").RegisteredMutation<"public", {
    chatId: number;
    postId: number;
    userId: number;
}, Promise<void>>;
export declare const updateSessionType: import("convex/server").RegisteredMutation<"public", {
    chatId: number;
    postId: number;
    userId: number;
    sessionType: string;
}, Promise<void>>;
export declare const updateUserDisplayName: import("convex/server").RegisteredMutation<"public", {
    chatId: number;
    postId: number;
    userId: number;
    displayName: string;
}, Promise<void>>;
//# sourceMappingURL=mutations.d.ts.map