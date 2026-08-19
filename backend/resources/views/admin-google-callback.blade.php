<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RecipeReal Admin</title>
  <style>
    html, body { margin: 0; height: 100%; }
    body {
      display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, system-ui, sans-serif;
      background: #FBF8F3; color: #241D17;
    }
    .dot { width: 14px; height: 14px; margin: 0 auto 14px; border-radius: 50%;
           background: #BF552B; animation: pulse 0.9s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: .35; transform: scale(.85);} 50% { opacity: 1; transform: scale(1);} }
    p { font-size: 15px; color: #6E6357; }
  </style>
</head>
<body>
  <div style="text-align:center">
    <div class="dot"></div>
    <p>Signing you in&hellip;</p>
  </div>
  <script>
    // Google's implicit id_token flow delivers its params in the URL
    // FRAGMENT — servers never see fragments. Re-enter this same URL with
    // the fragment merged into the query so Laravel can verify the token.
    var q = window.location.search ? window.location.search.substring(1) : '';
    var h = window.location.hash ? window.location.hash.substring(1) : '';
    var params = [q, h].filter(Boolean).join('&');
    if (params && q.indexOf('id_token=') === -1) {
      window.location.replace(window.location.pathname + '?' + params);
    }
  </script>
</body>
</html>
