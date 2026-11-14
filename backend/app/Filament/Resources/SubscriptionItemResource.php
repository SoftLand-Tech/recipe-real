<?php

namespace App\Filament\Resources;

use App\Filament\Resources\SubscriptionItemResource\Pages;
use BackedEnum;
use Filament\Actions\ViewAction;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use Laravel\Cashier\SubscriptionItem;
use UnitEnum;

class SubscriptionItemResource extends Resource
{
    protected static ?string $model = SubscriptionItem::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedReceiptPercent;

    protected static string|UnitEnum|null $navigationGroup = 'People';

    public static function getModelLabel(): string
    {
        return 'Subscription item';
    }

    public static function getPluralModelLabel(): string
    {
        return 'Subscription items';
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit(Model $record): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Grid::make(2)
                    ->schema([
                        TextEntry::make('subscription.user.name')
                            ->label('User'),
                        TextEntry::make('subscription.name')
                            ->label('Plan'),
                        TextEntry::make('stripe_product')
                            ->label('Stripe product')
                            ->copyable(),
                        TextEntry::make('stripe_price')
                            ->label('Stripe price')
                            ->copyable(),
                        TextEntry::make('quantity'),
                        TextEntry::make('stripe_id')
                            ->label('Stripe ID')
                            ->copyable(),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('id')
                    ->sortable(),
                TextColumn::make('subscription.user.name')
                    ->label('User')
                    ->searchable(),
                TextColumn::make('subscription.name')
                    ->label('Plan'),
                TextColumn::make('stripe_product')
                    ->label('Product')
                    ->limit(24),
                TextColumn::make('stripe_price')
                    ->label('Price')
                    ->limit(24),
                TextColumn::make('quantity'),
            ])
            ->defaultSort('id', 'desc')
            ->recordActions([
                ViewAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListSubscriptionItems::route('/'),
            'view' => Pages\ViewSubscriptionItem::route('/{record}'),
        ];
    }
}
