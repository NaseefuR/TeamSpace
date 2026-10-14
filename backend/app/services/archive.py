from pathlib import PurePosixPath
from zipfile import BadZipFile, ZipFile

IGNORED_DIRS = {"node_modules", ".git", "venv", ".venv", "target", "dist", "__pycache__"}
IGNORED_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".pdf",
    ".zip",
    ".so",
    ".dll",
    ".exe",
    ".bin",
    ".pyc",
}


def validate_project_zip(path: str, max_files: int, max_unpacked_bytes: int) -> list[str]:
    """Validate member paths/metadata before extraction; callers must stream to bounded files."""
    try:
        with ZipFile(path) as archive:
            infos = archive.infolist()
            if len(infos) > max_files:
                raise ValueError("archive exceeds file count limit")
            total = 0
            kept = []
            for info in infos:
                name = info.filename.replace("\\", "/")
                member = PurePosixPath(name)
                mode = info.external_attr >> 16
                if member.is_absolute() or ".." in member.parts or (mode & 0o170000) == 0o120000:
                    raise ValueError(f"unsafe archive member: {name}")
                total += info.file_size
                if total > max_unpacked_bytes:
                    raise ValueError("archive exceeds expanded size limit")
                if (
                    any(part in IGNORED_DIRS for part in member.parts)
                    or member.suffix.lower() in IGNORED_SUFFIXES
                ):
                    continue
                if info.file_size > 0 and info.compress_size == 0:
                    raise ValueError("invalid compression metadata")
                if info.compress_size and info.file_size / info.compress_size > 500:
                    raise ValueError("suspicious compression ratio")
                kept.append(name)
            return kept
    except BadZipFile as exc:
        raise ValueError("invalid zip archive") from exc
