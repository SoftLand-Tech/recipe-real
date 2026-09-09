<?php

namespace App\Livewire;

use App\Filament\Resources\CommentReportResource;
use App\Models\CommentReport;
use Filament\Actions\Concerns\InteractsWithActions;
use Filament\Actions\Contracts\HasActions;
use Filament\Schemas\Concerns\InteractsWithSchemas;
use Filament\Schemas\Contracts\HasSchemas;
use Filament\Tables\Concerns\InteractsWithTable;
use Filament\Tables\Contracts\HasTable;
use Filament\Tables\Table;
use Livewire\Component;

/**
 * Comment-report queue table, embedded as a tab on the combined Reports
 * page. The full table definition is shared with CommentReportResource.
 */
class CommentReportsTable extends Component implements HasActions, HasSchemas, HasTable
{
    use InteractsWithActions;
    use InteractsWithSchemas;
    use InteractsWithTable;

    public function table(Table $table): Table
    {
        return CommentReportResource::table($table)->query(CommentReport::query());
    }

    public function render()
    {
        return view('livewire.comment-reports-table');
    }
}
