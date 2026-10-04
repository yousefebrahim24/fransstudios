using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace FransStudios.Api.GoogleDrive;

public static class DriveHttp
{
    public const string ApiClient = "google-api";
    public const string MediaClient = "google-media";
    public const string ApiBase = "https://www.googleapis.com/drive/v3/";
    public const string FolderMime = "application/vnd.google-apps.folder";
}

public sealed record DriveFolder(string Id, string Name, DateTime? ModifiedTime);

public sealed record DriveItem(
    string Id,
    string Name,
    string MimeType,
    long? Size,
    DateTime? ModifiedTime,
    bool HasThumbnail,
    int? Width,
    int? Height,
    int? Rotation,
    long? DurationMs);

/// <summary>
/// Thin client over the Google Drive v3 REST API (the official API, called directly with HttpClient).
/// Every call authenticates with the studio's server-held token. Folder/file ids are validated before
/// being placed into Drive query strings.
/// </summary>
public sealed partial class DriveClient(IHttpClientFactory httpFactory, DriveTokenService tokens, ILogger<DriveClient> logger)
{
    // Drive ids are URL-safe base64-ish strings. "root" is the alias for My Drive.
    [GeneratedRegex("^(root|[A-Za-z0-9_-]{10,128})$")]
    private static partial Regex IdPattern();

    public static bool IsValidId(string? id) => id is not null && IdPattern().IsMatch(id);

    /// <summary>Accepts a raw id or a Drive folder/file URL and returns the id, or null.</summary>
    public static string? ExtractId(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;
        input = input.Trim();
        if (IsValidId(input)) return input;
        var m = Regex.Match(input, @"(?:/folders/|/d/|[?&]id=)([A-Za-z0-9_-]{10,128})");
        return m.Success ? m.Groups[1].Value : null;
    }

    private const string ItemFields =
        "id,name,mimeType,size,modifiedTime,hasThumbnail,trashed,parents," +
        "imageMediaMetadata(width,height,rotation),videoMediaMetadata(width,height,durationMillis)";

    // ── Folder browsing (admin picker) ──────────────────────────────────────

    public async Task<List<DriveFolder>> ListFoldersAsync(string parentId, string? search, CancellationToken ct)
    {
        EnsureId(parentId);
        var q = $"mimeType = '{DriveHttp.FolderMime}' and trashed = false";
        q += string.IsNullOrWhiteSpace(search)
            ? $" and '{parentId}' in parents"
            : $" and name contains '{EscapeQ(search.Trim())}'";

        var result = new List<DriveFolder>();
        string? pageToken = null;
        do
        {
            var url = ApiUrl("files", new()
            {
                ["q"] = q,
                ["orderBy"] = "name_natural",
                ["pageSize"] = "200",
                ["fields"] = "nextPageToken,files(id,name,modifiedTime)",
                ["pageToken"] = pageToken,
            });
            using var doc = await GetJsonAsync(url, ct);
            foreach (var f in doc.RootElement.GetProperty("files").EnumerateArray())
                result.Add(new DriveFolder(f.GetProperty("id").GetString()!, f.GetProperty("name").GetString()!, GetDate(f, "modifiedTime")));
            pageToken = doc.RootElement.TryGetProperty("nextPageToken", out var t) ? t.GetString() : null;
        } while (pageToken is not null && result.Count < 1000);

        return result;
    }

    public async Task<(DriveItem Item, bool Trashed, string[] Parents)> GetItemAsync(string id, CancellationToken ct)
    {
        EnsureId(id);
        using var doc = await GetJsonAsync(ApiUrl($"files/{id}", new() { ["fields"] = ItemFields }), ct);
        var e = doc.RootElement;
        var parents = e.TryGetProperty("parents", out var p) ? p.EnumerateArray().Select(x => x.GetString()!).ToArray() : [];
        return (ToItem(e), e.TryGetProperty("trashed", out var tr) && tr.GetBoolean(), parents);
    }

    /// <summary>Human-readable path like "My Drive / Clients / Sara Ahmed Wedding" (display only).</summary>
    public async Task<string> GetFolderPathAsync(string folderId, CancellationToken ct)
    {
        var names = new List<string>();
        var current = folderId;
        for (var depth = 0; depth < 8 && current is not null; depth++)
        {
            var (item, _, parents) = await GetItemAsync(current, ct);
            names.Add(item.Name);
            current = parents.FirstOrDefault();
        }
        names.Reverse();
        return string.Join(" / ", names);
    }

    // ── Album sync ──────────────────────────────────────────────────────────

    public async Task<List<DriveItem>> ListChildrenAsync(string folderId, CancellationToken ct)
    {
        EnsureId(folderId);
        var result = new List<DriveItem>();
        string? pageToken = null;
        do
        {
            var url = ApiUrl("files", new()
            {
                ["q"] = $"'{folderId}' in parents and trashed = false",
                ["pageSize"] = "1000",
                ["fields"] = $"nextPageToken,files({ItemFields})",
                ["pageToken"] = pageToken,
            });
            using var doc = await GetJsonAsync(url, ct);
            foreach (var f in doc.RootElement.GetProperty("files").EnumerateArray()) result.Add(ToItem(f));
            pageToken = doc.RootElement.TryGetProperty("nextPageToken", out var t) ? t.GetString() : null;
        } while (pageToken is not null);
        return result;
    }

    // ── Media ───────────────────────────────────────────────────────────────

    /// <summary>Downloads a Drive thumbnail at the requested pixel size (longest edge). Null if none exists.</summary>
    public async Task<byte[]?> GetThumbnailAsync(string fileId, int size, CancellationToken ct)
    {
        EnsureId(fileId);
        using var doc = await GetJsonAsync(ApiUrl($"files/{fileId}", new() { ["fields"] = "thumbnailLink" }), ct);
        if (!doc.RootElement.TryGetProperty("thumbnailLink", out var link) || link.GetString() is not { } thumbUrl) return null;

        // thumbnailLink ends with a size directive like "=s220"; ask for the size we want.
        thumbUrl = Regex.Replace(thumbUrl, @"=s\d+(-[a-z0-9-]+)?$", $"=s{size}");
        if (!thumbUrl.Contains("=s")) thumbUrl += $"=s{size}";

        using var http = httpFactory.CreateClient(DriveHttp.ApiClient);
        using var req = new HttpRequestMessage(HttpMethod.Get, thumbUrl);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await tokens.GetAccessTokenAsync(ct));
        using var resp = await http.SendAsync(req, ct);
        if (!resp.IsSuccessStatusCode)
        {
            logger.LogInformation("Thumbnail fetch for {FileId} returned {Status}", fileId, (int)resp.StatusCode);
            return null;
        }
        return await resp.Content.ReadAsByteArrayAsync(ct);
    }

    /// <summary>
    /// Opens the file's bytes from Drive, forwarding an optional Range header. The response is returned
    /// with headers read but the body unread, so callers can stream it without buffering.
    /// The caller owns (and must dispose) the returned response.
    /// </summary>
    public async Task<HttpResponseMessage> OpenMediaAsync(string fileId, RangeHeaderValue? range, CancellationToken ct)
    {
        EnsureId(fileId);
        var http = httpFactory.CreateClient(DriveHttp.MediaClient);
        for (var attempt = 0; ; attempt++)
        {
            var req = new HttpRequestMessage(HttpMethod.Get,
                ApiUrl($"files/{fileId}", new() { ["alt"] = "media" }));
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await tokens.GetAccessTokenAsync(ct));
            req.Headers.Range = range;
            var resp = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
            if (resp.StatusCode == HttpStatusCode.Unauthorized && attempt == 0)
            {
                resp.Dispose();
                tokens.InvalidateAccessToken();
                continue;
            }
            return resp;
        }
    }

    public static async Task<DriveApiException> ToExceptionAsync(HttpResponseMessage resp, CancellationToken ct)
    {
        var reason = "unknown";
        var message = resp.ReasonPhrase ?? "Drive request failed.";
        try
        {
            using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
            if (doc.RootElement.TryGetProperty("error", out var err))
            {
                if (err.TryGetProperty("message", out var m)) message = m.GetString() ?? message;
                if (err.TryGetProperty("errors", out var errs) && errs.GetArrayLength() > 0
                    && errs[0].TryGetProperty("reason", out var r)) reason = r.GetString() ?? reason;
            }
        }
        catch (JsonException) { }
        return new DriveApiException((int)resp.StatusCode, reason, message);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private async Task<JsonDocument> GetJsonAsync(string url, CancellationToken ct)
    {
        using var http = httpFactory.CreateClient(DriveHttp.ApiClient);
        for (var attempt = 0; ; attempt++)
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await tokens.GetAccessTokenAsync(ct));
            using var resp = await http.SendAsync(req, ct);

            if (resp.IsSuccessStatusCode)
                return await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync(ct), cancellationToken: ct);

            if (resp.StatusCode == HttpStatusCode.Unauthorized && attempt == 0)
            {
                tokens.InvalidateAccessToken();
                continue;
            }

            var ex = await ToExceptionAsync(resp, ct);
            var retryable = resp.StatusCode is HttpStatusCode.TooManyRequests or >= HttpStatusCode.InternalServerError
                            || ex.Reason is "userRateLimitExceeded" or "rateLimitExceeded";
            if (retryable && attempt < 4)
            {
                // Exponential backoff with jitter, as recommended by the Drive API docs.
                var delay = TimeSpan.FromMilliseconds(Math.Pow(2, attempt) * 500 + Random.Shared.Next(0, 250));
                logger.LogInformation("Drive {Status}/{Reason}; retrying in {Delay}", (int)resp.StatusCode, ex.Reason, delay);
                await Task.Delay(delay, ct);
                continue;
            }
            throw ex;
        }
    }

    private static string ApiUrl(string path, Dictionary<string, string?> query)
    {
        query["supportsAllDrives"] = "true";              // Workspace shared drives work too
        if (path == "files" && !query.ContainsKey("alt")) query["includeItemsFromAllDrives"] = "true";
        return DriveHttp.ApiBase + path + QueryString.Create(query.Where(kv => kv.Value is not null));
    }

    private static void EnsureId(string id)
    {
        if (!IsValidId(id)) throw new ArgumentException("Invalid Google Drive id.", nameof(id));
    }

    /// <summary>Escapes a value for use inside a single-quoted Drive query string.</summary>
    private static string EscapeQ(string value) => value.Replace("\\", "\\\\").Replace("'", "\\'");

    private static DriveItem ToItem(JsonElement f)
    {
        int? width = null, height = null, rotation = null;
        long? duration = null;
        if (f.TryGetProperty("imageMediaMetadata", out var img))
        {
            width = GetInt(img, "width"); height = GetInt(img, "height"); rotation = GetInt(img, "rotation");
        }
        if (f.TryGetProperty("videoMediaMetadata", out var vid))
        {
            width = GetInt(vid, "width"); height = GetInt(vid, "height");
            duration = vid.TryGetProperty("durationMillis", out var d) && long.TryParse(d.GetString(), out var ms) ? ms : null;
        }
        return new DriveItem(
            f.GetProperty("id").GetString()!,
            f.GetProperty("name").GetString()!,
            f.GetProperty("mimeType").GetString()!,
            f.TryGetProperty("size", out var s) && long.TryParse(s.GetString(), out var size) ? size : null,
            GetDate(f, "modifiedTime"),
            f.TryGetProperty("hasThumbnail", out var ht) && ht.GetBoolean(),
            width, height, rotation, duration);
    }

    private static int? GetInt(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt32() : null;

    private static DateTime? GetDate(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.TryGetDateTime(out var d) ? d.ToUniversalTime() : null;
}
