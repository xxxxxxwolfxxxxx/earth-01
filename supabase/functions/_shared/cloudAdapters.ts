// Provider-agnostisches Cloud-Storage-Interface.
// save = neue Notiz ablegen, load = Klartext zu cloud_path holen,
// delete = aufräumen wenn Vektor weg ist, list = für Re-Indexing.

export interface CloudAdapter {
  save(noteId: string, text: string): Promise<string>; // returns cloud_path
  load(cloudPath: string): Promise<string>;
  delete(cloudPath: string): Promise<void>;
  list(): Promise<{ path: string; modifiedAt: string }[]>;
}

export interface CloudConfig {
  provider: "gdrive" | "gist";
  // Drive
  gdriveAccessToken?: string;   // kurzlebig, von oauth-cloud refresh'd
  gdriveFolderId?: string;
  // Gist
  githubPat?: string;
  githubGistId?: string;
}

// ─── Google Drive ──────────────────────────────────────────────────────────

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export class GoogleDriveAdapter implements CloudAdapter {
  constructor(private accessToken: string, private folderId: string) {}

  async save(noteId: string, text: string): Promise<string> {
    const boundary = "earth01-" + crypto.randomUUID();
    const metadata = {
      name: `${noteId}.txt`,
      parents: [this.folderId],
      mimeType: "text/plain",
    };
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      text,
      `--${boundary}--`,
    ].join("\r\n");
    const r = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!r.ok) throw new Error(`Drive save: ${r.status} ${await r.text()}`);
    const j = await r.json();
    return `drive:${j.id}`;
  }

  async load(cloudPath: string): Promise<string> {
    const fileId = cloudPath.replace(/^drive:/, "");
    const r = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!r.ok) throw new Error(`Drive load: ${r.status}`);
    return await r.text();
  }

  async delete(cloudPath: string): Promise<void> {
    const fileId = cloudPath.replace(/^drive:/, "");
    await fetch(`${DRIVE_API}/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
  }

  async list(): Promise<{ path: string; modifiedAt: string }[]> {
    const q = encodeURIComponent(`'${this.folderId}' in parents and trashed=false`);
    const r = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id,modifiedTime)`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!r.ok) throw new Error(`Drive list: ${r.status}`);
    const j = await r.json();
    return (j.files ?? []).map((f: any) => ({
      path: `drive:${f.id}`,
      modifiedAt: f.modifiedTime,
    }));
  }
}

// ─── GitHub Gist ───────────────────────────────────────────────────────────

const GIST_API = "https://api.github.com/gists";

export class GitHubGistAdapter implements CloudAdapter {
  constructor(private pat: string, private gistId: string) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.pat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
  }

  async save(noteId: string, text: string): Promise<string> {
    const filename = `${noteId}.txt`;
    const r = await fetch(`${GIST_API}/${this.gistId}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify({ files: { [filename]: { content: text } } }),
    });
    if (!r.ok) throw new Error(`Gist save: ${r.status} ${await r.text()}`);
    return `gist:${filename}`;
  }

  async load(cloudPath: string): Promise<string> {
    const filename = cloudPath.replace(/^gist:/, "");
    const r = await fetch(`${GIST_API}/${this.gistId}`, { headers: this.headers() });
    if (!r.ok) throw new Error(`Gist load: ${r.status}`);
    const j = await r.json();
    const file = j.files?.[filename];
    if (!file) throw new Error(`Gist file fehlt: ${filename}`);
    if (file.truncated && file.raw_url) {
      const raw = await fetch(file.raw_url, { headers: { Authorization: `Bearer ${this.pat}` } });
      return await raw.text();
    }
    return file.content;
  }

  async delete(cloudPath: string): Promise<void> {
    const filename = cloudPath.replace(/^gist:/, "");
    await fetch(`${GIST_API}/${this.gistId}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify({ files: { [filename]: null } }),
    });
  }

  async list(): Promise<{ path: string; modifiedAt: string }[]> {
    const r = await fetch(`${GIST_API}/${this.gistId}`, { headers: this.headers() });
    if (!r.ok) throw new Error(`Gist list: ${r.status}`);
    const j = await r.json();
    const updated = j.updated_at;
    return Object.keys(j.files ?? {}).map((name) => ({
      path: `gist:${name}`,
      modifiedAt: updated,
    }));
  }
}

// ─── Picker ─────────────────────────────────────────────────────────────────

export function buildAdapter(cfg: CloudConfig): CloudAdapter {
  if (cfg.provider === "gdrive") {
    if (!cfg.gdriveAccessToken || !cfg.gdriveFolderId) {
      throw new Error("Drive nicht konfiguriert");
    }
    return new GoogleDriveAdapter(cfg.gdriveAccessToken, cfg.gdriveFolderId);
  }
  if (cfg.provider === "gist") {
    if (!cfg.githubPat || !cfg.githubGistId) {
      throw new Error("Gist nicht konfiguriert");
    }
    return new GitHubGistAdapter(cfg.githubPat, cfg.githubGistId);
  }
  throw new Error(`Provider ${(cfg as any).provider} unbekannt`);
}
