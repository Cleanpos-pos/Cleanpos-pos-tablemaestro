
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
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading image: ", error);
    // Consider more specific error handling or re-throwing
    throw new Error(`Image upload failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Deletes an image from Firebase Storage.
 * @param path The path of the image in Firebase Storage to delete.
 * @returns A promise that resolves when the image is deleted.
 */
export const deleteImageFromStorage = async (path: string): Promise<void> => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error("Error deleting image from storage: ", error);
    // If file doesn't exist, deleteObject might throw an error.
    // You might want to handle 'storage/object-not-found' specifically if needed.
    if ((error as any).code === 'storage/object-not-found') {
      console.warn(`File not found at path: ${path}, nothing to delete.`);
      return; // Not a critical error in many cases
    }
    throw new Error(`Image deletion failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};
