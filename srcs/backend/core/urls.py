from django.urls import path

from . import views

urlpatterns = [
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/me/", views.MeView.as_view(), name="me"),
    path("countries/", views.CountriesView.as_view(), name="countries"),
    path("supporters-count/", views.SupportersCountView.as_view(), name="supporters-count"),
    path("events/", views.EventsView.as_view(), name="events"),
    path("action-groups/", views.ActionGroupsView.as_view(), name="action-groups"),
    path("footer-links/", views.FooterLinksView.as_view(), name="footer-links"),
    path("contact/", views.ContactView.as_view(), name="contact"),
    path("supporters/", views.SupporterView.as_view(), name="supporters"),
]
