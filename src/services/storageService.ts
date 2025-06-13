
import { storage, auth } from '@/config/firebase'; // Ensure auth is imported
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Uploads an image file to Firebase Storage and returns its download URL.
 * @param file The image file to upload.
 * @param path The path in Firebase Storage where the image should be stored (e.g., 'restaurant/USER_UID/logo.png').
 * @returns A promise that resolves with the download URL of the uploaded image.
 */
export const uploadImageAndGetURL = async (file: File, path: string): Promise<string> => {
  const currentUser = auth.currentUser; // Get current user AT THE TIME OF THE CALL
  
  console.log(`[storageService] Attempting upload for path: "${path}"`);
  if (currentUser) {
    console.log(`[storageService] Authenticated user UID at time of upload attempt: ${currentUser.uid}`);
    // Extract the userId from the path to compare, assuming path format "restaurant/actual_userId/filename"
    const pathParts = path.split('/');
    if (pathParts.length >= 2 && pathParts[0] === 'restaurant') {
      const userIdInPath = pathParts[1];
      console.log(`[storageService] User ID extracted from path: ${userIdInPath}`);
      if (currentUser.uid === userIdInPath) {
        console.log('[storageService] Path user ID matches authenticated user UID. Rule check should pass if user is authenticated.');
      } else {
        console.warn('[storageService] MISMATCH! Path user ID does NOT match authenticated user UID. Storage rule will likely fail.');
        console.warn(`[storageService] Auth UID: ${currentUser.uid}, Path UID: ${userIdInPath}`);
      }
    }
  } else {
    console.warn('[storageService] CRITICAL: No authenticated user found (auth.currentUser is null) at time of upload attempt! Storage rules requiring auth will fail.');
  }

  try {
    const storageRef = ref(storage, path);
    console.log('[storageService] storageRef created. Calling uploadBytes...');
    const snapshot = await uploadBytes(storageRef, file);
    console.log(`[storageService] Upload successful for path: ${path}. Snapshot:`, snapshot);
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log(`[storageService] Download URL for ${path}: ${downloadURL}`);
    return downloadURL;
  } catch (error) {
    console.error(`[storageService] Error during Firebase Storage operation for path "${path}":`, error);
    
    let detailedErrorMessage = `Image upload failed for ${path}.`;
    if (error instanceof Error) {
        detailedErrorMessage += ` Message: ${error.message}.`;
        const firebaseError = error as any; 
        if (firebaseError.code) {
             detailedErrorMessage += ` Firebase Code: ${firebaseError.code}.`;
             console.error(`[storageService] Firebase error code: ${firebaseError.code}`);
             if (firebaseError.code === 'storage/unauthorized') {
                detailedErrorMessage += ' Unauthorized: Verify Firebase Storage security rules and ensure the user is authenticated and authorized for this path.';
                console.error('[storageService] Unauthorized: Verify Firebase Storage security rules and user authentication status. Ensure the path (and UID within it) matches rule conditions.');
             } else if (firebaseError.code === 'storage/object-not-found') {
                detailedErrorMessage += ' Object not found: The file path might be incorrect or the object does not exist (relevant for getDownloadURL or deleteObject).';
                console.error('[storageService] Object not found: The file path might be incorrect or the object does not exist.');
             } else if (firebaseError.code === 'storage/retry-limit-exceeded') {
                detailedErrorMessage += ' Retry limit exceeded: Network issue or Firebase server issue. Try again later.';
                console.error('[storageService] Retry limit exceeded: Network issue or Firebase server issue. Try again later.');
             }
        }
         // Log the full error object for more details in console
        console.error("[storageService] Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } else {
        detailedErrorMessage += ` Unknown error: ${String(error)}.`;
    }
    throw new Error(detailedErrorMessage);
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

