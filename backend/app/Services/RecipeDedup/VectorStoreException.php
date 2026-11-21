<?php

namespace App\Services\RecipeDedup;

use RuntimeException;

/** Vector database failures (Qdrant unreachable, HTTP errors, bad responses). */
final class VectorStoreException extends RuntimeException {}
