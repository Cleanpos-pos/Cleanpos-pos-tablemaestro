

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

const mapDocToTable = (docSnap: QueryDocumentSnapshot<DocumentData>): Table => {
  const data = docSnap.data();
  console.log(`[tableService][mapDocToTable] Processing document ID: ${docSnap.id}. Raw data from POS DB:`, JSON.stringify(data));
  
  // Convert POS status (e.g., "Available") to internal status (e.g., "available")
  const posStatus = data.status || 'available';
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
    case 'needscleaning':
      internalStatus = 'cleaning';
      break;
    default:
      // Fallback for any other statuses from POS we don't handle explicitly yet
      internalStatus = 'unavailable';
  }


  return {
    id: docSnap.id,
    name: data.name || `Unnamed Table ${docSnap.id}`,
    capacity: data.capacity || 1, 
    status: internalStatus,
    location: data.areaId || '', // Map 'areaId' from POS to 'location' in our app
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
    console.log("[tableService] POS Firestore database is available. Checking settings for POS Store ID...");
    
    const settings = await getRestaurantSettings();
    const posStoreId = settings.posStoreId;

    if (posStoreId) {
      const path = `${POS_ROOT_COLLECTION}/${posStoreId}/${POS_SUB_COLLECTION}`;
      console.log(`[tableService] SUCCESS: POS Store ID "${posStoreId}" found in settings. Using multi-tenant POS path: "${path}"`);
      return collection(posDb as Firestore, path);
    } else {
      console.warn(`[tableService] WARNING: POS DB is connected, but no POS Store ID is set in the latest settings. Falling back to the main app's database. Please go to the Settings page and enter your POS Store ID.`);
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

    const dataToSave: { [key: string]: any } = { 
      name: tableData.name,
      capacity: tableData.capacity,
      status: tableData.status,
      areaId: tableData.location || undefined, // map our location back to areaId for POS
    };
    Object.keys(dataToSave).forEach(key => {
      if (dataToSave[key] === undefined) {
        delete dataToSave[key];
      }
    });

    const finalData = { ...dataToSave };
    if (!posDb) {
        finalData.ownerUID = user.uid;
        delete finalData.areaId; // Don't save areaId to fallback DB
        finalData.location = tableData.location; // Save location to fallback DB
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
    
    if (posDb) {
      if ('location' in dataToUpdate) {
        dataToUpdate.areaId = dataToUpdate.location;
        delete dataToUpdate.location;
      }
    }

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

