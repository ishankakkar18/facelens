import uuid
from pathlib import Path

from .config import get_settings

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def upload_image(data: bytes, content_type: str) -> str:
    """Store an image in R2 when configured, otherwise in local ./uploads."""
    settings = get_settings()
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}.get(content_type, "jpg")
    key = f"faces/{uuid.uuid4().hex}.{ext}"

    if settings.r2_bucket and settings.r2_account_id and settings.r2_access_key_id:
        import boto3

        client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name="auto",
        )
        client.put_object(
            Bucket=settings.r2_bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        if settings.r2_public_base_url:
            return f"{settings.r2_public_base_url.rstrip('/')}/{key}"
        return key

    destination = UPLOAD_DIR / key
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    return f"/uploads/{key}"


def delete_image(image_url: str | None) -> None:
    if not image_url:
        return

    settings = get_settings()
    if settings.r2_bucket and settings.r2_account_id and settings.r2_access_key_id:
        key = image_url
        if settings.r2_public_base_url:
            prefix = settings.r2_public_base_url.rstrip("/") + "/"
            if image_url.startswith(prefix):
                key = image_url[len(prefix) :]
        if key.startswith("/uploads/"):
            key = key[len("/uploads/") :]
        try:
            import boto3

            client = boto3.client(
                "s3",
                endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
                aws_access_key_id=settings.r2_access_key_id,
                aws_secret_access_key=settings.r2_secret_access_key,
                region_name="auto",
            )
            client.delete_object(Bucket=settings.r2_bucket, Key=key)
        except Exception:
            pass
        return

    if image_url.startswith("/uploads/"):
        path = UPLOAD_DIR / image_url[len("/uploads/") :]
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
