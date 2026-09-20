import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { pipeline } from "stream";
import { constants as zlibConstants, createBrotliCompress, createGzip } from "zlib";

function acceptedCompression(acceptEncoding: string): "br" | "gzip" | null {
  const accepted = new Map(
    acceptEncoding.toLowerCase().split(",").map((part) => {
      const [name, ...params] = part.trim().split(";");
      const q = params.find((param) => param.trim().startsWith("q="));
      return [name, q ? Number(q.trim().slice(2)) : 1] as const;
    }),
  );
  if ((accepted.get("br") ?? 0) > 0) return "br";
  if ((accepted.get("gzip") ?? 0) > 0) return "gzip";
  return null;
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist", "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }
  const assetsPath = path.join(distPath, "assets");

  // The main bundle is several MB. Compress hashed assets in-process because the
  // Ubuntu nginx proxy currently forwards Express responses without compression.
  app.get("/assets/*", (req, res, next) => {
    if (req.headers.range) return next();
    const relativePath = req.path.slice("/assets/".length);
    const filePath = path.resolve(assetsPath, relativePath);
    if (!filePath.startsWith(`${assetsPath}${path.sep}`) || !/\.(?:js|css|json|svg|map)$/i.test(filePath)) {
      return next();
    }
    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return next();
    }
    if (!stat.isFile()) return next();

    const encoding = acceptedCompression(req.get("Accept-Encoding") || "");
    if (!encoding) return next();

    res.type(path.extname(filePath));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Vary", "Accept-Encoding");
    res.setHeader("Content-Encoding", encoding);
    if (req.method === "HEAD") return res.end();

    const compressor = encoding === "br"
      ? createBrotliCompress({
          params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 },
        })
      : createGzip({ level: 6 });
    pipeline(fs.createReadStream(filePath), compressor, res, (error) => {
      if (error && !res.headersSent) next(error);
    });
  });

  app.use(express.static(distPath, {
    maxAge: 0,
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
      if (filePath.startsWith(`${assetsPath}${path.sep}`)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return;
      }
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  }));

  app.use("*", (_req, res, next) => {
    if (_req.originalUrl.startsWith('/api/') || _req.originalUrl.startsWith('/ws/') || _req.originalUrl.startsWith('/udid/')) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
