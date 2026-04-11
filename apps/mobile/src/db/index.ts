import { Platform } from 'react-native';
import { Database } from '@nozbe/watermelondb';
import { ServiceOrder } from './models/ServiceOrder';
import { ServiceOrderPhoto } from './models/ServiceOrderPhoto';
import { schema } from './schema';
import migrations from './migrations';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const adapter =
  Platform.OS === 'web'
    ? new (require('@nozbe/watermelondb/adapters/lokijs').default)({ schema })
    : new (require('@nozbe/watermelondb/adapters/sqlite').default)({
        schema,
        migrations,
        jsi: true,
      });

export const database = new Database({
  adapter,
  modelClasses: [ServiceOrder, ServiceOrderPhoto],
});
