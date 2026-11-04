from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

def health_check(request):
    return JsonResponse({
        "status": "healthy",
        "service": "ForgeTrack API",
        "version": "1.0.0"
    })

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health-check'),
    
    # OpenAPI Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    
    # API v1 routes
    path('api/v1/auth/', include('apps.users.urls_auth')),
    path('api/v1/organizations/', include('apps.organizations.urls')),
    path('api/v1/users/', include('apps.users.urls')),
    path('api/v1/inventory/', include('apps.inventory.urls')),
    path('api/v1/products/', include('apps.products.urls')),
    path('api/v1/production/', include('apps.production.urls')),
    path('api/v1/reports/', include('apps.reporting.urls')),
    path('api/v1/audit/', include('apps.audit.urls')),
]
