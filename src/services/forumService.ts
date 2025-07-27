
import { db, auth } from '@/config/firebase';
import type { ForumPost, ForumPostInput } from '@/lib/types';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  Timestamp,
  query,
  orderBy,
  where,
  serverTimestamp,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';

const FORUM_POSTS_COLLECTION = 'forumPosts';

const mapDocToForumPost = (docSnap: QueryDocumentSnapshot<DocumentData>): ForumPost => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    title: data.title,
    content: data.content,
    type: data.type,
    status: data.status,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
    ownerUID: data.ownerUID,
    ownerEmail: data.ownerEmail,
  } as ForumPost;
};

export const addForumPost = async (postData: ForumPostInput): Promise<string> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated. Cannot create post.");
  }

  try {
    const docRef = await addDoc(collection(db, FORUM_POSTS_COLLECTION), {
      ...postData,
      ownerUID: user.uid,
      ownerEmail: user.email,
      status: 'open', // Default status
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding forum post: ", error);
    throw error;
  }
};

export const getMyForumPosts = async (): Promise<ForumPost[]> => {
  const user = auth.currentUser;
  if (!user) {
    console.warn("[forumService] getMyForumPosts called without an authenticated user. Returning empty array.");
    return [];
  }

  try {
    const q = query(
      collection(db, FORUM_POSTS_COLLECTION),
      where('ownerUID', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(mapDocToForumPost);
  } catch (error) {
    console.error("Error fetching user's forum posts: ", error);
    throw error;
  }
};
