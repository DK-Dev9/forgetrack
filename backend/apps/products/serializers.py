from decimal import Decimal
from rest_framework import serializers
from .models import Product, BillOfMaterials, BOMComponent, BOMStatus
from apps.inventory.serializers import UnitOfMeasureSerializer, ItemSerializer
from apps.inventory.models import Item, UnitOfMeasure

class ProductSerializer(serializers.ModelSerializer):
    unit_of_measure_details = UnitOfMeasureSerializer(source='unit_of_measure', read_only=True)
    active_bom_version = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id',
            'code',
            'name',
            'description',
            'unit_of_measure',
            'unit_of_measure_details',
            'linked_item',
            'active_bom_version',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_active_bom_version(self, obj) -> str | None:
        bom = obj.boms.filter(status=BOMStatus.RELEASED).first()
        return bom.version if bom else None

    def create(self, validated_data):
        user = self.context['request'].user
        return Product.objects.create(organization=user.organization, **validated_data)


class BOMComponentSerializer(serializers.ModelSerializer):
    item_code = serializers.CharField(source='item.code', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    unit_cost = serializers.DecimalField(source='item.unit_cost', max_digits=14, decimal_places=4, read_only=True)
    uom_code = serializers.CharField(source='unit_of_measure.code', read_only=True)

    class Meta:
        model = BOMComponent
        fields = [
            'id',
            'item',
            'item_code',
            'item_name',
            'quantity',
            'unit_of_measure',
            'uom_code',
            'scrap_allowance_percent',
            'unit_cost',
            'notes',
        ]
        read_only_fields = ['id']


class BillOfMaterialsSerializer(serializers.ModelSerializer):
    product_code = serializers.CharField(source='product.code', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    components = BOMComponentSerializer(many=True, required=False)

    class Meta:
        model = BillOfMaterials
        fields = [
            'id',
            'product',
            'product_code',
            'product_name',
            'version',
            'status',
            'notes',
            'components',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'status', 'created_by', 'created_at', 'updated_at']

    def create(self, validated_data):
        components_data = validated_data.pop('components', [])
        user = self.context['request'].user
        bom = BillOfMaterials.objects.create(
            organization=user.organization,
            created_by=user,
            **validated_data
        )

        for comp_data in components_data:
            BOMComponent.objects.create(
                organization=user.organization,
                bom=bom,
                **comp_data
            )

        return bom

    def update(self, instance, validated_data):
        if instance.status == BOMStatus.RELEASED:
            raise serializers.ValidationError("Cannot edit an already RELEASED Bill of Materials. Create a new version instead.")

        components_data = validated_data.pop('components', None)
        instance.version = validated_data.get('version', instance.version)
        instance.notes = validated_data.get('notes', instance.notes)
        instance.save()

        if components_data is not None:
            instance.components.all().delete()
            for comp_data in components_data:
                BOMComponent.objects.create(
                    organization=instance.organization,
                    bom=instance,
                    **comp_data
                )

        return instance
