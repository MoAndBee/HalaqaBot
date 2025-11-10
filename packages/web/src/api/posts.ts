import { createServerFn } from '@tanstack/react-start'
import { StorageService, type User } from '@halakabot/db'
import * as z from 'zod'

const storage = new StorageService()

export interface Post {
  chatId: number
  postId: number
  userCount: number
}

const postUsersSchema = z.object({
  chatId: z.number(),
  postId: z.number(),
})

const updatePositionSchema = z.object({
  chatId: z.number(),
  postId: z.number(),
  userId: z.number(),
  newPosition: z.number(),
})

/**
 * Server function to fetch all posts from the database
 * Returns an array of posts with their chat ID, post ID, and user count
 */
export const getPosts = createServerFn({ method: 'GET' }).handler(async (): Promise<Post[]> => {
  try {
    const posts = await storage.getAllPosts()
    return posts
  } catch (error) {
    console.error('Error fetching posts:', error)
    throw new Error('Failed to fetch posts')
  }
})

/**
 * Server function to fetch users for a specific post
 * Returns an ordered array of users for the given chat and post
 */
export const getPostUsers = createServerFn({ method: 'GET' })
  .inputValidator(postUsersSchema)
  .handler(async ({ data }): Promise<User[]> => {
    try {
      const users = await storage.getUserList(data.chatId, data.postId)
      return users
    } catch (error) {
      console.error('Error fetching post users:', error)
      throw new Error('Failed to fetch post users')
    }
  })

/**
 * Server function to update a user's position in a post's user list
 * Handles reordering when users are dragged and dropped
 */
export const updateUserPosition = createServerFn({ method: 'POST' })
  .inputValidator(updatePositionSchema)
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    try {
      await storage.updateUserPosition(data.chatId, data.postId, data.userId, data.newPosition)
      return { success: true }
    } catch (error) {
      console.error('Error updating user position:', error)
      throw new Error('Failed to update user position')
    }
  })
