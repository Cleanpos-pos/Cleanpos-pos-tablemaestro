
import { storage } from '@/config/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Uploads an image file to Firebase Storage and returns its download URL.
 * @param file The image file to upload.
 * @param path The path in Firebase Storage where the image should be stored (e.g., 'restaurant/logo.png').
 * @returns A promise that resolves with the download URL of the uploaded image.
 */
export const uploadImageAndGetURL = async (file: File, path: string): Promise<string> => {
  try {
    console.log(`[storageService] Attempting to upload to path: ${path}`);
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    console.log(`[storageService] Upload successful for path: ${path}. Snapshot:`, snapshot);
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log(`[storageService] Download URL for ${path}: ${downloadURL}`);
    return downloadURL;
  } catch (error) {
    console.error(`[storageService] Error uploading image to ${path}: `, error);
    // Log the error object itself for more details in the console
    console.error("[storageService] Full error object:", error);
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

