import { useEffect, useState } from "react";

const REPOSITORY = "thethomaseffect/swedish-practice";
const RELEASES_URL = `https://github.com/${REPOSITORY}/releases/latest`;

type Asset = {
  name: string;
  url: string;
  size: number;
  platform: "Windows" | "macOS" | "Linux";
};

type Release = {
  tag: string;
  url: string;
  assets: Asset[];
};

type Load =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "ready"; release: Release };

export function Downloads() {
  const [load, setLoad] = useState<Load>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    })
      .then(async (response) => {
        if (response.status === 404) {
          setLoad({ status: "empty" });
          return;
        }
        if (!response.ok) {
          setLoad({ status: "error" });
          return;
        }
        const body = (await response.json()) as {
          tag_name?: string;
          html_url?: string;
          assets?: { name?: string; browser_download_url?: string; size?: number }[];
        };
        const assets = (body.assets ?? []).flatMap((asset) => {
          const platform = platformFor(asset.name ?? "");
          if (!platform || !asset.browser_download_url || !asset.name) return [];
          return [{ name: asset.name, url: asset.browser_download_url, size: asset.size ?? 0, platform }];
        });
        setLoad({
          status: "ready",
          release: {
            tag: body.tag_name ?? "latest",
            url: body.html_url ?? RELEASES_URL,
            assets,
          },
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="panel">
      <p className="eyebrow">Desktop</p>
      <h2>Download the app</h2>
      <p className="lead">
        The page you are on is the web app, and it keeps phrases in this browser. The desktop app stores them in a JSON
        file, which is what you want when notes are added from the project folder.
      </p>
      {load.status === "loading" && <p>Looking up the latest release…</p>}
      {load.status === "empty" && (
        <p>No desktop build has been published yet. The web app on this page is ready to use.</p>
      )}
      {load.status === "error" && <p>The latest release could not be loaded. The releases page has the installers.</p>}
      {load.status === "ready" && load.release.assets.length === 0 && (
        <p>Release {load.release.tag} does not have an installer attached yet.</p>
      )}
      {load.status === "ready" && load.release.assets.length > 0 && (
        <ul className="download-list">
          {load.release.assets.map((asset) => (
            <li key={asset.name}>
              <a className="asset" href={asset.url}>
                <span>{asset.platform}</span>
                <span className="muted">
                  {load.release.tag} · {formatSize(asset.size)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <p>
        <a href={RELEASES_URL}>All releases</a>
      </p>
    </section>
  );
}

function platformFor(name: string): Asset["platform"] | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".exe")) return "Windows";
  if (lower.endsWith(".dmg")) return "macOS";
  if (lower.endsWith(".appimage")) return "Linux";
  return null;
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return "download";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
