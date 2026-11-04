from django.urls import path
from .views import UserListCreateView, UserDetailView, ToggleUserActiveView

urlpatterns = [
    path('', UserListCreateView.as_view(), name='user-list-create'),
    path('<uuid:id>/', UserDetailView.as_view(), name='user-detail'),
    path('<uuid:id>/toggle-active/', ToggleUserActiveView.as_view(), name='user-toggle-active'),
]
