<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppInstall;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AppInstallController extends Controller
{
    /**
     * Anonymous install heartbeat. The app generates a random install_id
     * once per install and POSTs it on every cold start; first POST
     * creates the row (first seen), later POSTs only bump last seen
     * (updated_at) plus platform/version. Auth-optional: when a bearer
     * token is present the install is linked to the user, but an
     * anonymous heartbeat never clears an existing link.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'install_id' => ['required', 'string', 'uuid', 'max:36'],
            'platform' => ['nullable', 'string', 'in:android,ios,web'],
            'app_version' => ['nullable', 'string', 'max:32'],
        ]);

        $user = $request->user('sanctum');

        $install = AppInstall::firstOrNew(['install_id' => $validated['install_id']]);
        $install->platform = $validated['platform'] ?? $install->platform;
        $install->app_version = $validated['app_version'] ?? $install->app_version;
        // Never unlink: anonymous heartbeats keep the known user.
        if ($user) {
            $install->user_id = $user->id;
        }
        // Touch last-seen on every heartbeat, even when nothing changed.
        $install->updated_at = now();
        $install->save();

        return response()->json(null, 204);
    }
}
