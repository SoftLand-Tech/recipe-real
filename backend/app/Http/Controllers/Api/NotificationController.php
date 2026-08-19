<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * The signed-in user's in-app notification center: likes and comments on
 * their community posts. Rows are created inline by PostController::like
 * and PostCommentController::store — no queue, no laravel-notifications
 * machinery.
 */
class NotificationController extends Controller
{
    /**
     * Paginated inbox (20/page, newest first) for the authed user, plus the
     * unread count in the meta block (drives the header bell badge).
     *
     * Row shape: {id, type, read_at, created_at, actor: {id, display_name,
     * name, avatar_url}|null, post: {id, kind, body (first 80 chars)}|null}.
     * The actor is null once the liker/commenter deleted their account; the
     * post reference is null once the post is gone (rows survive both as
     * gentle history).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $notifications = Notification::query()
            ->where('user_id', $user->id)
            ->with([
                'actor:id,display_name,name,avatar_url',
                'post:id,kind,body',
            ])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(20);

        $unreadCount = Notification::query()
            ->where('user_id', $user->id)
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'data' => collect($notifications->items())
                ->map(fn (Notification $notification) => $this->row($notification))
                ->all(),
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'last_page'    => $notifications->lastPage(),
                'per_page'     => $notifications->perPage(),
                'total'        => $notifications->total(),
                'unread_count' => $unreadCount,
            ],
        ]);
    }

    /**
     * Mark notifications read (authed). Body `{ids?: number[]}`: with ids,
     * only those rows (still restricted to the caller's own); without ids,
     * EVERYTHING unread in the caller's inbox. Only rows still unread are
     * touched (read_at is set to now once, never re-stamped).
     */
    public function read(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids'   => ['nullable', 'array', 'max:1000'],
            'ids.*' => ['integer'],
        ]);

        $ids = array_values(array_filter(
            $validated['ids'] ?? [],
            fn ($id) => is_int($id) || (is_string($id) && ctype_digit($id)),
        ));

        $query = Notification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at');

        if ($ids !== []) {
            $query->whereIn('id', $ids);
        }

        $marked = $query->update(['read_at' => now()]);

        return response()->json(['ok' => true, 'marked' => $marked]);
    }

    /**
     * Serialize one inbox row (see index for the shape).
     *
     * @return array<string, mixed>
     */
    private function row(Notification $notification): array
    {
        $actor = $notification->actor;

        return [
            'id'         => $notification->id,
            'type'       => $notification->type,
            'read_at'    => $notification->read_at?->toIso8601String(),
            'created_at' => $notification->created_at?->toIso8601String(),
            'actor'      => $actor !== null ? [
                'id'           => $actor->id,
                'display_name' => $actor->display_name ?? $actor->name,
                'name'         => $actor->name,
                'avatar_url'   => $actor->avatar_url,
            ] : null,
            'post'       => $notification->post !== null ? [
                'id'   => $notification->post->id,
                'kind' => $notification->post->kind,
                // Snippet only — the mobile row never shows the full body.
                'body' => Str::limit($notification->post->body, 80),
            ] : null,
        ];
    }
}
