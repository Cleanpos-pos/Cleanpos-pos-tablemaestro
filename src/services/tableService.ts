
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
  writeBatch,
  Firestore,
} from 'firebase/firestore';

const TABLES_COLLECTION = 'tables';

const mapDocToTable = (docSnap: QueryDocumentSnapshot<DocumentData>): Table => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name || `Unnamed Table ${docSnap.id}`,
    capacity: data.capacity || 1,
    status: data.status || 'unavailable',
    location: data.location || '',
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
  } as Table;
};

const getTablesCollectionRef = () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated to access tables.");
  }
  const path = `restaurantConfig/${user.uid}/${TABLES_COLLECTION}`;
  return collection(db, path);
};

export const getTables = async (): Promise<Table[]> => {
  const user = auth.currentUser;
  if (!user) {
    console.warn("[tableService] getTables called without an authenticated user. Returning empty array.");
    return [];
  }
  
  try {
    const tablesCollectionRef = getTablesCollectionRef();
    const q = query(tablesCollectionRef, orderBy('name', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(mapDocToTable);
  } catch (error) {
    console.error("[tableService] Error getting tables:", error);
    throw new Error(`Failed to fetch tables. This may be a Firestore security rules issue. Original error: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const addTable = async (tableData: TableInput): Promise<string> => {
  const tablesCollectionRef = getTablesCollectionRef();
  const docRef = await addDoc(tablesCollectionRef, {
    ...tableData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updateTable = async (tableId: string, tableData: TableUpdateData): Promise<void> => {
  const tablesCollectionRef = getTablesCollectionRef();
  const tableRef = doc(tablesCollectionRef, tableId);
  await updateDoc(tableRef, {
    ...tableData,
    updatedAt: serverTimestamp(),
  });
};

export const deleteTable = async (tableId: string): Promise<void> => {
  const tablesCollectionRef = getTablesCollectionRef();
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
  const tablesCollectionRef = getTablesCollectionRef();
  const batch = writeBatch(db);

  tableIds.forEach(tableId => {
    const tableRef = doc(tablesCollectionRef, tableId);
    batch.update(tableRef, { status: status, updatedAt: serverTimestamp() });
  });
  await batch.commit();
};
