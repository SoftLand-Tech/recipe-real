@extends('layouts.page')

@section('title', 'Why recipe times lie (and what to trust instead) — RecipeReal')
@section('description', 'Recipe times describe a perfect kitchen, not yours. Why the gap is normal, not your failure — and how to find numbers you can actually trust.')

@section('content')
<div class="page">
    <h1>Why recipe times lie <span class="o">(and what to trust instead)</span></h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="lede">Every cook has been burned by a "25-minute" recipe that took an hour. Here is where those numbers come from — and what to trust instead.</p>

    <p>
        You know the scene. The recipe promises dinner in 25 minutes, and an hour
        later the onions have only just softened, the sauce is still reducing, and
        nobody has set the table. The easy conclusion is that you were slow.
    </p>
    <p>
        You almost certainly were not. The number printed on a recipe was never
        written for your kitchen. Here is why the gap exists, why it is normal,
        and how to get times you can actually plan an evening around.
    </p>

    <h2>The ideal case behind every headline</h2>
    <p>
        A published time describes the smoothest run a recipe could ever have.
        The test cook has diced every onion before the clock starts. The stove is
        powerful and familiar. The pans are the right size and already hot. Nobody
        interrupts mid-step to ask where their other sock went.
    </p>
    <p>
        And the clock almost always stops when the food reaches the plate. The
        washing-up — often a third of the real evening — never makes it into the
        headline.
    </p>

    <h2>The gap is normal, not your failure</h2>
    <p>
        A home kitchen has one burner that works properly, one good knife, one
        cutting board, and a family. Of course a "30-minute" recipe takes an hour
        on a Tuesday. You are not bad at cooking; you are cooking in a real kitchen
        while the number was written in an ideal one.
    </p>
    <blockquote>
        A recipe's time is a claim. What your kitchen delivers is a fact. The two
        rarely match — and that is nobody's failure.
    </blockquote>

    <h2>What to trust instead</h2>
    <p>
        <strong>Read the steps, not the headline.</strong> Steps tell you how much
        work is really involved. "Finely dice three onions and grate the ginger"
        is five honest minutes before anything touches a pan — time the headline
        quietly forgot to mention.
    </p>
    <p>
        <strong>Notice passive versus active time.</strong> "Simmer for 20 minutes"
        is not 20 minutes of your life; you can wash a pot while it bubbles. But
        "stir constantly for 20 minutes" pins you to the stove. As you read, sort
        every step into one of those two piles and add up the active pile — that
        is your real work.
    </p>
    <p>
        <strong>Time yourself once.</strong> Next time you make the dish, run a
        stopwatch across your part of it, start to plate. One honest measurement
        of your own beats any label on the page.
    </p>

    <h2>How RecipeReal handles it</h2>
    <p>
        RecipeReal keeps the published claim on record and puts it right next to
        what the dish actually took. Cook Mode runs a step-by-step stopwatch while
        you cook, and your measured time becomes the recipe's "Really takes". Cook
        a handful of recipes a few times and every estimate in the app calibrates
        to your pace — not a test kitchen's.
    </p>

    <div class="card">
        <h3>Cook with your own numbers</h3>
        <p>
            Tired of times written for someone else's kitchen? Let your own
            stopwatch do the talking.
        </p>
        <p><a class="btn btn-accent" href="{{ route('app.download') }}">Get RecipeReal for Android</a></p>
    </div>

    <h2>More from the blog</h2>
    <ul>
        <li><a href="{{ url('blog/where-the-time-goes') }}">Prep, cook, cleanup: where the time actually goes</a></li>
        <li><a href="{{ url('blog/plan-backwards-from-maghrib') }}">Plan backwards from maghrib: a calm iftar checklist</a></li>
        <li><a href="{{ route('pages.blog') }}">All blog posts</a></li>
    </ul>
</div>
@endsection
