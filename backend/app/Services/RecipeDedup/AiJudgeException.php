<?php

namespace App\Services\RecipeDedup;

use RuntimeException;

/** Layer 3 AI verification failures (transport, HTTP, timeouts, bad payloads). */
final class AiJudgeException extends RuntimeException {}
