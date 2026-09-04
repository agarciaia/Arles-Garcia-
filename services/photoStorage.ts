import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';

export const uploadServicePhoto = async (uid: string, serviceId: string, blob: Blob): Promise<string> => {
  const photoRef = ref(storage, `users/${uid}/services/${serviceId}/${crypto.randomUUID()}.jpg`);
  await uploadBytes(photoRef, blob, {
    contentType: 'image/jpeg',
    cacheControl: 'private,max-age=3600',
  });
  return getDownloadURL(photoRef);
};

export const deleteServicePhoto = async (photoUrl: string): Promise<void> => {
  if (!photoUrl.startsWith('https://firebasestorage.googleapis.com/')) return;
  await deleteObject(ref(storage, photoUrl));
};
