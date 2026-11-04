from decimal import Decimal
from django.db import models
from rest_framework import generics, views, status, permissions
from rest_framework.response import Response
from .models import Product, BillOfMaterials, BOMComponent, BOMStatus
from .serializers import ProductSerializer, BillOfMaterialsSerializer
from apps.users.permissions import IsProductionManagerOrAdmin
from apps.audit.services import log_audit_event

class ProductListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductSerializer

    def get_queryset(self):
        qs = Product.objects.filter(
            organization=self.request.user.organization
        ).select_related('unit_of_measure', 'linked_item').prefetch_related('boms')

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                models.Q(code__icontains=search) |
                models.Q(name__icontains=search)
            )
        return qs


class ProductDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ProductSerializer
    lookup_field = 'id'

    def get_queryset(self):
        return Product.objects.filter(organization=self.request.user.organization)


class BillOfMaterialsListCreateView(generics.ListCreateAPIView):
    serializer_class = BillOfMaterialsSerializer

    def get_queryset(self):
        qs = BillOfMaterials.objects.filter(
            organization=self.request.user.organization
        ).select_related('product', 'created_by').prefetch_related('components__item', 'components__unit_of_measure')

        product_id = self.request.query_params.get('product')
        if product_id:
            qs = qs.filter(product_id=product_id)

        bom_status = self.request.query_params.get('status')
        if bom_status and bom_status in BOMStatus.values:
            qs = qs.filter(status=bom_status)

        return qs


class BillOfMaterialsDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BillOfMaterialsSerializer
    lookup_field = 'id'

    def get_queryset(self):
        return BillOfMaterials.objects.filter(
            organization=self.request.user.organization
        ).select_related('product', 'created_by').prefetch_related('components__item', 'components__unit_of_measure')

    def perform_destroy(self, instance):
        if instance.status == BOMStatus.RELEASED:
            return Response(
                {"detail": "Cannot delete a RELEASED Bill of Materials. Archive it instead."},
                status=status.HTTP_400_BAD_REQUEST
            )
        instance.delete()


class ReleaseBOMView(views.APIView):
    permission_classes = [IsProductionManagerOrAdmin]

    def post(self, request, id):
        org = request.user.organization
        try:
            bom = BillOfMaterials.objects.get(id=id, organization=org)
        except BillOfMaterials.DoesNotExist:
            return Response({"detail": "BOM not found."}, status=status.HTTP_404_NOT_FOUND)

        if bom.status == BOMStatus.RELEASED:
            return Response({"detail": "BOM is already in RELEASED status."}, status=status.HTTP_400_BAD_REQUEST)

        if not bom.components.exists():
            return Response({"detail": "Cannot release a BOM with no components."}, status=status.HTTP_400_BAD_REQUEST)

        # Archive previous released versions of this product
        BillOfMaterials.objects.filter(
            organization=org,
            product=bom.product,
            status=BOMStatus.RELEASED
        ).exclude(id=bom.id).update(status=BOMStatus.ARCHIVED)

        bom.status = BOMStatus.RELEASED
        bom.save(update_fields=['status', 'updated_at'])

        log_audit_event(
            action="BOM_RELEASED",
            entity_type="BillOfMaterials",
            entity_id=str(bom.id),
            actor=request.user,
            organization=org,
            description=f"Released BOM {bom.version} for product {bom.product.name} ({bom.product.code})",
            after_state={"status": bom.status, "version": bom.version}
        )

        return Response(BillOfMaterialsSerializer(bom).data)


class BOMPreviewCalculationView(views.APIView):
    """
    Simulates / previews material requirements and shortages for a target production quantity.
    """
    def post(self, request, id):
        org = request.user.organization
        try:
            bom = BillOfMaterials.objects.get(id=id, organization=org)
        except BillOfMaterials.DoesNotExist:
            return Response({"detail": "BOM not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            order_qty = Decimal(str(request.data.get('quantity', '1')))
            if order_qty <= Decimal('0.0000'):
                raise ValueError()
        except (ValueError, TypeError):
            return Response({"detail": "Quantity must be a positive number."}, status=status.HTTP_400_BAD_REQUEST)

        warehouse_id = request.data.get('warehouse_id')

        requirements = []
        total_estimated_material_cost = Decimal('0.0000')

        for comp in bom.components.select_related('item', 'unit_of_measure'):
            gross_needed = comp.calculate_requirement_for(order_qty)
            item_cost = comp.item.unit_cost
            line_cost = gross_needed * item_cost
            total_estimated_material_cost += line_cost

            # Check available stock
            bal_qs = comp.item.stock_balances.filter(organization=org)
            if warehouse_id:
                bal_qs = bal_qs.filter(warehouse_id=warehouse_id)
            total_avail = sum((b.available for b in bal_qs), Decimal('0.0000'))
            shortage = max(Decimal('0.0000'), gross_needed - total_avail)

            requirements.append({
                "item_id": str(comp.item.id),
                "item_code": comp.item.code,
                "item_name": comp.item.name,
                "uom_code": comp.unit_of_measure.code,
                "base_quantity_per_unit": str(comp.quantity),
                "scrap_allowance_percent": str(comp.scrap_allowance_percent),
                "gross_quantity_needed": str(round(gross_needed, 4)),
                "unit_cost": str(item_cost),
                "total_estimated_cost": str(round(line_cost, 4)),
                "total_available_stock": str(round(total_avail, 4)),
                "shortage": str(round(shortage, 4)),
                "has_shortage": shortage > Decimal('0.0000')
            })

        return Response({
            "bom_id": str(bom.id),
            "bom_version": bom.version,
            "product_code": bom.product.code,
            "product_name": bom.product.name,
            "production_quantity": str(order_qty),
            "total_estimated_material_cost": str(round(total_estimated_material_cost, 4)),
            "components": requirements,
            "has_any_shortage": any(r['has_shortage'] for r in requirements)
        })
