import { NativeModules, Platform } from 'react-native';
import { Database } from '@nozbe/watermelondb';
import { ServiceOrder } from './models/ServiceOrder';
import { ServiceOrderPhoto } from './models/ServiceOrderPhoto';
import { schema } from './schema';
import migrations from './migrations';

// Usa LokiJS (in-memory) no web e no Expo Go (sem WMDatabaseBridge nativo).
// Builds nativas (EAS Build / expo run:ios) usam SQLite.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const useLoki = Platform.OS === 'web' || !NativeModules.WMDatabaseBridge;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const adapter = useLoki
  ? new (require('@nozbe/watermelondb/adapters/lokijs').default)({
      schema,
      useWebWorker: false,           // React Native não tem web workers
      useIncrementalIndexedDB: false, // sem IndexedDB no RN
    })
  : new (require('@nozbe/watermelondb/adapters/sqlite').default)({
      schema,
      migrations,
      jsi: false,
    });

export const database = new Database({
  adapter,
  modelClasses: [ServiceOrder, ServiceOrderPhoto],
});
