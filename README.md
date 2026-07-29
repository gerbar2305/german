# GerBar Load Planner

Proyecto base funcional para gestión y planificación logística de cargas.

## Funciones incluidas

- API FastAPI
- Base de datos SQLite
- Autenticación JWT
- Usuario administrador inicial
- Gestión de vehículos
- Gestión de contenedores
- Gestión de productos
- Gestión de cargas
- Frontend web inicial
- Documentación Swagger

## Usuario inicial

- Email: admin@gerbar.local
- Contraseña: Admin123!

## Ejecutar backend en Windows

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Abrir:

- http://127.0.0.1:8000
- http://127.0.0.1:8000/docs

## Ejecutar frontend

Necesita Node.js 20 o superior.

```powershell
cd frontend
npm install
npm run dev
```

Abrir:

- http://127.0.0.1:5173
