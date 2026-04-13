import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'service_order_photos',
          columns: [
            { name: 'slot', type: 'string', isOptional: true },
            { name: 'checklist_type', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'service_orders',
          columns: [{ name: 'push_status', type: 'string', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: 'service_orders',
          columns: [
            { name: 'insurer_id', type: 'string', isOptional: true },
            { name: 'insured_type', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
