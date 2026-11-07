from pathlib import Path
import hashlib
import json
import zipfile
root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'extension/manifest.json').read_text())['version']
files = json.loads((root / 'scripts/release-files.json').read_text())
actual = sorted(p.relative_to(root / 'extension').as_posix() for p in (root / 'extension').rglob('*') if p.is_file() and p.name != '.DS_Store')
if actual != sorted(files):
    raise SystemExit('Unreviewed extension files: run the privacy check before packaging.')
output = root / 'dist'
output.mkdir(exist_ok=True)
def archive(path, entries):
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for source, name in entries:
            if source.is_symlink():
                raise SystemExit('Symlinks are not permitted in release packages.')
            info = zipfile.ZipInfo(name, date_time=(2024, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = (0o100755 if name.endswith(('.sh', '.command')) else 0o100644) << 16
            z.writestr(info, source.read_bytes())
extension = output / f'books-and-movies-{version}-extension.zip'
archive(extension, [(root / 'extension' / f, f) for f in files])
installer = output / f'books-and-movies-{version}-setup.zip'
extras = ['install.sh', 'install-macos.command', 'install-windows.cmd', 'install/INSTALL.html', 'README.md', 'PRIVACY.md', 'LICENSE', 'NOTICE']
archive(installer, [(root / 'extension' / f, 'extension/' + f) for f in files] + [(root / f, f) for f in extras])
checksums = ''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in [extension, installer])
(output / 'SHA256SUMS.txt').write_text(checksums)
for p in [extension, installer, output / 'SHA256SUMS.txt']:
    print(p.name)
