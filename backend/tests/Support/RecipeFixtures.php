<?php

namespace Tests\Support;

/**
 * Realistic recipe fixtures shared by dedup tests (full plausible drafts,
 * not artificial minimums). Extending with more cases: add them inside the
 * owning test file for scenario-specific fixtures, or here when 2+ slices
 * need the same recipe.
 */
final class RecipeFixtures
{
    /** Traditional carbonara #1 — the canonical one. */
    public static function carbonaraRaw(): array
    {
        return [
            'title' => 'Spaghetti Carbonara',
            'description' => 'The classic Roman pasta with eggs, pecorino and guanciale. No cream, ever.',
            'ingredients' => [
                '400 g spaghetti',
                '150 g guanciale, cut into small strips',
                '4 large egg yolks',
                '1 whole egg',
                '100 g Pecorino Romano, finely grated',
                '2 tsp coarsely ground black pepper',
                '1 tsp salt for the pasta water',
            ],
            'steps' => [
                'Bring a large pot of salted water to a boil and cook the spaghetti until al dente.',
                'Render the guanciale in a large skillet over medium heat until golden and crisp, about 8 minutes. Remove from heat.',
                'Whisk the egg yolks, whole egg, pecorino and black pepper into a smooth paste in a bowl.',
                'Drain the pasta, reserving a cup of pasta water.',
                'Toss the hot pasta with the guanciale off the heat, then quickly stir in the egg mixture, loosening with pasta water until silky.',
                'Serve immediately with extra pecorino and black pepper.',
            ],
            'category' => 'Pasta',
            'keywords' => ['carbonara', 'italian', 'roman', 'pasta', 'guanciale'],
            'cuisine' => 'italian',
            'servings' => 4,
            'prep_time_minutes' => 15,
            'cook_time_minutes' => 15,
        ];
    }

    /** Same recipe, different wording and title. */
    public static function carbonaraAlternate(): array
    {
        return [
            'title' => 'Authentic Roman Style Pasta with Egg and Cured Pork',
            'description' => 'A traditional Rome dish made silky with eggs and sheep cheese, finished with cured pork cheek.',
            'ingredients' => [
                '450 grams dry spaghetti pasta',
                '140 grams guanciale (pork cheek), sliced into strips',
                '5 large eggs, separated, yolks only (4 yolks + 1 whole)',
                '90 grams pecorino cheese, grated fine',
                'Coarsely crushed black peppercorns, 2 teaspoons',
            ],
            'steps' => [
                'Boil salted water in a big pot; cook spaghetti al dente.',
                'Crisp the guanciale slowly in a pan on medium heat, then take off the flame.',
                'Mix yolks, one whole egg, grated pecorino and cracked pepper to a paste.',
                'Save a mugful of pasta water and drain the noodles.',
                'Off the heat, combine pasta with pork fat then egg paste, adding water to reach a creamy texture.',
            ],
            'category' => 'Pasta',
            'keywords' => ['roman', 'traditional', 'eggs', 'pasta'],
            'cuisine' => 'italian',
        ];
    }

    /** Classic Alfredo. */
    public static function chickenAlfredoClassic(): array
    {
        return [
            'title' => 'Chicken Alfredo Fettuccine',
            'description' => 'Creamy butter-and-parmesan sauce with grilled chicken over fettuccine.',
            'ingredients' => [
                '450 g fettuccine',
                '600 g chicken breast, sliced',
                '240 ml heavy cream',
                '100 g parmesan, grated',
                '60 g butter',
                '3 cloves garlic, minced',
                '2 tbsp olive oil',
                'Salt and pepper to taste',
                '1 tbsp fresh parsley, chopped',
            ],
            'steps' => [
                'Season the chicken and grill or pan-sear until cooked through, then slice.',
                'Cook fettuccine in salted water until al dente.',
                'Melt butter with garlic in a skillet, pour in cream, and simmer gently.',
                'Whisk in parmesan until smooth; season with salt and pepper.',
                'Toss pasta with sauce and top with sliced chicken and parsley.',
            ],
            'category' => 'Pasta',
            'keywords' => ['alfredo', 'chicken', 'cream', 'italian-american'],
            'cuisine' => 'italian-american',
            'servings' => 4,
            'prep_time_minutes' => 15,
            'cook_time_minutes' => 25,
        ];
    }

    /** Meaningful variation: spiced + a real ingredient delta, but same dish family. */
    public static function chickenAlfredoSpicy(): array
    {
        return [
            'title' => 'Spicy Cajun Chicken Alfredo',
            'description' => 'Heat-lovers Alfredo: cajun-spiced seared chicken and a pinch of cayenne in the cream.',
            'ingredients' => [
                '450 g fettuccine',
                '600 g chicken breast, sliced',
                '3 tbsp cajun seasoning',
                '1 tsp cayenne pepper',
                '240 ml heavy cream',
                '100 g parmesan, grated',
                '60 g butter',
                '3 cloves garlic, minced',
                '2 tbsp olive oil',
            ],
            'steps' => [
                'Coat the chicken in cajun seasoning and sear hard until deeply browned, then slice.',
                'Cook fettuccine in salted water until al dente.',
                'Melt butter with garlic, add cream and cayenne, simmer gently.',
                'Whisk in parmesan until smooth.',
                'Toss pasta with creamy sauce and cajun chicken.',
            ],
            'category' => 'Pasta',
            'keywords' => ['alfredo', 'spicy', 'cajun', 'chicken'],
            'cuisine' => 'italian-american',
            'servings' => 4,
            'prep_time_minutes' => 15,
            'cook_time_minutes' => 25,
        ];
    }

    /** Egyptian breakfast classic. */
    public static function foulMedames(): array
    {
        return [
            'title' => 'Egyptian Ful Medames',
            'description' => 'Slow-simmered fava beans mashed with olive oil, lemon, cumin and garlic, the national breakfast.',
            'ingredients' => [
                '400 g dried fava beans, soaked overnight',
                '5 cloves garlic, mashed',
                '60 ml olive oil',
                '2 lemons, juiced',
                '1 tsp ground cumin',
                '1 tsp salt',
                '2 tbsp fresh parsley, chopped',
                '1 medium tomato, diced (optional)',
            ],
            'steps' => [
                'Simmer the soaked fava beans in fresh water until very tender, 60-90 minutes.',
                'Mash the beans coarsely with some of their cooking liquid.',
                'Stir in mashed garlic, cumin and salt.',
                'Whisk olive oil and lemon juice and pour over the beans.',
                'Top with parsley and tomato and serve warm with bread.',
            ],
            'category' => 'Breakfast',
            'keywords' => ['ful', 'fava beans', 'egyptian', 'breakfast', 'vegan'],
            'cuisine' => 'egyptian',
            'servings' => 4,
            'prep_time_minutes' => 15,
            'cook_time_minutes' => 90,
        ];
    }

    /** Same main ingredients (beans/spices) but a genuinely different dish. */
    public static function kupuraBeanStew(): array
    {
        return [
            'title' => 'Spiced Fava Bean and Vegetable Stew',
            'description' => 'A hearty winter stew of fava beans simmered with tomatoes and vegetables.',
            'ingredients' => [
                '400 g dried fava beans, soaked overnight',
                '4 cloves garlic, mashed',
                '45 ml olive oil',
                '1 large onion, diced',
                '2 medium carrots, sliced',
                '3 medium tomatoes, chopped',
                '1 tsp ground cumin',
                '1 tsp paprika',
                '1 litre vegetable stock',
                '1 tsp salt',
            ],
            'steps' => [
                'Sweat the onion and carrots in olive oil until soft.',
                'Add garlic, tomatoes and spices; cook until jammy.',
                'Add soaked beans and stock and simmer 90 minutes until the beans are tender.',
                'Season and serve in deep bowls.',
            ],
            'category' => 'Soups',
            'keywords' => ['stew', 'fava beans', 'vegan'],
            'cuisine' => 'levantine',
            'servings' => 5,
            'prep_time_minutes' => 15,
            'cook_time_minutes' => 110,
        ];
    }

    /** Regional variation: same dish family, different regionality. */
    public static function shakshukaCaftan(): array
    {
        return [
            'title' => 'Shakshuka',
            'description' => 'Eggs poached in a spiced tomato and pepper sauce.',
            'ingredients' => [
                '4 eggs',
                '4 medium tomatoes, chopped',
                '2 red bell peppers, sliced',
                '1 onion, diced',
                '3 cloves garlic, minced',
                '1 tsp sweet paprika',
                '1 tsp cumin',
                '3 tbsp olive oil',
                'salt to taste',
            ],
            'steps' => [
                'Fry onion and peppers in olive oil until soft.',
                'Add garlic and spices, then tomatoes; simmer 15 minutes into a sauce.',
                'Make wells in the sauce and crack in the eggs.',
                'Cover and cook until the whites set, yolks runny.',
            ],
            'category' => 'Breakfast',
            'keywords' => ['shakshuka', 'eggs', 'middle eastern'],
            'cuisine' => 'levantine',
            'servings' => 2,
            'prep_time_minutes' => 15,
            'cook_time_minutes' => 30,
        ];
    }
}
