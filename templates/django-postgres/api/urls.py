from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter(trailing_slash=False)
router.register("items", views.ItemViewSet)

urlpatterns = [
    path("health", views.health),
    path("", include(router.urls)),
]
