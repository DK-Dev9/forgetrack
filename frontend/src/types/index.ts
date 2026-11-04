export type UserRole = 
  | 'ADMIN' 
  | 'PRODUCTION_MANAGER' 
  | 'STOREKEEPER' 
  | 'OPERATOR' 
  | 'VIEWER';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  employee_code?: string;
  department?: string;
  phone_number?: string;
  is_active: boolean;
  organization?: Organization;
  assigned_orders_count?: number;
  last_login?: string;
  created_at: string;
}

export type ItemType = 'RAW_MATERIAL' | 'COMPONENT' | 'FINISHED_GOOD' | 'CONSUMABLE';

export type TransactionType =
  | 'RECEIPT'
  | 'RESERVATION'
  | 'RESERVATION_RELEASE'
  | 'MATERIAL_ISSUE'
  | 'MATERIAL_RETURN'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'POSITIVE_ADJUSTMENT'
  | 'NEGATIVE_ADJUSTMENT'
  | 'PRODUCTION_CONSUMPTION'
  | 'FINISHED_GOODS_RECEIPT';

export interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location?: string;
  is_active: boolean;
}

export interface Item {
  id: string;
  code: string;
  name: string;
  description: string;
  item_type: ItemType;
  base_uom: string;
  base_uom_details?: UnitOfMeasure;
  unit_cost: string;
  reorder_level: string;
  total_on_hand: string;
  total_available: string;
  is_low_stock: boolean;
  is_active: boolean;
  created_at: string;
}

export interface StockBalance {
  id: string;
  item: string;
  item_code: string;
  item_name: string;
  item_type: ItemType;
  uom_code: string;
  warehouse: string;
  warehouse_code: string;
  warehouse_name: string;
  on_hand: string;
  reserved: string;
  available: string;
  issued_to_production: string;
  is_low_stock: boolean;
  updated_at: string;
}

export interface InventoryLedgerTransaction {
  id: string;
  item: string;
  item_code: string;
  item_name: string;
  uom_code: string;
  warehouse: string;
  warehouse_code: string;
  warehouse_name: string;
  transaction_type: TransactionType;
  quantity: string;
  unit_cost: string;
  total_cost: string;
  balance_after: string;
  reference_number: string;
  source_document_type: string;
  performed_by_name?: string;
  notes: string;
  created_at: string;
}

export interface ReconciliationItem {
  item_id: string;
  item_code: string;
  item_name: string;
  warehouse_id: string;
  warehouse_code: string;
  cached_on_hand: string;
  ledger_calculated_on_hand: string;
  discrepancy: string;
  reconciled: boolean;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  unit_of_measure: string;
  unit_of_measure_details?: UnitOfMeasure;
  linked_item?: string;
  active_bom_version?: string;
  is_active: boolean;
  created_at: string;
}

export interface BOMComponent {
  id?: string;
  item: string;
  item_code?: string;
  item_name?: string;
  quantity: string;
  unit_of_measure: string;
  uom_code?: string;
  scrap_allowance_percent: string;
  unit_cost?: string;
  notes?: string;
}

export interface BillOfMaterials {
  id: string;
  product: string;
  product_code: string;
  product_name: string;
  version: string;
  status: 'DRAFT' | 'RELEASED' | 'ARCHIVED';
  notes: string;
  components: BOMComponent[];
  created_by_name?: string;
  created_at: string;
}

export type OrderStatus = 
  | 'DRAFT' 
  | 'PLANNED' 
  | 'RELEASED' 
  | 'IN_PROGRESS' 
  | 'ON_HOLD' 
  | 'COMPLETED' 
  | 'CLOSED' 
  | 'CANCELLED';

export type OrderPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ProductionOrderComponent {
  id: string;
  item: string;
  item_code: string;
  item_name: string;
  unit_of_measure: string;
  uom_code: string;
  planned_quantity: string;
  issued_quantity: string;
  consumed_quantity: string;
  returned_quantity: string;
  scrap_quantity: string;
  unit_cost_snapshot: string;
  variance_quantity: string;
  variance_percentage: string;
  planned_cost: string;
  actual_cost: string;
}

export interface ProductionOrderAssignment {
  id: string;
  user: string;
  user_details?: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
  };
  assigned_by_name?: string;
  is_primary: boolean;
  is_active: boolean;
  assigned_at: string;
  notes?: string;
}

export interface ProductionConsumptionReport {
  id: string;
  component: string;
  component_item_code: string;
  component_item_name: string;
  uom_code: string;
  operator_name?: string;
  quantity_consumed: string;
  scrap_quantity: string;
  notes: string;
  created_at: string;
}

export interface ProductionOutputReport {
  id: string;
  operator_name?: string;
  good_quantity: string;
  rejected_quantity: string;
  notes: string;
  created_at: string;
}

export interface ProductionOrder {
  id: string;
  order_number: string;
  product: string;
  product_code: string;
  product_name: string;
  uom_code: string;
  planned_quantity: string;
  completed_good_quantity: string;
  completed_rejected_quantity: string;
  completion_percentage: string;
  status: OrderStatus;
  priority: OrderPriority;
  bom?: string;
  bom_snapshot_version?: string;
  warehouse?: string;
  warehouse_name?: string;
  planned_start_date?: string;
  due_date?: string;
  actual_start_time?: string;
  actual_end_time?: string;
  creator_name?: string;
  primary_assignee?: string;
  primary_assignee_name?: string;
  notes?: string;
  total_actual_material_cost?: string;
  actual_cost_per_good_unit?: string;
  assignments?: ProductionOrderAssignment[];
  components?: ProductionOrderComponent[];
  consumption_reports?: ProductionConsumptionReport[];
  output_reports?: ProductionOutputReport[];
  created_at: string;
}

export interface DashboardSummary {
  role: UserRole;
  organization_name: string;
  metrics: Record<string, number>;
  alerts: Array<{
    id: string;
    code: string;
    name: string;
    available: string;
    reorder_level: string;
    uom: string;
  }>;
  status_breakdown?: Record<string, number>;
  recent_orders: Array<{
    id: string;
    order_number: string;
    product_name: string;
    product_code: string;
    planned_quantity: string;
    completed_good_quantity: string;
    completion_percentage: string;
    status: OrderStatus;
    priority: OrderPriority;
    due_date?: string;
    primary_assignee?: string;
    cost_per_good_unit?: string;
  }>;
}

export interface MaterialVarianceRow {
  order_id: string;
  order_number: string;
  order_status: OrderStatus;
  product_name: string;
  product_code: string;
  item_id: string;
  item_code: string;
  item_name: string;
  uom: string;
  planned_quantity: string;
  issued_quantity: string;
  consumed_quantity: string;
  returned_quantity: string;
  scrap_quantity: string;
  variance_quantity: string;
  variance_percentage: string;
  unit_cost_snapshot?: string;
  planned_cost?: string;
  actual_cost?: string;
  cost_variance?: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_name?: string;
  actor_email?: string;
  description: string;
  before_state?: Record<string, any>;
  after_state?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}
