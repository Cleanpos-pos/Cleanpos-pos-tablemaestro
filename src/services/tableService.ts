
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
const POS_TABLES_COLLECTION = 'tables'; 
const FALLBACK_TABLES_COLLECTION = 'tables';

const mapDocToTable = (docSnap: QueryDocumentSnapshot<DocumentData>): Table => {
  const data = docSnap.data();
  
  let internalStatus: TableStatus = 'available';
  if (data.status && typeof data.status === 'string') {
    switch (data.status.toLowerCase()) {
      case 'available':
        internalStatus = 'available';
        break;
      case 'occupied':
        internalStatus = 'occupied';
        break;
      case 'reserved':
        internalStatus = 'reserved';
        break;
      case 'needscleaning': // From POS
      case 'cleaning': // From this app
        internalStatus = 'cleaning';
        break;
      default:
        internalStatus = 'unavailable';
    }
  }

  return {
    id: docSnap.id,
    name: data.name || `Unnamed Table ${docSnap.id}`,
    capacity: data.capacity || 1,
    status: internalStatus,
    location: data.areaId || data.location || '',
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
  } as Table;
};

// --- Internal Functions for clarity ---

const getPosTables = async (storeId: string): Promise<Table[]> => {
    if (!posDb) {
        throw new Error("Configuration Error: A POS Store ID is set, but the connection to the POS database (posDb) is not available. Please check your .env file and Firebase configuration.");
    }
    const path = `${POS_ROOT_COLLECTION}/${storeId}/${POS_TABLES_COLLECTION}`;
    console.log(`[tableService] getPosTables: Attempting to query POS path: "${path}"`);
    try {
        const tablesCollectionRef = collection(posDb as Firestore, path);
        const q = query(tablesCollectionRef, orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        console.log(`[tableService] getPosTables: Fetched ${querySnapshot.docs.length} tables from POS database.`);
        return querySnapshot.docs.map(mapDocToTable);
    } catch (error) {
        console.error(`[tableService] getPosTables: Error querying POS path "${path}":`, error);
        throw new Error(`Failed to fetch tables from the POS database at path '${path}'. This is likely a Firestore Security Rules issue on your POS project. Ensure the path is correct and readable. Original error: ${error instanceof Error ? error.message : String(error)}`);
    }
};

const getLocalTables = async (userId: string): Promise<Table[]> => {
    const path = `restaurantConfig/${userId}/${FALLBACK_TABLES_COLLECTION}`;
    console.log(`[tableService] getLocalTables: Using fallback path in primary database: "${path}"`);
    try {
        const tablesCollectionRef = collection(db, path);
        const q = query(tablesCollectionRef, orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        console.log(`[tableService] getLocalTables: Fetched ${querySnapshot.docs.length} tables from local database.`);
        return querySnapshot.docs.map(mapDocToTable);
    } catch (error) {
        console.error(`[tableService] getLocalTables: Error querying local path "${path}":`, error);
        throw error;
    }
};


// --- Public API ---

export const getTables = async (): Promise<Table[]> => {
  const user = auth.currentUser;
  if (!user) {
    console.warn("[tableService] getTables called without an authenticated user. Returning empty array.");
    return [];
  }
  
  const settings = await getRestaurantSettings();
  const posStoreId = settings?.posStoreId;

  if (posStoreId && posStoreId.trim() !== "") {
    console.log(`[tableService] getTables: POS Store ID "${posStoreId}" is configured. Fetching from POS database.`);
    return getPosTables(posStoreId);
  } else {
    console.log("[tableService] getTables: No POS Store ID configured. Fetching from local database.");
    return getLocalTables(user.uid);
  }
};


const getTablesCollectionRef = async () => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("User not authenticated to access tables.");
    }

    const settings = await getRestaurantSettings();
    const posStoreId = settings.posStoreId;

    if (posStoreId && posStoreId.trim() !== "") {
        if (!posDb) {
            throw new Error("Configuration Error: A POS Store ID is set, but the POS database is not connected.");
        }
        const path = `${POS_ROOT_COLLECTION}/${posStoreId}/${POS_TABLES_COLLECTION}`;
        return collection(posDb as Firestore, path);
    } else {
        const fallbackPath = `restaurantConfig/${user.uid}/${FALLBACK_TABLES_COLLECTION}`;
        return collection(db, fallbackPath);
    }
};


export const addTable = async (tableData: TableInput): Promise<string> => {
    const tablesCollectionRef = await getTablesCollectionRef();
    const isUsingPosDb = tablesCollectionRef.firestore === posDb;
    const dataToSave: { [key: string]: any } = { ...tableData };

    if(isUsingPosDb) {
        dataToSave.areaId = dataToSave.location;
        delete dataToSave.location;
        if (dataToSave.status) {
             switch(dataToSave.status) {
                case 'available': dataToSave.status = 'Available'; break;
                case 'occupied': dataToSave.status = 'Occupied'; break;
                case 'reserved': dataToSave.status = 'Reserved'; break;
                case 'cleaning': dataToSave.status = 'NeedsCleaning'; break;
                default: dataToSave.status = 'Unavailable';
            }
        }
    }

    const docRef = await addDoc(tablesCollectionRef, {
      ...dataToSave,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
};


export const updateTable = async (tableId: string, tableData: TableUpdateData): Promise<void> => {
    const tablesCollectionRef = await getTablesCollectionRef();
    const tableRef = doc(tablesCollectionRef, tableId);
    const isUsingPosDb = tablesCollectionRef.firestore === posDb;
    const dataToUpdate: { [key: string]: any } = { ...tableData };
    
    if (isUsingPosDb) {
      if ('location' in dataToUpdate) {
        dataToUpdate.areaId = dataToUpdate.location;
        delete dataToUpdate.location;
      }
      if ('status' in dataToUpdate) {
        switch(dataToUpdate.status) {
            case 'available': dataToUpdate.status = 'Available'; break;
            case 'occupied': dataToUpdate.status = 'Occupied'; break;
            case 'reserved': dataToUpdate.status = 'Reserved'; break;
            case 'cleaning': dataToUpdate.status = 'NeedsCleaning'; break;
            default: dataToUpdate.status = 'Unavailable';
        }
      }
    }

    await updateDoc(tableRef, {
      ...dataToUpdate, 
      updatedAt: serverTimestamp(),
    });
};


export const deleteTable = async (tableId: string): Promise<void> => {
    const tablesCollectionRef = await getTablesCollectionRef();
    const tableRef = doc(tablesCollectionRef, tableId);
    await deleteDoc(tableRef);
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
