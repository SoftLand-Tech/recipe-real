@extends('layouts.page')

@section('title', __('site.help_title'))
@section('description', __('site.help_desc'))

@section('jsonld')
<script type="application/ld+json">
{
    "@@context": "https://schema.org",
    "@@type": "FAQPage",
    "mainEntity": [
        {
            "@@type": "Question",
            "name": {{ json_encode(__('site.help_q1'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }},
            "acceptedAnswer": {
                "@@type": "Answer",
                "text": {{ json_encode(__('site.help_a1'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }}
            }
        },
        {
            "@@type": "Question",
            "name": {{ json_encode(__('site.help_q2'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }},
            "acceptedAnswer": {
                "@@type": "Answer",
                "text": {{ json_encode(__('site.help_a2'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }}
            }
        },
        {
            "@@type": "Question",
            "name": {{ json_encode(__('site.help_q3'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }},
            "acceptedAnswer": {
                "@@type": "Answer",
                "text": {{ json_encode(__('site.help_a3'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }}
            }
        },
        {
            "@@type": "Question",
            "name": {{ json_encode(__('site.help_q4'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }},
            "acceptedAnswer": {
                "@@type": "Answer",
                "text": {{ json_encode(__('site.help_a4'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }}
            }
        },
        {
            "@@type": "Question",
            "name": {{ json_encode(__('site.help_q5'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }},
            "acceptedAnswer": {
                "@@type": "Answer",
                "text": {{ json_encode(__('site.help_a5'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }}
            }
        },
        {
            "@@type": "Question",
            "name": {{ json_encode(__('site.help_q6'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }},
            "acceptedAnswer": {
                "@@type": "Answer",
                "text": {{ json_encode(__('site.help_a6'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }}
            }
        },
        {
            "@@type": "Question",
            "name": {{ json_encode(__('site.help_q7'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }},
            "acceptedAnswer": {
                "@@type": "Answer",
                "text": {{ json_encode(__('site.help_a7'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }}
            }
        },
        {
            "@@type": "Question",
            "name": {{ json_encode(__('site.help_q8'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }},
            "acceptedAnswer": {
                "@@type": "Answer",
                "text": {{ json_encode(__('site.help_a8'), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }}
            }
        }
    ]
}
</script>
@endsection

@section('content')
<div class="page">
    <h1>{{ __('site.help_h1_a') }} <span class="o">{{ __('site.help_h1_b') }}</span></h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">
        {{ __('site.help_lede') }}
    </p>

    <h3>{{ __('site.help_q1') }}</h3>
    <p>
        {{ __('site.help_a1') }}
    </p>

    <h3>{{ __('site.help_q2') }}</h3>
    <p>
        {{ __('site.help_a2_a') }} <strong>{{ __('site.help_really') }}</strong>{{ __('site.help_a2_b') }}
    </p>

    <h3>{{ __('site.help_q3') }}</h3>
    <p>
        {{ __('site.help_a3') }}
    </p>

    <h3>{{ __('site.help_q4') }}</h3>
    <p>
        {{ __('site.help_a4') }}
    </p>

    <h3>{{ __('site.help_q5') }}</h3>
    <p>
        {{ __('site.help_a5') }}
    </p>

    <h3>{{ __('site.help_q6') }}</h3>
    <p>
        {{ __('site.help_a6_a') }} <strong>{{ __('site.help_settings') }}</strong> {{ __('site.help_a6_b') }}
        <strong>{{ __('site.help_danger') }}</strong>{{ __('site.help_a6_c') }}
    </p>

    <h3>{{ __('site.help_q7') }}</h3>
    <p>
        {{ __('site.help_a7') }}
    </p>

    <h3>{{ __('site.help_q8') }}</h3>
    <p>
        {{ __('site.help_a8_a') }}
        <a href="{{ route('app.download') }}">{{ __('site.help_download_page') }}</a>{{ __('site.help_a8_b') }}
        <strong>{{ __('site.help_install_unknown') }}</strong>
        {{ __('site.help_a8_c') }}
    </p>

    <h2>{{ __('site.help_stuck_t') }}</h2>
    <p>
        {{ __('site.help_stuck_a') }} <a href="{{ route('pages.contact') }}">{{ __('site.help_stuck_link') }}</a> — {{ __('site.help_stuck_b') }}
    </p>
</div>
@endsection
