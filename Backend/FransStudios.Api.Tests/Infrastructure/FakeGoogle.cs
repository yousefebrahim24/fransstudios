using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.WebUtilities;

namespace FransStudios.Api.Tests.Infrastructure;

public sealed record FakeItem(string Id, string Name, string MimeType, string? ParentId, byte[] Bytes);

/// <summary>In-memory stand-in for the Google OAuth and Drive v3 endpoints the app calls.</summary>
public sealed class FakeDrive
{
    public const string AccessToken = "test-access-token";
    public ConcurrentDictionary<string, FakeItem> Items { get; } = new();
    public int MediaRequests;

    public FakeItem Folder(string id, string name, string? parent = null) =>
        Items[id] = new FakeItem(id, name, "application/vnd.google-apps.folder", parent, []);

    public FakeItem File(string id, string name, string mime, string parent, int size = 1000)
    {
        var bytes = new byte[size];
        for (var i = 0; i < size; i++) bytes[i] = (byte)(i % 251);
        return Items[id] = new FakeItem(id, name, mime, parent, bytes);
    }
}

public sealed partial class FakeGoogleHandler(FakeDrive drive) : HttpMessageHandler
{
    private static readonly byte[] TinyJpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 0x4A, 0x46, 0x49, 0x46, 0, 1];

    [GeneratedRegex(@"'([^']+)' in parents")]
    private static partial Regex ParentQuery();

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var uri = request.RequestUri!;

        if (uri.Host == "oauth2.googleapis.com" && uri.AbsolutePath == "/token")
            return Json(new { access_token = FakeDrive.AccessToken, expires_in = 3600, scope = "https://www.googleapis.com/auth/drive.readonly" });

        if (request.Headers.Authorization?.Parameter != FakeDrive.AccessToken)
            return new HttpResponseMessage(HttpStatusCode.Unauthorized);

        if (uri.Host == "lh3.googleusercontent.com")
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(TinyJpeg) };

        if (uri.Host != "www.googleapis.com" || !uri.AbsolutePath.StartsWith("/drive/v3/"))
            return new HttpResponseMessage(HttpStatusCode.NotFound);

        var parsed = QueryHelpers.ParseQuery(uri.Query);
        var query = new Func<string, string>(k => parsed.TryGetValue(k, out var v) ? v.ToString() : "");
        var path = uri.AbsolutePath["/drive/v3/".Length..];

        if (path == "files")
        {
            var q = query("q");
            var parent = ParentQuery().Match(q) is { Success: true } m ? m.Groups[1].Value : null;
            var foldersOnly = q.Contains("mimeType = 'application/vnd.google-apps.folder'");
            var files = drive.Items.Values
                .Where(i => i.ParentId == parent && (!foldersOnly || i.MimeType.EndsWith("folder")))
                .Select(ToJson).ToList();
            return Json(new { files });
        }

        if (path.StartsWith("files/"))
        {
            var id = path["files/".Length..];
            if (!drive.Items.TryGetValue(id, out var item))
                return Json(new { error = new { code = 404, message = "File not found", errors = new[] { new { reason = "notFound" } } } }, HttpStatusCode.NotFound);

            if (query("alt") == "media")
            {
                Interlocked.Increment(ref drive.MediaRequests);
                return Media(item.Bytes, request.Headers.Range);
            }
            if (query("fields") == "thumbnailLink")
                return Json(new { thumbnailLink = $"https://lh3.googleusercontent.com/thumb/{id}=s220" });
            return Json(ToJson(item));
        }

        await Task.CompletedTask;
        return new HttpResponseMessage(HttpStatusCode.NotFound);
    }

    private static Dictionary<string, object?> ToJson(FakeItem i) => new()
    {
        ["id"] = i.Id,
        ["name"] = i.Name,
        ["mimeType"] = i.MimeType,
        ["size"] = i.MimeType.EndsWith("folder") ? null : i.Bytes.Length.ToString(),
        ["modifiedTime"] = "2026-09-01T10:00:00.000Z",
        ["hasThumbnail"] = i.MimeType.StartsWith("image/") || i.MimeType.StartsWith("video/"),
        ["trashed"] = false,
        ["parents"] = i.ParentId is null ? Array.Empty<string>() : new[] { i.ParentId },
    };

    private static HttpResponseMessage Media(byte[] bytes, RangeHeaderValue? range)
    {
        if (range is null)
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(bytes) };

        var r = range.Ranges.Single();
        long from = r.From ?? bytes.Length - r.To!.Value;
        long to = r.From is null ? bytes.Length - 1 : Math.Min(r.To ?? bytes.Length - 1, bytes.Length - 1);
        if (from >= bytes.Length)
            return new HttpResponseMessage(HttpStatusCode.RequestedRangeNotSatisfiable);

        var content = new ByteArrayContent(bytes, (int)from, (int)(to - from + 1));
        content.Headers.ContentRange = new ContentRangeHeaderValue(from, to, bytes.Length);
        return new HttpResponseMessage(HttpStatusCode.PartialContent) { Content = content };
    }

    private static HttpResponseMessage Json(object body, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status) { Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json") };
}
