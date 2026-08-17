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
    // Forward the OAuth response (query AND fragment — the id_token lives in
    // the fragment for Google's implicit flow) to the app's deep link.
    var rest = window.location.search + window.location.hash;
    window.location.replace('recipereal:///login' + rest);
  </script>
</body>
</html>
