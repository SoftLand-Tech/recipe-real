{{-- Topbar shortcuts: the three jobs that used to mean leaving the panel. --}}
<div class="rr-top-actions">
    <a href="{{ url('/') }}" target="_blank" rel="noopener" class="rr-top-action" title="Open the live landing page">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9"/>
            <path d="M3 12h18M12 3c2.5 2.6 3.9 5.7 3.9 9s-1.4 6.4-3.9 9c-2.5-2.6-3.9-5.7-3.9-9S9.5 5.6 12 3Z"/>
        </svg>
        <span>View site</span>
    </a>
    <a href="{{ url('/admin/manage-app-releases') }}" class="rr-top-action" title="Publish a new APK build">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 15V4m0 0 4 4m-4-4L8 8"/>
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
        </svg>
        <span>Releases</span>
    </a>
    <a href="{{ url('/download') }}" class="rr-top-action" title="Download the live APK (/download serves the newest release)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 4v11m0 0 4-4m-4 4-4-4"/>
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
        </svg>
        <span>APK</span>
    </a>
</div>
