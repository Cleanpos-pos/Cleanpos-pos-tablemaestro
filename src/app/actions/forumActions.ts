
'use server';

import type { ForumPostInput, ForumPost } from "@/lib/types";
import { addForumPost, getMyForumPosts } from "@/services/forumService";
import { auth } from "@/config/firebase-admin"; // Using admin SDK for user info if needed on backend
import { revalidatePath } from "next/cache";

interface ActionResult {
  success: boolean;
  message: string;
}

// This action runs on the server, so it's secure
export async function createForumPostAction(
  postData: ForumPostInput
): Promise<ActionResult> {
  try {
    // The service layer will handle getting the currently authenticated user
    // from the client-side auth state. No need to pass UID from here.
    const newPostId = await addForumPost(postData);
    
    // Revalidate the forum page to show the new post
    revalidatePath('/admin/forum');

    return { success: true, message: `Post created with ID: ${newPostId}` };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    console.error("[createForumPostAction] Error:", error);
    return { success: false, message: errorMessage };
  }
}

export async function getMyForumPostsAction(): Promise<ForumPost[]> {
    try {
        // The service function already handles the logic of getting posts for the current user
        const posts = await getMyForumPosts();
        return posts;
    } catch (error) {
        console.error("[getMyForumPostsAction] Error:", error);
        // In a real app, you might want more robust error handling,
        // but for now, we'll return an empty array on failure.
        return [];
    }
}
