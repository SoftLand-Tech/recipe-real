{{-- Direct-APK confirm dialog for the top-nav "Get the App" button.
     Progressive enhancement: without JS the button is a plain link to
     route('app.download') and still downloads immediately. With JS we
     intercept the click, show version/size, and start the download only
     after the user taps Download. Zero dependencies, RTL-ready. --}}
<div id="dl-confirm" hidden>
    <div class="dl-confirm-backdrop" data-dl-close></div>
    <div class="dl-confirm-card" role="dialog" aria-modal="true" aria-labelledby="dl-confirm-title">
        <h3 id="dl-confirm-title">{{ __('site.dl_confirm_title') }}</h3>
        <p class="dl-confirm-text">{{ __('site.dl_confirm_text') }}</p>
        <p class="dl-confirm-meta"><b id="dl-confirm-version"></b><span aria-hidden="true"> · </span><span id="dl-confirm-size"></span><span aria-hidden="true"> · </span><span>{{ __('site.dl_meta') }}</span></p>
        <p class="dl-confirm-note">{{ __('site.dl_confirm_note') }}</p>
        <div class="dl-confirm-actions">
            <a id="dl-confirm-go" class="dl-confirm-go" href="{{ route('app.download') }}" download>{{ __('site.dl_confirm_download') }}</a>
            <button id="dl-confirm-cancel" class="dl-confirm-cancel" type="button" data-dl-close>{{ __('site.dl_confirm_cancel') }}</button>
        </div>
    </div>
</div>
<style>
#dl-confirm[hidden] { display: none; }
#dl-confirm { position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; }
.dl-confirm-backdrop { position: absolute; inset: 0; background: rgba(38,33,27,.5); }
.dl-confirm-card { position: relative; background: #fff; color: #26211B; border-radius: 20px; max-width: 400px; width: 100%; padding: 26px 24px 22px; box-shadow: 0 30px 70px -20px rgba(0,0,0,.5); text-align: center; }
.dl-confirm-card h3 { margin: 0 0 8px; font-size: 21px; font-weight: 800; letter-spacing: -.01em; }
[dir="rtl"] .dl-confirm-card h3 { letter-spacing: 0; }
.dl-confirm-text { margin: 0 0 10px; font-size: 14.5px; color: #6E6558; }
.dl-confirm-meta { margin: 0 0 10px; font-size: 14px; color: #6E6558; }
.dl-confirm-meta b { color: #26211B; }
.dl-confirm-note { margin: 0 0 20px; font-size: 13px; color: #988D7E; line-height: 1.6; }
.dl-confirm-actions { display: flex; gap: 10px; }
.dl-confirm-go { flex: 1; display: inline-flex; align-items: center; justify-content: center; background: #F26B1D; color: #fff; font-weight: 800; font-size: 15px; border-radius: 999px; padding: 12px 20px; text-decoration: none; }
.dl-confirm-go:hover { background: #CE5710; }
.dl-confirm-cancel { flex: 1; background: #fff; color: #26211B; border: 1px solid #E8DFD2; font-weight: 700; font-size: 15px; border-radius: 999px; padding: 12px 20px; cursor: pointer; font-family: inherit; }
.dl-confirm-cancel:hover { border-color: #F26B1D; color: #CE5710; }
</style>
<script>
(function () {
    var modal = document.getElementById('dl-confirm');
    if (!modal) return;
    var go = document.getElementById('dl-confirm-go');
    var cancel = document.getElementById('dl-confirm-cancel');
    var ver = document.getElementById('dl-confirm-version');
    var size = document.getElementById('dl-confirm-size');
    var lastFocus = null;
    function open(e, link) {
        e.preventDefault();
        lastFocus = document.activeElement;
        go.href = link.href;
        ver.textContent = 'v' + (link.getAttribute('data-dl-version') || '');
        size.textContent = link.getAttribute('data-dl-size') || '';
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
        go.focus();
    }
    function close() {
        modal.hidden = true;
        document.body.style.overflow = '';
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    document.addEventListener('click', function (e) {
        var link = e.target && e.target.closest ? e.target.closest('a[data-dl-confirm]') : null;
        if (link) { open(e, link); return; }
        if (e.target && e.target.closest && e.target.closest('[data-dl-close]')) close();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !modal.hidden) close();
    });
})();
</script>
