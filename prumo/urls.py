from django.urls import path

from . import views

urlpatterns = [
    path("api/v1/", views.indice),
    path("api/v1/saude", views.saude),
    path("api/v1/auth/entrar", views.entrar),
    path("api/v1/auth/sair", views.sair),
    path("api/v1/auth/eu", views.eu),
    path("api/v1/quadros", views.quadros),
    path("api/v1/quadros/<str:quadro_id>", views.quadro),
    path("api/v1/quadros/<str:quadro_id>/historico", views.historico),
    path("api/v1/quadros/<str:quadro_id>/tarefas", views.tarefas),
    path("api/v1/quadros/<str:quadro_id>/membros", views.membros),
    path("api/v1/quadros/<str:quadro_id>/anexos", views.anexos),
    path("api/v1/anexos/<uuid:anexo_id>", views.baixar_anexo),
]
