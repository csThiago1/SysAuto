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
  ],
});
