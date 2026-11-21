<?php

namespace App\Services\RecipeDedup\Data;

/**
 * The normalized culinary identity of a recipe: what it IS culinarily,
 * independent of title, wording, or description style.
 *
 * This DTO is the contract shared by fingerprinting, embeddings, scoring,
 * the AI judge, and generation. It serializes to plain JSON (stored in
 * recipe_fingerprints.identity and embedded into the vector payload), so
 * every property is scalar or list-of-scalar/list-of-assoc-array.
 *
 * Additive changes require bumping VERSION (fingerprints are re-extracted
 * when the version changes; see recipe_fingerprints.version).
 */
final class CulinaryIdentity
{
    public const VERSION = 1;

    /**
     * @param  string  $canonicalDish  lowercase canonical dish name, e.g.
     *                                 "spaghetti carbonara" (empty string when unknown)
     * @param  string|null  $dishFamily  coarse family: pasta|breakfast|dessert|main_dish|appetizer|soup|salad|bread|sauce|drink|other
     * @param  string|null  $cuisine  e.g. italian|egyptian|… (null when unknown)
     * @param  string|null  $category  platform category (passthrough)
     * @param  string|null  $form  food form: spaghetti|patty|pastry|layers|drink|…
     * @param  list<array{item:string,qty:float|null,unit:string|null,raw:string|null}>  $mainIngredients
     * @param  list<array{item:string,qty:float|null,unit:string|null,raw:string|null}>  $supportingIngredients
     * @param  list<string>  $techniques  canonical technique classes (saute, bake, simmer, …)
     * @param  string|null  $cookingMethod  boiling|baking|frying|grilling|roasting|steaming|braising|no_heat|…
     * @param  string|null  $prepMethod  blended|marinated|assembled|kneaded|whipped|…
     * @param  list<string>  $sauces  sauce types present (tomato, cream_based, …)
     * @param  list<string>  $flavorMarkers  strong taste/heat markers (spicy, smoky, sweet, …)
     * @param  list<string>  $characteristics  freeform distinguishing notes
     */
    public function __construct(
        public readonly string $canonicalDish,
        public readonly ?string $dishFamily,
        public readonly ?string $cuisine,
        public readonly ?string $category,
        public readonly ?string $form,
        public readonly array $mainIngredients,
        public readonly array $supportingIngredients,
        public readonly array $techniques,
        public readonly ?string $cookingMethod,
        public readonly ?string $prepMethod,
        public readonly array $sauces,
        public readonly array $flavorMarkers,
        public readonly array $characteristics,
        public readonly int $version = self::VERSION,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'version' => $this->version,
            'canonical_dish' => $this->canonicalDish,
            'dish_family' => $this->dishFamily,
            'cuisine' => $this->cuisine,
            'category' => $this->category,
            'form' => $this->form,
            'main_ingredients' => $this->mainIngredients,
            'supporting_ingredients' => $this->supportingIngredients,
            'techniques' => $this->techniques,
            'cooking_method' => $this->cookingMethod,
            'prep_method' => $this->prepMethod,
            'sauces' => $this->sauces,
            'flavor_markers' => $this->flavorMarkers,
            'characteristics' => $this->characteristics,
        ];
    }

    /** @param array<string, mixed> $array */
    public static function fromArray(array $array): self
    {
        $version = (int) ($array['version'] ?? self::VERSION);

        return new self(
            canonicalDish: (string) ($array['canonical_dish'] ?? ''),
            dishFamily: $array['dish_family'] ?? null,
            cuisine: $array['cuisine'] ?? null,
            category: $array['category'] ?? null,
            form: $array['form'] ?? null,
            mainIngredients: self::ingredientList($array['main_ingredients'] ?? []),
            supportingIngredients: self::ingredientList($array['supporting_ingredients'] ?? []),
            techniques: self::stringList($array['techniques'] ?? []),
            cookingMethod: $array['cooking_method'] ?? null,
            prepMethod: $array['prep_method'] ?? null,
            sauces: self::stringList($array['sauces'] ?? []),
            flavorMarkers: self::stringList($array['flavor_markers'] ?? []),
            characteristics: self::stringList($array['characteristics'] ?? []),
            version: $version,
        );
    }

    /** @return list<string> */
    public function mainIngredientNames(): array
    {
        return self::filterNames($this->mainIngredients);
    }

    /** @return list<string> */
    public function supportingIngredientNames(): array
    {
        return self::filterNames($this->supportingIngredients);
    }

    /** @return list<string> */
    public function allIngredientNames(): array
    {
        return [
            ...$this->mainIngredientNames(),
            ...$this->supportingIngredientNames(),
        ];
    }

    /**
     * @param  list<array{item:string,qty:float|null,unit:string|null,raw:string|null}>  $items
     * @return list<string>
     */
    private static function filterNames(array $items): array
    {
        $names = array_map(
            fn (array $item): string => (string) ($item['item'] ?? ''),
            array_values($items),
        );

        return array_values(array_filter($names, fn (string $name): bool => $name !== ''));
    }

    /**
     * @return list<array{item:string,qty:float|null,unit:string|null,raw:string|null}>
     */
    private static function ingredientList(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $list = [];
        foreach ($value as $item) {
            if (! is_array($item)) {
                continue;
            }

            $list[] = [
                'item' => (string) ($item['item'] ?? ''),
                'qty' => isset($item['qty']) && is_numeric($item['qty']) ? (float) $item['qty'] : null,
                'unit' => $item['unit'] ?? null,
                'raw' => $item['raw'] ?? null,
            ];
        }

        return $list;
    }

    /** @param  mixed  $value @return list<string> */
    private static function stringList(mixed $value): array
    {
        return array_values(array_filter(
            is_array($value) ? array_map(strval(...), $value) : [],
            fn (string $item): bool => $item !== '',
        ));
    }
}
