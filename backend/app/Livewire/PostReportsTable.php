<?php

namespace App\Livewire;

use App\Filament\Resources\PostReportResource;
use App\Models\PostReport;
use Filament\Actions\Concerns\InteractsWithActions;
use Filament\Actions\Contracts\HasActions;
use Filament\Schemas\Concerns\InteractsWithSchemas;
use Filament\Schemas\Contracts\HasSchemas;
use Filament\Tables\Concerns\InteractsWithTable;
use Filament\Tables\Contracts\HasTable;
use Filament\Tables\Table;
use Livewire\Component;

/**
 * Post-report queue table, embedded as a tab on the combined Reports page.
 * The full table definition (columns, filters, Dismiss/Remove/Ban actions)
 * is shared with PostReportResource so both surfaces stay identical.
 */
class PostReportsTable extends Component implements HasActions, HasSchemas, HasTable
{
    use InteractsWithActions;
    use InteractsWithSchemas;
    use InteractsWithTable;

    public function table(Table $table): Table
    {
        return PostReportResource::table($table)->query(PostReport::query());
    }

    public function render()
    {
        return view('livewire.post-reports-table');
    }
}
