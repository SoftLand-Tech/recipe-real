<?php

namespace App\Services\RecipeDedup\Fingerprinting;

use RuntimeException;
use Throwable;

/**
 * Thrown by FingerprintService::register() ONLY when another recipe
 * already holds the exact same fingerprint (UNIQUE violation on
 * recipe_fingerprints.fingerprint). This is the DB-level race guard:
 * slice 4's registrar catches it and interprets it as "exact duplicate
 * already registered" instead of storing a second row.
 *
 * Other query exceptions (connection lost, column mismatch, a unique
 * violation on any other column, ...) are NEVER converted — they ride
 * through untouched.
 */
final class FingerprintCollisionException extends RuntimeException
{
    public function __construct(string $message = '', ?Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
    }
}
