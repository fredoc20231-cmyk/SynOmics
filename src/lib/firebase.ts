import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, collection, getDocs, setDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom databaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Auth
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connectivity
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or network is restricted.');
    }
  }
}

// Auth helper functions
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleAuthProvider);
    const user = result.user;
    if (user) {
      // Save or update user profile doc
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }, { merge: true });
    }
    return user;
  } catch (err) {
    console.error('Sign-in failed:', err);
    throw err;
  }
}

export async function signOutUser() {
  return fbSignOut(auth);
}

// Cloud sync helpers for Analysis Sessions
export async function saveAnalysisSessionToCloud(userId: string, session: {
  id: string;
  title: string;
  query: string;
  mode?: string;
  targetGenes?: string[];
  summary?: string;
}) {
  const sessionPath = `users/${userId}/sessions/${session.id}`;
  try {
    const sessionRef = doc(db, 'users', userId, 'sessions', session.id);
    await setDoc(sessionRef, {
      ...session,
      userId,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, sessionPath);
  }
}

export async function loadAnalysisSessionsFromCloud(userId: string) {
  const sessionsPath = `users/${userId}/sessions`;
  try {
    const sessionsRef = collection(db, 'users', userId, 'sessions');
    const snapshot = await getDocs(sessionsRef);
    return snapshot.docs.map(doc => doc.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, sessionsPath);
    return [];
  }
}

export async function deleteAnalysisSessionFromCloud(userId: string, sessionId: string) {
  const sessionPath = `users/${userId}/sessions/${sessionId}`;
  try {
    const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);
    await deleteDoc(sessionRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, sessionPath);
  }
}
