from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from api.views import RegisterView, LoginView, MeView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/register', RegisterView.as_view(), name='register'),
    path('api/auth/login', LoginView.as_view(), name='login'),
    path('api/auth/refresh', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/me', MeView.as_view(), name='me'),
]
