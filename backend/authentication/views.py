import json
from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

# Modelos
from .models import WebAuthnCredential

# Librería WebAuthn
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json,
    base64url_to_bytes,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
)
from webauthn.helpers.exceptions import InvalidAuthenticationResponse, InvalidRegistrationResponse

class RegisterOptionsView(APIView):
    """
    [STEP 1 - REGISTRATION]
    Generates the challenge and options to create a new credential.
    """
    def post(self, request):
        username = request.data.get('username')
        if not username:
            return Response({"error": "Username is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Find or create the user (Ideally this should be only for authenticated users or specific flow)
        # TODO: Adjust user creation logic as per application needs
        user, created = User.objects.get_or_create(username=username)

        try:
            # Generate registration options
            options = generate_registration_options(
                rp_id=settings.RP_ID,
                rp_name=settings.RP_NAME,
                # ID must be bytes
                user_id=str(user.id).encode(),
                user_name=user.username,
                authenticator_selection=AuthenticatorSelectionCriteria(
                    user_verification=UserVerificationRequirement.PREFERRED
                ),
            )

            # Save state in session (backend state)
            request.session['registration_challenge'] = options.challenge
            request.session['registering_user_id'] = user.id
            
            # options_to_json converts bytes to base64url automatically for the frontend
            return Response(options_to_json(options), status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": f"Error generando opciones: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VerifyRegisterView(APIView):
    """
    [STEP 2 - REGISTRATION]
    Verifies the cryptographic signature sent by the authenticator and saves the public key.
    """
    def post(self, request):
        challenge = request.session.get('registration_challenge')
        user_id = request.session.get('registering_user_id')

        if not challenge or not user_id:
            return Response({"error": "Sesión de registro expirada o inválida."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id)
            
            verification = verify_registration_response(
                #DRF already parses JSON body
                credential=request.data,
                expected_challenge=base64url_to_bytes(challenge),
                expected_origin=settings.RP_ORIGIN,
                expected_rp_id=settings.RP_ID,
            )

            # Transaction to ensure atomicity
            with transaction.atomic():
                WebAuthnCredential.objects.create(
                    user=user,
                    credential_id=verification.credential_id,
                    public_key=verification.credential_public_key,
                    sign_count=verification.sign_count
                )

            # Clean up session
            del request.session['registration_challenge']
            del request.session['registering_user_id']

            return Response({"status": "Registro exitoso", "verified": True}, status=status.HTTP_201_CREATED)

        except InvalidRegistrationResponse as e:
            return Response({"error": f"Registro inválido: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Error inesperado: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)