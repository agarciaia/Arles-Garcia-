import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AppSettings, Cost, Quote, Service } from '../types';

export interface WorkshopState {
  services: Service[];
  costs: Cost[];
  quotes: Quote[];
  settings: AppSettings;
}

const stateDocument = (uid: string) => doc(db, 'users', uid, 'appData', 'workshop');

const sanitize = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export const subscribeToWorkshopState = (
  uid: string,
  onData: (state: WorkshopState | null) => void,
  onError: (error: Error) => void,
) => onSnapshot(
  stateDocument(uid),
  (snapshot) => {
    if (!snapshot.exists()) {
      onData(null);
      return;
    }
    const data = snapshot.data();
    onData({
      services: Array.isArray(data.services) ? data.services : [],
      costs: Array.isArray(data.costs) ? data.costs : [],
      quotes: Array.isArray(data.quotes) ? data.quotes : [],
      settings: data.settings as AppSettings,
    });
  },
  onError,
);

export const saveWorkshopState = async (uid: string, state: WorkshopState) => {
  await setDoc(stateDocument(uid), {
    ...sanitize(state),
    ownerUid: uid,
    schemaVersion: 2,
    updatedAt: serverTimestamp(),
  });
};
