
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
    location: data.location, // Firestore returns null or the value, not undefined for missing fields
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
    x: data.x,
    y: data.y,
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
    const user = auth.currentUser; 
    if (!user) throw new Error("User not authenticated.");

    const dataToSave: { [key: string]: any } = { ...tableData };
    // Remove undefined fields, Firestore doesn't support them.
    Object.keys(dataToSave).forEach(key => {
      if (dataToSave[key] === undefined) {
        delete dataToSave[key];
      }
    });

    const docRef = await addDoc(tablesCollectionRef, {
      ...dataToSave,
      ownerUID: user.uid, 
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
    
    const dataToUpdate: { [key: string]: any } = { ...tableData };
    // Remove undefined fields for update as well
    Object.keys(dataToUpdate).forEach(key => {
      if (dataToUpdate[key] === undefined) {
        delete dataToUpdate[key];
      }
    });

    await updateDoc(tableRef, {
      ...dataToUpdate, 
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
    
    const bookingsCollectionPath = `restaurantConfig/${user.uid}/bookings`; // Assuming bookings are per-user
    const bookingsRef = collection(db, bookingsCollectionPath);
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
    return 0; 
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
    return 0; 
  }
};

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


export const batchUpdateTableLayout = async (tables: Pick<Table, 'id' | 'x' | 'y'>[]): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated.");

  const batch = writeBatch(db);
  tables.forEach(table => {
    if (typeof table.x === 'number' && typeof table.y === 'number') {
      const tableRef = doc(db, `restaurantConfig/${user.uid}/${TABLES_COLLECTION}`, table.id);
      batch.update(tableRef, { x: table.x, y: table.y, updatedAt: serverTimestamp() });
    }
  });
  await batch.commit();
};
