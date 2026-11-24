from django.urls import path

from . import agenda, group_pages, members, trackers, views

urlpatterns = [
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/admin-session/", views.AdminSessionView.as_view(), name="admin-session"),
    path("auth/me/", views.MeView.as_view(), name="me"),
    path("auth/reset/<str:uid>/<str:token>/", views.PasswordResetView.as_view(), name="password-reset"),
    path("members/", members.MembersView.as_view(), name="members"),
    path("members/<int:pk>/", members.MemberView.as_view(), name="member"),
    path("members/<int:pk>/reset-link/", members.MemberResetLinkView.as_view(), name="member-reset-link"),
    path("trackers/", trackers.TrackersView.as_view(), name="trackers"),
    path("trackers/<int:pk>/", trackers.TrackerView.as_view(), name="tracker"),
    path("visits/stats/", trackers.VisitStatsView.as_view(), name="visit-stats"),
    path("track/", trackers.TrackView.as_view(), name="track"),
    path("countries/", views.CountriesView.as_view(), name="countries"),
    path("supporters-count/", views.SupportersCountView.as_view(), name="supporters-count"),
    path("agenda.ics", agenda.AgendaFeedView.as_view(), name="agenda-feed"),
    path("agenda/<slug:slug>.ics", agenda.CityAgendaFeedView.as_view(), name="agenda-city-feed"),
    path("engage-forms/", views.EngageFormsView.as_view(), name="engage-forms"),
    path("events/", views.EventsView.as_view(), name="events"),
    path("action-groups/", views.ActionGroupsView.as_view(), name="action-groups"),
    # <pk> : identifiant ou adresse de la page (« berlin-insoumise »)
    path("action-groups/<str:pk>/", group_pages.ActionGroupDetailView.as_view(), name="action-group"),
    path("action-groups/<int:pk>/logo/", group_pages.ActionGroupImageView.as_view(field="logo"), name="action-group-logo"),
    path("action-groups/<int:pk>/cover/", group_pages.ActionGroupImageView.as_view(field="cover"), name="action-group-cover"),
    path("action-groups/<int:pk>/visit/", group_pages.ActionGroupVisitView.as_view(), name="action-group-visit"),
    path("action-groups/<int:pk>/photos/", group_pages.ActionGroupPhotosView.as_view(), name="action-group-photos"),
    path("action-groups/<int:pk>/photos/<int:photo_id>/", group_pages.ActionGroupPhotoView.as_view(),
         name="action-group-photo"),
    path("polling-stations/", views.PollingStationsView.as_view(), name="polling-stations"),
    path("faq/", views.FaqView.as_view(), name="faq"),
    path("footer-links/", views.FooterLinksView.as_view(), name="footer-links"),
]
