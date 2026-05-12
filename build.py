#!/usr/bin/env python3
"""
build.py — discogs-cleaner-desktop builder

Run from the repo root:
    python build.py

Steps:
  1. Check discogs-cleaner submodule is present
  2. Install PyInstaller if needed
  3. Compile server.py -> python/server.exe
  4. npm install + electron-builder -> dist/installer.exe

Requirements: Python 3.x, Node.js + npm
"""

import os
import sys
import subprocess

ROOT = os.path.abspath(os.path.dirname(__file__))
CORE_DIR = os.path.join(ROOT, 'discogs-cleaner')
PYTHON_OUT = os.path.join(ROOT, 'python')
DIST_DIR = os.path.join(ROOT, 'dist')

def run(cmd, cwd=None):
    label = ' '.join(cmd) if isinstance(cmd, list) else cmd
    print(f'\n  $ {label}')
    result = subprocess.run(cmd, cwd=cwd or ROOT, shell=isinstance(cmd, str))
    if result.returncode != 0:
        print(f'\n  ERROR: command failed (exit {result.returncode})')
        sys.exit(1)

def main():
    print('\n  discogs-cleaner-desktop — build')
    print('  ================================\n')

    # Step 1: Check submodule
    print('[1/4] Checking submodule...')
    server_py = os.path.join(CORE_DIR, 'server.py')
    if not os.path.exists(server_py):
        print('  discogs-cleaner submodule not found. Run:')
        print('  git submodule update --init --recursive')
        sys.exit(1)
    print(f'  Found: {server_py}')

    # Step 2: PyInstaller
    print('\n[2/4] Checking PyInstaller...')
    try:
        import PyInstaller
        print(f'  PyInstaller {PyInstaller.__version__} ready.')
    except ImportError:
        print('  Installing PyInstaller...')
        run([sys.executable, '-m', 'pip', 'install', 'pyinstaller'])

    # Step 3: Compile server.py
    print('\n[3/4] Compiling server.py...')
    os.makedirs(PYTHON_OUT, exist_ok=True)
    sep = ';' if sys.platform == 'win32' else ':'
    run([
        sys.executable, '-m', 'PyInstaller',
        '--onefile',
        '--noconsole',
        '--distpath', PYTHON_OUT,
        '--workpath', os.path.join(ROOT, 'build_tmp'),
        '--specpath', os.path.join(ROOT, 'build_tmp'),
        '--name', 'server',
        '--add-data', f'{os.path.join(CORE_DIR, "index.html")}{sep}.',
        server_py
    ])
    print(f'  server.exe -> {PYTHON_OUT}')

    # Step 4: Electron build
    print('\n[4/4] Building Electron installer...')
    npm = 'npm.cmd' if sys.platform == 'win32' else 'npm'
    run([npm, 'install'])
    run([npm, 'run', 'build'])

    installer = None
    if os.path.isdir(DIST_DIR):
        for f in os.listdir(DIST_DIR):
            if f.endswith('.exe') and 'Setup' in f:
                installer = os.path.join(DIST_DIR, f)
                break

    print('\n  Build complete.')
    if installer:
        print(f'  Installer -> {installer}')
    else:
        print(f'  Output    -> {DIST_DIR}')
    print()

if __name__ == '__main__':
    main()
