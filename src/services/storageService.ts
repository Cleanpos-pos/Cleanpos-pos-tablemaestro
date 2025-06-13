
import { storage, auth } from '@/config/firebase'; // Ensure auth is imported
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Uploads an image file to Firebase Storage and returns its download URL.
 * @param file The image file to upload.
 * @param path The path in Firebase Storage where the image should be stored (e.g., 'restaurant/logo.png').
 * @returns A promise that resolves with the download URL of the uploaded image.
 */
export const uploadImageAndGetURL = async (file: File, path: string): Promise<string> => {
  try {
    const currentUser = auth.currentUser; // Get current user AT THE TIME OF THE CALL
    console.log(`[storageService] Attempting to upload to path: ${path}`);

    if (currentUser) {
      console.log(`[storageService] Current auth user UID (at time of upload): ${currentUser.uid}`);
    } else {
      console.warn('[storageService] No authenticated user found at time of upload attempt! This will likely cause security rule denial and CORS error.');
    }

    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    console.log(`[storageService] Upload successful for path: ${path}. Snapshot:`, snapshot);
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log(`[storageService] Download URL for ${path}: ${downloadURL}`);
    return downloadURL;
  } catch (error) {
    console.error(`[storageService] Error uploading image to ${path}: `, error);
    console.error("[storageService] Full error object:", error);

    if (error instanceof Error) {
        const firebaseError = error as any; 
        if (firebaseError.code) {
             console.error(`[storageService] Firebase error code: ${firebaseError.code}`);
             if (firebaseError.code === 'storage/unauthorized') {
                console.error('[storageService] Unauthorized: Verify Firebase Storage security rules and user authentication status. Ensure the path matches rule conditions.');
             } else if (firebaseError.code === 'storage/object-not-found') {
                console.error('[storageService] Object not found: The file path might be incorrect or the object does not exist.');
             } else if (firebaseError.code === 'storage/retry-limit-exceeded') {
                console.error('[storageService] Retry limit exceeded: Network issue or Firebase server issue. Try again later.');
             }
        }
    }
    throw new Error(`Image upload failed for ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Deletes an image from Firebase Storage.
 * @param path The path of the image in Firebase Storage to delete.
 * @returns A promise that resolves when the image is deleted.
 */
export const deleteImageFromStorage = async (path: string): Promise<void> => {
  try {
    console.log(`[storageService] Attempting to delete image from path: ${path}`);
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    console.log(`[storageService] Image deleted successfully from path: ${path}`);
  } catch (error) {
    console.error(`[storageService] Error deleting image from storage path ${path}: `, error);
    if ((error as any).code === 'storage/object-not-found') {
      console.warn(`[storageService] File not found at path: ${path}, nothing to delete.`);
      return;
    }
    throw new Error(`Image deletion failed for ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
};
