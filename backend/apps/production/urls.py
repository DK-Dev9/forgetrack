from django.urls import path
from .views import (
    ProductionOrderListCreateView,
    ProductionOrderDetailView,
    ReleaseProductionOrderView,
    AssignUserToOrderView,
    RemoveUserFromOrderView,
    IssueOrderMaterialView,
    ReturnOrderMaterialView,
    RecordOrderConsumptionView,
    RecordOrderOutputView,
    CloseProductionOrderView,
)

urlpatterns = [
    path('', ProductionOrderListCreateView.as_view(), name='production-order-list-create'),
    path('orders/', ProductionOrderListCreateView.as_view(), name='production-order-list-alias'),
    path('<uuid:id>/', ProductionOrderDetailView.as_view(), name='production-order-detail'),
    path('<uuid:id>/release/', ReleaseProductionOrderView.as_view(), name='production-order-release'),
    path('<uuid:id>/assignments/', AssignUserToOrderView.as_view(), name='production-order-assign-user'),
    path('<uuid:id>/assignments/<uuid:user_id>/remove/', RemoveUserFromOrderView.as_view(), name='production-order-remove-user'),
    path('<uuid:id>/issues/', IssueOrderMaterialView.as_view(), name='production-order-issue'),
    path('<uuid:id>/returns/', ReturnOrderMaterialView.as_view(), name='production-order-return'),
    path('<uuid:id>/consumption/', RecordOrderConsumptionView.as_view(), name='production-order-consumption'),
    path('<uuid:id>/output/', RecordOrderOutputView.as_view(), name='production-order-output'),
    path('<uuid:id>/close/', CloseProductionOrderView.as_view(), name='production-order-close'),
]
