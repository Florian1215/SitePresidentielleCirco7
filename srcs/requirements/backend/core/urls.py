from django.urls import path

from . import members, views

urlpatterns = [
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/me/", views.MeView.as_view(), name="me"),
    path("members/", members.MembersView.as_view(), name="members"),
    path("members/<int:pk>/", members.MemberView.as_view(), name="member"),
    path("countries/", views.CountriesView.as_view(), name="countries"),
    path("supporters-count/", views.SupportersCountView.as_view(), name="supporters-count"),
    path("events/", views.EventsView.as_view(), name="events"),
    path("action-groups/", views.ActionGroupsView.as_view(), name="action-groups"),
    path("polling-stations/", views.PollingStationsView.as_view(), name="polling-stations"),
    path("faq/", views.FaqView.as_view(), name="faq"),
    path("footer-links/", views.FooterLinksView.as_view(), name="footer-links"),
]
