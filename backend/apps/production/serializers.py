from decimal import Decimal
from rest_framework import serializers
from .models import (
    ProductionOrder,
    OrderStatus,
    OrderPriority,
    ProductionOrderAssignment,
    ProductionOrderComponent,
    ProductionConsumptionReport,
    ProductionOutputReport,
)
from apps.products.models import Product, BillOfMaterials
from apps.inventory.models import Warehouse, Item, UnitOfMeasure
from apps.users.serializers import UserSummarySerializer

class ProductionOrderAssignmentSerializer(serializers.ModelSerializer):
    user_details = UserSummarySerializer(source='user', read_only=True)
    assigned_by_name = serializers.CharField(source='assigned_by.full_name', read_only=True)

    class Meta:
        model = ProductionOrderAssignment
        fields = [
            'id',
            'user',
            'user_details',
            'assigned_by',
            'assigned_by_name',
            'is_primary',
            'is_active',
            'assigned_at',
            'removed_at',
            'notes',
        ]
        read_only_fields = ['id', 'assigned_at', 'removed_at']


class ProductionOrderComponentSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source='item.code', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    uom_code = serializers.CharField(source='unit_of_measure.code', read_only=True)
    variance_quantity = serializers.DecimalField(max_digits=14, decimal_places=4, read_only=True)
    variance_percentage = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)
    actual_cost = serializers.DecimalField(max_digits=16, decimal_places=4, read_only=True)
    planned_cost = serializers.DecimalField(max_digits=16, decimal_places=4, read_only=True)

    class Meta:
        model = ProductionOrderComponent
        fields = [
            'id',
            'item',
            'item_code',
            'item_name',
            'unit_of_measure',
            'uom_code',
            'planned_quantity',
            'issued_quantity',
            'consumed_quantity',
            'returned_quantity',
            'scrap_quantity',
            'unit_cost_snapshot',
            'variance_quantity',
            'variance_percentage',
            'planned_cost',
            'actual_cost',
        ]


class ProductionConsumptionReportSerializer(serializers.ModelSerializer):
    component_item_code = serializers.CharField(source='component.item.code', read_only=True)
    component_item_name = serializers.CharField(source='component.item.name', read_only=True)
    uom_code = serializers.CharField(source='component.unit_of_measure.code', read_only=True)
    operator_name = serializers.CharField(source='operator.full_name', read_only=True)

    class Meta:
        model = ProductionConsumptionReport
        fields = [
            'id',
            'component',
            'component_item_code',
            'component_item_name',
            'uom_code',
            'operator',
            'operator_name',
            'quantity_consumed',
            'scrap_quantity',
            'notes',
            'created_at',
        ]


class ProductionOutputReportSerializer(serializers.ModelSerializer):
    operator_name = serializers.CharField(source='operator.full_name', read_only=True)

    class Meta:
        model = ProductionOutputReport
        fields = [
            'id',
            'operator',
            'operator_name',
            'good_quantity',
            'rejected_quantity',
            'notes',
            'created_at',
        ]


class ProductionOrderListSerializer(serializers.ModelSerializer):
    product_code = serializers.CharField(source='product.code', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    uom_code = serializers.CharField(source='product.unit_of_measure.code', read_only=True)
    primary_assignee_name = serializers.CharField(source='primary_assignee.full_name', read_only=True)
    completion_percentage = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)

    class Meta:
        model = ProductionOrder
        fields = [
            'id',
            'order_number',
            'product',
            'product_code',
            'product_name',
            'uom_code',
            'planned_quantity',
            'completed_good_quantity',
            'completed_rejected_quantity',
            'completion_percentage',
            'status',
            'priority',
            'primary_assignee',
            'primary_assignee_name',
            'planned_start_date',
            'due_date',
            'created_at',
        ]


class ProductionOrderDetailSerializer(serializers.ModelSerializer):
    product_code = serializers.CharField(source='product.code', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    uom_code = serializers.CharField(source='product.unit_of_measure.code', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    creator_name = serializers.CharField(source='creator.full_name', read_only=True)
    primary_assignee_name = serializers.CharField(source='primary_assignee.full_name', read_only=True)
    completion_percentage = serializers.DecimalField(max_digits=8, decimal_places=2, read_only=True)
    total_actual_material_cost = serializers.DecimalField(max_digits=16, decimal_places=4, read_only=True)
    actual_cost_per_good_unit = serializers.DecimalField(max_digits=16, decimal_places=4, read_only=True)
    
    assignments = serializers.SerializerMethodField()
    components = ProductionOrderComponentSerializer(source='order_components', many=True, read_only=True)
    consumption_reports = ProductionConsumptionReportSerializer(many=True, read_only=True)
    output_reports = ProductionOutputReportSerializer(many=True, read_only=True)

    class Meta:
        model = ProductionOrder
        fields = [
            'id',
            'order_number',
            'product',
            'product_code',
            'product_name',
            'uom_code',
            'planned_quantity',
            'completed_good_quantity',
            'completed_rejected_quantity',
            'completion_percentage',
            'status',
            'priority',
            'bom',
            'bom_snapshot_version',
            'warehouse',
            'warehouse_name',
            'planned_start_date',
            'due_date',
            'actual_start_time',
            'actual_end_time',
            'creator',
            'creator_name',
            'primary_assignee',
            'primary_assignee_name',
            'notes',
            'total_actual_material_cost',
            'actual_cost_per_good_unit',
            'assignments',
            'components',
            'consumption_reports',
            'output_reports',
            'created_at',
            'updated_at',
        ]

    def get_assignments(self, obj):
        active_assignments = obj.assignments.filter(is_active=True).select_related('user', 'assigned_by')
        return ProductionOrderAssignmentSerializer(active_assignments, many=True).data


class ProductionOrderCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionOrder
        fields = [
            'product',
            'planned_quantity',
            'bom',
            'warehouse',
            'priority',
            'planned_start_date',
            'due_date',
            'notes',
        ]

    def create(self, validated_data):
        user = self.context['request'].user
        org = user.organization

        # Generate unique order number within org (e.g. PO-2026-0001)
        count = ProductionOrder.objects.filter(organization=org).count() + 1
        order_number = f"PO-{count:04d}"
        while ProductionOrder.objects.filter(organization=org, order_number=order_number).exists():
            count += 1
            order_number = f"PO-{count:04d}"

        # If BOM is not provided, pick the latest RELEASED BOM for this product
        product = validated_data['product']
        bom = validated_data.get('bom')
        if not bom:
            bom = product.boms.filter(status='RELEASED').first()
            if not bom:
                # pick any draft if available
                bom = product.boms.first()
            validated_data['bom'] = bom

        order = ProductionOrder.objects.create(
            organization=org,
            creator=user,
            order_number=order_number,
            status=OrderStatus.DRAFT,
            **validated_data
        )

        return order
