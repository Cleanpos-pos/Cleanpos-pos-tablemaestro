
"use server";
import { db, auth } from '@/config/firebase';
import type { Table, TableInput, TableUpdateData, TableStatus } from '@/lib/types';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
  query,
  orderBy,
  serverTimestamp,
  DocumentData,
  QueryDocumentSnapshot,
  where,
  writeBatch
} from 'firebase/firestore';

const TABLES_COLLECTION = 'tables';

const mapDocToTable = (docSnap: QueryDocumentSnapshot<DocumentData>): Table => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name,
    capacity: data.capacity,
    status: data.status,
    location: data.location,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
  } as Table;
};

const getTablesCollectionRef = () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated to access tables.");
  }
  return collection(db, `restaurantConfig/${user.uid}/${TABLES_COLLECTION}`);
};


export const getTables = async (): Promise<Table[]> => {
  try {
    const tablesCollectionRef = getTablesCollectionRef();
    const q = query(tablesCollectionRef, orderBy('name', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(mapDocToTable);
  } catch (error) {
    console.error("Error fetching tables: ", error);
    throw error;
  }
};

export const addTable = async (tableData: TableInput): Promise<string> => {
  try {
    const tablesCollectionRef = getTablesCollectionRef();
    const user = auth.currentUser; // Re-check, though getTablesCollectionRef does it.
    if (!user) throw new Error("User not authenticated.");

    const docRef = await addDoc(tablesCollectionRef, {
      ...tableData,
      ownerUID: user.uid, // For potential cross-user queries if admin structure changes
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding table: ", error);
    throw error;
  }
};

export const updateTable = async (tableId: string, tableData: TableUpdateData): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated.");
    const tableRef = doc(db, `restaurantConfig/${user.uid}/${TABLES_COLLECTION}`, tableId);
    await updateDoc(tableRef, {
      ...tableData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating table: ", error);
    throw error;
  }
};

export const deleteTable = async (tableId: string): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated.");
    // Before deleting, we might want to ensure this table is not assigned to active bookings.
    // For now, direct delete.
    const bookingsRef = collection(db, 'bookings'); // Assuming bookings are top-level or per-user
    const q = query(bookingsRef, where("tableId", "==", tableId), where("status", "in", ["pending", "confirmed", "seated"]));
    const activeBookingsSnap = await getDocs(q);

    if (!activeBookingsSnap.empty) {
        const bookingIds = activeBookingsSnap.docs.map(d => d.id).join(", ");
        throw new Error(`Table cannot be deleted. It is assigned to active booking(s): ${bookingIds}. Please reassign or cancel these bookings first.`);
    }

    const tableRef = doc(db, `restaurantConfig/${user.uid}/${TABLES_COLLECTION}`, tableId);
    await deleteDoc(tableRef);
  } catch (error) {
    console.error("Error deleting table: ", error);
    throw error;
  }
};

export const getAvailableTablesCount = async (): Promise<number> => {
  try {
    const tables = await getTables();
    return tables.filter(table => table.status === 'available').length;
  } catch (error) {
    console.error("Error getting available tables count: ", error);
    return 0; // Fallback
  }
};

export const getOccupancyRate = async (): Promise<number> => {
  try {
    const tables = await getTables();
    if (tables.length === 0) return 0;
    const occupiedTables = tables.filter(table => table.status === 'occupied' || table.status === 'reserved').length;
    return Math.round((occupiedTables / tables.length) * 100);
  } catch (error) {
    console.error("Error calculating occupancy rate: ", error);
    return 0; // Fallback
  }
};

// Batch update table statuses - useful for initializing or bulk changes
export const batchUpdateTableStatuses = async (tableIds: string[], status: TableStatus): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated.");
  
  const batch = writeBatch(db);
  tableIds.forEach(tableId => {
    const tableRef = doc(db, `restaurantConfig/${user.uid}/${TABLES_COLLECTION}`, tableId);
    batch.update(tableRef, { status: status, updatedAt: serverTimestamp() });
  });
  await batch.commit();
};
