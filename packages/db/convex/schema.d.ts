declare const _default: import("convex/server").SchemaDefinition<{
    messageAuthors: import("convex/server").TableDefinition<import("convex/values").VObject<{
        username?: string | undefined;
        messageText?: string | undefined;
        chatId: number;
        postId: number;
        messageId: number;
        userId: number;
        firstName: string;
        createdAt: number;
    }, {
        chatId: import("convex/values").VFloat64<number, "required">;
        postId: import("convex/values").VFloat64<number, "required">;
        messageId: import("convex/values").VFloat64<number, "required">;
        userId: import("convex/values").VFloat64<number, "required">;
        firstName: import("convex/values").VString<string, "required">;
        username: import("convex/values").VString<string | undefined, "optional">;
        messageText: import("convex/values").VString<string | undefined, "optional">;
        createdAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "chatId" | "postId" | "messageId" | "userId" | "firstName" | "username" | "messageText" | "createdAt">, {
        by_chat_post_message: ["chatId", "postId", "messageId", "_creationTime"];
        by_chat_post: ["chatId", "postId", "_creationTime"];
        by_post: ["postId", "_creationTime"];
    }, {}, {}>;
    userLists: import("convex/server").TableDefinition<import("convex/values").VObject<{
        username?: string | undefined;
        displayName?: string | undefined;
        completedAt?: number | undefined;
        sessionType?: string | undefined;
        chatId: number;
        postId: number;
        userId: number;
        firstName: string;
        createdAt: number;
        position: number;
    }, {
        chatId: import("convex/values").VFloat64<number, "required">;
        postId: import("convex/values").VFloat64<number, "required">;
        userId: import("convex/values").VFloat64<number, "required">;
        firstName: import("convex/values").VString<string, "required">;
        username: import("convex/values").VString<string | undefined, "optional">;
        displayName: import("convex/values").VString<string | undefined, "optional">;
        position: import("convex/values").VFloat64<number, "required">;
        createdAt: import("convex/values").VFloat64<number, "required">;
        completedAt: import("convex/values").VFloat64<number | undefined, "optional">;
        sessionType: import("convex/values").VString<string | undefined, "optional">;
    }, "required", "chatId" | "postId" | "userId" | "firstName" | "username" | "createdAt" | "displayName" | "position" | "completedAt" | "sessionType">, {
        by_chat_post_user: ["chatId", "postId", "userId", "_creationTime"];
        by_chat_post: ["chatId", "postId", "_creationTime"];
        by_chat_post_position: ["chatId", "postId", "position", "_creationTime"];
    }, {}, {}>;
    lastListMessages: import("convex/server").TableDefinition<import("convex/values").VObject<{
        chatId: number;
        postId: number;
        messageId: number;
        updatedAt: number;
    }, {
        chatId: import("convex/values").VFloat64<number, "required">;
        postId: import("convex/values").VFloat64<number, "required">;
        messageId: import("convex/values").VFloat64<number, "required">;
        updatedAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "chatId" | "postId" | "messageId" | "updatedAt">, {
        by_chat_post: ["chatId", "postId", "_creationTime"];
    }, {}, {}>;
    messageClassifications: import("convex/server").TableDefinition<import("convex/values").VObject<{
        chatId: number;
        postId: number;
        messageId: number;
        containsName: boolean;
        detectedNames: string[];
        classifiedAt: number;
    }, {
        chatId: import("convex/values").VFloat64<number, "required">;
        postId: import("convex/values").VFloat64<number, "required">;
        messageId: import("convex/values").VFloat64<number, "required">;
        containsName: import("convex/values").VBoolean<boolean, "required">;
        detectedNames: import("convex/values").VArray<string[], import("convex/values").VString<string, "required">, "required">;
        classifiedAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "chatId" | "postId" | "messageId" | "containsName" | "detectedNames" | "classifiedAt">, {
        by_chat_post_message: ["chatId", "postId", "messageId", "_creationTime"];
        by_chat_post: ["chatId", "postId", "_creationTime"];
    }, {}, {}>;
}, true>;
export default _default;
//# sourceMappingURL=schema.d.ts.map