<div wire:poll.3s>
    <style>
        .rr-agy-dot { width: 8px; height: 8px; border-radius: 999px; background: #9ca3af; flex: none; }
        .rr-agy-dot.on { background: #22c55e; animation: rr-agy-pulse 1.6s ease-in-out infinite; }
        @keyframes rr-agy-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .rr-agy-count {
            display: inline-flex; align-items: center; justify-content: center;
            min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px;
            background: {{ $active > 0 ? '#E86A33' : 'rgba(128,128,128,.25)' }};
            color: #fff; font-size: 12px; font-weight: 800;
        }
    </style>
    <a
        href="{{ url('/admin/agy-sessions') }}"
        class="rr-top-action"
        title="{{ $active }} in-flight agy import(s), {{ $running }} worker process(es) running"
    >
        <span class="rr-agy-dot {{ $running > 0 ? 'on' : '' }}"></span>
        <span>Agy</span>
        <span class="rr-agy-count">{{ $active }}</span>
    </a>
</div>
