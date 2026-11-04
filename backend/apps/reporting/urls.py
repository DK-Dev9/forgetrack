from django.urls import path
from .views import (
    DashboardSummaryView,
    MaterialVarianceReportView,
    MaterialVarianceExportCSVView,
    ProductionCostReportView,
)

urlpatterns = [
    path('dashboard/', DashboardSummaryView.as_view(), name='report-dashboard'),
    path('material-variance/', MaterialVarianceReportView.as_view(), name='report-material-variance'),
    path('material-variance/export/', MaterialVarianceExportCSVView.as_view(), name='report-material-variance-export'),
    path('production-costs/', ProductionCostReportView.as_view(), name='report-production-costs'),
]
