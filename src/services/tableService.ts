
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

const POS_ROOT_COLLECTION = 'stores'; 
const POS_SUB_COLLECTION = 'tables'; 
const FALLBACK_TABLES_COLLECTION = 'tables'; 

// This function now correctly maps the POS table document to the app's Table type.
const mapDocToTable = (docSnap: QueryDocumentSnapshot<DocumentData>): Table => {
  const data = docSnap.data();
  
  // Convert POS status (e.g., "Available") to internal status (e.g., "available")
  const posStatus = data.status || 'Available';
  let internalStatus: TableStatus = 'available';
  switch (posStatus.toLowerCase()) {
    case 'available':
      internalStatus = 'available';
      break;
    case 'occupied':
      internalStatus = 'occupied';
      break;
    case 'reserved':
      internalStatus = 'reserved';
      break;
    case 'needscleaning': // Correctly handle "NeedsCleaning"
      internalStatus = 'cleaning';
      break;
    default:
      internalStatus = 'unavailable';
  }

  return {
    id: docSnap.id,
    name: data.name || `Unnamed Table ${docSnap.id}`,
    capacity: data.capacity || 1, // Default to 1 if capacity is missing
    status: internalStatus,
    location: data.areaId || '', // Map 'areaId' from POS to 'location' in our app
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
  } as Table;
};


// This function robustly determines the correct collection reference.
const getTablesCollectionRef = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated to access tables.");
  }

  if (posDb) {
    const settings = await getRestaurantSettings();
    const posStoreId = settings.posStoreId;

    if (posStoreId) {
      const path = `${POS_ROOT_COLLECTION}/${posStoreId}/${POS_SUB_COLLECTION}`;
      console.log(`[tableService] SUCCESS: POS Store ID "${posStoreId}" found. Using POS path: "${path}"`);
      return collection(posDb as Firestore, path);
    } else {
      console.warn(`[tableService] WARNING: POS DB is connected, but no POS Store ID is set. Falling back to the main app's database.`);
    }
  } else {
     console.log("[tableService] INFO: POS database not connected. Using main app's Firestore for tables.");
  }
  
  const fallbackPath = `restaurantConfig/${user.uid}/${FALLBACK_TABLES_COLLECTION}`;
  console.log(`[tableService] Using fallback path in primary database: "${fallbackPath}"`);
  return collection(db, fallbackPath);
};


export const getTables = async (): Promise<Table[]> => {
  try {
    const tablesCollectionRef = await getTablesCollectionRef();
    const q = query(tablesCollectionRef, orderBy('name', 'asc'));
    const querySnapshot = await getDocs(q);
    console.log(`[tableService] Fetched ${querySnapshot.docs.length} documents from the collection at path: "${tablesCollectionRef.path}".`);
    return querySnapshot.docs.map(mapDocToTable);
  } catch (error) {
    console.error("Error fetching tables: ", error);
    if (posDb && (await getRestaurantSettings()).posStoreId) {
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

    const isUsingPosDb = tablesCollectionRef.firestore === posDb;
    
    const dataToSave: { [key: string]: any } = { 
      name: tableData.name,
      capacity: tableData.capacity,
      status: tableData.status,
    };
    
    if (isUsingPosDb) {
        dataToSave.areaId = tableData.location || null;
    } else {
        dataToSave.location = tableData.location || null;
        dataToSave.ownerUID = user.uid;
    }

    const docRef = await addDoc(tablesCollectionRef, {
      ...dataToSave,
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
    
    const isUsingPosDb = tablesCollectionRef.firestore === posDb;
    const dataToUpdate: { [key: string]: any } = { ...tableData };
    
    if (isUsingPosDb) {
      if ('location' in dataToUpdate) {
        dataToUpdate.areaId = dataToUpdate.location;
        delete dataToUpdate.location;
      }
    }

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
  const batch = writeBatch(tablesCollectionRef.firestore); 

  tableIds.forEach(tableId => {
    const tableRef = doc(tablesCollectionRef, tableId);
    batch.update(tableRef, { status: status, updatedAt: serverTimestamp() });
  });
  await batch.commit();
};
