<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One message sent through the public /contact form. No email pipeline —
 * messages land here and are read in the admin panel.
 */
class ContactMessage extends Model
{
    protected $fillable = [
        'name',
        'email',
        'message',
    ];
}
