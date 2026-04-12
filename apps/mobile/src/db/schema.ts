import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'service_orders',
      columns: [
        { name: 'remote_id', type: 'string', isIndexed: true },
        { name: 'number', type: 'number' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'customer_name', type: 'string' },
        { name: 'vehicle_plate', type: 'string', isIndexed: true },
        { name: 'vehicle_model', type: 'string' },
        { name: 'vehicle_brand', type: 'string' },
        { name: 'vehicle_year', type: 'number', isOptional: true },
        { name: 'vehicle_color', type: 'string', isOptional: true },
        { name: 'customer_type', type: 'string' },
        { name: 'os_type', type: 'string' },
        { name: 'consultant_name', type: 'string', isOptional: true },
        { name: 'total_parts', type: 'number' },
        { name: 'total_services', type: 'number' },
        { name: 'created_at_remote', type: 'number' },
        { name: 'updated_at_remote', type: 'number' },
        { name: 'synced_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'service_order_photos',
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'service_order_id', type: 'string', isIndexed: true },
        { name: 'folder', type: 'string' },
        { name: 'url', type: 'string' },
        { name: 'local_uri', type: 'string', isOptional: true },
        { name: 'upload_status', type: 'string' },
        { name: 'created_at_remote', type: 'number', isOptional: true },
        { name: 'slot', type: 'string', isOptional: true },
        { name: 'checklist_type', type: 'string', isOptional: true },
      ],
    }),
  ],
});
