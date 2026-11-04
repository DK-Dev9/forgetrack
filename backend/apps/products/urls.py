from django.urls import path
from .views import (
    ProductListCreateView,
    ProductDetailView,
    BillOfMaterialsListCreateView,
    BillOfMaterialsDetailView,
    ReleaseBOMView,
    BOMPreviewCalculationView,
)

urlpatterns = [
    path('', ProductListCreateView.as_view(), name='product-list-create'),
    path('<uuid:id>/', ProductDetailView.as_view(), name='product-detail'),
    path('boms/', BillOfMaterialsListCreateView.as_view(), name='bom-list-create'),
    path('boms/<uuid:id>/', BillOfMaterialsDetailView.as_view(), name='bom-detail'),
    path('boms/<uuid:id>/release/', ReleaseBOMView.as_view(), name='bom-release'),
    path('boms/<uuid:id>/preview/', BOMPreviewCalculationView.as_view(), name='bom-preview'),
]
