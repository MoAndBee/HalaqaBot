export declare const getMessageAuthor: import("convex/server").RegisteredQuery<"public", {
    chatId: number;
    postId: number;
    messageId: number;
}, Promise<{
    id: number;
    first_name: string;
    username: string | undefined;
} | null>>;
export declare const getPostIdForMessage: import("convex/server").RegisteredQuery<"public", {
    chatId: number;
    messageId: number;
}, Promise<number | null>>;
export declare const getUserList: import("convex/server").RegisteredQuery<"public", {
    chatId: number;
    postId: number;
}, Promise<{
    activeUsers: {
        id: number;
        first_name: string;
        username: string | undefined;
        displayName: string | undefined;
        position: number;
    }[];
    completedUsers: {
        id: number;
        first_name: string;
        username: string | undefined;
        displayName: string | undefined;
        position: number;
        completedAt: number | undefined;
        sessionType: string | undefined;
    }[];
}>>;
export declare const getLastListMessage: import("convex/server").RegisteredQuery<"public", {
    chatId: number;
    postId: number;
}, Promise<number | null>>;
export declare const getClassification: import("convex/server").RegisteredQuery<"public", {
    chatId: number;
    postId: number;
    messageId: number;
}, Promise<{
    containsName: boolean;
    detectedNames: string[];
} | null>>;
export declare const getUnclassifiedMessages: import("convex/server").RegisteredQuery<"public", {
    chatId: number;
    postId: number;
}, Promise<any[]>>;
export declare const getAllPosts: import("convex/server").RegisteredQuery<"public", {}, Promise<{
    chatId: number;
    postId: number;
    userCount: number;
}[]>>;
export declare const getPostDetails: import("convex/server").RegisteredQuery<"public", {
    chatId: number;
    postId: number;
}, Promise<{
    userCount: number;
    messageCount: number;
} | null>>;
//# sourceMappingURL=queries.d.ts.map