from fastapi import APIRouter

from app.api.routes import auth, containers, loads, products, users, vehicles


api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Autenticación"])
api_router.include_router(users.router, prefix="/users", tags=["Usuarios"])
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["Vehículos"])
api_router.include_router(containers.router, prefix="/containers", tags=["Contenedores"])
api_router.include_router(products.router, prefix="/products", tags=["Productos"])
api_router.include_router(loads.router, prefix="/loads", tags=["Cargas"])
