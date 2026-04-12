import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class ServiceOrderPhoto extends Model {
  static table = 'service_order_photos';

  @field('remote_id') remoteId!: string;
  @field('service_order_id') serviceOrderId!: string;
  @field('folder') folder!: string;
  @field('url') url!: string;
  @field('local_uri') localUri!: string;
  @field('upload_status') uploadStatus!: string;
  @field('created_at_remote') createdAtRemote!: number;
  @field('slot') slot!: string | null;
  @field('checklist_type') checklistType!: string | null;
}
