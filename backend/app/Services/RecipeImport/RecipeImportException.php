<?php

namespace App\Services\RecipeImport;

use RuntimeException;

class RecipeImportException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode = 'import_failed',
        public readonly bool $retryable = false,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }
}
