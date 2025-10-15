
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('venex_app.urls'))
    # path('api/', include('venex_app.api_urls')),  # add your api urls here

]

admin.site.site_header = "RBC Broker Admin"
admin.site.site_title = "RBC Admin"
admin.site.index_title = "RBC Admin Dashboard"

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
