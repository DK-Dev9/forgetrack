from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ValidationError as DjangoValidationError

def custom_exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, 'message_dict'):
            errors = exc.message_dict
        elif hasattr(exc, 'messages'):
            errors = {'detail': exc.messages}
        else:
            errors = {'detail': str(exc)}
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    response = exception_handler(exc, context)
    return response
