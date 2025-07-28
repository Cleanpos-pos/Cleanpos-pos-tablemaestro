

import { db, auth, posDb } from '@/config/firebase';
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
  writeBatch,
  Firestore,
} from 'firebase/firestore';
import { getRestaurantSettings } from './settingsService';

const TABLES_COLLECTION = 'tables';
const RESTAURANTS_COLLECTION_POS = 'restaurants'; // Collection name in the POS database

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


const getTablesCollectionRef = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated to access tables.");
  }

  if (posDb) {
    console.log("[tableService] POS Firestore database is connected.");
    const settings = await getRestaurantSettings();
    const posUserId = settings.posUserId;

    if (posUserId) {
      // Path for multi-tenant POS system: /restaurants/{posUserId}/tables
      const path = `${RESTAURANTS_COLLECTION_POS}/${posUserId}/${TABLES_COLLECTION}`;
      console.log(`[tableService] Using multi-tenant POS path: ${path}`);
      return collection(posDb as Firestore, path);
    } else {
      console.warn("[tableService] POS DB is connected, but no POS User ID is set in settings. Falling back to simple 'tables' collection in POS DB.");
      // Fallback for single-tenant POS or if linking is not set up
      return collection(posDb as Firestore, TABLES_COLLECTION);
    }
  }
  
  console.log("[tableService] POS database not connected. Falling back to main app's Firestore for tables.");
  return collection(db, `restaurantConfig/${user.uid}/${TABLES_COLLECTION}`);
};


export const getTables = async (): Promise<Table[]> => {
  try {
    const tablesCollectionRef = await getTablesCollectionRef();
    const q = query(tablesCollectionRef, orderBy('name', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(mapDocToTable);
  } catch (error) {
    console.error("Error fetching tables: ", error);
    if (posDb) {
        throw new Error(`Failed to fetch tables from the connected POS database. Check Firestore rules and collection path. Original error: ${error instanceof Error ? error.message : String(error)}`);
    }
    throw error;
  }
};

export const addTable = async (tableData: TableInput): Promise<string> => {
  try {
    const tablesCollectionRef = await getTablesCollectionRef();
    const user = auth.currentUser; 
    if (!user) throw new Error("User not authenticated.");

    const dataToSave: { [key: string]: any } = { ...tableData };
    Object.keys(dataToSave).forEach(key => {
      if (dataToSave[key] === undefined) {
        delete dataToSave[key];
      }
    });

    const finalData = { ...dataToSave };
    // We don't add ownerUID when writing to a shared POS database
    if (!posDb) {
        finalData.ownerUID = user.uid;
    }

    const docRef = await addDoc(tablesCollectionRef, {
      ...finalData,
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
    const tablesCollectionRef = await getTablesCollectionRef();
    const tableRef = doc(tablesCollectionRef, tableId);
    
    const dataToUpdate: { [key: string]: any } = { ...tableData };
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
    const tablesCollectionRef = await getTablesCollectionRef();
    const tableRef = doc(tablesCollectionRef, tableId);
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
  const tablesCollectionRef = await getTablesCollectionRef();
  const batch = writeBatch(posDb || db); 

  tableIds.forEach(tableId => {
    const tableRef = doc(tablesCollectionRef, tableId);
    batch.update(tableRef, { status: status, updatedAt: serverTimestamp() });
  });
  await batch.commit();
};
