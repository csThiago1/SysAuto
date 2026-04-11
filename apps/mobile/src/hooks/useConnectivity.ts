import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useSyncStore } from '@/stores/sync.store';

export function useConnectivity(): boolean {
  const { isOnline, setIsOnline } = useSyncStore();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });
    return unsubscribe;
  }, [setIsOnline]);

  return isOnline;
}
