<?php

namespace App\Filament\Pages;

use App\Models\AppRelease;
use BackedEnum;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Schemas\Schema;
use Illuminate\Support\Facades\Storage;
use UnitEnum;

/**
 * "App releases" — upload a new signed APK and it instantly becomes the
 * file GET /download serves. No Play Store in the loop: this admin page
 * IS the release pipeline.
 */
class ManageAppReleases extends Page
{
    protected static BackedEnum|string|null $navigationIcon = 'heroicon-o-arrow-down-tray';

    protected string $view = 'filament.pages.manage-app-releases';

    protected static UnitEnum|string|null $navigationGroup = 'Content';

    protected static ?string $navigationLabel = 'App releases';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill();
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('version')
                    ->label('Version name')
                    ->required()
                    ->maxLength(32)
                    ->placeholder('1.0.0')
                    ->helperText('Shown on the landing page and in the APK filename.'),
                FileUpload::make('file')
                    ->label('Signed APK')
                    ->required()
                    ->disk('local')
                    ->directory('apks')
                    ->acceptedFileTypes(['application/vnd.android.package-archive', 'application/octet-stream'])
                    ->maxSize(65_536) // 64 MB in KB
                    ->helperText('The arm64 release APK built via `eas build --profile production-apk`. Max 64 MB.')
                    ->columnSpanFull(),
                Textarea::make('notes')
                    ->label('Release notes (optional)')
                    ->maxLength(1000)
                    ->columnSpanFull(),
            ])
            ->statePath('data');
    }

    /**
     * Publish the uploaded build. NOTE the name: never call this action
     * `upload` — that collides with Livewire's client-side $wire.upload()
     * file-helper, and wire:submit="upload" then runs the JS helper with
     * undefined args ("Cannot read properties of undefined (reading
     * 'name')" in supportFileUploads) instead of this method.
     */
    public function publish(): void
    {
        $data = $this->form->getState();
        $disk = Storage::disk('local');

        // Content check, not extension trust: an APK is a ZIP archive, so
        // the stored upload must literally start with the PK\x03\x04 magic
        // before it can become the payload GET /download serves.
        $stream = $disk->readStream((string) $data['file']);
        $magic = is_resource($stream) ? (string) stream_get_contents($stream, 4) : '';
        if (is_resource($stream)) {
            fclose($stream);
        }

        if ($magic !== "PK\x03\x04") {
            $disk->delete((string) $data['file']);

            Notification::make()
                ->title('Upload rejected')
                ->body('That file does not look like a valid APK/ZIP (missing PK header). Nothing was published.')
                ->danger()
                ->send();

            return;
        }

        $release = AppRelease::create([
            'version' => (string) $data['version'],
            'file_path' => (string) $data['file'],
            'file_size' => $disk->size((string) $data['file']),
            'sha256' => hash_file('sha256', $disk->path((string) $data['file'])) ?: null,
            'notes' => $data['notes'] ?? null,
            'uploaded_by' => auth()->id(),
        ]);

        $this->form->fill();

        Notification::make()
            ->title("Release {$release->version} published")
            ->body('/download now serves this build.')
            ->success()
            ->send();
    }

    public function deleteRelease(int $id): void
    {
        $release = AppRelease::find($id);
        if ($release === null) {
            return;
        }
        // Best-effort file cleanup; rows with a vanished file still 404 safely.
        try {
            Storage::disk('local')->delete($release->file_path);
        } catch (\Throwable) {
        }
        $release->delete();

        Notification::make()
            ->title("Release {$release->version} deleted")
            ->success()
            ->send();
    }

    protected function getViewData(): array
    {
        return [
            'releases' => AppRelease::query()->latest('id')->limit(20)->get(),
            'latest' => AppRelease::latest(),
        ];
    }
}
