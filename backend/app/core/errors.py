from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


async def http_error_handler(request: Request, exc: StarletteHTTPException):
    code = {
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
    }.get(exc.status_code, "REQUEST_ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {"code": code, "message": str(exc.detail), "details": []},
        },
    )


async def unhandled_error_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": [],
            },
        },
    )
