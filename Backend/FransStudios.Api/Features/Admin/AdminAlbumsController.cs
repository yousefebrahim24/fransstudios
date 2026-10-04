using System.ComponentModel.DataAnnotations;
using FransStudios.Api.Authentication;
using FransStudios.Api.Data;
using FransStudios.Api.Entities;
using FransStudios.Api.GoogleDrive;
using FransStudios.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FransStudios.Api.Features.Admin;

public sealed record AlbumListItem(int Id, Guid PublicId, string Title, int ClientId, string ClientName, AlbumStatus Status,
    int FileCount, long TotalBytes, string? DriveFolderName, DateTime? LastSyncedAt, string? LastSyncError,
    DateOnly? EventDate, Guid? CoverFileId, DateTime UpdatedAt);

public sealed record SectionInfo(string Name, int Count);

public sealed record AlbumDetail(int Id, Guid PublicId, string Title, string? Description, DateOnly? EventDate,
    int ClientId, string ClientName, AlbumStatus Status, bool DownloadsEnabled,
    string? DriveFolderId, string? DriveFolderName, Guid? CoverFileId,
    int FileCount, long TotalBytes, DateTime? LastSyncedAt, string? LastSyncError,
    IReadOnlyList<SectionInfo> Sections, DateTime CreatedAt, DateTime UpdatedAt);

public sealed record AlbumFileDto(Guid Id, string Name, string Section, MediaKind Kind, string MimeType, long SizeBytes,
    int? Width, int? Height, long? DurationMs, bool HasThumbnail);

public sealed record SaveAlbumRequest(
    [Range(1, int.MaxValue)] int ClientId,
    [Required, StringLength(200, MinimumLength = 1)] string Title,
    [StringLength(4000)] string? Description,
    DateOnly? EventDate,
    AlbumStatus Status,
    bool DownloadsEnabled = true,
    /// <summary>Optional on create: Drive folder id or folder URL.</summary>
    [StringLength(500)] string? DriveFolder = null);

public sealed record AssignFolderRequest([Required, StringLength(500)] string Folder);

public sealed record SetCoverRequest(Guid FileId);

[ApiController]
[Route("api/admin/albums")]
[Authorize(Policy = Policies.Admin)]
public sealed class AdminAlbumsController(
    AppDbContext db,
    DriveClient drive,
    AlbumSyncService sync,
    AuditService audit,
    TimeProvider clock) : ControllerBase
{
    [HttpGet]
    public async Task<Paged<AlbumListItem>> List(int? clientId, AlbumStatus? status, string? search,
        int page = 1, int pageSize = 25, CancellationToken ct = default)
    {
        var q = db.Albums.AsNoTracking();
        if (clientId is not null) q = q.Where(a => a.ClientId == clientId);
        if (status is not null) q = q.Where(a => a.Status == status);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(a => a.Title.Contains(s) || a.Client.FullName.Contains(s));
        }
        return await q.OrderByDescending(a => a.UpdatedAt)
            .Select(a => new AlbumListItem(a.Id, a.PublicId, a.Title, a.ClientId, a.Client.FullName, a.Status,
                a.FileCount, a.TotalBytes, a.DriveFolderName, a.LastSyncedAt, a.LastSyncError, a.EventDate, a.CoverFileId, a.UpdatedAt))
            .ToPagedAsync(page, pageSize, ct);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AlbumDetail>> Get(int id, CancellationToken ct)
    {
        var album = await db.Albums.AsNoTracking().Include(a => a.Client).SingleOrDefaultAsync(a => a.Id == id, ct);
        if (album is null) return this.NotFoundProblem("Album not found.");
        return await ToDetailAsync(album, ct);
    }

    [HttpPost]
    public async Task<ActionResult<AlbumDetail>> Create(SaveAlbumRequest request, CancellationToken ct)
    {
        if (!await db.Clients.AnyAsync(c => c.Id == request.ClientId, ct)) return this.FieldError("clientId", "Client not found.");

        var album = new Album
        {
            ClientId = request.ClientId,
            Title = request.Title.Trim(),
            Description = Clean(request.Description),
            EventDate = request.EventDate,
            Status = AlbumStatus.Draft,
            DownloadsEnabled = request.DownloadsEnabled,
        };

        if (!string.IsNullOrWhiteSpace(request.DriveFolder))
        {
            var error = await ApplyFolderAsync(album, request.DriveFolder, ct);
            if (error is not null) return this.FieldError("driveFolder", error);
        }
        if (request.Status == AlbumStatus.Published && album.DriveFolderId is null)
            return this.FieldError("status", "Assign a Google Drive folder before publishing.");
        album.Status = request.Status;

        db.Albums.Add(album);
        await db.SaveChangesAsync(ct);
        await audit.WriteAsync(AuditActions.AlbumCreated, "Album", album.Id, new { album.Title, album.ClientId }, ct: ct);

        if (album.DriveFolderId is not null) await sync.SyncAsync(album.Id, ct);
        var created = await db.Albums.AsNoTracking().Include(a => a.Client).SingleAsync(a => a.Id == album.Id, ct);
        return CreatedAtAction(nameof(Get), new { id = album.Id }, await ToDetailAsync(created, ct));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, SaveAlbumRequest request, CancellationToken ct)
    {
        var album = await db.Albums.SingleOrDefaultAsync(a => a.Id == id, ct);
        if (album is null) return this.NotFoundProblem("Album not found.");
        if (request.ClientId != album.ClientId && !await db.Clients.AnyAsync(c => c.Id == request.ClientId, ct))
            return this.FieldError("clientId", "Client not found.");
        if (request.Status == AlbumStatus.Published && album.DriveFolderId is null)
            return this.FieldError("status", "Assign a Google Drive folder before publishing.");

        var changes = new { From = new { album.ClientId, album.Status }, To = new { request.ClientId, request.Status } };
        album.ClientId = request.ClientId;
        album.Title = request.Title.Trim();
        album.Description = Clean(request.Description);
        album.EventDate = request.EventDate;
        album.Status = request.Status;
        album.DownloadsEnabled = request.DownloadsEnabled;
        audit.Add(AuditActions.AlbumUpdated, "Album", id, changes);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPut("{id:int}/drive-folder")]
    public async Task<ActionResult<AlbumDetail>> AssignFolder(int id, AssignFolderRequest request, CancellationToken ct)
    {
        var album = await db.Albums.SingleOrDefaultAsync(a => a.Id == id, ct);
        if (album is null) return this.NotFoundProblem("Album not found.");

        var previous = album.DriveFolderId;
        var error = await ApplyFolderAsync(album, request.Folder, ct);
        if (error is not null) return this.FieldError("folder", error);

        if (previous != album.DriveFolderId)
        {
            // New folder → previous index no longer applies.
            await db.AlbumFiles.Where(f => f.AlbumId == id).ExecuteUpdateAsync(u => u.SetProperty(f => f.IsRemoved, true), ct);
            album.CoverFileId = null;
        }
        audit.Add(AuditActions.AlbumFolderAssigned, "Album", id, new { album.DriveFolderId, album.DriveFolderName });
        await db.SaveChangesAsync(ct);
        await sync.SyncAsync(id, ct);

        var updated = await db.Albums.AsNoTracking().Include(a => a.Client).SingleAsync(a => a.Id == id, ct);
        return await ToDetailAsync(updated, ct);
    }

    [HttpPost("{id:int}/sync")]
    public async Task<ActionResult<SyncResult>> Sync(int id, CancellationToken ct)
    {
        if (!await db.Albums.AnyAsync(a => a.Id == id, ct)) return this.NotFoundProblem("Album not found.");
        var result = await sync.SyncAsync(id, ct);
        await audit.WriteAsync(AuditActions.AlbumSynced, "Album", id, new { result.Success, result.FileCount }, ct: ct);
        return result;
    }

    [HttpPut("{id:int}/cover")]
    public async Task<IActionResult> SetCover(int id, SetCoverRequest request, CancellationToken ct)
    {
        var album = await db.Albums.SingleOrDefaultAsync(a => a.Id == id, ct);
        if (album is null) return this.NotFoundProblem("Album not found.");
        var valid = await db.AlbumFiles.AnyAsync(f => f.Id == request.FileId && f.AlbumId == id && !f.IsRemoved && f.Kind == MediaKind.Image, ct);
        if (!valid) return this.FieldError("fileId", "Choose a photo from this album.");
        album.CoverFileId = request.FileId;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("{id:int}/files")]
    public async Task<ActionResult<Paged<AlbumFileDto>>> Files(int id, string? section, MediaKind? kind,
        int page = 1, int pageSize = 100, CancellationToken ct = default)
    {
        if (!await db.Albums.AnyAsync(a => a.Id == id, ct)) return this.NotFoundProblem("Album not found.");
        var q = db.AlbumFiles.AsNoTracking().Where(f => f.AlbumId == id && !f.IsRemoved);
        if (section is not null) q = q.Where(f => f.Section == section || f.Section.StartsWith(section + "/"));
        if (kind is not null) q = q.Where(f => f.Kind == kind);
        (page, pageSize) = ApiHelpers.Clamp(page, pageSize, 500);
        var total = await q.CountAsync(ct);
        var items = await q.OrderBy(f => f.SortOrder).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(f => new AlbumFileDto(f.Id, f.Name, f.Section, f.Kind, f.MimeType, f.SizeBytes, f.Width, f.Height, f.DurationMs, f.HasThumbnail))
            .ToListAsync(ct);
        return new Paged<AlbumFileDto>(items, total, page, pageSize);
    }

    /// <summary>Soft delete. The Drive folder and its files are never modified.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var album = await db.Albums.SingleOrDefaultAsync(a => a.Id == id, ct);
        if (album is null) return this.NotFoundProblem("Album not found.");
        album.DeletedAt = clock.GetUtcNow().UtcDateTime;
        album.Status = AlbumStatus.Disabled;
        audit.Add(AuditActions.AlbumDeleted, "Album", id, new { album.Title });
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /// <summary>Validates the folder against Drive (exists, is a folder, not trashed) and stores id + display path.</summary>
    private async Task<string?> ApplyFolderAsync(Album album, string input, CancellationToken ct)
    {
        var folderId = DriveClient.ExtractId(input);
        if (folderId is null || folderId == "root") return "That doesn't look like a Google Drive folder link or id.";
        try
        {
            var (item, trashed, _) = await drive.GetItemAsync(folderId, ct);
            if (item.MimeType != DriveHttp.FolderMime) return "That Drive item is a file, not a folder.";
            if (trashed) return "That folder is in the Drive trash.";
            album.DriveFolderId = item.Id;
            album.DriveFolderName = Truncate(await drive.GetFolderPathAsync(item.Id, ct), 400);
            return null;
        }
        catch (DriveApiException ex) when (ex.StatusCode == 404)
        {
            return "Folder not found in the connected Google Drive account.";
        }
        catch (DriveNotConnectedException ex)
        {
            return ex.Message;
        }
    }

    private async Task<AlbumDetail> ToDetailAsync(Album a, CancellationToken ct)
    {
        var sections = await SectionsAsync(db, a.Id, ct);
        return new AlbumDetail(a.Id, a.PublicId, a.Title, a.Description, a.EventDate, a.ClientId, a.Client.FullName, a.Status,
            a.DownloadsEnabled, a.DriveFolderId, a.DriveFolderName, a.CoverFileId, a.FileCount, a.TotalBytes,
            a.LastSyncedAt, a.LastSyncError, sections, a.CreatedAt, a.UpdatedAt);
    }

    /// <summary>Top-level sections (first path segment) with file counts, in album order.</summary>
    internal static async Task<List<SectionInfo>> SectionsAsync(AppDbContext db, int albumId, CancellationToken ct)
    {
        var rows = await db.AlbumFiles.AsNoTracking().Where(f => f.AlbumId == albumId && !f.IsRemoved)
            .GroupBy(f => f.Section)
            .Select(g => new { g.Key, Count = g.Count(), First = g.Min(f => f.SortOrder) })
            .ToListAsync(ct);
        return rows
            .GroupBy(r => r.Key.Split('/')[0])
            .Select(g => new { Name = g.Key, Count = g.Sum(x => x.Count), First = g.Min(x => x.First) })
            .OrderBy(x => x.First)
            .Select(x => new SectionInfo(x.Name, x.Count))
            .ToList();
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max];
}

/// <summary>Admin access to any album's files (preview, cover selection). No ownership restriction.</summary>
[ApiController]
[Route("api/admin/files")]
[Authorize(Policy = Policies.Admin)]
public sealed class AdminFilesController(AppDbContext db, AlbumMediaService media) : ControllerBase
{
    [HttpGet("{id:guid}/thumbnail")]
    public async Task<IResult> Thumbnail(Guid id, ThumbSize size = ThumbSize.Small, CancellationToken ct = default)
    {
        var file = await db.AlbumFiles.AsNoTracking().SingleOrDefaultAsync(f => f.Id == id && !f.IsRemoved, ct);
        return file is null ? Results.NotFound() : await media.ThumbnailAsync(file, size, ct);
    }

    [HttpGet("{id:guid}/content")]
    public async Task Content(Guid id, bool download = false, CancellationToken ct = default)
    {
        var file = await db.AlbumFiles.AsNoTracking().SingleOrDefaultAsync(f => f.Id == id && !f.IsRemoved, ct);
        if (file is null) { await Results.NotFound().ExecuteAsync(HttpContext); return; }
        await media.StreamAsync(HttpContext, file, download, ct);
    }
}
