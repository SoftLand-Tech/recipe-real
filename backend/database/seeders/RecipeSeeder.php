<?php

namespace Database\Seeders;

use App\Models\Recipe;
use App\Models\RecipeStep;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Hand-curated recipe catalogue. Each recipe includes a realistic
 * publisher_time_minutes (the cookbook's claim), community_avg_minutes (what
 * home cooks actually take — usually somewhat higher), cleanup_avg_minutes,
 * and a set of recipe_steps whose active+passive community minutes sum to
 * approximately community_avg_minutes, with the cleanup step matching
 * cleanup_avg_minutes.
 *
 * Each step entry: [description, step_type, publisher_minutes, community_minutes].
 */
class RecipeSeeder extends Seeder
{
    public function run(): void
    {
        // Clear existing rows so re-seeding replaces cleanly. Uses query()->delete()
        // (not truncate()) so it works within transactions and with FKs across
        // both sqlite and MySQL.
        \App\Models\RecipeStep::query()->delete();
        \App\Models\Recipe::query()->delete();

        foreach (self::RECIPES as $recipe) {
            $steps = $recipe['steps_data'];
            unset($recipe['steps_data']);

            $model = Recipe::create($recipe);

            foreach ($steps as $i => $step) {
                RecipeStep::create([
                    'recipe_id' => $model->id,
                    'step_number' => $i + 1,
                    'description' => $step[0],
                    'step_type' => $step[1],
                    'publisher_minutes' => $step[2],
                    'community_avg_minutes' => $step[3],
                ]);
            }
        }
    }

    /**
     * Helper kept for reference / future url-slug generation.
     */
    public static function slug(string $title): string
    {
        return Str::slug($title);
    }

    /**
     * @var list<array<string, mixed>>
     */
    private const RECIPES = [
        // 1 — Pasta
        [
            'title' => 'Spaghetti Aglio e Olio',
            'source_url' => 'https://example.com/recipes/spaghetti-aglio-e-olio',
            'ingredients' => [
                '8 oz spaghetti',
                '1/4 cup extra-virgin olive oil',
                '6 garlic cloves, thinly sliced',
                '1 tsp red pepper flakes',
                '1/4 cup fresh parsley, chopped',
                'Salt, to taste',
                '1 tbsp coarse sea salt (for pasta water)',
                '2 tbsp reserved pasta water',
                '1 tbsp grated Pecorino Romano (optional)',
                'Freshly ground black pepper',
            ],
            'steps' => [
                'Boil the pasta in well-salted water.',
                'Gently toast sliced garlic in olive oil with chili flakes.',
                'Toss drained pasta in the garlic oil with a splash of pasta water.',
                'Finish with parsley and cheese.',
            ],
            'publisher_time_minutes' => 20,
            'community_avg_minutes' => 24.00,
            'cleanup_avg_minutes' => 8.00,
            'steps_data' => [
                ['Bring a large pot of salted water to a boil and cook the spaghetti until al dente.', 'active', 10, 11.00],
                ['While the pasta cooks, warm olive oil over low heat and slowly toast the sliced garlic until just golden (do not burn).', 'active', 5, 6.00],
                ['Stir red pepper flakes into the garlic oil off the heat.', 'active', 1, 1.00],
                ['Drain the pasta (reserving 1/4 cup water) and toss it in the garlic oil with a splash of pasta water until emulsified.', 'active', 3, 4.00],
                ['Let the sauce cling to the noodles for a moment off the heat.', 'passive', 1, 2.00],
                ['Finish with chopped parsley, black pepper, and optional Pecorino.', 'active', 0, 1.00],
                ['Wash the pot, pan, tongs, and colander.', 'cleanup', null, 8.00],
            ],
        ],

        // 2 — Pasta
        [
            'title' => 'Creamy Tuscan Chicken Penne',
            'source_url' => 'https://example.com/recipes/tuscan-chicken-penne',
            'ingredients' => [
                '12 oz penne pasta',
                '2 boneless skinless chicken breasts, diced',
                '2 tbsp olive oil',
                '4 garlic cloves, minced',
                '1 cup heavy cream',
                '1/2 cup chicken broth',
                '1 cup sun-dried tomatoes, drained and sliced',
                '3 cups fresh spinach',
                '1/2 cup grated Parmesan',
                '1 tsp Italian seasoning',
                'Salt and black pepper',
                '1 tbsp butter',
                '2 tbsp all-purpose flour',
            ],
            'steps' => [
                'Boil penne until al dente.',
                'Sear diced chicken, then build a creamy sun-dried-tomato-and-spinach sauce.',
                'Toss the pasta in the sauce and serve.',
            ],
            'publisher_time_minutes' => 30,
            'community_avg_minutes' => 38.00,
            'cleanup_avg_minutes' => 12.00,
            'steps_data' => [
                ['Bring salted water to a boil and cook the penne until al dente.', 'active', 11, 12.00],
                ['Season and sear the diced chicken in olive oil until golden and cooked through, then remove from the pan.', 'active', 7, 9.00],
                ['In the same pan, melt butter and sauté the garlic, then stir in flour to make a quick roux.', 'active', 2, 3.00],
                ['Whisk in chicken broth and heavy cream and let the sauce thicken.', 'active', 4, 5.00],
                ['Let the cream simmer and reduce while you prep the add-ins.', 'passive', 3, 4.00],
                ['Stir in sun-dried tomatoes, Italian seasoning, and spinach until wilted, then return the chicken.', 'active', 3, 4.00],
                ['Fold in the drained penne and Parmesan until coated.', 'active', 1, 1.00],
                ['Wash the pot, skillet, and prep dishes.', 'cleanup', null, 12.00],
            ],
        ],

        // 3 — Stir-fry
        [
            'title' => 'Garlic Ginger Chicken Stir-Fry',
            'source_url' => 'https://example.com/recipes/garlic-ginger-chicken-stir-fry',
            'ingredients' => [
                '1 lb boneless chicken thighs, sliced thin',
                '3 tbsp soy sauce',
                '1 tbsp cornstarch',
                '2 tbsp vegetable oil',
                '1 thumb fresh ginger, minced',
                '5 garlic cloves, minced',
                '2 bell peppers, sliced',
                '1 cup snap peas',
                '1 small onion, sliced',
                '2 tbsp oyster sauce',
                '1 tbsp rice vinegar',
                '1 tsp sesame oil',
                '2 green onions, sliced',
                'Cooked jasmine rice, to serve',
            ],
            'steps' => [
                'Velvet the chicken in a soy-cornstarch marinade.',
                'Stir-fry chicken, then aromatics and vegetables.',
                'Return everything to the wok with sauce.',
            ],
            'publisher_time_minutes' => 25,
            'community_avg_minutes' => 32.00,
            'cleanup_avg_minutes' => 10.00,
            'steps_data' => [
                ['Toss sliced chicken with soy sauce and cornstarch; let it marinate briefly.', 'active', 5, 5.00],
                ['Let the chicken sit and absorb the marinade while you prep vegetables.', 'passive', 5, 7.00],
                ['Heat oil in a wok and stir-fry the chicken in batches until just cooked; set aside.', 'active', 5, 6.00],
                ['Add more oil and sauté the ginger and garlic until fragrant.', 'active', 1, 1.50],
                ['Toss in the onion, bell peppers, and snap peas and stir-fry until crisp-tender.', 'active', 4, 5.50],
                ['Return the chicken to the wok and add oyster sauce, rice vinegar, and sesame oil; toss to coat.', 'active', 3, 4.00],
                ['Off the heat, scatter with green onions and serve over rice.', 'active', 1, 1.00],
                ['Scrub the wok, cutting board, and knives.', 'cleanup', null, 10.00],
            ],
        ],

        // 4 — Stir-fry
        [
            'title' => 'Beef and Broccoli with Oyster Sauce',
            'source_url' => 'https://recipes.example.com/beef-and-broccoli',
            'ingredients' => [
                '1 lb flank steak, sliced against the grain',
                '2 tbsp soy sauce',
                '1 tbsp dry sherry',
                '1 tsp cornstarch',
                '1/2 tsp baking soda',
                '3 tbsp vegetable oil',
                '1 large head broccoli, cut into florets',
                '3 garlic cloves, minced',
                '1 tsp fresh ginger, grated',
                '3 tbsp oyster sauce',
                '1/2 cup beef broth',
                '1 tsp sesame oil',
                '1 tsp sugar',
                'Steamed rice, to serve',
            ],
            'steps' => [
                'Velvet the beef with baking soda for tenderness.',
                'Blanch broccoli, then stir-fry beef hot and fast.',
                'Combine with a glossy oyster-sauce glaze.',
            ],
            'publisher_time_minutes' => 30,
            'community_avg_minutes' => 42.00,
            'cleanup_avg_minutes' => 11.00,
            'steps_data' => [
                ['Toss sliced beef with baking soda and let it sit to tenderize, then rinse and pat dry.', 'active', 5, 6.00],
                ['Let the tenderized beef rest while you prep the other ingredients.', 'passive', 10, 15.00],
                ['Marinate the beef with soy sauce, sherry, and cornstarch.', 'active', 3, 3.00],
                ['Blanch the broccoli florets in boiling water for one minute, then drain.', 'active', 4, 5.00],
                ['Sear the beef in a screaming-hot wok in two batches and set aside.', 'active', 4, 5.00],
                ['Sauté garlic and ginger, then return beef and broccoli to the wok.', 'active', 2, 3.00],
                ['Pour in oyster sauce, beef broth, sugar, and sesame oil; toss until glossy and thickened.', 'active', 2, 3.00],
                ['Wash the wok, pot, and bowls.', 'cleanup', null, 11.00],
            ],
        ],

        // 5 — Salad
        [
            'title' => 'Lemon Herb Chickpea Salad',
            'source_url' => 'https://example.com/recipes/lemon-herb-chickpea-salad',
            'ingredients' => [
                '2 cans chickpeas, drained and rinsed',
                '1 English cucumber, diced',
                '2 cups cherry tomatoes, halved',
                '1/2 red onion, finely diced',
                '1/2 cup Kalamata olives, pitted',
                '1 cup feta cheese, crumbled',
                '1/3 cup extra-virgin olive oil',
                '2 lemons, juiced',
                '1 tsp Dijon mustard',
                '1 tsp dried oregano',
                '1/2 cup fresh parsley, chopped',
                '1/4 cup fresh mint, chopped',
                'Salt and black pepper',
            ],
            'steps' => [
                'Whisk a bright lemon-herb vinaigrette.',
                'Combine chickpeas with chopped vegetables and herbs.',
                'Toss with feta and dressing; rest before serving.',
            ],
            'publisher_time_minutes' => 15,
            'community_avg_minutes' => 20.00,
            'cleanup_avg_minutes' => 6.00,
            'steps_data' => [
                ['Drain and rinse the chickpeas and let them air-dry in a colander.', 'active', 3, 3.00],
                ['Dice the cucumber, halve the tomatoes, and finely dice the red onion.', 'active', 5, 7.00],
                ['Whisk together olive oil, lemon juice, Dijon, and oregano for the vinaigrette.', 'active', 3, 4.00],
                ['Combine chickpeas, vegetables, olives, parsley, and mint in a large bowl.', 'active', 2, 2.00],
                ['Pour the dressing over the salad and toss to coat.', 'active', 1, 1.00],
                ['Let the salad marinate so the flavors meld.', 'passive', 1, 3.00],
                ['Fold in the crumbled feta just before serving.', 'active', 0, 1.00],
                ['Rinse the bowls, knife, and whisk.', 'cleanup', null, 6.00],
            ],
        ],

        // 6 — Salad
        [
            'title' => 'Grilled Chicken Caesar Salad',
            'source_url' => 'https://example.com/recipes/grilled-chicken-caesar',
            'ingredients' => [
                '2 boneless skinless chicken breasts',
                '2 romaine hearts, chopped',
                '1/2 cup grated Parmesan',
                '1/2 cup Caesar dressing',
                '1 cup croutons',
                '1 lemon, cut into wedges',
                '2 tbsp olive oil',
                '1 tsp smoked paprika',
                '1 tsp garlic powder',
                'Salt and black pepper',
                '1 anchovy fillet, minced (optional)',
                '1 tsp Dijon mustard',
                '1 tbsp mayonnaise',
            ],
            'steps' => [
                'Season and grill the chicken.',
                'Build a quick Caesar dressing.',
                'Toss the romaine and assemble.',
            ],
            'publisher_time_minutes' => 20,
            'community_avg_minutes' => 26.00,
            'cleanup_avg_minutes' => 9.00,
            'steps_data' => [
                ['Season the chicken with olive oil, paprika, garlic powder, salt, and pepper.', 'active', 2, 2.00],
                ['Let the seasoned chicken rest while the grill heats.', 'passive', 5, 6.00],
                ['Grill the chicken until cooked through (165°F), then rest it.', 'active', 8, 10.00],
                ['Whisk together Caesar dressing, Parmesan, Dijon, mayo, and minced anchovy.', 'active', 3, 4.00],
                ['Chop the romaine and toss with dressing and half the Parmesan.', 'active', 2, 2.00],
                ['Slice the chicken and lay it over the salad with croutons and remaining cheese.', 'active', 1, 2.00],
                ['Wash the grill pan, bowls, and tongs.', 'cleanup', null, 9.00],
            ],
        ],

        // 7 — Soup
        [
            'title' => 'Classic Tomato Basil Soup',
            'source_url' => 'https://example.com/recipes/tomato-basil-soup',
            'ingredients' => [
                '2 cans (28 oz) whole peeled tomatoes',
                '1 yellow onion, chopped',
                '4 garlic cloves, minced',
                '3 tbsp olive oil',
                '1 tbsp tomato paste',
                '2 cups vegetable broth',
                '1/2 cup heavy cream',
                '1 cup fresh basil leaves',
                '1 tsp sugar',
                '1 dried bay leaf',
                '1 tsp dried oregano',
                'Salt and black pepper',
                'Crusty bread, to serve',
            ],
            'steps' => [
                'Sauté aromatics and bloom tomato paste.',
                'Simmer with tomatoes and broth.',
                'Blend smooth and finish with cream and basil.',
            ],
            'publisher_time_minutes' => 35,
            'community_avg_minutes' => 42.00,
            'cleanup_avg_minutes' => 10.00,
            'steps_data' => [
                ['Heat olive oil and sauté the chopped onion until soft.', 'active', 5, 6.00],
                ['Add the garlic and tomato paste and cook until fragrant and darkened.', 'active', 2, 3.00],
                ['Add the canned tomatoes (crushed by hand), broth, bay leaf, oregano, and sugar.', 'active', 3, 4.00],
                ['Let the soup simmer so the flavors develop.', 'passive', 15, 18.00],
                ['Remove the bay leaf and blend the soup until smooth (use care with hot liquid).', 'active', 4, 6.00],
                ['Stir in the heavy cream and most of the basil; season to taste.', 'active', 2, 3.00],
                ['Wash the pot, blender, and utensils.', 'cleanup', null, 10.00],
            ],
        ],

        // 8 — Soup
        [
            'title' => 'Hearty Lentil Vegetable Soup',
            'source_url' => 'https://example.com/recipes/lentil-vegetable-soup',
            'ingredients' => [
                '1 cup brown lentils, rinsed',
                '1 onion, diced',
                '2 carrots, diced',
                '2 celery stalks, diced',
                '3 garlic cloves, minced',
                '6 cups vegetable broth',
                '1 can (14 oz) diced tomatoes',
                '1 tsp ground cumin',
                '1 tsp smoked paprika',
                '2 bay leaves',
                '2 cups kale, chopped',
                '1 tbsp olive oil',
                '1 tbsp lemon juice',
                'Salt and black pepper',
            ],
            'steps' => [
                'Sauté a mirepoix of onion, carrot, and celery.',
                'Simmer lentils with tomatoes and broth until tender.',
                'Stir in kale and finish with lemon.',
            ],
            'publisher_time_minutes' => 40,
            'community_avg_minutes' => 48.00,
            'cleanup_avg_minutes' => 8.00,
            'steps_data' => [
                ['Heat olive oil and sauté the onion, carrots, and celery until softened.', 'active', 6, 7.00],
                ['Add the garlic, cumin, and smoked paprika and stir until fragrant.', 'active', 2, 3.00],
                ['Stir in the lentils, diced tomatoes, broth, and bay leaves.', 'active', 3, 4.00],
                ['Bring to a boil, then reduce and let the soup simmer until the lentils are tender.', 'passive', 25, 30.00],
                ['Stir in the chopped kale and cook until wilted.', 'active', 2, 3.00],
                ['Finish with lemon juice and seasoning.', 'active', 1, 1.00],
                ['Wash the pot, ladle, and cutting board.', 'cleanup', null, 8.00],
            ],
        ],

        // 9 — Breakfast
        [
            'title' => 'Fluffy Buttermilk Pancakes',
            'source_url' => 'https://example.com/recipes/buttermilk-pancakes',
            'ingredients' => [
                '2 cups all-purpose flour',
                '2 tbsp sugar',
                '2 tsp baking powder',
                '1/2 tsp baking soda',
                '1/2 tsp salt',
                '2 cups buttermilk',
                '2 large eggs',
                '3 tbsp melted butter',
                '1 tsp vanilla extract',
                'Extra butter for the pan',
                'Maple syrup, to serve',
                'Fresh berries, to serve',
                'Powdered sugar, to dust',
            ],
            'steps' => [
                'Whisk dry and wet ingredients separately, then fold together.',
                'Rest the batter for a fluffier rise.',
                'Cook pancakes on a buttered griddle.',
            ],
            'publisher_time_minutes' => 20,
            'community_avg_minutes' => 28.00,
            'cleanup_avg_minutes' => 9.00,
            'steps_data' => [
                ['Whisk together the flour, sugar, baking powder, baking soda, and salt.', 'active', 2, 2.00],
                ['Whisk the buttermilk, eggs, melted butter, and vanilla in a separate bowl.', 'active', 3, 4.00],
                ['Gently fold the wet into the dry until just combined (lumps are fine).', 'active', 2, 3.00],
                ['Let the batter rest so the leavening activates.', 'passive', 5, 8.00],
                ['Cook the pancakes on a buttered griddle until bubbles set, then flip.', 'active', 6, 9.00],
                ['Keep finished pancakes warm while cooking the rest.', 'passive', 1, 2.00],
                ['Wash the mixing bowls, whisk, and griddle.', 'cleanup', null, 9.00],
            ],
        ],

        // 10 — Breakfast
        [
            'title' => 'Veggie Scramble with Feta and Spinach',
            'source_url' => 'https://example.com/recipes/veggie-feta-scramble',
            'ingredients' => [
                '6 large eggs',
                '2 tbsp milk',
                '1 tbsp butter',
                '2 cups baby spinach',
                '1/4 red onion, diced',
                '1/2 red bell pepper, diced',
                '1/2 cup cherry tomatoes, quartered',
                '1/3 cup feta, crumbled',
                '2 green onions, sliced',
                '1 tbsp olive oil',
                'Salt and black pepper',
                'Hot sauce, to serve',
                'Toast, to serve',
            ],
            'steps' => [
                'Sauté the vegetables until soft.',
                'Whisk eggs and scramble them gently with the veg.',
                'Fold in feta and herbs at the end.',
            ],
            'publisher_time_minutes' => 15,
            'community_avg_minutes' => 19.00,
            'cleanup_avg_minutes' => 6.00,
            'steps_data' => [
                ['Whisk the eggs with milk, salt, and pepper until uniform.', 'active', 2, 2.00],
                ['Sauté the onion and bell pepper in olive oil until softened.', 'active', 3, 4.00],
                ['Add the tomatoes and spinach and cook until the spinach wilts.', 'active', 2, 3.00],
                ['Reduce the heat and pour in the eggs, stirring slowly with a spatula.', 'active', 4, 6.00],
                ['Once soft curds form, fold in the feta and green onions.', 'active', 1, 2.00],
                ['Let the eggs finish cooking gently off direct heat.', 'passive', 1, 2.00],
                ['Wash the pan, bowl, and spatula.', 'cleanup', null, 6.00],
            ],
        ],

        // 11 — Sheet-pan
        [
            'title' => 'Sheet-Pan Lemon Garlic Salmon',
            'source_url' => 'https://example.com/recipes/sheet-pan-lemon-salmon',
            'ingredients' => [
                '4 salmon fillets (6 oz each)',
                '1 lb baby potatoes, halved',
                '1 bunch asparagus, trimmed',
                '3 tbsp olive oil',
                '4 garlic cloves, minced',
                '1 lemon, sliced',
                '1 tbsp fresh dill, chopped',
                '1 tsp dried oregano',
                '1/2 tsp smoked paprika',
                'Salt and black pepper',
                '1 tbsp butter, melted',
                'Lemon wedges, to serve',
            ],
            'steps' => [
                'Roast potatoes partway on a sheet pan.',
                'Add salmon and asparagus with a lemon-garlic marinade.',
                'Finish under high heat and garnish.',
            ],
            'publisher_time_minutes' => 35,
            'community_avg_minutes' => 40.00,
            'cleanup_avg_minutes' => 4.00,
            'steps_data' => [
                ['Toss the halved potatoes with olive oil, salt, and oregano and spread on a sheet pan.', 'active', 4, 5.00],
                ['Roast the potatoes until they start to soften.', 'passive', 15, 17.00],
                ['Stir minced garlic, paprika, and melted butter into more olive oil for the salmon glaze.', 'active', 2, 3.00],
                ['Push potatoes aside and add salmon and asparagus; brush with the glaze and top with lemon slices.', 'active', 3, 4.00],
                ['Roast until the salmon flakes and asparagus is tender.', 'passive', 9, 10.00],
                ['Garnish with dill and serve with lemon wedges.', 'active', 1, 1.00],
                ['Wipe down the sheet pan and toss the foil liner.', 'cleanup', null, 4.00],
            ],
        ],

        // 12 — Sheet-pan
        [
            'title' => 'Sheet-Pan Chicken Fajitas',
            'source_url' => 'https://example.com/recipes/sheet-pan-chicken-fajitas',
            'ingredients' => [
                '1.5 lb boneless skinless chicken breasts, sliced',
                '3 bell peppers (mixed colors), sliced',
                '1 large red onion, sliced',
                '3 tbsp olive oil',
                '2 tbsp fajita seasoning',
                '1 tsp ground cumin',
                '1 lime, juiced',
                '1 tsp smoked paprika',
                'Salt and black pepper',
                '8 flour tortillas, warmed',
                '1/2 cup sour cream',
                '1 cup shredded Mexican cheese',
                'Fresh cilantro, to garnish',
            ],
            'steps' => [
                'Toss chicken, peppers, and onion in fajita seasoning.',
                'Roast hot on one sheet pan.',
                'Char the edges and serve with tortillas.',
            ],
            'publisher_time_minutes' => 30,
            'community_avg_minutes' => 35.00,
            'cleanup_avg_minutes' => 5.00,
            'steps_data' => [
                ['Slice the chicken, bell peppers, and onion into even strips.', 'active', 6, 8.00],
                ['Toss everything with olive oil, fajita seasoning, cumin, paprika, lime, salt, and pepper.', 'active', 3, 4.00],
                ['Spread in a single layer on a sheet pan.', 'active', 1, 1.00],
                ['Roast at 425°F, stirring once, until the chicken is cooked and edges char.', 'passive', 18, 20.00],
                ['Warm the tortillas while the pan finishes.', 'active', 1, 2.00],
                ['Serve with sour cream, cheese, and cilantro.', 'active', 1, 1.00],
                ['Wipe down the sheet pan and wash the knife and bowl.', 'cleanup', null, 5.00],
            ],
        ],

        // 13 — Curry
        [
            'title' => 'Coconut Chickpea Curry',
            'source_url' => 'https://example.com/recipes/coconut-chickpea-curry',
            'ingredients' => [
                '2 cans chickpeas, drained',
                '1 can (14 oz) coconut milk',
                '1 can (14 oz) crushed tomatoes',
                '1 onion, diced',
                '4 garlic cloves, minced',
                '1 tbsp fresh ginger, grated',
                '2 tbsp curry powder',
                '1 tsp ground turmeric',
                '1 tsp ground cumin',
                '1/2 tsp cayenne',
                '2 cups fresh spinach',
                '1 tbsp lime juice',
                '2 tbsp vegetable oil',
                'Cooked basmati rice and naan, to serve',
            ],
            'steps' => [
                'Sauté aromatics and bloom the curry spices.',
                'Simmer chickpeas in coconut milk and tomatoes.',
                'Wilt in spinach and finish with lime.',
            ],
            'publisher_time_minutes' => 30,
            'community_avg_minutes' => 36.00,
            'cleanup_avg_minutes' => 7.00,
            'steps_data' => [
                ['Heat oil and sauté the onion until translucent.', 'active', 4, 5.00],
                ['Add the garlic and ginger and cook until fragrant.', 'active', 1, 2.00],
                ['Stir in curry powder, turmeric, cumin, and cayenne and toast briefly.', 'active', 2, 2.00],
                ['Add the crushed tomatoes and let the base simmer.', 'passive', 3, 4.00],
                ['Stir in the chickpeas and coconut milk and simmer until thickened.', 'passive', 15, 18.00],
                ['Wilt in the spinach and finish with lime juice.', 'active', 2, 3.00],
                ['Wash the pot, can opener, and ladle.', 'cleanup', null, 7.00],
            ],
        ],

        // 14 — Curry
        [
            'title' => 'Thai Green Curry with Chicken',
            'source_url' => 'https://example.com/recipes/thai-green-curry-chicken',
            'ingredients' => [
                '1 lb boneless chicken thighs, diced',
                '3 tbsp Thai green curry paste',
                '1 can (14 oz) coconut milk (full fat)',
                '1 bell pepper, sliced',
                '1 small zucchini, sliced',
                '1 tbsp fish sauce',
                '1 tbsp palm sugar (or brown sugar)',
                '2 kaffir lime leaves',
                '1 tbsp vegetable oil',
                '1/2 cup Thai basil leaves',
                '1 lime, juiced',
                '1 can bamboo shoots, drained',
                'Cooked jasmine rice, to serve',
            ],
            'steps' => [
                'Crack open the coconut cream and fry the curry paste.',
                'Simmer chicken and vegetables in coconut milk.',
                'Season and finish with basil and lime.',
            ],
            'publisher_time_minutes' => 30,
            'community_avg_minutes' => 38.00,
            'cleanup_avg_minutes' => 8.00,
            'steps_data' => [
                ['Scoop the thick coconut cream from the top of the can and fry it in oil until it splits.', 'active', 3, 4.00],
                ['Stir in the green curry paste and fry until fragrant.', 'active', 2, 3.00],
                ['Add the diced chicken and toss to coat; cook until the surface is opaque.', 'active', 4, 5.00],
                ['Pour in the remaining coconut milk, lime leaves, and bamboo shoots and bring to a gentle simmer.', 'active', 2, 3.00],
                ['Let the curry simmer until the chicken is tender and the sauce thickens.', 'passive', 12, 16.00],
                ['Add the bell pepper and zucchini and cook until just tender.', 'active', 3, 4.00],
                ['Season with fish sauce, sugar, lime juice, and Thai basil.', 'active', 1, 2.00],
                ['Wash the pot, knife, and rice cooker.', 'cleanup', null, 8.00],
            ],
        ],

        // 15 — Tacos
        [
            'title' => 'Slow-Cooked Carnitas Tacos',
            'source_url' => 'https://example.com/recipes/carnitas-tacos',
            'ingredients' => [
                '3 lb pork shoulder, cut into chunks',
                '1 orange, juiced',
                '1 lime, juiced',
                '4 garlic cloves, smashed',
                '1 tsp ground cumin',
                '1 tsp dried oregano',
                '1 tsp smoked paprika',
                'Salt and black pepper',
                '1/2 cup water',
                '12 corn tortillas, warmed',
                '1/2 white onion, diced',
                '1/2 cup fresh cilantro, chopped',
                '2 limes, cut into wedges',
                'Salsa verde and pickled red onion, to serve',
            ],
            'steps' => [
                'Slow-braise pork in citrus and spices until fork-tender.',
                'Crisp the shredded pork under the broiler.',
                'Serve on warm tortillas with toppings.',
            ],
            'publisher_time_minutes' => 60,
            'community_avg_minutes' => 95.00,
            'cleanup_avg_minutes' => 10.00,
            'steps_data' => [
                ['Season the pork chunks generously with salt, pepper, cumin, oregano, and paprika.', 'active', 4, 5.00],
                ['Sear the pork in a heavy pot in batches until deeply browned.', 'active', 8, 10.00],
                ['Return the pork to the pot with garlic, orange juice, lime juice, and water.', 'active', 3, 4.00],
                ['Cover and braise on low heat until the pork is fall-apart tender.', 'passive', 60, 72.00],
                ['Shred the pork and spread it on a sheet pan; broil until the edges crisp.', 'active', 4, 5.00],
                ['Warm the tortillas and prep the onion, cilantro, and lime.', 'active', 1, 2.00],
                ['Wash the heavy pot, sheet pan, and shredding forks.', 'cleanup', null, 10.00],
            ],
        ],

        // 16 — Tacos
        [
            'title' => 'Black Bean and Sweet Potato Tacos',
            'source_url' => 'https://example.com/recipes/black-bean-sweet-potato-tacos',
            'ingredients' => [
                '2 medium sweet potatoes, peeled and diced',
                '1 can black beans, drained and rinsed',
                '1 tsp ground cumin',
                '1 tsp smoked paprika',
                '1 tsp chili powder',
                '2 tbsp olive oil',
                '1/2 red onion, diced',
                '2 garlic cloves, minced',
                '8 corn tortillas, warmed',
                '1 ripe avocado, sliced',
                '1/4 cup pickled red onion',
                '1/2 cup crumbled cotija cheese',
                'Fresh cilantro and lime wedges',
                'Hot sauce, to serve',
            ],
            'steps' => [
                'Roast seasoned sweet potatoes until caramelized.',
                'Warm black beans with spices and aromatics.',
                'Build tacos with avocado and cotija.',
            ],
            'publisher_time_minutes' => 35,
            'community_avg_minutes' => 40.00,
            'cleanup_avg_minutes' => 6.00,
            'steps_data' => [
                ['Toss the sweet potato cubes with olive oil, cumin, paprika, and chili powder.', 'active', 4, 5.00],
                ['Roast the sweet potatoes on a sheet pan until tender and caramelized.', 'passive', 22, 25.00],
                ['While they roast, sauté red onion and garlic, then add black beans to warm through.', 'active', 5, 6.00],
                ['Warm the tortillas and slice the avocado.', 'active', 2, 2.00],
                ['Assemble the tacos with sweet potato, beans, avocado, and cotija.', 'active', 1, 2.00],
                ['Wipe down the sheet pan and wash the skillet.', 'cleanup', null, 6.00],
            ],
        ],

        // 17 — Pizza
        [
            'title' => 'Classic Margherita Pizza',
            'source_url' => 'https://example.com/recipes/margherita-pizza',
            'ingredients' => [
                '1 lb pizza dough (store-bought or homemade)',
                '1/2 cup San Marzano tomato sauce',
                '8 oz fresh mozzarella, torn',
                '1 cup fresh basil leaves',
                '2 tbsp extra-virgin olive oil',
                '1 tsp sea salt',
                '1/4 tsp black pepper',
                '2 tbsp semolina flour (for the peel)',
                '1 clove garlic, minced (for the sauce)',
                '1 tbsp olive oil (for the sauce)',
                'Pinch of sugar',
                'Red pepper flakes (optional)',
            ],
            'steps' => [
                'Stretch the dough and preheat a screaming-hot oven.',
                'Top simply with sauce, mozzarella, and oil.',
                'Bake fast, then finish with fresh basil.',
            ],
            'publisher_time_minutes' => 25,
            'community_avg_minutes' => 35.00,
            'cleanup_avg_minutes' => 7.00,
            'steps_data' => [
                ['Let the dough come to room temperature so it stretches easily.', 'passive', 15, 20.00],
                ['Preheat the oven (with stone or steel) to its hottest setting.', 'active', 1, 2.00],
                ['Mix a quick sauce with crushed tomatoes, garlic, oil, salt, and a pinch of sugar.', 'active', 4, 5.00],
                ['Stretch the dough on a semolina-dusted peel into a 12-inch round.', 'active', 3, 4.00],
                ['Top with sauce, torn mozzarella, and a drizzle of olive oil.', 'active', 2, 2.00],
                ['Bake until the crust is charred and the cheese is bubbling.', 'passive', 7, 8.00],
                ['Finish with fresh basil, salt, and pepper.', 'active', 0, 1.00],
                ['Brush off the peel and wash the prep bowl.', 'cleanup', null, 7.00],
            ],
        ],

        // 18 — Pizza
        [
            'title' => 'White Pizza with Mushrooms and Ricotta',
            'source_url' => 'https://example.com/recipes/white-pizza-mushroom-ricotta',
            'ingredients' => [
                '1 lb pizza dough',
                '8 oz whole-milk ricotta',
                '4 oz mozzarella, shredded',
                '1/4 cup grated Parmesan',
                '8 oz cremini mushrooms, sliced',
                '2 garlic cloves, minced',
                '2 tbsp olive oil',
                '1 tbsp butter',
                '1 tsp fresh thyme leaves',
                '1/2 tsp garlic powder',
                '2 tbsp semolina flour',
                'Freshly cracked black pepper',
                'Truffle oil (optional)',
            ],
            'steps' => [
                'Sauté seasoned mushrooms until deeply browned.',
                'Top dough with ricotta, mozzarella, and mushrooms.',
                'Bake hot and finish with thyme and pepper.',
            ],
            'publisher_time_minutes' => 30,
            'community_avg_minutes' => 38.00,
            'cleanup_avg_minutes' => 8.00,
            'steps_data' => [
                ['Preheat the oven and pizza stone to the hottest setting.', 'active', 1, 2.00],
                ['Sauté the mushrooms in butter and oil until deeply browned, then add garlic and thyme.', 'active', 8, 10.00],
                ['Let the mushrooms cool slightly while you prep the cheese.', 'passive', 3, 4.00],
                ['Stretch the dough on a semolina-dusted peel.', 'active', 3, 4.00],
                ['Spread ricotta over the dough and top with mozzarella, mushrooms, and Parmesan.', 'active', 3, 4.00],
                ['Bake until the crust is golden and the cheese is bubbly.', 'passive', 8, 10.00],
                ['Finish with cracked pepper and optional truffle oil.', 'active', 0, 1.00],
                ['Wash the skillet, peel, and bowl.', 'cleanup', null, 8.00],
            ],
        ],

        // 19 — One-pot
        [
            'title' => 'One-Pot Chicken and Rice',
            'source_url' => 'https://example.com/recipes/one-pot-chicken-and-rice',
            'ingredients' => [
                '4 bone-in chicken thighs',
                '1.5 cups long-grain white rice',
                '3 cups chicken broth',
                '1 onion, diced',
                '3 garlic cloves, minced',
                '1 tsp smoked paprika',
                '1 tsp dried thyme',
                '1 bay leaf',
                '2 tbsp olive oil',
                '2 tbsp butter',
                '1/2 cup frozen peas',
                '1 lemon, zested',
                '1/4 cup fresh parsley, chopped',
                'Salt and black pepper',
            ],
            'steps' => [
                'Sear the chicken, then sauté the rice and aromatics in the same pan.',
                'Simmer everything together until the rice is tender.',
                'Rest, then fluff with peas and herbs.',
            ],
            'publisher_time_minutes' => 35,
            'community_avg_minutes' => 45.00,
            'cleanup_avg_minutes' => 5.00,
            'steps_data' => [
                ['Season the chicken thighs with salt, pepper, paprika, and thyme.', 'active', 2, 2.00],
                ['Sear the chicken in olive oil until the skin is crisp; remove and set aside.', 'active', 7, 9.00],
                ['Sauté the onion and garlic in the rendered fat, then toast the rice briefly.', 'active', 4, 5.00],
                ['Pour in the broth and bay leaf and nestle the chicken back in.', 'active', 2, 2.00],
                ['Cover and simmer until the rice is tender and the liquid is absorbed.', 'passive', 18, 22.00],
                ['Off the heat, fold in peas, lemon zest, and parsley and rest covered.', 'passive', 3, 5.00],
                ['Wipe the pan and wash the lid and tongs.', 'cleanup', null, 5.00],
            ],
        ],

        // 20 — One-pot
        [
            'title' => 'One-Pot Creamy Mushroom Orzo',
            'source_url' => 'https://example.com/recipes/creamy-mushroom-orzo',
            'ingredients' => [
                '1.5 cups orzo pasta',
                '4 cups vegetable broth',
                '8 oz mixed mushrooms, sliced',
                '1 shallot, finely diced',
                '3 garlic cloves, minced',
                '1 tsp fresh thyme leaves',
                '1/4 cup dry white wine',
                '1/3 cup heavy cream',
                '1/2 cup grated Parmesan',
                '2 tbsp olive oil',
                '2 tbsp butter',
                '1/4 cup fresh parsley, chopped',
                '1 tsp lemon zest',
                'Salt and black pepper',
            ],
            'steps' => [
                'Brown the mushrooms for deep flavor.',
                'Cook the orzo directly in seasoned broth.',
                'Finish creamy with Parmesan and herbs.',
            ],
            'publisher_time_minutes' => 25,
            'community_avg_minutes' => 32.00,
            'cleanup_avg_minutes' => 5.00,
            'steps_data' => [
                ['Brown the mushrooms in butter and oil until deeply caramelized; set half aside for garnish.', 'active', 7, 9.00],
                ['Sauté the shallot, garlic, and thyme in the same pan.', 'active', 2, 3.00],
                ['Deglaze with white wine, scraping up any browned bits.', 'active', 1, 2.00],
                ['Add the orzo and broth and bring to a boil, then reduce to a simmer.', 'active', 2, 3.00],
                ['Cook, stirring often, until the orzo is tender and creamy.', 'active', 10, 12.00],
                ['Off the heat, stir in the cream, Parmesan, lemon zest, and parsley.', 'active', 2, 3.00],
                ['Wash the pan and stirring spoon.', 'cleanup', null, 5.00],
            ],
        ],

        // 21 — Pasta
        [
            'title' => 'Weeknight Beef Bolognese',
            'source_url' => 'https://example.com/recipes/weeknight-bolognese',
            'ingredients' => [
                '1 lb ground beef',
                '1 onion, diced',
                '2 carrots, diced',
                '2 celery stalks, diced',
                '4 garlic cloves, minced',
                '1 can (28 oz) crushed tomatoes',
                '1/2 cup dry red wine',
                '1/2 cup whole milk',
                '2 tbsp tomato paste',
                '1 tsp dried oregano',
                '1 dried bay leaf',
                '1 lb pappardelle or rigatoni',
                '1/2 cup grated Parmesan',
                '2 tbsp olive oil',
                'Salt and black pepper',
            ],
            'steps' => [
                'Brown the beef and sauté a soffritto.',
                'Simmer the sauce with tomatoes, wine, and milk.',
                'Toss with pasta and finish with cheese.',
            ],
            'publisher_time_minutes' => 45,
            'community_avg_minutes' => 60.00,
            'cleanup_avg_minutes' => 11.00,
            'steps_data' => [
                ['Brown the ground beef in olive oil, breaking it up; drain excess fat.', 'active', 6, 7.00],
                ['Sauté the onion, carrots, and celery until softened, then add the garlic and tomato paste.', 'active', 6, 8.00],
                ['Deglaze with red wine and let it mostly reduce.', 'active', 3, 4.00],
                ['Add the crushed tomatoes, bay leaf, and oregano and bring to a simmer.', 'active', 2, 3.00],
                ['Let the sauce simmer gently, stirring now and then.', 'passive', 25, 32.00],
                ['Stir in the milk to mellow the sauce.', 'active', 1, 2.00],
                ['Boil the pasta until al dente and drain.', 'active', 10, 12.00],
                ['Wash the pot, skillet, and pasta pot.', 'cleanup', null, 11.00],
            ],
        ],

        // 22 — Salad
        [
            'title' => 'Greek Salad with Feta and Olives',
            'source_url' => 'https://example.com/recipes/greek-salad',
            'ingredients' => [
                '4 large ripe tomatoes, wedged',
                '1 English cucumber, sliced',
                '1/2 red onion, sliced',
                '1 green bell pepper, sliced',
                '1 cup Kalamata olives',
                '1 block (8 oz) feta cheese',
                '1/4 cup extra-virgin olive oil',
                '2 tbsp red wine vinegar',
                '1 tsp dried oregano',
                '1 garlic clove, minced',
                '1/2 tsp Dijon mustard',
                'Salt and black pepper',
                'Fresh parsley, to garnish',
            ],
            'steps' => [
                'Whisk a red-wine-vinegar vinaigrette.',
                'Combine chopped vegetables and olives.',
                'Top with a slab of feta and oregano.',
            ],
            'publisher_time_minutes' => 15,
            'community_avg_minutes' => 18.00,
            'cleanup_avg_minutes' => 5.00,
            'steps_data' => [
                ['Whisk olive oil, red wine vinegar, garlic, Dijon, and oregano for the dressing.', 'active', 3, 4.00],
                ['Cut the tomatoes into wedges and slice the cucumber, onion, and bell pepper.', 'active', 5, 6.00],
                ['Combine the vegetables with the olives in a wide bowl.', 'active', 2, 2.00],
                ['Drizzle with dressing and toss gently.', 'active', 1, 1.00],
                ['Let the salad marinate briefly so the juices release.', 'passive', 1, 3.00],
                ['Top with a slab of feta, more oregano, and parsley.', 'active', 0, 1.00],
                ['Wash the knife, bowl, and whisk.', 'cleanup', null, 5.00],
            ],
        ],

        // 23 — Soup
        [
            'title' => 'Quick Chicken Pho',
            'source_url' => 'https://example.com/recipes/quick-chicken-pho',
            'ingredients' => [
                '8 cups chicken broth',
                '1 onion, halved',
                '1 thumb fresh ginger, sliced',
                '2 whole cloves',
                '1 star anise',
                '1 cinnamon stick',
                '1 tbsp fish sauce',
                '1 tbsp sugar',
                '12 oz dried rice noodles',
                '2 cooked chicken breasts, shredded',
                '1/2 small onion, paper-thin slices',
                '1/4 cup fresh cilantro',
                '1/4 cup fresh Thai basil',
                '2 green onions, sliced',
                '1 lime, wedged',
                'Bean sprouts and sriracha, to serve',
            ],
            'steps' => [
                'Char the aromatics and build a quick spiced broth.',
                'Soften rice noodles and warm the chicken.',
                'Assemble bowls with fresh herbs and lime.',
            ],
            'publisher_time_minutes' => 35,
            'community_avg_minutes' => 44.00,
            'cleanup_avg_minutes' => 9.00,
            'steps_data' => [
                ['Char the halved onion and ginger slices over an open flame or in a dry pan.', 'active', 5, 6.00],
                ['Toast the cloves, star anise, and cinnamon briefly to release their oils.', 'active', 2, 2.00],
                ['Combine broth with the charred aromatics and spices; simmer to infuse.', 'passive', 18, 24.00],
                ['Strain the broth and season with fish sauce and sugar.', 'active', 3, 4.00],
                ['Soak the rice noodles in hot water until tender, then drain.', 'active', 5, 6.00],
                ['Divide noodles and shredded chicken into bowls and ladle hot broth over.', 'active', 2, 2.00],
                ['Wash the stockpot, strainer, and noodle bowl.', 'cleanup', null, 9.00],
            ],
        ],

        // 24 — Breakfast
        [
            'title' => 'Shakshuka with Feta',
            'source_url' => 'https://example.com/recipes/shakshuka-feta',
            'ingredients' => [
                '1 can (28 oz) crushed tomatoes',
                '1 onion, diced',
                '2 bell peppers, diced',
                '4 garlic cloves, minced',
                '1 tsp ground cumin',
                '1 tsp smoked paprika',
                '1/2 tsp cayenne',
                '6 large eggs',
                '1/2 cup feta, crumbled',
                '2 tbsp olive oil',
                '1 tbsp tomato paste',
                '1/4 cup fresh parsley, chopped',
                '1/4 cup fresh cilantro, chopped',
                'Crusty bread or pita, to serve',
            ],
            'steps' => [
                'Build a spiced pepper-and-tomato sauce.',
                'Crack eggs into wells and simmer to set.',
                'Finish with feta and herbs; serve with bread.',
            ],
            'publisher_time_minutes' => 30,
            'community_avg_minutes' => 36.00,
            'cleanup_avg_minutes' => 7.00,
            'steps_data' => [
                ['Sauté the onion and bell peppers in olive oil until softened.', 'active', 6, 7.00],
                ['Add the garlic, cumin, smoked paprika, cayenne, and tomato paste and cook until fragrant.', 'active', 2, 3.00],
                ['Pour in the crushed tomatoes and simmer until thickened.', 'passive', 12, 15.00],
                ['Make six wells in the sauce and crack an egg into each.', 'active', 2, 3.00],
                ['Cover and simmer gently until the egg whites are set but yolks are soft.', 'passive', 6, 8.00],
                ['Scatter with crumbled feta, parsley, and cilantro.', 'active', 1, 1.00],
                ['Wash the skillet, lid, and cutting board.', 'cleanup', null, 7.00],
            ],
        ],
    ];
}
