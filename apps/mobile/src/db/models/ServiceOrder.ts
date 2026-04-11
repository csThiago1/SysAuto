import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class ServiceOrder extends Model {
  static table = 'service_orders';

  @field('remote_id') remoteId!: string;
  @field('number') number!: number;
  @field('status') status!: string;
  @field('customer_name') customerName!: string;
  @field('vehicle_plate') vehiclePlate!: string;
  @field('vehicle_model') vehicleModel!: string;
  @field('vehicle_brand') vehicleBrand!: string;
  @field('vehicle_year') vehicleYear!: number;
  @field('vehicle_color') vehicleColor!: string;
  @field('customer_type') customerType!: string;
  @field('os_type') osType!: string;
  @field('consultant_name') consultantName!: string;
  @field('total_parts') totalParts!: number;
  @field('total_services') totalServices!: number;
  @field('created_at_remote') createdAtRemote!: number;
  @field('updated_at_remote') updatedAtRemote!: number;
  @field('synced_at') syncedAt!: number;
}
