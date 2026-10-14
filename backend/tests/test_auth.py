from datetime import timedelta

from app.core.security import decode_token, hash_password, make_token, verify_password


def test_password_hash_and_verify():
    hashed = hash_password("CorrectHorseBatteryStaple!42")
    assert hashed != "CorrectHorseBatteryStaple!42"
    assert verify_password("CorrectHorseBatteryStaple!42", hashed)
    assert not verify_password("wrong", hashed)


def test_token_type_claim():
    token = make_token("user-id", "access", timedelta(minutes=2))
    claims = decode_token(token)
    assert claims["sub"] == "user-id"
    assert claims["kind"] == "access"
