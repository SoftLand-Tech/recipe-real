<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Laravel\Cashier\Http\Controllers\WebhookController as CashierWebhookController;

class WebhookController extends CashierWebhookController
{
    /**
     * Two guards over Cashier's default handler:
     * - Billing is PAUSED on this deployment (no Stripe keys configured):
     *   acknowledge webhooks with 204 instead of failing on a missing secret.
     * - Unsigned/malformed payloads must return 400, never 500 — Stripe
     *   treats 5xx as "retry later" and would hammer a broken endpoint.
     */
    public function handleWebhook(Request $request): Response
    {
        if (! config('cashier.secret') && ! config('services.stripe.secret')) {
            return response('', 204);
        }

        try {
            return parent::handleWebhook($request);
        } catch (\Throwable $e) {
            report($e);

            return response('Invalid webhook payload', 400);
        }
    }
}
