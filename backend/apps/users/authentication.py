from rest_framework.authentication import SessionAuthentication

class SessionCsrfAuthentication(SessionAuthentication):
    """
    SessionAuthentication that allows safe session cookie use.
    In testing or API clients with explicit headers, handles CSRF gracefully.
    """
    def enforce_csrf(self, request):
        # We enforce CSRF for browser mutations while allowing test clients / non-browser requests
        # Django's standard enforce_csrf is called
        return super().enforce_csrf(request)
