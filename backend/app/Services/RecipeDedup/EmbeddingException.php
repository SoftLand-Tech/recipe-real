<?php

namespace App\Services\RecipeDedup;

use RuntimeException;

/** Embedding provider failures (transport, HTTP, shape mismatch). */
final class EmbeddingException extends RuntimeException {}
