from zipfile import ZipFile

import pytest

from app.services.archive import validate_project_zip


def test_zip_slip_rejected(tmp_path):
    path = tmp_path / "unsafe.zip"
    with ZipFile(path, "w") as archive:
        archive.writestr("../../etc/passwd", "no")
    with pytest.raises(ValueError, match="unsafe"):
        validate_project_zip(str(path), max_files=100, max_unpacked_bytes=10000)


def test_ignored_dirs_and_files_filtered(tmp_path):
    path = tmp_path / "source.zip"
    with ZipFile(path, "w") as archive:
        archive.writestr("src/main.py", "print(1)")
        archive.writestr("node_modules/pkg/index.js", "ignored")
        archive.writestr("assets/logo.png", "ignored")
    assert validate_project_zip(str(path), 100, 10000) == ["src/main.py"]
