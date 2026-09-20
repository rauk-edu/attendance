import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  getDocs,
  deleteDoc,
  addDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { DayAttendanceMap, SchoolDocument, HolidayNoticeRecord } from '../types';

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Cloud Firestore with specified Database ID
export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

// Local storage backup key prefix
const STORAGE_PREFIX = 'att_data_';

// ==========================================
// 1. ATTENDANCE MANAGEMENT (FIRESTORE)
// ==========================================

export async function saveAttendanceData(
  dateStr: string,
  data: DayAttendanceMap
): Promise<{ success: boolean; cloud: boolean; error?: string }> {
  // Always persist locally first for instant access & offline safety
  try {
    localStorage.setItem(STORAGE_PREFIX + dateStr, JSON.stringify(data));
  } catch (e) {
    console.warn('LocalStorage save warning:', e);
  }

  // Persist to Cloud Firestore
  try {
    const attendanceDocRef = doc(db, 'attendance', dateStr);
    await setDoc(
      attendanceDocRef,
      {
        date: dateStr,
        records: data,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return { success: true, cloud: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('Firestore save error (persisted locally):', errorMsg);
    return { success: true, cloud: false, error: errorMsg };
  }
}

export async function fetchAttendanceData(
  dateStr: string
): Promise<DayAttendanceMap> {
  // 1. Check local cache
  let localData: DayAttendanceMap = {};
  try {
    const cached = localStorage.getItem(STORAGE_PREFIX + dateStr);
    if (cached) {
      localData = JSON.parse(cached);
    }
  } catch (e) {
    console.warn('Local read error:', e);
  }

  // 2. Fetch from Cloud Firestore
  try {
    const attendanceDocRef = doc(db, 'attendance', dateStr);
    const snap = await getDoc(attendanceDocRef);

    if (snap.exists()) {
      const val = snap.data();
      const records = (val.records || {}) as DayAttendanceMap;
      // Sync back to local storage
      try {
        localStorage.setItem(STORAGE_PREFIX + dateStr, JSON.stringify(records));
      } catch {
        // ignore
      }
      return records;
    }
  } catch (err) {
    console.info('Using local cache for date:', dateStr, err);
  }

  return localData;
}

export function subscribeToAttendanceDate(
  dateStr: string,
  onData: (data: DayAttendanceMap) => void,
  onStatusChange?: (isLive: boolean) => void
): () => void {
  try {
    const attendanceDocRef = doc(db, 'attendance', dateStr);
    const unsubscribe = onSnapshot(
      attendanceDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.data();
          const records = (val.records || {}) as DayAttendanceMap;
          try {
            localStorage.setItem(STORAGE_PREFIX + dateStr, JSON.stringify(records));
          } catch {
            // ignore
          }
          onData(records);
        }
        onStatusChange?.(true);
      },
      (error) => {
        console.warn('Firestore subscription warning:', error);
        onStatusChange?.(false);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Firestore subscription failed:', err);
    onStatusChange?.(false);
    return () => {};
  }
}

// ==========================================
// 2. DOCUMENTS & ABSENCE RECORDS (FIRESTORE)
// ==========================================

export async function saveSchoolDocument(
  docItem: SchoolDocument
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const nowIso = new Date().toISOString();
    const payload = {
      ...docItem,
      updatedAt: nowIso,
      createdAt: docItem.createdAt || nowIso,
    };

    if (docItem.id) {
      const docRef = doc(db, 'documents', docItem.id);
      await setDoc(docRef, payload, { merge: true });
      return { success: true, id: docItem.id };
    } else {
      const colRef = collection(db, 'documents');
      const docRef = await addDoc(colRef, payload);
      return { success: true, id: docRef.id };
    }
  } catch (err: any) {
    console.error('Error saving school document to Firestore:', err);
    return { success: false, error: err.message };
  }
}

export async function fetchSchoolDocuments(): Promise<SchoolDocument[]> {
  try {
    const colRef = collection(db, 'documents');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const results: SchoolDocument[] = [];
    snap.forEach((d) => {
      results.push({ id: d.id, ...(d.data() as Omit<SchoolDocument, 'id'>) });
    });
    return results;
  } catch (err) {
    console.warn('Error fetching school documents from Firestore:', err);
    return [];
  }
}

export function subscribeToSchoolDocuments(
  onData: (docs: SchoolDocument[]) => void
): () => void {
  try {
    const colRef = collection(db, 'documents');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const results: SchoolDocument[] = [];
        snapshot.forEach((d) => {
          results.push({ id: d.id, ...(d.data() as Omit<SchoolDocument, 'id'>) });
        });
        onData(results);
      },
      (err) => {
        console.warn('Documents subscription warning:', err);
      }
    );
    return unsubscribe;
  } catch {
    return () => {};
  }
}

export async function deleteSchoolDocument(id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'documents', id));
    return true;
  } catch (err) {
    console.error('Error deleting document:', err);
    return false;
  }
}

// ==========================================
// 3. AI HOLIDAY NOTICES (FIRESTORE)
// ==========================================

export async function saveHolidayNotice(
  notice: HolidayNoticeRecord
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const payload = {
      ...notice,
      createdAt: notice.createdAt || new Date().toISOString(),
    };

    if (notice.id) {
      const docRef = doc(db, 'holiday_notices', notice.id);
      await setDoc(docRef, payload, { merge: true });
      return { success: true, id: notice.id };
    } else {
      const colRef = collection(db, 'holiday_notices');
      const docRef = await addDoc(colRef, payload);
      return { success: true, id: docRef.id };
    }
  } catch (err: any) {
    console.error('Error saving holiday notice to Firestore:', err);
    return { success: false, error: err.message };
  }
}

export function subscribeToHolidayNotices(
  onData: (notices: HolidayNoticeRecord[]) => void
): () => void {
  try {
    const colRef = collection(db, 'holiday_notices');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const results: HolidayNoticeRecord[] = [];
        snapshot.forEach((d) => {
          results.push({ id: d.id, ...(d.data() as Omit<HolidayNoticeRecord, 'id'>) });
        });
        onData(results);
      },
      (err) => {
        console.warn('Holiday notices subscription warning:', err);
      }
    );
    return unsubscribe;
  } catch {
    return () => {};
  }
}

export async function deleteHolidayNotice(id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'holiday_notices', id));
    return true;
  } catch (err) {
    console.error('Error deleting holiday notice:', err);
    return false;
  }
}

// ==========================================
// 4. AUTOMATIC MIGRATION FROM LOCALSTORAGE / RTDB
// ==========================================

export async function migrateCachedDataToFirestore(): Promise<number> {
  let migratedCount = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const dateStr = key.replace(STORAGE_PREFIX, '');
        // Validate date format YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const data = JSON.parse(raw);
              if (Object.keys(data).length > 0) {
                const docRef = doc(db, 'attendance', dateStr);
                await setDoc(
                  docRef,
                  {
                    date: dateStr,
                    records: data,
                    migratedFromCache: true,
                    updatedAt: new Date().toISOString(),
                  },
                  { merge: true }
                );
                migratedCount++;
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Migration check completed with notice:', e);
  }
  return migratedCount;
}
