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
            return Response({"error": f"Error generating options: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VerifyRegisterView(APIView):
    """
    [STEP 2 - REGISTRATION]
    Verifies the cryptographic signature sent by the authenticator and saves the public key.
    """
    def post(self, request):
        challenge = request.session.get('registration_challenge')
        user_id = request.session.get('registering_user_id')

        if not challenge or not user_id:
            return Response({"error": "Registration session expired or invalid."}, status=status.HTTP_400_BAD_REQUEST)

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

            return Response({"status": "Registration successful", "verified": True}, status=status.HTTP_201_CREATED)

        except InvalidRegistrationResponse as e:
            return Response({"error": f"Invalid registration: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Unexpected error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class LoginOptionsView(APIView):
    """
    [STEP 1 - LOGIN]
    Generates the challenge for an existing user, allowing only their registered credentials.
    """
    def post(self, request):
        username = request.data.get('username')
        if not username:
            return Response({"error": "Username requerido"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            # For security, we should not reveal whether the user exists or not,
            # but for debugging/development we return 404.
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        user_credentials = WebAuthnCredential.objects.filter(user=user)
        if not user_credentials.exists():
            return Response({"error": "User has no registered WebAuthn credentials"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            options = generate_authentication_options(
                rp_id=settings.RP_ID,
                # Sending the list of allowed credentials (allowCredentials)
                allow_credentials=[
                    {"id": base64url_to_bytes(cred.credential_id), "type": "public-key"}
                    for cred in user_credentials
                ]
            )

            request.session['auth_challenge'] = options.challenge
            request.session['auth_user_id'] = user.id

            return Response(options_to_json(options), status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VerifyLoginView(APIView):
    """
    [STEP 2 - LOGIN]
    Verifies the signature, validates the counter (replay attack), and issues JWT.
    """
    def post(self, request):
        challenge = request.session.get('auth_challenge')
        user_id = request.session.get('auth_user_id')

        if not challenge or not user_id:
            return Response({"error": "Authentication session expired."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(id=user_id)
            credential_id_used = request.data.get('id')
            
            # Find the specific credential used by the browser
            stored_credential = WebAuthnCredential.objects.get(credential_id=credential_id_used, user=user)

            # Verify signature
            verification = verify_authentication_response(
                credential=request.data,
                expected_challenge=base64url_to_bytes(challenge),
                expected_rp_id=settings.RP_ID,
                expected_origin=settings.RP_ORIGIN,
                credential_public_key=base64url_to_bytes(stored_credential.public_key),
                credential_current_sign_count=stored_credential.sign_count
            )

            # Update signature counter (Protection against Replay Attacks)
            stored_credential.sign_count = verification.new_sign_count
            stored_credential.save()

            # Clear session
            del request.session['auth_challenge']
            del request.session['auth_user_id']

            # Generate JWT (Access + Refresh)
            refresh = RefreshToken.for_user(user)

            return Response({
                "status": "Authentication successful",
                "tokens": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                }
            }, status=status.HTTP_200_OK)

        except WebAuthnCredential.DoesNotExist:
            return Response({"error": "Credential not recognized for this user."}, status=status.HTTP_400_BAD_REQUEST)
        except InvalidAuthenticationResponse as e:
            return Response({"error": f"Verification failed: {str(e)}"}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"error": f"Internal error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)