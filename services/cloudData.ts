import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { AccountInfo, AppSettings, Cost, Quote, Service } from '../types';

export interface WorkshopState {
  services: Service[];
  costs: Cost[];
  quotes: Quote[];
  settings: AppSettings;
}

const TRIAL_DAYS = 15;
const COLLECTION_NAMES = ['services', 'costs', 'quotes'] as const;

const legacyStateDocument = (uid: string) => doc(db, 'users', uid, 'appData', 'workshop');
const accountDocument = (uid: string) => doc(db, 'accounts', uid);
const workshopDocument = (uid: string) => doc(db, 'workshops', uid);
const workshopCollection = (uid: string, name: typeof COLLECTION_NAMES[number] | 'activity') =>
  collection(db, 'workshops', uid, name);

const sanitize = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const dateToIso = (value: unknown): string | undefined => {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as any).toDate === 'function') {
    return (value as any).toDate().toISOString();
  }
  return typeof value === 'string' ? value : undefined;
};

const writeDocumentsInChunks = async (
  items: Array<{ reference: ReturnType<typeof doc>; value?: unknown; remove?: boolean }>,
) => {
  for (let index = 0; index < items.length; index += 400) {
    const batch = writeBatch(db);
    items.slice(index, index + 400).forEach(({ reference, value, remove }) => {
      if (remove) batch.delete(reference);
      else batch.set(reference, sanitize(value), { merge: true });
    });
    await batch.commit();
  }
};

export const ensureAccount = async (uid: string, email: string) => {
  const reference = accountDocument(uid);
  if ((await getDoc(reference)).exists()) return;
  const now = Date.now();
  await setDoc(reference, {
    uid,
    email,
    plan: 'trial',
    status: 'trialing',
    trialStartedAt: serverTimestamp(),
    trialEndsAt: Timestamp.fromMillis(now + TRIAL_DAYS * 24 * 60 * 60 * 1000),
    onboardingCompleted: false,
    createdAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
    schemaVersion: 1,
  });
};

export const subscribeToAccount = (
  uid: string,
  onData: (account: AccountInfo | null) => void,
  onError: (error: Error) => void,
) => onSnapshot(accountDocument(uid), (snapshot) => {
  if (!snapshot.exists()) return onData(null);
  const data = snapshot.data();
  onData({
    uid,
    email: typeof data.email === 'string' ? data.email : '',
    plan: data.plan === 'founder' ? 'founder' : 'trial',
    status: ['trialing', 'active', 'past_due', 'suspended'].includes(data.status) ? data.status : 'trialing',
    trialStartedAt: dateToIso(data.trialStartedAt),
    trialEndsAt: dateToIso(data.trialEndsAt),
    subscriptionStartedAt: dateToIso(data.subscriptionStartedAt),
    paidThrough: dateToIso(data.paidThrough),
    graceUntil: dateToIso(data.graceUntil),
    onboardingCompleted: data.onboardingCompleted === true,
    termsAcceptedAt: dateToIso(data.termsAcceptedAt),
    privacyAcceptedAt: dateToIso(data.privacyAcceptedAt),
    lastSeenAt: dateToIso(data.lastSeenAt),
    firstServiceAt: dateToIso(data.firstServiceAt),
    createdAt: dateToIso(data.createdAt),
  });
}, onError);

export const getEffectiveAccountStatus = (account: AccountInfo | null, now = new Date()) => {
  if (!account) return 'loading' as const;
  if (account.status === 'suspended') return 'suspended' as const;
  if (account.plan === 'founder' && account.status === 'active') {
    if (account.paidThrough && new Date(account.paidThrough) >= now) return 'active' as const;
    return 'expired' as const;
  }
  if (account.status === 'trialing' && account.trialEndsAt && new Date(account.trialEndsAt) >= now) {
    return 'trialing' as const;
  }
  return 'expired' as const;
};

export const recordActivity = async (uid: string) => {
  const storageKey = `gestion_taller_activity_${uid}`;
  const lastLocalActivity = Number(localStorage.getItem(storageKey) || 0);
  if (Date.now() - lastLocalActivity < 6 * 60 * 60 * 1000) return;
  await setDoc(accountDocument(uid), { lastSeenAt: serverTimestamp() }, { merge: true });
  const day = new Date().toISOString().slice(0, 10);
  await setDoc(doc(db, 'workshops', uid, 'activity', day), { date: day, lastSeenAt: serverTimestamp() }, { merge: true });
  localStorage.setItem(storageKey, String(Date.now()));
};

export const completeOnboarding = async (uid: string) => {
  await setDoc(accountDocument(uid), {
    onboardingCompleted: true,
    termsAcceptedAt: serverTimestamp(),
    privacyAcceptedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
  }, { merge: true });
};

export const migrateWorkshopData = async (uid: string, fallback: WorkshopState) => {
  const workshopRef = workshopDocument(uid);
  if ((await getDoc(workshopRef)).exists()) return;
  const legacySnapshot = await getDoc(legacyStateDocument(uid));
  const legacy = legacySnapshot.exists() ? legacySnapshot.data() : null;
  const state: WorkshopState = legacy ? {
    services: Array.isArray(legacy.services) ? legacy.services : [],
    costs: Array.isArray(legacy.costs) ? legacy.costs : [],
    quotes: Array.isArray(legacy.quotes) ? legacy.quotes : [],
    settings: legacy.settings || fallback.settings,
  } : fallback;

  await setDoc(workshopRef, {
    ownerUid: uid,
    settings: sanitize(state.settings),
    schemaVersion: 3,
    migratedFromLegacy: legacySnapshot.exists(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeDocumentsInChunks([
    ...state.services.map((item) => ({ reference: doc(workshopCollection(uid, 'services'), item.id), value: item })),
    ...state.costs.map((item) => ({ reference: doc(workshopCollection(uid, 'costs'), item.id), value: item })),
    ...state.quotes.map((item) => ({ reference: doc(workshopCollection(uid, 'quotes'), item.id), value: item })),
  ]);
};

export const subscribeToWorkshopState = (
  uid: string,
  onData: (state: WorkshopState) => void,
  onError: (error: Error) => void,
) => {
  const current: Partial<WorkshopState> = {};
  const loaded = new Set<string>();
  const emit = () => loaded.size === 4 && onData(current as WorkshopState);
  const unsubscribers = [
    onSnapshot(workshopDocument(uid), (snapshot) => {
      current.settings = snapshot.data()?.settings as AppSettings;
      loaded.add('settings');
      emit();
    }, onError),
    ...COLLECTION_NAMES.map((name) => onSnapshot(workshopCollection(uid, name), (snapshot) => {
      const rows = snapshot.docs.map((row) => row.data());
      if (name === 'services') current.services = rows as Service[];
      if (name === 'costs') current.costs = rows as Cost[];
      if (name === 'quotes') current.quotes = rows as Quote[];
      loaded.add(name);
      emit();
    }, onError)),
  ];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
};

const byId = (items: Array<{ id: string }>) => new Map(items.map((item) => [item.id, item]));

export const syncWorkshopState = async (uid: string, state: WorkshopState, previous: WorkshopState) => {
  const writes: Array<{ reference: ReturnType<typeof doc>; value?: unknown; remove?: boolean }> = [];
  for (const [name, nextItems, previousItems] of [
    ['services', state.services, previous.services],
    ['costs', state.costs, previous.costs],
    ['quotes', state.quotes, previous.quotes],
  ] as const) {
    const next = byId(nextItems);
    const before = byId(previousItems);
    next.forEach((value, id) => {
      if (JSON.stringify(value) !== JSON.stringify(before.get(id))) writes.push({ reference: doc(workshopCollection(uid, name), id), value });
    });
    before.forEach((_value, id) => {
      if (!next.has(id)) writes.push({ reference: doc(workshopCollection(uid, name), id), remove: true });
    });
  }
  if (JSON.stringify(state.settings) !== JSON.stringify(previous.settings)) {
    await setDoc(workshopDocument(uid), { settings: sanitize(state.settings), updatedAt: serverTimestamp() }, { merge: true });
  }
  await writeDocumentsInChunks(writes);
  if (previous.services.length === 0 && state.services.length > 0) {
    await setDoc(accountDocument(uid), { firstServiceAt: serverTimestamp() }, { merge: true });
  }
};

export const deleteAllAccountData = async (uid: string) => {
  const references: Array<{ reference: ReturnType<typeof doc>; remove: true }> = [];
  for (const name of [...COLLECTION_NAMES, 'activity'] as const) {
    const snapshot = await getDocs(workshopCollection(uid, name));
    snapshot.docs.forEach((row) => references.push({ reference: row.ref, remove: true }));
  }
  await writeDocumentsInChunks(references);
  await deleteDoc(workshopDocument(uid));
  await deleteDoc(legacyStateDocument(uid));
  await deleteDoc(accountDocument(uid));
};
