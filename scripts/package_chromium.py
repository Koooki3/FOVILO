"""Package the current Chromium development build with stable ZIP metadata."""

from hashlib import sha256
import json
from pathlib import Path
from zipfile import ZIP_STORED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
FILES = sorted((
    "_locales/en/messages.json",
    "_locales/zh_CN/messages.json",
    "background.js",
    "content.js",
    "manifest.json",
    "popup.css",
    "popup.html",
    "popup.js",
))


def main():
    manifest = json.loads((DIST / "manifest.json").read_text(encoding="utf-8"))
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    if manifest["manifest_version"] != 3 or manifest["version"] != package["version"]:
        raise ValueError("The development package version must match the MV3 manifest.")

    entries = {name: (DIST / name).read_bytes().replace(b"\r\n", b"\n") for name in FILES}
    output = ROOT / "work" / "packages"
    output.mkdir(parents=True, exist_ok=True)
    archive = output / f"fovilo-chromium-{manifest['version']}-dev.zip"
    with ZipFile(archive, "w", compression=ZIP_STORED) as bundle:
        for name, content in entries.items():
            entry = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            bundle.writestr(entry, content)

    with ZipFile(archive) as bundle:
        if bundle.namelist() != FILES or bundle.testzip() is not None:
            raise ValueError("Archive contents or integrity check failed.")
        for name, content in entries.items():
            if bundle.read(name) != content:
                raise ValueError(f"Archive bytes differ for {name}.")

    digest = sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix(".zip.sha256").write_text(f"{digest}  {archive.name}\n", encoding="utf-8", newline="\n")
    print(f"{digest}  {archive.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
