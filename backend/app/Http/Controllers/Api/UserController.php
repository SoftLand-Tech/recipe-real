<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class UserController extends Controller
{
    /**
     * Return the authenticated user. Lives inside the auth:sanctum
     * protected route group so $request->user() is guaranteed.
     *
     * Extracted from a route closure so `route:cache` works in production.
     */
    public function __invoke(Request $request)
    {
        return $request->user();
    }
}
