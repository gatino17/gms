import os
import glob

def fix_imports():
    # Buscamos todos los archivos .py en apps/backend
    files = glob.glob('apps/backend/**/*.py', recursive=True)
    
    for f in files:
        if os.path.isfile(f) and '.venv' not in f:
            print(f"Procesando {f}...")
            # Leer el contenido completo primero
            with open(f, 'r', encoding='utf-8', errors='ignore') as file:
                content = file.read()
            
            # Reemplazar
            new_content = content.replace('apps.backend.app', 'app')
            
            # Escribir solo si hubo cambios
            if content != new_content:
                with open(f, 'w', encoding='utf-8') as file:
                    file.write(new_content)
                print(f"  -> Cambios aplicados en {f}")

if __name__ == "__main__":
    fix_imports()
