<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RecipeReal</title>
  <style>
    html, body { margin: 0; height: 100%; }
    body {
      display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, system-ui, sans-serif;
      background: #FBF8F3; color: #241D17;
    }
    .card { text-align: center; }
    .dot { width: 14px; height: 14px; margin: 0 auto 14px; border-radius: 50%;
           background: #BF552B; animation: pulse 0.9s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: .35; transform: scale(.85);} 50% { opacity: 1; transform: scale(1);} }
    p { font-size: 15px; color: #6E6357; }
  </style>
</head>
<body>
  <div class="card">
    <div class="dot"></div>
    <p>Finishing sign-in&hellip;</p>
  </div>
  <script>
    // Forward the OAuth response to the app's deep link — with the FRAGMENT
    // CONVERTED TO A QUERY. Google's implicit id_token flow delivers its
    // params after '#', but Android strips fragments from custom-scheme
    // redirects, which left the app opening with no token at all (silent
    // sign-in failure). Merging search + hash into a single '?params' query
    // survives the trip.
    var q = window.location.search ? window.location.search.substring(1) : '';
    var h = window.location.hash ? window.location.hash.substring(1) : '';
    var params = [q, h].filter(Boolean).join('&');
    window.location.replace('recipereal:///login' + (params ? '?' + params : ''));
  </script>
</body>
</html>
